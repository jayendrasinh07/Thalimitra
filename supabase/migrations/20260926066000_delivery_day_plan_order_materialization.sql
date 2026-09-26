-- Materialize plan occurrences into ordinary Kitchen orders only after menu publication.

CREATE OR REPLACE FUNCTION private.enforce_subscription_order_occurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.subscription_id IS NOT NULL
     AND (
       NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
       OR NEW.subscription_occurrence_id IS DISTINCT FROM OLD.subscription_occurrence_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.order_date IS DISTINCT FROM OLD.order_date
       OR NEW.meal_type IS DISTINCT FROM OLD.meal_type
     ) THEN
    RAISE EXCEPTION 'A subscription order occurrence link is immutable.' USING ERRCODE = '55000';
  END IF;

  IF NEW.subscription_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.meal_plan_occurrences occurrence
    JOIN public.meal_plan_subscriptions subscription
      ON subscription.id = occurrence.subscription_id
    WHERE occurrence.id = NEW.subscription_occurrence_id
      AND occurrence.subscription_id = NEW.subscription_id
      AND occurrence.service_date = NEW.order_date
      AND occurrence.meal_type = NEW.meal_type
      AND subscription.user_id = NEW.user_id
      AND subscription.status IN ('active', 'paused')
      AND subscription.payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'The subscription order does not match its paid occurrence.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_subscription_order_occurrence
  BEFORE INSERT OR UPDATE OF subscription_id, subscription_occurrence_id,
    user_id, order_date, meal_type
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.enforce_subscription_order_occurrence();

