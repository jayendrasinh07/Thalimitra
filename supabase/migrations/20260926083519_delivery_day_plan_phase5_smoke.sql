-- Transactional Phase 5 security, policy, customer-document and lifecycle smoke.
DO $$
DECLARE
  v_admin UUID;
  v_customer UUID;
  v_address UUID;
  v_template UUID;
  v_subscription UUID;
  v_document JSONB;
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
  SELECT template.id INTO v_template FROM public.meal_plan_templates template
  WHERE template.code='starter_7_days';
  IF v_admin IS NULL OR v_customer IS NULL OR v_address IS NULL OR v_template IS NULL THEN
    RAISE NOTICE 'Skipping Phase 5 smoke because required role/address fixtures are absent.';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.meal_plan_subscriptions subscription SET status='cancelled',cancelled_at=now()
    WHERE subscription.user_id=v_customer
      AND subscription.status IN ('requested','quoted','accepted','payment_pending','active','paused');
    INSERT INTO public.meal_plan_subscriptions(
      user_id,address_id,template_id,status,payment_status,preferred_start_date,
      expected_completion_date,request_idempotency_key
    ) VALUES (
      v_customer,v_address,v_template,'requested','pending',current_date+30,
      current_date+60,gen_random_uuid()
    ) RETURNING id INTO v_subscription;
    INSERT INTO public.meal_plan_services(subscription_id,meal_type)
    VALUES (v_subscription,'lunch');
    INSERT INTO public.meal_plan_weekdays(subscription_id,meal_type,iso_weekday)
    VALUES (v_subscription,'lunch',1);

    BEGIN
      INSERT INTO public.meal_plan_quotes(
        subscription_id,version,status,subtotal_amount,discount_amount,
        delivery_fee,tax_amount,total_amount,valid_until,created_by
      ) VALUES (v_subscription,1,'draft',100,11,0,0,89,now()+interval '1 day',v_admin);
      RAISE EXCEPTION 'Over-limit discount unexpectedly succeeded.';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_customer,'role','authenticated','aal','aal1')::TEXT,TRUE);
    BEGIN
      PERFORM public.get_delivery_day_plan_management();
      RAISE EXCEPTION 'Customer unexpectedly opened plan management.';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.get_kitchen_delivery_day_plan_production();
      RAISE EXCEPTION 'Customer unexpectedly opened Kitchen production.';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_admin,'role','authenticated','aal','aal2')::TEXT,TRUE);
    PERFORM public.record_delivery_day_plan_decision(
      v_subscription,'cancelled_no_payment',0,
      'Your request was closed before payment, so no charge was made.',
      'Phase 5 transactional smoke internal note',NULL
    );
    PERFORM set_config('request.jwt.claims',jsonb_build_object(
      'sub',v_customer,'role','authenticated','aal','aal1')::TEXT,TRUE);
    SELECT private.meal_plan_subscription_document(v_subscription) INTO v_document;
    IF v_document->>'status' <> 'cancelled'
       OR v_document->'latest_decision'->>'decision_type' <> 'cancelled_no_payment'
       OR (v_document->'latest_decision') ? 'internal_note'
       OR (v_document->'latest_decision') ? 'external_reference' THEN
      RAISE EXCEPTION 'Customer lifecycle document is unsafe or incomplete.';
    END IF;

    RAISE EXCEPTION 'ROLLBACK_PHASE5_SMOKE' USING ERRCODE='PZ007';
  EXCEPTION WHEN SQLSTATE 'PZ007' THEN NULL;
  END;
END;
$$;
