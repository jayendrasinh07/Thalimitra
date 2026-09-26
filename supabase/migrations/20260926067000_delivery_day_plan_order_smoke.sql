-- Transactional smoke for occurrence-to-order linkage, Kitchen visibility and capacity idempotency.
DO $$
DECLARE
  v_admin UUID;
  v_customer UUID;
  v_address UUID;
  v_template UUID;
  v_meal UUID;
  v_menu_day UUID;
  v_subscription UUID;
  v_quote UUID;
  v_service_date DATE := current_date + 400;
  v_document JSONB;
  v_queue JSONB;
  v_order UUID;
  v_occurrence UUID;
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
  SELECT meal.id INTO v_meal FROM public.meals meal
  WHERE meal.is_active AND meal.meal_type IN ('lunch', 'both')
  ORDER BY meal.created_at, meal.id LIMIT 1;
  IF v_admin IS NULL OR v_customer IS NULL OR v_address IS NULL OR v_template IS NULL
     OR v_meal IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.delivery_slots slot
       WHERE slot.meal_type = 'lunch' AND slot.is_active AND slot.max_orders > 0
     ) THEN
    RAISE NOTICE 'Skipping plan order smoke because the clean rebuild lacks production identities, meal, or slot.';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.meal_plan_subscriptions SET status = 'cancelled', cancelled_at = now()
    WHERE user_id = v_customer
      AND status IN ('requested', 'quoted', 'accepted', 'payment_pending', 'active', 'paused');
    INSERT INTO public.menu_days(menu_date, is_published)
    VALUES (v_service_date, true)
    RETURNING id INTO v_menu_day;
    INSERT INTO public.menu_items(
      menu_day_id, meal_id, service_meal_types, availability, display_order
    ) VALUES (v_menu_day, v_meal, ARRAY['lunch']::TEXT[], true, 1);
    INSERT INTO public.meal_plan_subscriptions (
      user_id, address_id, template_id, status, payment_status,
      preferred_start_date, expected_completion_date, request_idempotency_key
    ) VALUES (
      v_customer, v_address, v_template, 'requested', 'pending',
      v_service_date, v_service_date + 10, gen_random_uuid()
    ) RETURNING id INTO v_subscription;
    INSERT INTO public.meal_plan_services(subscription_id, meal_type)
    VALUES (v_subscription, 'lunch');
    INSERT INTO public.meal_plan_weekdays(subscription_id, meal_type, iso_weekday)
    SELECT v_subscription, 'lunch', weekday
    FROM generate_series(1, 7) weekday;

    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::TEXT, TRUE);
    v_document := public.offer_delivery_day_plan_quote(
      v_subscription, jsonb_build_object('lunch', 119), 0, 0, 0, now() + interval '2 days');
    v_quote := (v_document->'current_quote'->>'id')::UUID;
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_customer, 'role', 'authenticated', 'aal', 'aal1')::TEXT, TRUE);
    PERFORM public.respond_delivery_day_plan_quote(v_subscription, v_quote, 'accept');
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::TEXT, TRUE);
    PERFORM public.verify_and_activate_delivery_day_plan(
      v_subscription, 'plan-order-smoke-' || v_subscription::TEXT, 'manual_upi');

    SELECT orders.id, orders.subscription_occurrence_id
      INTO v_order, v_occurrence
    FROM public.orders orders
    WHERE orders.subscription_id = v_subscription
      AND orders.order_date = v_service_date
      AND orders.meal_type = 'lunch';
    IF v_order IS NULL OR v_occurrence IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.meal_plan_occurrences occurrence
         WHERE occurrence.id = v_occurrence
           AND occurrence.subscription_id = v_subscription
           AND occurrence.status = 'order_created'
       )
       OR NOT EXISTS (
         SELECT 1 FROM public.order_items item
         WHERE item.order_id = v_order AND item.quantity = 1 AND item.unit_price = 119
       ) THEN
      RAISE EXCEPTION 'Plan occurrence did not create one linked paid order.';
    END IF;

    v_document := public.materialize_delivery_day_plan_orders(v_service_date, 'lunch');
    SELECT count(*)::INTEGER INTO v_count
    FROM public.orders orders
    WHERE orders.subscription_occurrence_id = v_occurrence;
    IF v_count <> 1
       OR (v_document->>'created_orders')::INTEGER <> 0
       OR (v_document->>'existing_orders')::INTEGER <> 1 THEN
      RAISE EXCEPTION 'Plan order materialization was not idempotent.';
    END IF;

    v_queue := public.get_kitchen_orders(v_service_date, 'lunch');
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_queue) queue_order
      WHERE queue_order->>'id' = v_order::TEXT
    ) THEN
      RAISE EXCEPTION 'The generated plan order is missing from the Kitchen queue.';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.delivery_slots slot
      JOIN public.orders orders ON orders.delivery_slot_id = slot.id
      JOIN public.order_items item ON item.order_id = orders.id
      WHERE orders.id = v_order AND item.quantity = 1
    ) THEN
      RAISE EXCEPTION 'The generated plan order did not consume slot capacity.';
    END IF;

    RAISE EXCEPTION 'ROLLBACK_PLAN_ORDER_SMOKE' USING ERRCODE = 'PZ005';
  EXCEPTION WHEN SQLSTATE 'PZ005' THEN
    NULL;
  END;
END;
$$;
