-- Transactional production smoke: exercise quote, acceptance and immutability,
-- then roll every fixture change back inside a caught subtransaction.
DO $$
DECLARE
  v_admin UUID;
  v_customer UUID;
  v_address UUID;
  v_template UUID;
  v_subscription UUID;
  v_quote UUID;
  v_document JSONB;
BEGIN
  SELECT r.user_id INTO v_admin
  FROM public.user_roles r WHERE r.role = 'admin'
  ORDER BY r.created_at LIMIT 1;
  SELECT r.user_id, a.id INTO v_customer, v_address
  FROM public.user_roles r
  JOIN public.addresses a ON a.user_id = r.user_id AND a.is_serviceable
  WHERE r.role = 'customer'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles staff
      WHERE staff.user_id = r.user_id AND staff.role IN ('admin', 'kitchen', 'delivery', 'corporate')
    )
  ORDER BY r.created_at, a.created_at LIMIT 1;
  SELECT t.id INTO v_template
  FROM public.meal_plan_templates t WHERE t.code = 'regular_15_days';

  IF v_admin IS NULL OR v_customer IS NULL OR v_address IS NULL OR v_template IS NULL THEN
    RAISE EXCEPTION 'Quote smoke prerequisites are missing.';
  END IF;

  BEGIN
    UPDATE public.meal_plan_subscriptions
    SET status = 'cancelled', cancelled_at = now()
    WHERE user_id = v_customer
      AND status IN ('requested', 'quoted', 'accepted', 'payment_pending', 'active', 'paused');

    INSERT INTO public.meal_plan_subscriptions (
      user_id, address_id, template_id, status, payment_status,
      preferred_start_date, expected_completion_date, request_idempotency_key
    ) VALUES (
      v_customer, v_address, v_template, 'requested', 'pending',
      current_date + 3, current_date + 35, gen_random_uuid()
    ) RETURNING id INTO v_subscription;
    INSERT INTO public.meal_plan_services (subscription_id, meal_type)
    VALUES (v_subscription, 'breakfast'), (v_subscription, 'lunch');
    INSERT INTO public.meal_plan_weekdays (subscription_id, meal_type, iso_weekday)
    VALUES
      (v_subscription, 'breakfast', 1), (v_subscription, 'breakfast', 3),
      (v_subscription, 'lunch', 1), (v_subscription, 'lunch', 3);

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::TEXT,
      TRUE
    );
    v_document := public.offer_delivery_day_plan_quote(
      v_subscription,
      jsonb_build_object('breakfast', 59, 'lunch', 119),
      100, 50, 10, now() + interval '2 days'
    );
    v_quote := (v_document->'current_quote'->>'id')::UUID;
    IF v_document->>'status' <> 'quoted'
       OR (v_document->'current_quote'->>'subtotal_amount')::NUMERIC <> 2670
       OR (v_document->'current_quote'->>'total_amount')::NUMERIC <> 2730
       OR jsonb_array_length(v_document->'current_quote'->'items') <> 5 THEN
      RAISE EXCEPTION 'Server-calculated quote smoke assertion failed.';
    END IF;

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_customer, 'role', 'authenticated', 'aal', 'aal1')::TEXT,
      TRUE
    );
    v_document := public.respond_delivery_day_plan_quote(v_subscription, v_quote, 'accept');
    IF v_document->>'status' <> 'accepted'
       OR v_document->>'payment_status' <> 'pending'
       OR v_document->'accepted_quote'->>'status' <> 'accepted'
       OR EXISTS (
         SELECT 1 FROM public.meal_plan_services ms
         WHERE ms.subscription_id = v_subscription AND ms.locked_unit_price IS NULL
       ) THEN
      RAISE EXCEPTION 'Customer quote acceptance smoke assertion failed.';
    END IF;

    BEGIN
      UPDATE public.meal_plan_quotes SET total_amount = total_amount + 1 WHERE id = v_quote;
      RAISE EXCEPTION 'Immutable quote mutation unexpectedly succeeded.';
    EXCEPTION WHEN SQLSTATE '55000' THEN
      NULL;
    END;

    RAISE EXCEPTION 'ROLLBACK_QUOTE_SMOKE' USING ERRCODE = 'PZ001';
  EXCEPTION WHEN SQLSTATE 'PZ001' THEN
    NULL;
  END;
END;
$$;
