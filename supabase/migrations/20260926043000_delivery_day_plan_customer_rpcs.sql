-- Customer-safe delivery-day plan catalog, request and read contracts.

ALTER TABLE public.meal_plan_subscriptions
  ADD COLUMN request_idempotency_key UUID;

CREATE UNIQUE INDEX meal_plan_subscriptions_customer_request_key_unique
  ON public.meal_plan_subscriptions(user_id, request_idempotency_key)
  WHERE request_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION private.normalize_plan_weekdays(p_weekdays SMALLINT[])
RETURNS SMALLINT[]
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(day ORDER BY day), '{}'::SMALLINT[])
  FROM (
    SELECT value AS day
    FROM unnest(p_weekdays) AS selected(value)
    WHERE value BETWEEN 1 AND 7
    GROUP BY value
  ) normalized;
$$;

CREATE OR REPLACE FUNCTION private.meal_plan_subscription_document(p_subscription_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'template_code', t.code,
    'plan_name', t.customer_name,
    'delivery_days', t.delivery_days,
    'status', s.status,
    'payment_status', s.payment_status,
    'preferred_start_date', s.preferred_start_date,
    'expected_completion_date', s.expected_completion_date,
    'customer_note', s.customer_note,
    'meal_types', coalesce((
      SELECT jsonb_agg(ms.meal_type ORDER BY CASE ms.meal_type
        WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END)
      FROM public.meal_plan_services ms
      WHERE ms.subscription_id = s.id
    ), '[]'::JSONB),
    'weekdays_by_service', coalesce((
      SELECT jsonb_object_agg(schedule.meal_type, to_jsonb(schedule.days))
      FROM (
        SELECT mw.meal_type, array_agg(mw.iso_weekday ORDER BY mw.iso_weekday) AS days
        FROM public.meal_plan_weekdays mw
        WHERE mw.subscription_id = s.id
        GROUP BY mw.meal_type
      ) schedule
    ), '{}'::JSONB),
    'meals_per_delivery_day', (
      SELECT count(*)::INTEGER FROM public.meal_plan_services ms WHERE ms.subscription_id = s.id
    ),
    'total_meal_occurrences', t.delivery_days * (
      SELECT count(*)::INTEGER FROM public.meal_plan_services ms WHERE ms.subscription_id = s.id
    ),
    'accepted_quote', CASE WHEN q.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', q.id,
      'version', q.version,
      'status', q.status,
      'currency', q.currency,
      'total_amount', q.total_amount,
      'accepted_at', q.accepted_at
    ) END,
    'created_at', s.created_at,
    'updated_at', s.updated_at
  )
  FROM public.meal_plan_subscriptions s
  JOIN public.meal_plan_templates t ON t.id = s.template_id
  LEFT JOIN public.meal_plan_quotes q ON q.id = s.accepted_quote_id
  WHERE s.id = p_subscription_id;
$$;

CREATE OR REPLACE FUNCTION public.get_delivery_day_plan_catalog()
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'code', t.code,
    'name', t.customer_name,
    'description', t.description,
    'delivery_days', t.delivery_days
  ) ORDER BY t.display_order), '[]'::JSONB)
  FROM public.meal_plan_templates t
  WHERE t.is_active;
$$;