CREATE OR REPLACE FUNCTION private.materialize_delivery_day_plan_orders(
  p_service_date DATE,
  p_meal_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day public.menu_days%ROWTYPE;
  v_meal public.meals%ROWTYPE;
  v_occurrence RECORD;
  v_slot public.delivery_slots%ROWTYPE;
  v_candidate_slot public.delivery_slots%ROWTYPE;
  v_booked INTEGER;
  v_order_id UUID;
  v_item_id UUID;
  v_created INTEGER := 0;
  v_existing INTEGER := 0;
  v_blocked INTEGER := 0;
  v_total INTEGER := 0;
  v_snapshot JSONB;
BEGIN
  IF p_service_date IS NULL OR p_meal_type NOT IN ('breakfast', 'lunch', 'dinner') THEN
    RAISE EXCEPTION 'Choose a valid service date and meal type.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended('meal-plan-orders:' || p_service_date::TEXT || ':' || p_meal_type, 0)
  );

  SELECT day.* INTO v_day
  FROM public.menu_days day
  WHERE day.menu_date = p_service_date AND day.is_published
  FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'service_date', p_service_date, 'meal_type', p_meal_type,
      'menu_ready', false, 'created_orders', 0, 'existing_orders', 0,
      'blocked_occurrences', 0
    );
  END IF;

  SELECT meal.* INTO v_meal
  FROM public.menu_items item
  JOIN public.meals meal ON meal.id = item.meal_id
  WHERE item.menu_day_id = v_day.id
    AND item.availability
    AND p_meal_type = ANY(item.service_meal_types)
    AND meal.is_active
    AND (
      meal.meal_type = p_meal_type
      OR (meal.meal_type = 'both' AND p_meal_type IN ('lunch', 'dinner'))
    )
  ORDER BY item.display_order, meal.id
  LIMIT 1
  FOR SHARE OF item, meal;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'service_date', p_service_date, 'meal_type', p_meal_type,
      'menu_ready', false, 'created_orders', 0, 'existing_orders', 0,
      'blocked_occurrences', 0
    );
  END IF;

  FOR v_occurrence IN
    SELECT
      occurrence.id AS occurrence_id,
      occurrence.reservation_key,
      occurrence.status AS occurrence_status,
      subscription.id AS subscription_id,
      subscription.user_id,
      subscription.address_id,
      service.locked_unit_price,
      address.*
    FROM public.meal_plan_occurrences occurrence
    JOIN public.meal_plan_subscriptions subscription
      ON subscription.id = occurrence.subscription_id
    JOIN public.meal_plan_services service
      ON service.subscription_id = occurrence.subscription_id
     AND service.meal_type = occurrence.meal_type
    JOIN public.addresses address ON address.id = subscription.address_id
    WHERE occurrence.service_date = p_service_date
      AND occurrence.meal_type = p_meal_type
      AND occurrence.status IN ('planned', 'order_created')
      AND subscription.status = 'active'
      AND subscription.payment_status = 'paid'
    ORDER BY occurrence.id
    FOR UPDATE OF occurrence
  LOOP
    v_total := v_total + 1;
    IF v_occurrence.occurrence_status = 'order_created' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.orders orders
        WHERE orders.subscription_occurrence_id = v_occurrence.occurrence_id
      ) THEN
        RAISE EXCEPTION 'An occurrence is marked ordered without its linked order.'
          USING ERRCODE = '23514';
      END IF;
      v_existing := v_existing + 1;
      CONTINUE;
    END IF;
    IF v_occurrence.locked_unit_price IS NULL OR v_occurrence.locked_unit_price <= 0 THEN
      RAISE EXCEPTION 'The accepted quote did not lock a valid service price.'
        USING ERRCODE = '23514';
    END IF;
    IF NOT v_occurrence.is_serviceable OR NOT EXISTS (
      SELECT 1 FROM public.delivery_zones zone
      WHERE zone.id = private.resolve_delivery_zone_v2(
        v_occurrence.latitude, v_occurrence.longitude, v_occurrence.pincode,
        v_occurrence.area, v_occurrence.sector, p_meal_type
      )
        AND zone.status = 'available'
        AND zone.id = v_occurrence.zone_id
    ) THEN
      v_blocked := v_blocked + 1;
      CONTINUE;
    END IF;

    v_slot.id := NULL;
    FOR v_candidate_slot IN
      SELECT slot.* FROM public.delivery_slots slot
      WHERE slot.meal_type = p_meal_type AND slot.is_active
      ORDER BY slot.start_time, slot.id
    LOOP
      SELECT slot.* INTO v_candidate_slot
      FROM public.delivery_slots slot
      WHERE slot.id = v_candidate_slot.id
      FOR UPDATE;
      SELECT coalesce(sum(item.quantity), 0)::INTEGER INTO v_booked
      FROM public.orders orders
      JOIN public.order_items item ON item.order_id = orders.id
      WHERE orders.delivery_slot_id = v_candidate_slot.id
        AND orders.order_date = p_service_date
        AND orders.status <> 'cancelled';
      IF v_booked < v_candidate_slot.max_orders THEN
        v_slot := v_candidate_slot;
        EXIT;
      END IF;
    END LOOP;
    IF v_slot.id IS NULL THEN
      v_blocked := v_blocked + 1;
      CONTINUE;
    END IF;

    v_order_id := gen_random_uuid();
    v_snapshot := to_jsonb(v_occurrence) - ARRAY[
      'occurrence_id', 'reservation_key', 'occurrence_status', 'subscription_id',
      'locked_unit_price', 'user_id', 'address_id'
    ] || jsonb_build_object(
      'zoneId', v_occurrence.zone_id,
      'deliveryFee', 0,
      'slotLabel', v_slot.start_time::TEXT || ' – ' || v_slot.end_time::TEXT,
      'capturedAt', clock_timestamp(),
      'orderSource', 'delivery_day_plan'
    );
    INSERT INTO public.orders(
      id, user_id, address_id, order_number, idempotency_key, request_payload,
      order_date, meal_type, delivery_slot_id, status, subtotal,
      customization_total, delivery_fee, discount, grand_total, payment_status,
      notes, address_snapshot, subscription_id, subscription_occurrence_id
    ) VALUES (
      v_order_id, v_occurrence.user_id, v_occurrence.address_id,
      'THA-PLAN-' || to_char(p_service_date, 'YYYYMMDD') || '-' || left(replace(v_order_id::TEXT, '-', ''), 12),
      v_occurrence.reservation_key,
      jsonb_build_object(
        'source', 'delivery_day_plan',
        'subscription_id', v_occurrence.subscription_id,
        'occurrence_id', v_occurrence.occurrence_id
      ),
      p_service_date, p_meal_type, v_slot.id, 'confirmed',
      v_occurrence.locked_unit_price, 0, 0, 0,
      v_occurrence.locked_unit_price, 'paid', NULL, v_snapshot,
      v_occurrence.subscription_id, v_occurrence.occurrence_id
    );
    INSERT INTO public.order_items(
      order_id, meal_id, meal_name_snapshot, preparation_preferences,
      quantity, unit_price, line_total
    ) VALUES (
      v_order_id, v_meal.id, v_meal.name,
      jsonb_build_object(
        'spiceLevel', 'Regular',
        'oilLevel', 'Standard',
        'dietType', v_meal.diet_type
      ),
      1, v_occurrence.locked_unit_price, v_occurrence.locked_unit_price
    ) RETURNING id INTO v_item_id;
    UPDATE public.meal_plan_occurrences
    SET status = 'order_created'
    WHERE id = v_occurrence.occurrence_id AND status = 'planned';
    INSERT INTO private.meal_plan_events(
      subscription_id, actor_id, event_type, previous_status, next_status, event_data
    ) VALUES (
      v_occurrence.subscription_id, auth.uid(), 'subscription_order_created',
      'planned', 'order_created',
      jsonb_build_object(
        'occurrence_id', v_occurrence.occurrence_id,
        'order_id', v_order_id,
        'service_date', p_service_date,
        'meal_type', p_meal_type,
        'delivery_slot_id', v_slot.id,
        'meal_id', v_meal.id
      )
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'service_date', p_service_date,
    'meal_type', p_meal_type,
    'menu_ready', true,
    'eligible_occurrences', v_total,
    'created_orders', v_created,
    'existing_orders', v_existing,
    'blocked_occurrences', v_blocked
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.materialize_delivery_day_plan_orders(
  p_service_date DATE,
  p_meal_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_kitchen_access();
  RETURN private.materialize_delivery_day_plan_orders(p_service_date, p_meal_type);
END;
$$;

CREATE OR REPLACE FUNCTION private.materialize_plan_order_after_occurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.menu_days day
    JOIN public.menu_items item ON item.menu_day_id = day.id
    WHERE day.menu_date = NEW.service_date
      AND day.is_published
      AND item.availability
      AND NEW.meal_type = ANY(item.service_meal_types)
  ) THEN
    PERFORM private.materialize_delivery_day_plan_orders(NEW.service_date, NEW.meal_type);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER materialize_plan_order_after_occurrence
  AFTER INSERT ON public.meal_plan_occurrences
  FOR EACH ROW EXECUTE FUNCTION private.materialize_plan_order_after_occurrence();

CREATE OR REPLACE FUNCTION private.materialize_plan_orders_after_menu_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_meal_type TEXT;
BEGIN
  IF NEW.is_published THEN
    FOR v_meal_type IN
      SELECT DISTINCT selected.meal_type
      FROM unnest(NEW.service_meal_types) AS selected(meal_type)
      WHERE selected.meal_type IN ('breakfast', 'lunch', 'dinner')
    LOOP
      PERFORM private.materialize_delivery_day_plan_orders(NEW.menu_date, v_meal_type);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER materialize_plan_orders_after_menu_publish
  AFTER INSERT ON private.kitchen_menu_events
  FOR EACH ROW EXECUTE FUNCTION private.materialize_plan_orders_after_menu_publish();

REVOKE ALL ON FUNCTION private.enforce_subscription_order_occurrence(),
  private.materialize_delivery_day_plan_orders(DATE,TEXT),
  private.materialize_plan_order_after_occurrence(),
  private.materialize_plan_orders_after_menu_publish()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.materialize_delivery_day_plan_orders(DATE,TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_delivery_day_plan_orders(DATE,TEXT)
  TO authenticated;

COMMENT ON FUNCTION private.materialize_delivery_day_plan_orders(DATE,TEXT) IS
  'Idempotently converts paid planned occurrences into capacity-counted Kitchen orders after menu publication.';
COMMENT ON FUNCTION public.materialize_delivery_day_plan_orders(DATE,TEXT) IS
  'MFA Kitchen/Admin retry control for published plan occurrences blocked earlier by menu, area, or capacity state.';
