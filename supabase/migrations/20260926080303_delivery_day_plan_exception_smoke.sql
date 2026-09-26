-- Transactional smoke for immutable ledger, service/full-day skips, pause/resume and Kitchen cancellation.
DO $$
DECLARE
  v_admin UUID;
  v_customer UUID;
  v_address UUID;
  v_template UUID;
  v_lunch_meal UUID;
  v_dinner_meal UUID;
  v_subscription UUID;
  v_quote UUID;
  v_menu_day UUID;
  v_start DATE := current_date + 500;
  v_date DATE;
  v_occurrence UUID;
  v_order UUID;
  v_key UUID := gen_random_uuid();
  v_result JSONB;
  v_balance INTEGER;
  v_count INTEGER;
BEGIN
  SELECT role.user_id INTO v_admin
  FROM public.user_roles role
  WHERE role.role = 'admin' ORDER BY role.created_at LIMIT 1;
  SELECT role.user_id, address.id INTO v_customer, v_address
  FROM public.user_roles role
  JOIN public.addresses address ON address.user_id = role.user_id AND address.is_serviceable
  WHERE role.role = 'customer'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles staff
      WHERE staff.user_id = role.user_id
        AND staff.role IN ('admin','kitchen','delivery','corporate')
    )
  ORDER BY role.created_at, address.created_at LIMIT 1;
  SELECT template.id INTO v_template
  FROM public.meal_plan_templates template WHERE template.code = 'starter_7_days';
  SELECT meal.id INTO v_lunch_meal
  FROM public.meals meal
  WHERE meal.is_active AND meal.meal_type IN ('lunch','both')
  ORDER BY (meal.meal_type = 'lunch') DESC, meal.created_at LIMIT 1;
  SELECT meal.id INTO v_dinner_meal
  FROM public.meals meal
  WHERE meal.is_active AND meal.meal_type IN ('dinner','both')
    AND meal.id IS DISTINCT FROM v_lunch_meal
  ORDER BY (meal.meal_type = 'dinner') DESC, meal.created_at LIMIT 1;

  IF v_admin IS NULL OR v_customer IS NULL OR v_address IS NULL OR v_template IS NULL
     OR v_lunch_meal IS NULL OR v_dinner_meal IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.delivery_slots slot
       WHERE slot.meal_type = 'lunch' AND slot.is_active AND slot.max_orders > 0
     ) OR NOT EXISTS (
       SELECT 1 FROM public.delivery_slots slot
       WHERE slot.meal_type = 'dinner' AND slot.is_active AND slot.max_orders > 0
     ) THEN
    RAISE NOTICE 'Skipping exception workflow smoke because required production fixtures are absent.';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.meal_plan_subscriptions subscription
    SET status = 'cancelled', cancelled_at = now()
    WHERE subscription.user_id = v_customer
      AND subscription.status IN ('requested','quoted','accepted','payment_pending','active','paused');

    INSERT INTO public.menu_days(menu_date,is_published)
    VALUES (v_start,true) RETURNING id INTO v_menu_day;
    INSERT INTO public.menu_items(menu_day_id,meal_id,service_meal_types,availability,display_order)
    VALUES
      (v_menu_day,v_lunch_meal,ARRAY['lunch']::TEXT[],true,1),
      (v_menu_day,v_dinner_meal,ARRAY['dinner']::TEXT[],true,2);

    INSERT INTO public.meal_plan_subscriptions(
      user_id,address_id,template_id,status,payment_status,
      preferred_start_date,expected_completion_date,request_idempotency_key
    ) VALUES (
      v_customer,v_address,v_template,'requested','pending',
      v_start,v_start + 10,gen_random_uuid()
    ) RETURNING id INTO v_subscription;
    INSERT INTO public.meal_plan_services(subscription_id,meal_type)
    VALUES (v_subscription,'lunch'),(v_subscription,'dinner');
    INSERT INTO public.meal_plan_weekdays(subscription_id,meal_type,iso_weekday)
    SELECT v_subscription, service.meal_type, weekday
    FROM (VALUES ('lunch'),('dinner')) service(meal_type)
    CROSS JOIN generate_series(1,7) weekday;

    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_admin,'role','authenticated','aal','aal2')::TEXT,TRUE);
    v_result := public.offer_delivery_day_plan_quote(
      v_subscription,jsonb_build_object('lunch',119,'dinner',129),0,0,0,now() + interval '2 days');
    v_quote := (v_result->'current_quote'->>'id')::UUID;
    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_customer,'role','authenticated','aal','aal1')::TEXT,TRUE);
    PERFORM public.respond_delivery_day_plan_quote(v_subscription,v_quote,'accept');
    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_admin,'role','authenticated','aal','aal2')::TEXT,TRUE);
    PERFORM public.verify_and_activate_delivery_day_plan(
      v_subscription,'exception-smoke-' || v_subscription::TEXT,'manual_upi');

    IF (SELECT count(*) FROM public.meal_plan_ledger ledger
        WHERE ledger.subscription_id = v_subscription AND ledger.entry_type = 'credit_granted') <> 2
       OR (SELECT count(*) FROM public.meal_plan_ledger ledger
           WHERE ledger.subscription_id = v_subscription AND ledger.entry_type = 'reserved') <> 2 THEN
      RAISE EXCEPTION 'Initial credits and reservations were not written to the ledger.';
    END IF;

    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_customer,'role','authenticated','aal','aal1')::TEXT,TRUE);
    v_result := public.skip_delivery_day_plan(v_subscription,v_start,NULL,'Travelling',v_key);
    IF (v_result->>'moved_deliveries')::INTEGER <> 2 THEN
      RAISE EXCEPTION 'Full-day skip did not move both services.';
    END IF;
    IF public.skip_delivery_day_plan(v_subscription,v_start,NULL,'Travelling',v_key) <> v_result THEN
      RAISE EXCEPTION 'Full-day skip idempotent replay changed its result.';
    END IF;
    SELECT count(*)::INTEGER INTO v_count
    FROM public.meal_plan_occurrences occurrence
    WHERE occurrence.subscription_id = v_subscription;
    IF v_count <> 16 THEN
      RAISE EXCEPTION 'Full-day skip did not append exactly two replacements.';
    END IF;
    FOR v_balance IN
      SELECT ledger.balance_after
      FROM public.meal_plan_ledger ledger
      WHERE ledger.subscription_id = v_subscription
        AND ledger.id IN (
          SELECT max(latest.id) FROM public.meal_plan_ledger latest
          WHERE latest.subscription_id = v_subscription GROUP BY latest.meal_type
        )
    LOOP
      IF v_balance <> 7 THEN RAISE EXCEPTION 'Skip did not restore reserved entitlement.'; END IF;
    END LOOP;

    SELECT min(occurrence.service_date) INTO v_date
    FROM public.meal_plan_occurrences occurrence
    WHERE occurrence.subscription_id = v_subscription
      AND occurrence.meal_type = 'lunch' AND occurrence.status = 'planned';
    v_result := public.skip_delivery_day_plan(
      v_subscription,v_date,'lunch','Lunch not needed',gen_random_uuid());
    IF (v_result->>'moved_deliveries')::INTEGER <> 1 THEN
      RAISE EXCEPTION 'Service-only skip moved the wrong number of deliveries.';
    END IF;

    SELECT min(occurrence.service_date) INTO v_date
    FROM public.meal_plan_occurrences occurrence
    WHERE occurrence.subscription_id = v_subscription AND occurrence.status = 'planned';
    v_result := public.pause_delivery_day_plan(
      v_subscription,v_date,v_date + 1,'One day pause',gen_random_uuid());
    IF v_result->>'status' <> 'paused'
       OR (SELECT status FROM public.meal_plan_subscriptions WHERE id = v_subscription) <> 'paused' THEN
      RAISE EXCEPTION 'Plan pause did not persist its state.';
    END IF;
    v_result := public.resume_delivery_day_plan(v_subscription,gen_random_uuid());
    IF v_result->>'status' <> 'active' THEN
      RAISE EXCEPTION 'Plan resume did not reactivate the plan.';
    END IF;

    SELECT occurrence.id INTO v_occurrence
    FROM public.meal_plan_occurrences occurrence
    WHERE occurrence.subscription_id = v_subscription
      AND occurrence.meal_type = 'dinner' AND occurrence.status = 'planned'
    ORDER BY occurrence.service_date LIMIT 1;
    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_admin,'role','authenticated','aal','aal2')::TEXT,TRUE);
    v_result := public.cancel_delivery_day_plan_occurrence(
      v_occurrence,'Kitchen equipment unavailable',gen_random_uuid());
    IF v_result->>'status' <> 'kitchen_cancelled'
       OR NOT EXISTS (
         SELECT 1 FROM public.meal_plan_ledger ledger
         WHERE ledger.occurrence_id = v_occurrence AND ledger.entry_type = 'kitchen_cancel_credit'
       ) THEN
      RAISE EXCEPTION 'Kitchen cancellation was not audited.';
    END IF;

    SELECT min(occurrence.service_date) INTO v_date
    FROM public.meal_plan_occurrences occurrence
    WHERE occurrence.subscription_id = v_subscription
      AND occurrence.meal_type = 'lunch' AND occurrence.status = 'planned';
    INSERT INTO public.menu_days(menu_date,is_published)
    VALUES (v_date,true) RETURNING id INTO v_menu_day;
    INSERT INTO public.menu_items(menu_day_id,meal_id,service_meal_types,availability,display_order)
    VALUES (v_menu_day,v_lunch_meal,ARRAY['lunch']::TEXT[],true,1);
    PERFORM public.materialize_delivery_day_plan_orders(v_date,'lunch');
    SELECT orders.id,orders.subscription_occurrence_id INTO v_order,v_occurrence
    FROM public.orders orders
    WHERE orders.subscription_id = v_subscription
      AND orders.order_date = v_date AND orders.meal_type = 'lunch';
    UPDATE public.orders SET status = 'delivered' WHERE id = v_order;
    IF NOT EXISTS (
      SELECT 1 FROM public.meal_plan_occurrences occurrence
      WHERE occurrence.id = v_occurrence AND occurrence.status = 'fulfilled'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.meal_plan_ledger ledger
      WHERE ledger.occurrence_id = v_occurrence AND ledger.entry_type = 'fulfilled'
    ) THEN
      RAISE EXCEPTION 'Delivered order did not resolve the entitlement occurrence.';
    END IF;

    BEGIN
      UPDATE public.meal_plan_ledger SET note = 'tampered'
      WHERE subscription_id = v_subscription;
      RAISE EXCEPTION 'Ledger mutation unexpectedly succeeded.';
    EXCEPTION WHEN SQLSTATE '55000' THEN
      NULL;
    END;

    IF EXISTS (
      SELECT 1
      FROM (
        SELECT ledger.meal_type,
          sum(ledger.quantity) AS calculated,
          (array_agg(ledger.balance_after ORDER BY ledger.id DESC))[1] AS latest
        FROM public.meal_plan_ledger ledger
        WHERE ledger.subscription_id = v_subscription
        GROUP BY ledger.meal_type
      ) balance
      WHERE balance.calculated <> balance.latest OR balance.latest < 0
    ) THEN
      RAISE EXCEPTION 'Ledger entries do not reconcile to their latest balances.';
    END IF;

    RAISE EXCEPTION 'ROLLBACK_EXCEPTION_WORKFLOW_SMOKE' USING ERRCODE = 'PZ006';
  EXCEPTION WHEN SQLSTATE 'PZ006' THEN
    NULL;
  END;
END;
$$;
