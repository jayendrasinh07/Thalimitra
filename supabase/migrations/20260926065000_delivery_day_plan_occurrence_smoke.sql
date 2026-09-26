-- Transactional smoke for blackout-aware, pause-aware, idempotent occurrence generation.
DO $$
DECLARE
  v_admin UUID;
  v_customer UUID;
  v_address UUID;
  v_template UUID;
  v_subscription UUID;
  v_quote UUID;
  v_start_date DATE := current_date + 3;
  v_closed_date DATE := current_date + 4;
  v_paused_date DATE := current_date + 5;
  v_document JSONB;
  v_count INTEGER;
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
    RAISE NOTICE 'Skipping occurrence smoke because the clean rebuild has no production identities.';
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
      v_start_date, v_start_date + 14, gen_random_uuid()
    ) RETURNING id INTO v_subscription;
    INSERT INTO public.meal_plan_services (subscription_id, meal_type)
    VALUES (v_subscription, 'breakfast'), (v_subscription, 'lunch');
    INSERT INTO public.meal_plan_weekdays (subscription_id, meal_type, iso_weekday)
    SELECT v_subscription, service.meal_type, weekday.iso_weekday
    FROM (VALUES ('breakfast'), ('lunch')) AS service(meal_type)
    CROSS JOIN generate_series(1, 7) AS weekday(iso_weekday);
    INSERT INTO public.meal_plan_service_blackouts (service_date, meal_type, reason, created_by)
    VALUES (v_closed_date, 'all', 'Occurrence smoke closure', v_admin);
    INSERT INTO public.meal_plan_pause_days (subscription_id, service_date, meal_type, reason)
    VALUES (v_subscription, v_paused_date, 'all', 'Occurrence smoke pause');

    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::TEXT, TRUE);
    v_document := public.offer_delivery_day_plan_quote(
      v_subscription, jsonb_build_object('breakfast', 59, 'lunch', 119),
      0, 0, 0, now() + interval '2 days');
    v_quote := (v_document->'current_quote'->>'id')::UUID;
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_customer, 'role', 'authenticated', 'aal', 'aal1')::TEXT, TRUE);
    PERFORM public.respond_delivery_day_plan_quote(v_subscription, v_quote, 'accept');
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::TEXT, TRUE);
    PERFORM public.verify_and_activate_delivery_day_plan(
      v_subscription, 'occurrence-smoke-' || v_subscription::TEXT, 'manual_upi');

    SELECT count(*)::INTEGER INTO v_count
    FROM public.meal_plan_occurrences occurrence
    WHERE occurrence.subscription_id = v_subscription;
    IF v_count <> 14
       OR EXISTS (
         SELECT 1 FROM public.meal_plan_occurrences occurrence
         WHERE occurrence.subscription_id = v_subscription
           AND occurrence.service_date IN (v_closed_date, v_paused_date)
       )
       OR EXISTS (
         SELECT occurrence.meal_type
         FROM public.meal_plan_occurrences occurrence
         WHERE occurrence.subscription_id = v_subscription
         GROUP BY occurrence.meal_type HAVING count(*) <> 7
       ) THEN
      RAISE EXCEPTION 'Occurrence schedule count or exclusion assertion failed.';
    END IF;
    IF private.generate_meal_plan_occurrences(v_subscription) <> 0 THEN
      RAISE EXCEPTION 'Idempotent occurrence generation inserted duplicates.';
    END IF;
    SELECT count(*)::INTEGER INTO v_count
    FROM public.meal_plan_occurrences occurrence
    WHERE occurrence.subscription_id = v_subscription;
    IF v_count <> 14 THEN
      RAISE EXCEPTION 'Idempotent occurrence count changed.';
    END IF;

    UPDATE public.meal_plan_subscriptions
    SET status = 'paused', paused_at = now()
    WHERE id = v_subscription;
    BEGIN
      PERFORM private.generate_meal_plan_occurrences(v_subscription);
      RAISE EXCEPTION 'Paused plan unexpectedly generated occurrences.';
    EXCEPTION WHEN SQLSTATE '22023' THEN
      NULL;
    END;

    RAISE EXCEPTION 'ROLLBACK_OCCURRENCE_SMOKE' USING ERRCODE = 'PZ004';
  EXCEPTION WHEN SQLSTATE 'PZ004' THEN
    NULL;
  END;
END;
$$;
