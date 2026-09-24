-- Production-safe meal plan intake and manual activation workflow.
-- Online payment is intentionally separate: an admin records the verified quote
-- and confirms payment before a plan can become active.

CREATE TABLE public.meal_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE RESTRICT,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('weekly_7', 'half_month_15', 'monthly_30')),
  plan_name TEXT NOT NULL,
  total_meals INTEGER NOT NULL CHECK (total_meals IN (7, 15, 30)),
  remaining_meals INTEGER NOT NULL CHECK (remaining_meals >= 0 AND remaining_meals <= total_meals),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  preferred_start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'payment_pending', 'active', 'paused', 'completed', 'cancelled', 'rejected')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  quoted_total NUMERIC(10,2) CHECK (quoted_total IS NULL OR quoted_total > 0),
  customer_note TEXT CHECK (customer_note IS NULL OR char_length(customer_note) <= 500),
  admin_note TEXT CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000),
  activated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX meal_subscriptions_one_open_per_customer
  ON public.meal_subscriptions(user_id)
  WHERE status IN ('requested', 'payment_pending', 'active', 'paused');
CREATE INDEX meal_subscriptions_admin_queue_idx ON public.meal_subscriptions(status, created_at DESC);
CREATE INDEX meal_subscriptions_customer_idx ON public.meal_subscriptions(user_id, created_at DESC);

