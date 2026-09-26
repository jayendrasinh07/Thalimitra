-- Server-owned, append-only entitlement accounting for delivery-day plans.

ALTER TABLE public.meal_plan_ledger
  DROP CONSTRAINT IF EXISTS meal_plan_ledger_quantity_check;
ALTER TABLE public.meal_plan_ledger
  ADD CONSTRAINT meal_plan_ledger_quantity_check
  CHECK (quantity BETWEEN -1000 AND 1000);

CREATE OR REPLACE FUNCTION private.enforce_meal_plan_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_previous INTEGER;
BEGIN
  PERFORM 1
  FROM public.meal_plan_subscriptions subscription
  WHERE subscription.id = NEW.subscription_id
  FOR UPDATE;

  SELECT ledger.balance_after
  INTO v_previous
  FROM public.meal_plan_ledger ledger
  WHERE ledger.subscription_id = NEW.subscription_id
    AND ledger.meal_type = NEW.meal_type
  ORDER BY ledger.id DESC
  LIMIT 1;

  v_previous := coalesce(v_previous, 0);
  IF NEW.balance_after <> v_previous + NEW.quantity OR NEW.balance_after < 0 THEN
    RAISE EXCEPTION 'Invalid delivery-day plan ledger balance.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meal_plan_ledger_balance_guard ON public.meal_plan_ledger;
CREATE TRIGGER meal_plan_ledger_balance_guard
  BEFORE INSERT ON public.meal_plan_ledger
  FOR EACH ROW EXECUTE FUNCTION private.enforce_meal_plan_ledger_balance();

