ALTER TABLE public.meal_subscriptions
  ADD COLUMN payment_reference TEXT;

ALTER TABLE public.meal_subscriptions
  ADD CONSTRAINT meal_subscriptions_paid_reference_required
  CHECK (
    payment_status <> 'paid'
    OR (payment_reference IS NOT NULL AND char_length(btrim(payment_reference)) BETWEEN 3 AND 120)
  );

CREATE UNIQUE INDEX meal_subscriptions_payment_reference_unique
  ON public.meal_subscriptions(payment_reference)
  WHERE payment_reference IS NOT NULL;

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

DROP FUNCTION public.manage_meal_subscription(UUID,TEXT,NUMERIC,TEXT);

CREATE FUNCTION public.manage_meal_subscription(
  p_id UUID,
  p_action TEXT,
  p_quoted_total NUMERIC DEFAULT NULL,
  p_admin_note TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL
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
      payment_status='pending', payment_reference=NULL,
      admin_note=nullif(btrim(coalesce(p_admin_note,'')), '') WHERE s.id=p_id;
  ELSIF p_action = 'activate' THEN
    IF v_previous <> 'payment_pending' THEN
      RAISE EXCEPTION 'Request payment before activating this plan.' USING ERRCODE = '22023';
    END IF;
    IF char_length(btrim(coalesce(p_payment_reference,''))) NOT BETWEEN 3 AND 120 THEN
      RAISE EXCEPTION 'Add the verified payment reference before activation.' USING ERRCODE = '22023';
    END IF;
    v_next := 'active';
    UPDATE public.meal_subscriptions s SET status=v_next, payment_status='paid', activated_at=now(),
      payment_reference=btrim(p_payment_reference),
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
    IF p_action = 'reject' AND v_previous NOT IN ('requested','payment_pending') THEN
      RAISE EXCEPTION 'Only a pending request can be rejected.' USING ERRCODE='22023';
    END IF;
    IF p_action = 'cancel' AND v_previous NOT IN ('requested','payment_pending','active','paused') THEN
      RAISE EXCEPTION 'This plan cannot be cancelled from its current status.' USING ERRCODE='22023';
    END IF;
    IF p_action = 'complete' AND v_previous <> 'active' THEN
      RAISE EXCEPTION 'Only an active plan can be completed.' USING ERRCODE='22023';
    END IF;
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

REVOKE ALL ON FUNCTION public.manage_meal_subscription(UUID,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_meal_subscription(UUID,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;
