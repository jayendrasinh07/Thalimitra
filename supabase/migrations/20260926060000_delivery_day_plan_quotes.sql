-- Immutable, itemized Operations quotes and explicit customer decisions.

CREATE OR REPLACE FUNCTION private.guard_meal_plan_quote_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Meal plan quotes are immutable.' USING ERRCODE = '55000';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.subtotal_amount IS DISTINCT FROM OLD.subtotal_amount
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Quoted prices and validity cannot be changed.' USING ERRCODE = '55000';
  END IF;

  IF NOT (
    NEW.status = OLD.status
    OR (OLD.status = 'draft' AND NEW.status IN ('offered', 'superseded'))
    OR (OLD.status = 'offered' AND NEW.status IN ('accepted', 'declined', 'expired', 'superseded'))
  ) THEN
    RAISE EXCEPTION 'Invalid quote status transition.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meal_plan_quotes_guard_immutable ON public.meal_plan_quotes;
CREATE TRIGGER meal_plan_quotes_guard_immutable
  BEFORE UPDATE OR DELETE ON public.meal_plan_quotes
  FOR EACH ROW EXECUTE FUNCTION private.guard_meal_plan_quote_mutation();

CREATE OR REPLACE FUNCTION private.meal_plan_quote_document(p_quote_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN q.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', q.id,
    'version', q.version,
    'status', q.status,
    'currency', q.currency,
    'subtotal_amount', q.subtotal_amount,
    'discount_amount', q.discount_amount,
    'delivery_fee', q.delivery_fee,
    'tax_amount', q.tax_amount,
    'total_amount', q.total_amount,
    'valid_until', q.valid_until,
    'offered_at', q.offered_at,
    'accepted_at', q.accepted_at,
    'declined_at', q.declined_at,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', item.id,
        'item_type', item.item_type,
        'meal_type', item.meal_type,
        'label', item.label,
        'quantity', item.quantity,
        'unit_amount', item.unit_amount,
        'line_amount', item.line_amount
      ) ORDER BY
        CASE item.item_type WHEN 'service' THEN 1 WHEN 'delivery' THEN 2
          WHEN 'discount' THEN 3 WHEN 'tax' THEN 4 ELSE 5 END,
        CASE item.meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 ELSE 4 END,
        item.created_at
      )
      FROM public.meal_plan_quote_items item
      WHERE item.quote_id = q.id
    ), '[]'::JSONB)
  ) END
  FROM public.meal_plan_quotes q
  WHERE q.id = p_quote_id;
