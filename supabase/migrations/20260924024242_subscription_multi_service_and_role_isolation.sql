-- Keep customer and Operations identities mutually exclusive, and allow a
-- subscription to cover any combination of Breakfast, Lunch and Dinner.

CREATE OR REPLACE FUNCTION private.normalize_subscription_meal_types(p_meal_types TEXT[])
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(item.meal_type ORDER BY item.sort_order), '{}'::TEXT[])
  FROM (
    SELECT value AS meal_type,
      min(CASE value WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 END) AS sort_order
    FROM unnest(p_meal_types) AS selected(value)
    WHERE value IN ('breakfast', 'lunch', 'dinner')
    GROUP BY value
  ) AS item;
$$;

CREATE OR REPLACE FUNCTION private.require_customer_access()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in with a customer account.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = v_actor AND r.role = 'customer'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = v_actor AND r.role IN ('admin', 'kitchen', 'delivery', 'corporate')
  ) THEN
    RAISE EXCEPTION 'Operations accounts cannot use customer ordering.' USING ERRCODE = '42501';
  END IF;
  RETURN v_actor;
END;
$$;

REVOKE ALL ON FUNCTION private.normalize_subscription_meal_types(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.require_customer_access() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_user_role_separation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role = 'customer' THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = NEW.user_id
        AND r.role IN ('admin', 'kitchen', 'delivery', 'corporate')
    ) THEN
      DELETE FROM public.user_roles r
      WHERE r.user_id = NEW.user_id AND r.role = 'customer';
    END IF;
  ELSE
    DELETE FROM public.user_roles r
    WHERE r.user_id = NEW.user_id AND r.role = 'customer';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_user_role_separation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_user_role_separation ON public.user_roles;
CREATE TRIGGER enforce_user_role_separation
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION private.enforce_user_role_separation();

-- Remove the legacy customer role from every existing Operations identity.
DELETE FROM public.user_roles customer_role
USING public.user_roles staff_role
WHERE customer_role.user_id = staff_role.user_id
  AND customer_role.role = 'customer'
  AND staff_role.role IN ('admin', 'kitchen', 'delivery', 'corporate');

ALTER TABLE public.meal_subscriptions
  ADD COLUMN meal_types TEXT[];

UPDATE public.meal_subscriptions
SET meal_types = ARRAY[meal_type];

ALTER TABLE public.meal_subscriptions
  ALTER COLUMN meal_types SET NOT NULL,
  ADD CONSTRAINT meal_subscriptions_meal_types_valid
    CHECK (
      cardinality(meal_types) BETWEEN 1 AND 3
      AND meal_types = private.normalize_subscription_meal_types(meal_types)
      AND meal_type = meal_types[1]
    );