CREATE OR REPLACE FUNCTION public.request_delivery_day_plan(
  p_template_code TEXT,
  p_meal_types TEXT[],
  p_weekdays SMALLINT[],
  p_address_id UUID,
  p_preferred_start_date DATE,
  p_request_idempotency_key UUID,
  p_customer_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_customer_access();
  v_template public.meal_plan_templates%ROWTYPE;
  v_meal_types TEXT[] := private.normalize_subscription_meal_types(p_meal_types);
  v_weekdays SMALLINT[] := private.normalize_plan_weekdays(p_weekdays);
  v_subscription_id UUID;
  v_meal_type TEXT;
  v_weekday SMALLINT;
BEGIN
  IF p_request_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A request key is required.' USING ERRCODE = '22023';
  END IF;

  SELECT s.id INTO v_subscription_id
  FROM public.meal_plan_subscriptions s
  WHERE s.user_id = v_actor AND s.request_idempotency_key = p_request_idempotency_key;
  IF FOUND THEN
    RETURN private.meal_plan_subscription_document(v_subscription_id);
  END IF;

  SELECT t.* INTO v_template
  FROM public.meal_plan_templates t
  WHERE t.code = p_template_code AND t.is_active
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This delivery-day plan is not currently available.' USING ERRCODE = '22023';
  END IF;

  IF p_meal_types IS NULL OR cardinality(v_meal_types) NOT BETWEEN 1 AND 3
     OR cardinality(v_meal_types) <> cardinality(p_meal_types) THEN
    RAISE EXCEPTION 'Choose one or more valid meal services.' USING ERRCODE = '22023';
  END IF;
  IF p_weekdays IS NULL OR cardinality(v_weekdays) NOT BETWEEN 1 AND 7
     OR cardinality(v_weekdays) <> cardinality(p_weekdays) THEN
    RAISE EXCEPTION 'Choose one or more valid delivery weekdays.' USING ERRCODE = '22023';
  END IF;
  IF p_preferred_start_date < (now() AT TIME ZONE 'Asia/Kolkata')::DATE
     OR p_preferred_start_date > (now() AT TIME ZONE 'Asia/Kolkata')::DATE + 60 THEN
    RAISE EXCEPTION 'Choose a start date within the next 60 days.' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(p_customer_note, '')) > 500 THEN
    RAISE EXCEPTION 'The note is too long.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.addresses a
    WHERE a.id = p_address_id AND a.user_id = v_actor AND a.is_serviceable
  ) THEN
    RAISE EXCEPTION 'Choose a saved serviceable delivery address.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.meal_plan_subscriptions (
      user_id, address_id, template_id, preferred_start_date, customer_note,
      request_idempotency_key
    ) VALUES (
      v_actor, p_address_id, v_template.id, p_preferred_start_date,
      nullif(btrim(coalesce(p_customer_note, '')), ''), p_request_idempotency_key
    ) RETURNING id INTO v_subscription_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT s.id INTO v_subscription_id
      FROM public.meal_plan_subscriptions s
      WHERE s.user_id = v_actor AND s.request_idempotency_key = p_request_idempotency_key;
      IF v_subscription_id IS NULL THEN
        RAISE EXCEPTION 'You already have an open delivery-day plan request.' USING ERRCODE = '23505';
      END IF;
      RETURN private.meal_plan_subscription_document(v_subscription_id);
  END;

  FOREACH v_meal_type IN ARRAY v_meal_types LOOP
    INSERT INTO public.meal_plan_services (subscription_id, meal_type)
    VALUES (v_subscription_id, v_meal_type);
    FOREACH v_weekday IN ARRAY v_weekdays LOOP
      INSERT INTO public.meal_plan_weekdays (subscription_id, meal_type, iso_weekday)
      VALUES (v_subscription_id, v_meal_type, v_weekday);
    END LOOP;
  END LOOP;

  INSERT INTO private.meal_plan_events (
    subscription_id, actor_id, event_type, next_status, event_data
  ) VALUES (
    v_subscription_id, v_actor, 'customer_requested', 'requested',
    jsonb_build_object(
      'template_code', v_template.code,
      'meal_types', to_jsonb(v_meal_types),
      'weekdays', to_jsonb(v_weekdays)
    )
  );

  RETURN private.meal_plan_subscription_document(v_subscription_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_delivery_day_plans()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_customer_access();
BEGIN
  RETURN (
    SELECT coalesce(jsonb_agg(
      private.meal_plan_subscription_document(s.id) ORDER BY s.created_at DESC
    ), '[]'::JSONB)
    FROM public.meal_plan_subscriptions s
    WHERE s.user_id = v_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION private.normalize_plan_weekdays(SMALLINT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.meal_plan_subscription_document(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_delivery_day_plan_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_delivery_day_plan(TEXT,TEXT[],SMALLINT[],UUID,DATE,UUID,TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_delivery_day_plans() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_delivery_day_plan_catalog() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_delivery_day_plan(TEXT,TEXT[],SMALLINT[],UUID,DATE,UUID,TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_delivery_day_plans() TO authenticated;

COMMENT ON FUNCTION public.request_delivery_day_plan(TEXT,TEXT[],SMALLINT[],UUID,DATE,UUID,TEXT)
  IS 'Creates one idempotent customer request from server-owned plan templates; accepts no price or balance fields.';
