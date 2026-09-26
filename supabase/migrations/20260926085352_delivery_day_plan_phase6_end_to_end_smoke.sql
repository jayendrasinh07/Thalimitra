-- Transactional 7-day journey: customer request -> admin quote -> customer
-- acceptance -> verified payment -> entitlement use -> automatic completion.
DO $$
DECLARE
  v_admin UUID;
  v_customer UUID;
  v_address UUID;
  v_subscription UUID;
  v_quote UUID;
  v_result JSONB;
  v_start DATE := current_date + 2;
BEGIN
  SELECT role.user_id INTO v_admin FROM public.user_roles role
  WHERE role.role='admin' ORDER BY role.created_at LIMIT 1;
  SELECT role.user_id,address.id INTO v_customer,v_address
  FROM public.user_roles role
  JOIN public.addresses address ON address.user_id=role.user_id AND address.is_serviceable
  WHERE role.role='customer' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles staff WHERE staff.user_id=role.user_id
      AND staff.role IN ('admin','kitchen','delivery','corporate')
  ) ORDER BY role.created_at,address.created_at LIMIT 1;
  IF v_admin IS NULL OR v_customer IS NULL OR v_address IS NULL THEN
    RAISE NOTICE 'Skipping Phase 6 journey smoke because required fixtures are absent.';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.meal_plan_subscriptions subscription SET status='cancelled',cancelled_at=now()
    WHERE subscription.user_id=v_customer
      AND subscription.status IN ('requested','quoted','accepted','payment_pending','active','paused');
    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_customer,'role','authenticated','aal','aal1')::TEXT,TRUE);
    v_result := public.request_delivery_day_plan(
      'starter_7_days',ARRAY['lunch']::TEXT[],ARRAY[1,2,3,4,5,6,7]::SMALLINT[],
      v_address,v_start,gen_random_uuid(),'Phase 6 transactional journey'
    );
    v_subscription := (v_result->>'id')::UUID;

    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_admin,'role','authenticated','aal','aal2')::TEXT,TRUE);
    v_result := public.offer_delivery_day_plan_quote(
      v_subscription,jsonb_build_object('lunch',119),0,0,0,now()+interval '2 days');
    v_quote := (v_result->'current_quote'->>'id')::UUID;
    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_customer,'role','authenticated','aal','aal1')::TEXT,TRUE);
    PERFORM public.respond_delivery_day_plan_quote(v_subscription,v_quote,'accept');
    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_admin,'role','authenticated','aal','aal2')::TEXT,TRUE);
    PERFORM public.verify_and_activate_delivery_day_plan(
      v_subscription,'phase6-smoke-'||v_subscription::TEXT,'manual_upi');

    IF (SELECT count(*) FROM public.meal_plan_occurrences occurrence
        WHERE occurrence.subscription_id=v_subscription) <> 7 THEN
      RAISE EXCEPTION 'The 7-day plan did not generate seven occurrences.';
    END IF;
    UPDATE public.meal_plan_occurrences occurrence SET status='order_created'
    WHERE occurrence.subscription_id=v_subscription AND occurrence.status='planned';
    UPDATE public.meal_plan_occurrences occurrence
    SET status='fulfilled',fulfilled_at=now(),resolved_at=now()
    WHERE occurrence.subscription_id=v_subscription AND occurrence.status='order_created';

    IF (SELECT status FROM public.meal_plan_subscriptions WHERE id=v_subscription) <> 'completed'
       OR (SELECT count(*) FROM public.meal_plan_occurrences occurrence
           WHERE occurrence.subscription_id=v_subscription AND occurrence.status='fulfilled') <> 7
       OR (SELECT ledger.balance_after FROM public.meal_plan_ledger ledger
           WHERE ledger.subscription_id=v_subscription AND ledger.meal_type='lunch'
           ORDER BY ledger.id DESC LIMIT 1) <> 0 THEN
      RAISE EXCEPTION 'The 7-day plan did not complete with a reconciled zero balance.';
    END IF;

    RAISE EXCEPTION 'ROLLBACK_PHASE6_JOURNEY' USING ERRCODE='PZ008';
  EXCEPTION WHEN SQLSTATE 'PZ008' THEN NULL;
  END;
END;
$$;
