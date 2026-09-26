-- Transactional production smoke for the accepted-quote payment activation gate.
DO $$
DECLARE
  v_admin UUID;
  v_customer UUID;
  v_address UUID;
  v_template UUID;
  v_subscription UUID;
  v_quote UUID;
  v_document JSONB;
  v_reference TEXT;
BEGIN
  SELECT r.user_id INTO v_admin FROM public.user_roles r
  WHERE r.role = 'admin' ORDER BY r.created_at LIMIT 1;
  SELECT r.user_id, a.id INTO v_customer, v_address
  FROM public.user_roles r
  JOIN public.addresses a ON a.user_id = r.user_id AND a.is_serviceable
  WHERE r.role = 'customer'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles staff
      WHERE staff.user_id = r.user_id AND staff.role IN ('admin', 'kitchen', 'delivery', 'corporate')
    )
  ORDER BY r.created_at, a.created_at LIMIT 1;
  SELECT t.id INTO v_template FROM public.meal_plan_templates t
  WHERE t.code = 'starter_7_days';
  IF v_admin IS NULL OR v_customer IS NULL OR v_address IS NULL OR v_template IS NULL THEN
    RAISE NOTICE 'Skipping payment smoke because the clean rebuild has no production identities.';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.meal_plan_subscriptions SET status = 'cancelled', cancelled_at = now()
    WHERE user_id = v_customer
      AND status IN ('requested', 'quoted', 'accepted', 'payment_pending', 'active', 'paused');
    INSERT INTO public.meal_plan_subscriptions (
      user_id, address_id, template_id, status, payment_status,
      preferred_start_date, expected_completion_date, request_idempotency_key
    ) VALUES (
      v_customer, v_address, v_template, 'requested', 'pending',
      current_date + 3, current_date + 14, gen_random_uuid()
    ) RETURNING id INTO v_subscription;
    INSERT INTO public.meal_plan_services (subscription_id, meal_type)
    VALUES (v_subscription, 'breakfast');
    INSERT INTO public.meal_plan_weekdays (subscription_id, meal_type, iso_weekday)
    VALUES (v_subscription, 'breakfast', 1), (v_subscription, 'breakfast', 3);

    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::TEXT, TRUE);
    v_document := public.offer_delivery_day_plan_quote(
      v_subscription, jsonb_build_object('breakfast', 59), 0, 0, 0, now() + interval '2 days');
    v_quote := (v_document->'current_quote'->>'id')::UUID;
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_customer, 'role', 'authenticated', 'aal', 'aal1')::TEXT, TRUE);
    PERFORM public.respond_delivery_day_plan_quote(v_subscription, v_quote, 'accept');

    BEGIN
      UPDATE public.meal_plan_subscriptions
      SET status = 'active', payment_status = 'paid', activated_at = now()
      WHERE id = v_subscription;
      RAISE EXCEPTION 'Activation without a verified payment unexpectedly succeeded.';
    EXCEPTION WHEN SQLSTATE '22023' THEN
      NULL;
    END;

    v_reference := 'smoke-' || v_subscription::TEXT;
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::TEXT, TRUE);
    v_document := public.verify_and_activate_delivery_day_plan(
      v_subscription, v_reference, 'manual_upi');
    IF v_document->>'status' <> 'active'
       OR v_document->>'payment_status' <> 'paid'
       OR v_document->'payment'->>'status' <> 'verified'
       OR (v_document->'payment'->>'amount')::NUMERIC <> 413
       OR v_document::TEXT LIKE '%payment_reference%' THEN
      RAISE EXCEPTION 'Verified payment activation smoke assertion failed.';
    END IF;
    RAISE EXCEPTION 'ROLLBACK_PAYMENT_SMOKE' USING ERRCODE = 'PZ002';
  EXCEPTION WHEN SQLSTATE 'PZ002' THEN
    NULL;
  END;
END;
$$;
