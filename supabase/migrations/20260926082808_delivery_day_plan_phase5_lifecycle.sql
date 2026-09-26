-- Phase 5: customer plan visibility, controlled commercial policy, lifecycle
-- decisions, automatic completion, and a finance-free Kitchen production view.

CREATE TABLE public.meal_plan_commercial_policy (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  max_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 10
    CHECK (max_discount_percent BETWEEN 0 AND 50),
  max_delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 500
    CHECK (max_delivery_fee BETWEEN 0 AND 10000),
  tax_collection_enabled BOOLEAN NOT NULL DEFAULT false,
  customer_cancellation_summary TEXT NOT NULL
    CHECK (char_length(customer_cancellation_summary) BETWEEN 20 AND 500),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.meal_plan_commercial_policy(
  singleton, max_discount_percent, max_delivery_fee,
  tax_collection_enabled, customer_cancellation_summary
) VALUES (
  true, 10, 500, false,
  'Before payment, a plan can be closed without a charge. After activation, Operations reviews undelivered services and records any refund decision before money is returned.'
);

ALTER TABLE public.meal_plan_commercial_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meal_plan_commercial_policy FROM PUBLIC, anon, authenticated;

CREATE TABLE private.meal_plan_financial_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.meal_plan_subscriptions(id) ON DELETE RESTRICT,
  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'cancelled_no_payment', 'refund_due', 'no_refund', 'refund_completed'
  )),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  customer_message TEXT NOT NULL CHECK (char_length(customer_message) BETWEEN 5 AND 500),
  internal_note TEXT CHECK (internal_note IS NULL OR char_length(internal_note) <= 1000),
  external_reference TEXT CHECK (external_reference IS NULL OR char_length(external_reference) BETWEEN 3 AND 120),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX meal_plan_financial_decisions_subscription_idx
  ON private.meal_plan_financial_decisions(subscription_id, created_at DESC);
CREATE UNIQUE INDEX meal_plan_financial_decisions_ref_unique
  ON private.meal_plan_financial_decisions(lower(btrim(external_reference)))
  WHERE external_reference IS NOT NULL;
ALTER TABLE private.meal_plan_financial_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.meal_plan_financial_decisions FROM PUBLIC, anon, authenticated;
CREATE TRIGGER meal_plan_financial_decisions_immutable
  BEFORE UPDATE OR DELETE ON private.meal_plan_financial_decisions
  FOR EACH ROW EXECUTE FUNCTION private.reject_meal_plan_immutable_mutation();

CREATE OR REPLACE FUNCTION private.enforce_meal_plan_quote_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_policy public.meal_plan_commercial_policy%ROWTYPE;
BEGIN
  SELECT policy.* INTO STRICT v_policy
  FROM public.meal_plan_commercial_policy policy
  WHERE policy.singleton;
  IF NEW.discount_amount > round(NEW.subtotal_amount * v_policy.max_discount_percent / 100, 2) THEN
    RAISE EXCEPTION 'Plan discount exceeds the approved limit.' USING ERRCODE = '23514';
  END IF;
  IF NEW.delivery_fee > v_policy.max_delivery_fee THEN
    RAISE EXCEPTION 'Delivery fee exceeds the approved limit.' USING ERRCODE = '23514';
  END IF;
  IF NOT v_policy.tax_collection_enabled AND NEW.tax_amount <> 0 THEN
    RAISE EXCEPTION 'Tax collection is not enabled for plan quotes.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER meal_plan_quotes_commercial_policy
  BEFORE INSERT ON public.meal_plan_quotes
  FOR EACH ROW EXECUTE FUNCTION private.enforce_meal_plan_quote_policy();