$$;

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
    'customer_note', s.customer_note,
    'meal_types', coalesce((
      SELECT jsonb_agg(ms.meal_type ORDER BY CASE ms.meal_type
        WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END)
      FROM public.meal_plan_services ms
      WHERE ms.subscription_id = s.id
    ), '[]'::JSONB),
    'weekdays_by_service', coalesce((
      SELECT jsonb_object_agg(schedule.meal_type, to_jsonb(schedule.days))
      FROM (
        SELECT mw.meal_type, array_agg(mw.iso_weekday ORDER BY mw.iso_weekday) AS days
        FROM public.meal_plan_weekdays mw
        WHERE mw.subscription_id = s.id
        GROUP BY mw.meal_type
      ) schedule
    ), '{}'::JSONB),
    'meals_per_delivery_day', (
      SELECT count(*)::INTEGER FROM public.meal_plan_services ms WHERE ms.subscription_id = s.id
    ),
    'total_meal_occurrences', t.delivery_days * (
      SELECT count(*)::INTEGER FROM public.meal_plan_services ms WHERE ms.subscription_id = s.id
    ),
    'current_quote', private.meal_plan_quote_document(coalesce(
      s.accepted_quote_id,
      (SELECT q.id FROM public.meal_plan_quotes q
       WHERE q.subscription_id = s.id AND q.status = 'offered'
       ORDER BY q.version DESC LIMIT 1)
    )),
    'accepted_quote', private.meal_plan_quote_document(s.accepted_quote_id),
    'created_at', s.created_at,
    'updated_at', s.updated_at
  )
  FROM public.meal_plan_subscriptions s
  JOIN public.meal_plan_templates t ON t.id = s.template_id
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
    'subscriptions', coalesce((
      SELECT jsonb_agg(
        private.meal_plan_subscription_document(s.id) || jsonb_build_object(
          'customer', jsonb_build_object(
            'name', p.full_name,
            'email', p.email,
            'phone', p.phone,
            'address', concat_ws(', ',
              nullif(a.house_flat_number, ''), nullif(a.building_name, ''),
              nullif(a.street, ''), nullif(a.area, ''), nullif(a.sector, ''),
              nullif(a.city, ''), nullif(a.pincode, '')
            )
          )
        ) ORDER BY
          CASE s.status WHEN 'requested' THEN 0 WHEN 'quoted' THEN 1 WHEN 'accepted' THEN 2
            WHEN 'payment_pending' THEN 3 WHEN 'active' THEN 4 ELSE 5 END,
          s.created_at DESC
      )
      FROM public.meal_plan_subscriptions s
      JOIN public.profiles p ON p.id = s.user_id
      JOIN public.addresses a ON a.id = s.address_id
    ), '[]'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.offer_delivery_day_plan_quote(
  p_subscription_id UUID,
  p_service_unit_prices JSONB,
  p_delivery_fee NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_valid_until TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_admin_access();
  v_subscription public.meal_plan_subscriptions%ROWTYPE;
  v_delivery_days INTEGER;
  v_service RECORD;
  v_unit_price NUMERIC(10,2);
  v_subtotal NUMERIC(10,2) := 0;
  v_total NUMERIC(10,2);
  v_quote_id UUID;
  v_version INTEGER;
  v_selected_count INTEGER;
  v_price_count INTEGER;
BEGIN
  SELECT s.* INTO v_subscription
  FROM public.meal_plan_subscriptions s
  WHERE s.id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery-day plan request was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_subscription.status NOT IN ('requested', 'quoted') THEN
    RAISE EXCEPTION 'Only a pending request can receive a quote.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_service_unit_prices) <> 'object' THEN
    RAISE EXCEPTION 'Enter one unit price for every selected service.' USING ERRCODE = '22023';
  END IF;
  IF p_valid_until IS NULL OR p_valid_until < now() + interval '15 minutes'
     OR p_valid_until > now() + interval '30 days' THEN
    RAISE EXCEPTION 'Quote validity must be between 15 minutes and 30 days.' USING ERRCODE = '22023';
  END IF;
  IF p_delivery_fee IS NULL OR p_delivery_fee < 0 OR p_delivery_fee > 100000
     OR p_discount_amount IS NULL OR p_discount_amount < 0 OR p_discount_amount > 100000
     OR p_tax_amount IS NULL OR p_tax_amount < 0 OR p_tax_amount > 100000
     OR round(p_delivery_fee, 2) <> p_delivery_fee
     OR round(p_discount_amount, 2) <> p_discount_amount
     OR round(p_tax_amount, 2) <> p_tax_amount THEN
    RAISE EXCEPTION 'Quote adjustments must be valid two-decimal amounts.' USING ERRCODE = '22023';
  END IF;

  SELECT t.delivery_days INTO v_delivery_days
  FROM public.meal_plan_templates t
  WHERE t.id = v_subscription.template_id;
  SELECT count(*) INTO v_selected_count FROM public.meal_plan_services ms
    WHERE ms.subscription_id = p_subscription_id;
  SELECT count(*) INTO v_price_count FROM jsonb_object_keys(p_service_unit_prices);
  IF v_selected_count <> v_price_count OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_service_unit_prices) supplied(meal_type)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.meal_plan_services ms
      WHERE ms.subscription_id = p_subscription_id AND ms.meal_type = supplied.meal_type
    )
  ) THEN
    RAISE EXCEPTION 'Enter one unit price for every selected service.' USING ERRCODE = '22023';
  END IF;

  FOR v_service IN
    SELECT ms.meal_type FROM public.meal_plan_services ms
    WHERE ms.subscription_id = p_subscription_id
    ORDER BY CASE ms.meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END
  LOOP
    BEGIN
      v_unit_price := (p_service_unit_prices->>v_service.meal_type)::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Each service price must be a number.' USING ERRCODE = '22023';
    END;
    IF v_unit_price IS NULL OR v_unit_price <= 0 OR v_unit_price > 100000
       OR round(v_unit_price, 2) <> v_unit_price THEN
      RAISE EXCEPTION 'Each service price must be a valid two-decimal amount.' USING ERRCODE = '22023';
    END IF;
    v_subtotal := v_subtotal + (v_delivery_days * v_unit_price);
  END LOOP;

  IF p_discount_amount > v_subtotal THEN
    RAISE EXCEPTION 'Discount cannot exceed the service subtotal.' USING ERRCODE = '22023';
  END IF;
  v_total := v_subtotal - p_discount_amount + p_delivery_fee + p_tax_amount;
  SELECT coalesce(max(q.version), 0) + 1 INTO v_version
  FROM public.meal_plan_quotes q WHERE q.subscription_id = p_subscription_id;

  UPDATE public.meal_plan_quotes q
  SET status = 'superseded'
  WHERE q.subscription_id = p_subscription_id AND q.status = 'offered';

  INSERT INTO public.meal_plan_quotes (
    subscription_id, version, status, subtotal_amount, discount_amount,
    delivery_fee, tax_amount, total_amount, valid_until, offered_at, created_by
  ) VALUES (
    p_subscription_id, v_version, 'offered', v_subtotal, p_discount_amount,
    p_delivery_fee, p_tax_amount, v_total, p_valid_until, now(), v_actor
  ) RETURNING id INTO v_quote_id;

  FOR v_service IN
    SELECT ms.meal_type FROM public.meal_plan_services ms
    WHERE ms.subscription_id = p_subscription_id
    ORDER BY CASE ms.meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END
  LOOP
    v_unit_price := (p_service_unit_prices->>v_service.meal_type)::NUMERIC;
    INSERT INTO public.meal_plan_quote_items (
      quote_id, item_type, meal_type, label, quantity, unit_amount, line_amount
    ) VALUES (
      v_quote_id, 'service', v_service.meal_type,
      initcap(v_service.meal_type) || ' service', v_delivery_days,
      v_unit_price, v_delivery_days * v_unit_price
    );
  END LOOP;
  IF p_delivery_fee > 0 THEN
    INSERT INTO public.meal_plan_quote_items
      (quote_id, item_type, label, quantity, unit_amount, line_amount)
    VALUES (v_quote_id, 'delivery', 'Delivery fee', 1, p_delivery_fee, p_delivery_fee);
  END IF;
  IF p_discount_amount > 0 THEN
    INSERT INTO public.meal_plan_quote_items
      (quote_id, item_type, label, quantity, unit_amount, line_amount)
    VALUES (v_quote_id, 'discount', 'Plan discount', 1, -p_discount_amount, -p_discount_amount);
  END IF;
  IF p_tax_amount > 0 THEN
    INSERT INTO public.meal_plan_quote_items
      (quote_id, item_type, label, quantity, unit_amount, line_amount)
    VALUES (v_quote_id, 'tax', 'Tax', 1, p_tax_amount, p_tax_amount);
  END IF;

  UPDATE public.meal_plan_subscriptions s SET status = 'quoted'
  WHERE s.id = p_subscription_id;
  INSERT INTO private.meal_plan_events (
    subscription_id, actor_id, event_type, previous_status, next_status, event_data
  ) VALUES (
    p_subscription_id, v_actor, 'quote_offered', v_subscription.status, 'quoted',
    jsonb_build_object('quote_id', v_quote_id, 'version', v_version, 'total_amount', v_total)
  );
  RETURN private.meal_plan_subscription_document(p_subscription_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_delivery_day_plan_quote(
  p_subscription_id UUID,
  p_quote_id UUID,
  p_decision TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_customer_access();
  v_subscription public.meal_plan_subscriptions%ROWTYPE;
  v_quote public.meal_plan_quotes%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'Choose accept or decline.' USING ERRCODE = '22023';
  END IF;
  SELECT s.* INTO v_subscription
  FROM public.meal_plan_subscriptions s
  WHERE s.id = p_subscription_id AND s.user_id = v_actor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery-day plan request was not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT q.* INTO v_quote
  FROM public.meal_plan_quotes q
  WHERE q.id = p_quote_id AND q.subscription_id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND OR v_quote.status <> 'offered' OR v_subscription.status <> 'quoted' THEN
    RAISE EXCEPTION 'This quote is no longer available.' USING ERRCODE = '22023';
  END IF;
  IF v_quote.valid_until IS NULL OR v_quote.valid_until <= now() THEN
    UPDATE public.meal_plan_quotes q SET status = 'expired' WHERE q.id = p_quote_id;
    UPDATE public.meal_plan_subscriptions s SET status = 'requested' WHERE s.id = p_subscription_id;
    RAISE EXCEPTION 'This quote has expired. Ask Operations for a new quote.' USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'accept' THEN
    UPDATE public.meal_plan_quotes q
    SET status = 'accepted', accepted_at = now()
    WHERE q.id = p_quote_id;
    UPDATE public.meal_plan_services ms
    SET locked_unit_price = item.unit_amount
    FROM public.meal_plan_quote_items item
    WHERE item.quote_id = p_quote_id AND item.item_type = 'service'
      AND item.meal_type = ms.meal_type AND ms.subscription_id = p_subscription_id;
    UPDATE public.meal_plan_subscriptions s
    SET status = 'accepted', accepted_quote_id = p_quote_id
    WHERE s.id = p_subscription_id;
    INSERT INTO private.meal_plan_events (
      subscription_id, actor_id, event_type, previous_status, next_status, event_data
    ) VALUES (
      p_subscription_id, v_actor, 'quote_accepted', 'quoted', 'accepted',
      jsonb_build_object('quote_id', p_quote_id, 'version', v_quote.version)
    );
  ELSE
    UPDATE public.meal_plan_quotes q
    SET status = 'declined', declined_at = now()
    WHERE q.id = p_quote_id;
    UPDATE public.meal_plan_subscriptions s
    SET status = 'cancelled', cancelled_at = now()
    WHERE s.id = p_subscription_id;
    INSERT INTO private.meal_plan_events (
      subscription_id, actor_id, event_type, previous_status, next_status, event_data
    ) VALUES (
      p_subscription_id, v_actor, 'quote_declined', 'quoted', 'cancelled',
      jsonb_build_object('quote_id', p_quote_id, 'version', v_quote.version)
    );
  END IF;
  RETURN private.meal_plan_subscription_document(p_subscription_id);
END;
$$;

REVOKE ALL ON FUNCTION private.guard_meal_plan_quote_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.meal_plan_quote_document(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.meal_plan_subscription_document(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_delivery_day_plan_management() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.offer_delivery_day_plan_quote(UUID,JSONB,NUMERIC,NUMERIC,NUMERIC,TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_delivery_day_plan_quote(UUID,UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_day_plan_management() TO authenticated;
GRANT EXECUTE ON FUNCTION public.offer_delivery_day_plan_quote(UUID,JSONB,NUMERIC,NUMERIC,NUMERIC,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_delivery_day_plan_quote(UUID,UUID,TEXT) TO authenticated;

COMMENT ON FUNCTION public.offer_delivery_day_plan_quote(UUID,JSONB,NUMERIC,NUMERIC,NUMERIC,TIMESTAMPTZ)
  IS 'MFA-admin-only server-calculated itemized quote. Customer-supplied totals are never accepted.';
COMMENT ON FUNCTION public.respond_delivery_day_plan_quote(UUID,UUID,TEXT)
  IS 'Owner-only explicit acceptance or decline of one current immutable quote.';