CREATE TABLE private.meal_subscription_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.meal_subscriptions(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meal_subscription_events_subscription_idx
  ON private.meal_subscription_events(subscription_id, created_at DESC);

CREATE TRIGGER meal_subscriptions_updated_at
  BEFORE UPDATE ON public.meal_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.meal_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_subscriptions_customer_read_own
  ON public.meal_subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY meal_subscriptions_admin_read
  ON public.meal_subscriptions FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

REVOKE ALL ON public.meal_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.meal_subscription_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_meal_subscription(
  p_plan_code TEXT,
  p_meal_type TEXT,
  p_address_id UUID,
  p_preferred_start_date DATE,
  p_customer_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_plan_name TEXT;
  v_total_meals INTEGER;
  v_row public.meal_subscriptions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to request a meal plan.' USING ERRCODE = '42501';
  END IF;
  CASE p_plan_code
    WHEN 'weekly_7' THEN v_plan_name := '7-Meal Routine'; v_total_meals := 7;
    WHEN 'half_month_15' THEN v_plan_name := '15-Meal Routine'; v_total_meals := 15;
    WHEN 'monthly_30' THEN v_plan_name := '30-Meal Routine'; v_total_meals := 30;
    ELSE RAISE EXCEPTION 'Choose a valid meal plan.' USING ERRCODE = '22023';
  END CASE;
  IF p_meal_type NOT IN ('breakfast', 'lunch', 'dinner') THEN
    RAISE EXCEPTION 'Choose breakfast, lunch or dinner.' USING ERRCODE = '22023';
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
      meal_type, preferred_start_date, customer_note
    ) VALUES (
      v_actor, p_address_id, p_plan_code, v_plan_name, v_total_meals, v_total_meals,
      p_meal_type, p_preferred_start_date, nullif(btrim(coalesce(p_customer_note, '')), '')
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

CREATE OR REPLACE FUNCTION public.get_my_meal_subscriptions()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'plan_code', s.plan_code,
    'plan_name', s.plan_name,
    'total_meals', s.total_meals,
    'remaining_meals', s.remaining_meals,
    'meal_type', s.meal_type,
    'preferred_start_date', s.preferred_start_date,
    'status', s.status,
    'payment_status', s.payment_status,
    'quoted_total', s.quoted_total,
    'customer_note', s.customer_note,
    'created_at', s.created_at,
    'updated_at', s.updated_at
  ) ORDER BY s.created_at DESC), '[]'::JSONB)
  FROM public.meal_subscriptions s
  WHERE s.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.cancel_my_meal_subscription(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_previous TEXT;
  v_row public.meal_subscriptions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to manage your meal plan.' USING ERRCODE = '42501';
  END IF;
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
        'preferred_start_date', s.preferred_start_date,
        'status', s.status,
        'payment_status', s.payment_status,
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

CREATE OR REPLACE FUNCTION public.manage_meal_subscription(
  p_id UUID,
  p_action TEXT,
  p_quoted_total NUMERIC DEFAULT NULL,
  p_admin_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_access();
  v_previous TEXT;
  v_next TEXT;
BEGIN
  IF char_length(coalesce(p_admin_note, '')) > 1000 THEN
    RAISE EXCEPTION 'The admin note is too long.' USING ERRCODE = '22023';
  END IF;
  SELECT s.status INTO v_previous FROM public.meal_subscriptions s
    WHERE s.id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meal plan request was not found.' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'quote' THEN
    IF v_previous <> 'requested' OR p_quoted_total IS NULL OR p_quoted_total <= 0 THEN
      RAISE EXCEPTION 'A positive quote is required for a new request.' USING ERRCODE = '22023';
    END IF;
    v_next := 'payment_pending';
    UPDATE public.meal_subscriptions s SET status=v_next, quoted_total=p_quoted_total,
      payment_status='pending', admin_note=nullif(btrim(coalesce(p_admin_note,'')), '') WHERE s.id=p_id;
  ELSIF p_action = 'activate' THEN
    IF v_previous <> 'payment_pending' THEN
      RAISE EXCEPTION 'Request payment before activating this plan.' USING ERRCODE = '22023';
    END IF;
    v_next := 'active';
    UPDATE public.meal_subscriptions s SET status=v_next, payment_status='paid', activated_at=now(),
      admin_note=coalesce(nullif(btrim(coalesce(p_admin_note,'')), ''), s.admin_note) WHERE s.id=p_id;
  ELSIF p_action = 'pause' THEN
    IF v_previous <> 'active' THEN RAISE EXCEPTION 'Only an active plan can be paused.' USING ERRCODE='22023'; END IF;
    v_next := 'paused';
    UPDATE public.meal_subscriptions s SET status=v_next, admin_note=coalesce(nullif(btrim(coalesce(p_admin_note,'')), ''), s.admin_note) WHERE s.id=p_id;
  ELSIF p_action = 'resume' THEN
    IF v_previous <> 'paused' THEN RAISE EXCEPTION 'Only a paused plan can be resumed.' USING ERRCODE='22023'; END IF;
    v_next := 'active';
    UPDATE public.meal_subscriptions s SET status=v_next, admin_note=coalesce(nullif(btrim(coalesce(p_admin_note,'')), ''), s.admin_note) WHERE s.id=p_id;
  ELSIF p_action IN ('reject', 'cancel', 'complete') THEN
    v_next := CASE p_action WHEN 'reject' THEN 'rejected' WHEN 'cancel' THEN 'cancelled' ELSE 'completed' END;
    UPDATE public.meal_subscriptions s SET status=v_next,
      cancelled_at=CASE WHEN v_next IN ('rejected','cancelled') THEN now() ELSE s.cancelled_at END,
      admin_note=coalesce(nullif(btrim(coalesce(p_admin_note,'')), ''), s.admin_note) WHERE s.id=p_id;
  ELSE
    RAISE EXCEPTION 'Choose a valid subscription action.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.meal_subscription_events
    (subscription_id, actor_id, event_type, previous_status, next_status, note)
    VALUES (p_id, v_actor, p_action, v_previous, v_next, nullif(btrim(coalesce(p_admin_note,'')), ''));
  RETURN public.get_subscription_management();
END;
$$;

REVOKE ALL ON FUNCTION public.request_meal_subscription(TEXT,TEXT,UUID,DATE,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_meal_subscriptions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_my_meal_subscription(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_subscription_management() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manage_meal_subscription(UUID,TEXT,NUMERIC,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_meal_subscription(TEXT,TEXT,UUID,DATE,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_meal_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_meal_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_management() TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_meal_subscription(UUID,TEXT,NUMERIC,TEXT) TO authenticated;