CREATE OR REPLACE FUNCTION private.meal_plan_subscription_document(p_subscription_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'template_code', t.code,
    'plan_name', t.customer_name,
    'delivery_days', t.delivery_days,
    'status', s.status,
    'payment_status', s.payment_status,
    'preferred_start_date', s.preferred_start_date,
    'expected_completion_date', s.expected_completion_date,
    'resume_on_date', s.resume_on_date,
    'customer_note', s.customer_note,
    'meal_types', coalesce((
      SELECT jsonb_agg(ms.meal_type ORDER BY CASE ms.meal_type
        WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END)
      FROM public.meal_plan_services ms WHERE ms.subscription_id = s.id
    ), '[]'::JSONB),
    'weekdays_by_service', coalesce((
      SELECT jsonb_object_agg(schedule.meal_type, to_jsonb(schedule.days))
      FROM (
        SELECT mw.meal_type, array_agg(mw.iso_weekday ORDER BY mw.iso_weekday) AS days
        FROM public.meal_plan_weekdays mw
        WHERE mw.subscription_id = s.id GROUP BY mw.meal_type
      ) schedule
    ), '{}'::JSONB),
    'meals_per_delivery_day', (
      SELECT count(*)::INTEGER FROM public.meal_plan_services ms WHERE ms.subscription_id = s.id
    ),
    'total_meal_occurrences', t.delivery_days * (
      SELECT count(*)::INTEGER FROM public.meal_plan_services ms WHERE ms.subscription_id = s.id
    ),
    'service_progress', coalesce((
      SELECT jsonb_object_agg(service.meal_type, jsonb_build_object(
        'entitled', t.delivery_days,
        'remaining', coalesce((
          SELECT ledger.balance_after FROM public.meal_plan_ledger ledger
          WHERE ledger.subscription_id = s.id AND ledger.meal_type = service.meal_type
          ORDER BY ledger.id DESC LIMIT 1
        ), CASE WHEN s.status IN ('active','paused','completed','cancelled') THEN 0 ELSE t.delivery_days END),
        'fulfilled', (SELECT count(*) FROM public.meal_plan_occurrences occurrence
          WHERE occurrence.subscription_id = s.id AND occurrence.meal_type = service.meal_type
            AND occurrence.status = 'fulfilled'),
        'upcoming', (SELECT count(*) FROM public.meal_plan_occurrences occurrence
          WHERE occurrence.subscription_id = s.id AND occurrence.meal_type = service.meal_type
            AND occurrence.status IN ('planned','order_created') AND occurrence.service_date >= current_date)
      )) FROM public.meal_plan_services service WHERE service.subscription_id = s.id
    ), '{}'::JSONB),
    'occurrences', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', occurrence.id,
        'meal_type', occurrence.meal_type,
        'service_date', occurrence.service_date,
        'status', occurrence.status,
        'can_move', occurrence.status IN ('planned','order_created')
          AND occurrence.service_date >= current_date
      ) ORDER BY occurrence.service_date,
        CASE occurrence.meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END)
      FROM public.meal_plan_occurrences occurrence
      WHERE occurrence.subscription_id = s.id
    ), '[]'::JSONB),
    'current_quote', private.meal_plan_quote_document(coalesce(
      s.accepted_quote_id,
      (SELECT quote.id FROM public.meal_plan_quotes quote
       WHERE quote.subscription_id = s.id AND quote.status = 'offered'
       ORDER BY quote.version DESC LIMIT 1)
    )),
    'accepted_quote', private.meal_plan_quote_document(s.accepted_quote_id),
    'latest_decision', (
      SELECT jsonb_build_object(
        'decision_type', decision.decision_type,
        'amount', decision.amount,
        'customer_message', decision.customer_message,
        'created_at', decision.created_at
      ) FROM private.meal_plan_financial_decisions decision
      WHERE decision.subscription_id = s.id
      ORDER BY decision.created_at DESC LIMIT 1
    ),
    'commercial_policy', (SELECT jsonb_build_object(
      'cancellation_summary', policy.customer_cancellation_summary
    ) FROM public.meal_plan_commercial_policy policy WHERE policy.singleton),
    'created_at', s.created_at,
    'updated_at', s.updated_at
  )
  FROM public.meal_plan_subscriptions s
  JOIN public.meal_plan_templates t ON t.id = s.template_id
  WHERE s.id = p_subscription_id;
$$;

CREATE OR REPLACE FUNCTION private.meal_plan_management_document(p_subscription_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT private.meal_plan_subscription_document(s.id) || jsonb_build_object(
    'customer', jsonb_build_object(
      'name', p.full_name,
      'email', p.email,
      'phone', p.phone,
      'address', concat_ws(', ', nullif(a.house_flat_number, ''), nullif(a.building_name, ''),
        nullif(a.street, ''), nullif(a.area, ''), nullif(a.sector, ''),
        nullif(a.city, ''), nullif(a.pincode, ''))
    ),
    'payment', CASE WHEN payment.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', payment.id, 'amount', payment.amount, 'currency', payment.currency,
      'payment_method', payment.payment_method, 'status', payment.status,
      'verified_at', payment.verified_at
    ) END,
    'decisions', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', decision.id, 'decision_type', decision.decision_type,
      'amount', decision.amount, 'customer_message', decision.customer_message,
      'internal_note', decision.internal_note,
      'external_reference', decision.external_reference,
      'created_at', decision.created_at
    ) ORDER BY decision.created_at DESC)
    FROM private.meal_plan_financial_decisions decision
    WHERE decision.subscription_id = s.id), '[]'::JSONB)
  )
  FROM public.meal_plan_subscriptions s
  JOIN public.profiles p ON p.id = s.user_id
  JOIN public.addresses a ON a.id = s.address_id
  LEFT JOIN public.meal_plan_payments payment ON payment.subscription_id = s.id
  WHERE s.id = p_subscription_id;