CREATE OR REPLACE FUNCTION private.append_meal_plan_ledger(
  p_subscription_id UUID,
  p_occurrence_id UUID,
  p_meal_type TEXT,
  p_entry_type TEXT,
  p_quantity INTEGER,
  p_idempotency_key UUID,
  p_note TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.meal_plan_ledger%ROWTYPE;
  v_previous INTEGER;
  v_balance INTEGER;
BEGIN
  IF p_meal_type NOT IN ('breakfast', 'lunch', 'dinner') OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Invalid ledger entry.' USING ERRCODE = '22023';
  END IF;
  IF p_entry_type NOT IN (
    'credit_granted', 'reserved', 'reservation_released', 'fulfilled',
    'customer_skip_credit', 'kitchen_cancel_credit', 'cancelled', 'refunded'
  ) OR p_quantity NOT BETWEEN -1000 AND 1000 THEN
    RAISE EXCEPTION 'Invalid ledger entry.' USING ERRCODE = '22023';
  END IF;

  SELECT ledger.* INTO v_existing
  FROM public.meal_plan_ledger ledger
  WHERE ledger.subscription_id = p_subscription_id
    AND ledger.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.occurrence_id IS NOT DISTINCT FROM p_occurrence_id
       AND v_existing.meal_type = p_meal_type
       AND v_existing.entry_type = p_entry_type
       AND v_existing.quantity = p_quantity THEN
      RETURN v_existing.balance_after;
    END IF;
    RAISE EXCEPTION 'Ledger idempotency key was already used for another action.' USING ERRCODE = '23505';
  END IF;

  PERFORM 1
  FROM public.meal_plan_subscriptions subscription
  WHERE subscription.id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery-day plan was not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT ledger.balance_after INTO v_previous
  FROM public.meal_plan_ledger ledger
  WHERE ledger.subscription_id = p_subscription_id
    AND ledger.meal_type = p_meal_type
  ORDER BY ledger.id DESC
  LIMIT 1;
  v_balance := coalesce(v_previous, 0) + p_quantity;
  IF v_balance < 0 THEN
    RAISE EXCEPTION 'No remaining % entitlement is available.', p_meal_type USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.meal_plan_ledger(
    subscription_id, occurrence_id, meal_type, entry_type,
    quantity, balance_after, idempotency_key, note
  ) VALUES (
    p_subscription_id, p_occurrence_id, p_meal_type, p_entry_type,
    p_quantity, v_balance, p_idempotency_key, nullif(btrim(coalesce(p_note, '')), '')
  );
  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION private.append_meal_plan_ledger(UUID,UUID,TEXT,TEXT,INTEGER,UUID,TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.initialize_meal_plan_ledger(p_subscription_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_service RECORD;
  v_inserted INTEGER := 0;
  v_key UUID;
BEGIN
  FOR v_service IN
    SELECT service.meal_type, template.delivery_days
    FROM public.meal_plan_subscriptions subscription
    JOIN public.meal_plan_templates template ON template.id = subscription.template_id
    JOIN public.meal_plan_services service ON service.subscription_id = subscription.id
    WHERE subscription.id = p_subscription_id
      AND subscription.status IN ('active', 'paused')
      AND subscription.payment_status = 'paid'
    ORDER BY service.meal_type
  LOOP
    v_key := md5('delivery-plan-credit:' || p_subscription_id::TEXT || ':' || v_service.meal_type)::UUID;
    IF NOT EXISTS (
      SELECT 1 FROM public.meal_plan_ledger ledger
      WHERE ledger.subscription_id = p_subscription_id
        AND ledger.idempotency_key = v_key
    ) THEN
      PERFORM private.append_meal_plan_ledger(
        p_subscription_id, NULL, v_service.meal_type, 'credit_granted',
        v_service.delivery_days, v_key, 'Paid plan entitlement granted.'
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION private.initialize_meal_plan_ledger(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_meal_plan_occurrence_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.subscription_id <> OLD.subscription_id
     OR NEW.meal_type <> OLD.meal_type
     OR NEW.service_date <> OLD.service_date
     OR NEW.entitlement_quantity <> OLD.entitlement_quantity
     OR NEW.reservation_key <> OLD.reservation_key THEN
    RAISE EXCEPTION 'Delivery-day plan occurrence identity is immutable.' USING ERRCODE = '55000';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'planned' AND NEW.status IN ('order_created', 'customer_skipped', 'kitchen_cancelled', 'cancelled')) OR
    (OLD.status = 'order_created' AND NEW.status IN ('fulfilled', 'customer_skipped', 'kitchen_cancelled', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid occurrence status transition: % to %.', OLD.status, NEW.status USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meal_plan_occurrence_transition_guard ON public.meal_plan_occurrences;
CREATE TRIGGER meal_plan_occurrence_transition_guard
  BEFORE UPDATE ON public.meal_plan_occurrences
  FOR EACH ROW EXECUTE FUNCTION private.enforce_meal_plan_occurrence_transition();

CREATE OR REPLACE FUNCTION private.record_meal_plan_occurrence_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_type TEXT;
  v_quantity INTEGER := 0;
  v_key UUID;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'order_created' THEN
      v_entry_type := 'reserved';
      v_quantity := -1;
      v_key := NEW.reservation_key;
    WHEN 'fulfilled' THEN
      v_entry_type := 'fulfilled';
      v_key := md5('delivery-plan-fulfilled:' || NEW.id::TEXT)::UUID;
    WHEN 'customer_skipped' THEN
      v_entry_type := 'customer_skip_credit';
      v_quantity := CASE WHEN OLD.status = 'order_created' THEN 1 ELSE 0 END;
      v_key := md5('delivery-plan-customer-skip:' || NEW.id::TEXT)::UUID;
    WHEN 'kitchen_cancelled' THEN
      v_entry_type := 'kitchen_cancel_credit';
      v_quantity := CASE WHEN OLD.status = 'order_created' THEN 1 ELSE 0 END;
      v_key := md5('delivery-plan-kitchen-cancel:' || NEW.id::TEXT)::UUID;
    WHEN 'cancelled' THEN
      v_entry_type := CASE WHEN OLD.status = 'order_created' THEN 'reservation_released' ELSE 'cancelled' END;
      v_quantity := CASE WHEN OLD.status = 'order_created' THEN 1 ELSE 0 END;
      v_key := md5('delivery-plan-cancelled:' || NEW.id::TEXT)::UUID;
    ELSE
      RETURN NEW;
  END CASE;

  PERFORM private.append_meal_plan_ledger(
    NEW.subscription_id, NEW.id, NEW.meal_type, v_entry_type,
    v_quantity, v_key, 'Occurrence moved from ' || OLD.status || ' to ' || NEW.status || '.'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meal_plan_occurrence_ledger ON public.meal_plan_occurrences;
CREATE TRIGGER meal_plan_occurrence_ledger
  AFTER UPDATE OF status ON public.meal_plan_occurrences
  FOR EACH ROW EXECUTE FUNCTION private.record_meal_plan_occurrence_ledger();

CREATE OR REPLACE FUNCTION private.resolve_meal_plan_occurrence_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.subscription_occurrence_id IS NULL OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'delivered' THEN
    UPDATE public.meal_plan_occurrences occurrence
    SET status = 'fulfilled', fulfilled_at = now(), resolved_at = now()
    WHERE occurrence.id = NEW.subscription_occurrence_id
      AND occurrence.status = 'order_created';
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.meal_plan_occurrences occurrence
    SET status = 'cancelled', resolved_at = now()
    WHERE occurrence.id = NEW.subscription_occurrence_id
      AND occurrence.status = 'order_created';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meal_plan_order_resolution ON public.orders;
CREATE TRIGGER meal_plan_order_resolution
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.resolve_meal_plan_occurrence_from_order();

CREATE OR REPLACE FUNCTION public.verify_and_activate_delivery_day_plan(
  p_subscription_id UUID,
  p_payment_reference TEXT,
  p_payment_method TEXT DEFAULT 'manual_upi'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_access();
  v_subscription public.meal_plan_subscriptions%ROWTYPE;
  v_quote public.meal_plan_quotes%ROWTYPE;
  v_payment_id UUID;
  v_generated INTEGER;
  v_ledger_services INTEGER;
  v_reference TEXT := btrim(coalesce(p_payment_reference, ''));
BEGIN
  IF char_length(v_reference) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Enter a valid payment reference.' USING ERRCODE = '22023';
  END IF;
  IF p_payment_method NOT IN ('manual_upi', 'manual_bank', 'cash') THEN
    RAISE EXCEPTION 'Choose a valid payment method.' USING ERRCODE = '22023';
  END IF;

  SELECT subscription.* INTO v_subscription
  FROM public.meal_plan_subscriptions subscription
  WHERE subscription.id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery-day plan request was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_subscription.status <> 'accepted' OR v_subscription.payment_status <> 'pending'
     OR v_subscription.accepted_quote_id IS NULL THEN
    RAISE EXCEPTION 'Customer acceptance is required before payment verification.' USING ERRCODE = '22023';
  END IF;
  SELECT quote.* INTO v_quote
  FROM public.meal_plan_quotes quote
  WHERE quote.id = v_subscription.accepted_quote_id
    AND quote.subscription_id = p_subscription_id
  FOR SHARE;
  IF NOT FOUND OR v_quote.status <> 'accepted' OR v_quote.total_amount <= 0 THEN
    RAISE EXCEPTION 'A valid accepted quote is required before activation.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.meal_plan_payments(
      subscription_id, quote_id, amount, payment_method,
      payment_reference, verified_by
    ) VALUES (
      p_subscription_id, v_quote.id, v_quote.total_amount, p_payment_method,
      v_reference, v_actor
    ) RETURNING id INTO v_payment_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This payment reference has already been used.' USING ERRCODE = '23505';
  END;

  UPDATE public.meal_plan_subscriptions subscription
  SET payment_status = 'paid', status = 'active', activated_at = now()
  WHERE subscription.id = p_subscription_id;

  v_ledger_services := private.initialize_meal_plan_ledger(p_subscription_id);
  v_generated := private.generate_meal_plan_occurrences(p_subscription_id);

  INSERT INTO private.meal_plan_events(
    subscription_id, actor_id, event_type, previous_status, next_status, event_data
  ) VALUES (
    p_subscription_id, v_actor, 'payment_verified_and_activated', 'accepted', 'active',
    jsonb_build_object(
      'quote_id', v_quote.id,
      'payment_id', v_payment_id,
      'amount', v_quote.total_amount,
      'payment_method', p_payment_method,
      'ledger_services_initialized', v_ledger_services,
      'generated_occurrences', v_generated
    )
  );
  RETURN private.meal_plan_management_document(p_subscription_id);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_activate_delivery_day_plan(UUID,TEXT,TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_and_activate_delivery_day_plan(UUID,TEXT,TEXT)
  TO authenticated;

DO $$
DECLARE
  v_subscription RECORD;
  v_occurrence RECORD;
BEGIN
  FOR v_subscription IN
    SELECT subscription.id
    FROM public.meal_plan_subscriptions subscription
    WHERE subscription.status IN ('active', 'paused')
      AND subscription.payment_status = 'paid'
  LOOP
    IF v_subscription.id IS NOT NULL THEN
      PERFORM private.initialize_meal_plan_ledger(v_subscription.id);
      FOR v_occurrence IN
        SELECT occurrence.*
        FROM public.meal_plan_occurrences occurrence
        WHERE occurrence.subscription_id = v_subscription.id
          AND occurrence.status IN ('order_created', 'fulfilled')
        ORDER BY occurrence.service_date, occurrence.meal_type
      LOOP
        PERFORM private.append_meal_plan_ledger(
          v_occurrence.subscription_id, v_occurrence.id, v_occurrence.meal_type,
          'reserved', -1, v_occurrence.reservation_key, 'Existing occurrence reservation backfill.'
        );
        IF v_occurrence.status = 'fulfilled' THEN
          PERFORM private.append_meal_plan_ledger(
            v_occurrence.subscription_id, v_occurrence.id, v_occurrence.meal_type,
            'fulfilled', 0, md5('delivery-plan-fulfilled:' || v_occurrence.id::TEXT)::UUID,
            'Existing fulfilled occurrence backfill.'
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION private.append_meal_plan_ledger(UUID,UUID,TEXT,TEXT,INTEGER,UUID,TEXT) IS
  'The only supported entitlement balance mutation path; serialized and idempotent.';
COMMENT ON FUNCTION private.initialize_meal_plan_ledger(UUID) IS
  'Grants paid delivery-day plan credits once per selected service before occurrence materialization.';
