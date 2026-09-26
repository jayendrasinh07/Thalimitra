-- Defense-in-depth validation for delivery-day requests after authoritative preview rollout.

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
  v_preview JSONB;
  v_subscription_id UUID;
  v_meal_type TEXT;
  v_weekday SMALLINT;
BEGIN
  IF p_request_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A request key is required.' USING ERRCODE = '22023';
  END IF;

  SELECT subscription.id INTO v_subscription_id
  FROM public.meal_plan_subscriptions subscription
  WHERE subscription.user_id = v_actor
    AND subscription.request_idempotency_key = p_request_idempotency_key;
  IF FOUND THEN
    RETURN private.meal_plan_subscription_document(v_subscription_id);
  END IF;

  IF char_length(coalesce(p_customer_note, '')) > 500 THEN
    RAISE EXCEPTION 'The note is too long.' USING ERRCODE = '22023';
  END IF;
  IF p_meal_types IS NULL OR cardinality(v_meal_types) NOT BETWEEN 1 AND 3
     OR cardinality(v_meal_types) <> cardinality(p_meal_types) THEN
    RAISE EXCEPTION 'Choose one or more valid meal services.' USING ERRCODE = '22023';
  END IF;
  IF p_weekdays IS NULL OR cardinality(v_weekdays) NOT BETWEEN 1 AND 7
     OR cardinality(v_weekdays) <> cardinality(p_weekdays) THEN
    RAISE EXCEPTION 'Choose one or more valid delivery weekdays.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.addresses a
    WHERE a.id = p_address_id AND a.user_id = v_actor AND a.is_serviceable
  ) THEN
    RAISE EXCEPTION 'Choose a saved serviceable delivery address.' USING ERRCODE = '22023';
  END IF;

  v_preview := public.preview_delivery_day_plan(
    p_template_code,
    p_meal_types,
    p_weekdays,
    p_address_id,
    p_preferred_start_date
  );

  SELECT template.* INTO v_template
  FROM public.meal_plan_templates template
  WHERE template.code = p_template_code AND template.is_active
  FOR SHARE;

  BEGIN
    INSERT INTO public.meal_plan_subscriptions (
      user_id, address_id, template_id, preferred_start_date,
      expected_completion_date, customer_note, request_idempotency_key
    ) VALUES (
      v_actor, p_address_id, v_template.id, p_preferred_start_date,
      (v_preview->>'expected_completion_date')::DATE,
      nullif(btrim(coalesce(p_customer_note, '')), ''), p_request_idempotency_key
    ) RETURNING id INTO v_subscription_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT subscription.id INTO v_subscription_id
      FROM public.meal_plan_subscriptions subscription
      WHERE subscription.user_id = v_actor
        AND subscription.request_idempotency_key = p_request_idempotency_key;
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
      'weekdays', to_jsonb(v_weekdays),
      'preview', v_preview
    )
  );

  RETURN private.meal_plan_subscription_document(v_subscription_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_delivery_day_plan(TEXT,TEXT[],SMALLINT[],UUID,DATE,UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_delivery_day_plan(TEXT,TEXT[],SMALLINT[],UUID,DATE,UUID,TEXT) TO authenticated;

COMMENT ON FUNCTION public.request_delivery_day_plan(TEXT,TEXT[],SMALLINT[],UUID,DATE,UUID,TEXT)
  IS 'Creates one idempotent customer request from server-owned plan templates; accepts no price or balance fields.';