$$;

CREATE OR REPLACE FUNCTION public.get_delivery_day_plan_management()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_admin_access();
  RETURN jsonb_build_object(
    'subscriptions', coalesce((SELECT jsonb_agg(
      private.meal_plan_management_document(s.id) ORDER BY
      CASE s.status WHEN 'requested' THEN 0 WHEN 'quoted' THEN 1 WHEN 'accepted' THEN 2
        WHEN 'payment_pending' THEN 3 WHEN 'active' THEN 4 WHEN 'paused' THEN 5 ELSE 6 END,
      s.created_at DESC) FROM public.meal_plan_subscriptions s), '[]'::JSONB),
    'templates', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'code', template.code, 'name', template.customer_name,
      'description', template.description, 'delivery_days', template.delivery_days,
      'is_active', template.is_active, 'display_order', template.display_order
    ) ORDER BY template.display_order) FROM public.meal_plan_templates template), '[]'::JSONB),
    'policy', (SELECT jsonb_build_object(
      'max_discount_percent', policy.max_discount_percent,
      'max_delivery_fee', policy.max_delivery_fee,
      'tax_collection_enabled', policy.tax_collection_enabled,
      'customer_cancellation_summary', policy.customer_cancellation_summary,
      'updated_at', policy.updated_at
    ) FROM public.meal_plan_commercial_policy policy WHERE policy.singleton)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_delivery_day_plan_template(
  p_code TEXT,
  p_name TEXT,
  p_description TEXT,
  p_is_active BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor UUID := private.require_admin_access(); v_row public.meal_plan_templates%ROWTYPE;
BEGIN
  IF char_length(btrim(coalesce(p_name,''))) NOT BETWEEN 3 AND 80
     OR char_length(btrim(coalesce(p_description,''))) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Enter a valid plan name and description.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.meal_plan_templates template
  SET customer_name = btrim(p_name), description = btrim(p_description),
      is_active = p_is_active, updated_at = now()
  WHERE template.code = p_code RETURNING template.* INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan template was not found.' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('code',v_row.code,'name',v_row.customer_name,
    'description',v_row.description,'delivery_days',v_row.delivery_days,
    'is_active',v_row.is_active,'display_order',v_row.display_order);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_delivery_day_plan_policy(
  p_max_discount_percent NUMERIC,
  p_max_delivery_fee NUMERIC,
  p_customer_cancellation_summary TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actor UUID := private.require_admin_access(); v_row public.meal_plan_commercial_policy%ROWTYPE;
BEGIN
  IF p_max_discount_percent NOT BETWEEN 0 AND 50 OR p_max_delivery_fee NOT BETWEEN 0 AND 10000
     OR char_length(btrim(coalesce(p_customer_cancellation_summary,''))) NOT BETWEEN 20 AND 500 THEN
    RAISE EXCEPTION 'Enter valid commercial policy limits and customer wording.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.meal_plan_commercial_policy policy
  SET max_discount_percent=p_max_discount_percent, max_delivery_fee=p_max_delivery_fee,
      customer_cancellation_summary=btrim(p_customer_cancellation_summary),
      updated_by=v_actor, updated_at=now()
  WHERE policy.singleton RETURNING policy.* INTO v_row;
  RETURN jsonb_build_object('max_discount_percent',v_row.max_discount_percent,
    'max_delivery_fee',v_row.max_delivery_fee,
    'tax_collection_enabled',v_row.tax_collection_enabled,
    'customer_cancellation_summary',v_row.customer_cancellation_summary,
    'updated_at',v_row.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_delivery_day_plan_decision(
  p_subscription_id UUID,
  p_decision_type TEXT,
  p_amount NUMERIC,
  p_customer_message TEXT,
  p_internal_note TEXT DEFAULT NULL,
  p_external_reference TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_access();
  v_subscription public.meal_plan_subscriptions%ROWTYPE;
  v_paid NUMERIC(10,2) := 0;
  v_due NUMERIC(10,2) := 0;
  v_decision_id UUID;
BEGIN
  IF p_decision_type NOT IN ('cancelled_no_payment','refund_due','no_refund','refund_completed')
     OR coalesce(p_amount,-1) < 0
     OR char_length(btrim(coalesce(p_customer_message,''))) NOT BETWEEN 5 AND 500
     OR char_length(coalesce(p_internal_note,'')) > 1000 THEN
    RAISE EXCEPTION 'Enter a valid lifecycle decision.' USING ERRCODE = '22023';
  END IF;
  SELECT subscription.* INTO v_subscription
  FROM public.meal_plan_subscriptions subscription
  WHERE subscription.id=p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery-day plan was not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT coalesce(payment.amount,0) INTO v_paid
  FROM public.meal_plan_payments payment WHERE payment.subscription_id=p_subscription_id;
  IF p_amount > v_paid THEN
    RAISE EXCEPTION 'Refund amount cannot exceed the verified payment.' USING ERRCODE = '23514';
  END IF;
  IF p_decision_type IN ('cancelled_no_payment','no_refund') AND p_amount <> 0 THEN
    RAISE EXCEPTION 'This decision requires a zero amount.' USING ERRCODE = '22023';
  END IF;
  IF p_decision_type='cancelled_no_payment' AND v_paid <> 0 THEN
    RAISE EXCEPTION 'A paid plan requires a refund or no-refund review.' USING ERRCODE = '23514';
  END IF;
  IF p_decision_type='refund_due' AND (v_paid <= 0 OR p_amount <= 0) THEN
    RAISE EXCEPTION 'A positive paid amount is required for a refund decision.' USING ERRCODE = '23514';
  END IF;
  IF p_decision_type='refund_completed' THEN
    SELECT coalesce(max(decision.amount),0) INTO v_due
    FROM private.meal_plan_financial_decisions decision
    WHERE decision.subscription_id=p_subscription_id AND decision.decision_type='refund_due';
    IF p_amount <= 0 OR p_amount > v_due OR char_length(btrim(coalesce(p_external_reference,''))) < 3 THEN
      RAISE EXCEPTION 'Record the approved amount and refund reference.' USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO private.meal_plan_financial_decisions(
    subscription_id, decision_type, amount, customer_message,
    internal_note, external_reference, actor_id
  ) VALUES (
    p_subscription_id, p_decision_type, p_amount, btrim(p_customer_message),
    nullif(btrim(coalesce(p_internal_note,'')),''),
    nullif(btrim(coalesce(p_external_reference,'')),''), v_actor
  ) RETURNING id INTO v_decision_id;

  IF p_decision_type IN ('cancelled_no_payment','refund_due','no_refund') THEN
    UPDATE public.orders orders SET status='cancelled', cancellation_reason='customer_request',
      cancellation_note='Plan closed by Operations.', cancelled_at=now()
    WHERE orders.subscription_id=p_subscription_id AND orders.status='confirmed';
    UPDATE public.meal_plan_occurrences occurrence SET status='cancelled', resolved_at=now()
    WHERE occurrence.subscription_id=p_subscription_id AND occurrence.status='planned';
    UPDATE public.meal_plan_subscriptions subscription
    SET status='cancelled', cancelled_at=now()
    WHERE subscription.id=p_subscription_id AND subscription.status NOT IN ('completed','cancelled');
  ELSIF p_decision_type='refund_completed' THEN
    UPDATE public.meal_plan_subscriptions subscription
    SET payment_status=CASE WHEN p_amount=v_paid THEN 'refunded' ELSE 'partially_refunded' END
    WHERE subscription.id=p_subscription_id;
  END IF;

  INSERT INTO private.meal_plan_events(
    subscription_id,actor_id,event_type,previous_status,next_status,event_data
  ) VALUES (
    p_subscription_id,v_actor,'lifecycle_decision',v_subscription.status,
    CASE WHEN p_decision_type='refund_completed' THEN v_subscription.status ELSE 'cancelled' END,
    jsonb_build_object('decision_id',v_decision_id,'decision_type',p_decision_type,'amount',p_amount)
  );
  RETURN private.meal_plan_management_document(p_subscription_id);
END;
$$;

CREATE OR REPLACE FUNCTION private.complete_delivery_day_plan_if_ready(p_subscription_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_days INTEGER;
BEGIN
  SELECT template.delivery_days INTO v_days
  FROM public.meal_plan_subscriptions subscription
  JOIN public.meal_plan_templates template ON template.id=subscription.template_id
  WHERE subscription.id=p_subscription_id AND subscription.status IN ('active','paused')
  FOR UPDATE OF subscription;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meal_plan_services service
    WHERE service.subscription_id=p_subscription_id
      AND (SELECT count(*) FROM public.meal_plan_occurrences occurrence
        WHERE occurrence.subscription_id=p_subscription_id
          AND occurrence.meal_type=service.meal_type AND occurrence.status='fulfilled') < v_days
  ) THEN
    UPDATE public.meal_plan_subscriptions subscription
    SET status='completed', completed_at=now(), resume_on_date=NULL, paused_at=NULL
    WHERE subscription.id=p_subscription_id;
    INSERT INTO private.meal_plan_events(subscription_id,event_type,previous_status,next_status,event_data)
    VALUES (p_subscription_id,'plan_completed','active','completed',jsonb_build_object('delivery_days',v_days));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.complete_delivery_day_plan_after_occurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status='fulfilled' AND OLD.status IS DISTINCT FROM 'fulfilled' THEN
    PERFORM private.complete_delivery_day_plan_if_ready(NEW.subscription_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER meal_plan_occurrence_completion
  AFTER UPDATE OF status ON public.meal_plan_occurrences
  FOR EACH ROW EXECUTE FUNCTION private.complete_delivery_day_plan_after_occurrence();

CREATE OR REPLACE FUNCTION public.get_kitchen_delivery_day_plan_production(
  p_from DATE DEFAULT current_date,
  p_to DATE DEFAULT current_date + 7
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_kitchen_access();
  IF p_from < current_date - 7 OR p_to < p_from OR p_to > p_from + 31 THEN
    RAISE EXCEPTION 'Choose a production window of up to 31 days.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('from',p_from,'to',p_to,'production',coalesce((
    SELECT jsonb_agg(row_data ORDER BY service_date,
      CASE meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END, meal_name)
    FROM (
      SELECT occurrence.service_date, occurrence.meal_type,
        item.meal_name_snapshot AS meal_name,
        sum(item.quantity)::INTEGER AS portions,
        coalesce(item.preparation_preferences,'{}'::JSONB) AS preparation_preferences
      FROM public.meal_plan_occurrences occurrence
      JOIN public.orders orders ON orders.subscription_occurrence_id=occurrence.id
      JOIN public.order_items item ON item.order_id=orders.id
      WHERE occurrence.service_date BETWEEN p_from AND p_to
        AND occurrence.status='order_created'
        AND orders.status IN ('confirmed','preparing','ready')
      GROUP BY occurrence.service_date,occurrence.meal_type,item.meal_name_snapshot,item.preparation_preferences
    ) row_data
  ),'[]'::JSONB));
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_meal_plan_quote_policy(),
  private.complete_delivery_day_plan_if_ready(UUID),
  private.complete_delivery_day_plan_after_occurrence()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_delivery_day_plan_template(TEXT,TEXT,TEXT,BOOLEAN),
  public.update_delivery_day_plan_policy(NUMERIC,NUMERIC,TEXT),
  public.record_delivery_day_plan_decision(UUID,TEXT,NUMERIC,TEXT,TEXT,TEXT),
  public.get_kitchen_delivery_day_plan_production(DATE,DATE)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_delivery_day_plan_template(TEXT,TEXT,TEXT,BOOLEAN),
  public.update_delivery_day_plan_policy(NUMERIC,NUMERIC,TEXT),
  public.record_delivery_day_plan_decision(UUID,TEXT,NUMERIC,TEXT,TEXT,TEXT),
  public.get_kitchen_delivery_day_plan_production(DATE,DATE)
  TO authenticated;

COMMENT ON TABLE public.meal_plan_commercial_policy IS
  'Single approved pilot policy. Tax remains disabled until a separate legal/tax review enables it.';
COMMENT ON TABLE private.meal_plan_financial_decisions IS
  'Append-only Operations decisions; internal notes and references never appear in customer documents.';
COMMENT ON FUNCTION public.get_kitchen_delivery_day_plan_production(DATE,DATE) IS
  'MFA Kitchen production totals only; excludes customer identity, prices, payments and refund controls.';