CREATE OR REPLACE FUNCTION public.request_meal_subscription(
  p_plan_code TEXT,
  p_meal_types TEXT[],
  p_address_id UUID,
  p_preferred_start_date DATE,
  p_customer_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_customer_access();
  v_plan_name TEXT;
  v_total_meals INTEGER;
  v_meal_types TEXT[] := private.normalize_subscription_meal_types(p_meal_types);
  v_row public.meal_subscriptions%ROWTYPE;
BEGIN
  CASE p_plan_code
    WHEN 'weekly_7' THEN v_plan_name := '7-Meal Routine'; v_total_meals := 7;
    WHEN 'half_month_15' THEN v_plan_name := '15-Meal Routine'; v_total_meals := 15;
    WHEN 'monthly_30' THEN v_plan_name := '30-Meal Routine'; v_total_meals := 30;
    ELSE RAISE EXCEPTION 'Choose a valid meal plan.' USING ERRCODE = '22023';
  END CASE;
  IF p_meal_types IS NULL OR cardinality(v_meal_types) NOT BETWEEN 1 AND 3
     OR cardinality(v_meal_types) <> cardinality(p_meal_types) THEN
    RAISE EXCEPTION 'Choose one or more valid meal services.' USING ERRCODE = '22023';
  END IF;
  IF p_preferred_start_date < (now() AT TIME ZONE 'Asia/Kolkata')::DATE THEN
    RAISE EXCEPTION 'Choose today or a future start date.' USING ERRCODE = '22023';
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
    INSERT INTO public.meal_subscriptions (
      user_id, address_id, plan_code, plan_name, total_meals, remaining_meals,
      meal_type, meal_types, preferred_start_date, customer_note
    ) VALUES (
      v_actor, p_address_id, p_plan_code, v_plan_name, v_total_meals, v_total_meals,
      v_meal_types[1], v_meal_types, p_preferred_start_date,
      nullif(btrim(coalesce(p_customer_note, '')), '')
    ) RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You already have an open meal plan request.' USING ERRCODE = '23505';
  END;

  INSERT INTO private.meal_subscription_events (
    subscription_id, actor_id, event_type, next_status, note
  ) VALUES (v_row.id, v_actor, 'requested', v_row.status, v_row.customer_note);

  RETURN to_jsonb(v_row) - 'user_id';
END;
$$;

-- Backward-compatible entry point for a briefly deployed single-service client.
CREATE OR REPLACE FUNCTION public.request_meal_subscription(
  p_plan_code TEXT,
  p_meal_type TEXT,
  p_address_id UUID,
  p_preferred_start_date DATE,
  p_customer_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.request_meal_subscription(
    p_plan_code,
    ARRAY[p_meal_type],
    p_address_id,
    p_preferred_start_date,
    p_customer_note
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_meal_subscriptions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_customer_access();
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'plan_code', s.plan_code,
      'plan_name', s.plan_name,
      'total_meals', s.total_meals,
      'remaining_meals', s.remaining_meals,
      'meal_type', s.meal_type,
      'meal_types', s.meal_types,
      'preferred_start_date', s.preferred_start_date,
      'status', s.status,
      'payment_status', s.payment_status,
      'quoted_total', s.quoted_total,
      'customer_note', s.customer_note,
      'created_at', s.created_at,
      'updated_at', s.updated_at
    ) ORDER BY s.created_at DESC), '[]'::JSONB)
    FROM public.meal_subscriptions s
    WHERE s.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_my_meal_subscription(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_customer_access();
  v_previous TEXT;
  v_row public.meal_subscriptions%ROWTYPE;
BEGIN
  SELECT s.status INTO v_previous FROM public.meal_subscriptions s
    WHERE s.id = p_id AND s.user_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meal plan request was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_previous NOT IN ('requested', 'payment_pending') THEN
    RAISE EXCEPTION 'Contact support to change an active meal plan.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.meal_subscriptions s SET status = 'cancelled', cancelled_at = now()
    WHERE s.id = p_id RETURNING * INTO v_row;
  INSERT INTO private.meal_subscription_events
    (subscription_id, actor_id, event_type, previous_status, next_status)
    VALUES (p_id, v_actor, 'customer_cancelled', v_previous, 'cancelled');
  RETURN to_jsonb(v_row) - 'user_id';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_subscription_management()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_admin_access();
  RETURN jsonb_build_object(
    'subscriptions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'customer_name', p.full_name,
        'customer_email', p.email,
        'customer_phone', p.phone,
        'address', concat_ws(', ', nullif(a.house_flat_number,''), nullif(a.building_name,''), nullif(a.street,''), nullif(a.area,''), nullif(a.sector,''), nullif(a.pincode,'')),
        'plan_code', s.plan_code,
        'plan_name', s.plan_name,
        'total_meals', s.total_meals,
        'remaining_meals', s.remaining_meals,
        'meal_type', s.meal_type,
        'meal_types', s.meal_types,
        'preferred_start_date', s.preferred_start_date,
        'status', s.status,
        'payment_status', s.payment_status,
        'payment_reference', s.payment_reference,
        'quoted_total', s.quoted_total,
        'customer_note', s.customer_note,
        'admin_note', s.admin_note,
        'created_at', s.created_at,
        'updated_at', s.updated_at
      ) ORDER BY
        CASE s.status WHEN 'requested' THEN 0 WHEN 'payment_pending' THEN 1 WHEN 'active' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END,
        s.created_at DESC)
      FROM public.meal_subscriptions s
      JOIN public.profiles p ON p.id = s.user_id
      JOIN public.addresses a ON a.id = s.address_id
    ), '[]'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_customer_order_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() THEN
    PERFORM private.require_customer_access();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_customer_order_actor() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_customer_order_actor ON public.orders;
CREATE TRIGGER enforce_customer_order_actor
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.enforce_customer_order_actor();

REVOKE ALL ON FUNCTION public.request_meal_subscription(TEXT,TEXT[],UUID,DATE,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_meal_subscription(TEXT,TEXT,UUID,DATE,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_meal_subscriptions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_my_meal_subscription(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_meal_subscription(TEXT,TEXT[],UUID,DATE,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_meal_subscription(TEXT,TEXT,UUID,DATE,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_meal_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_meal_subscription(UUID) TO authenticated;
