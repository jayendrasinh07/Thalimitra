-- Generate one duplicate-safe delivery occurrence per active plan day and service.

CREATE TABLE public.meal_plan_service_blackouts (
  service_date DATE NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'all'
    CHECK (meal_type IN ('all', 'breakfast', 'lunch', 'dinner')),
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 240),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_date, meal_type)
);

CREATE TABLE public.meal_plan_pause_days (
  subscription_id UUID NOT NULL REFERENCES public.meal_plan_subscriptions(id) ON DELETE RESTRICT,
  service_date DATE NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'all'
    CHECK (meal_type IN ('all', 'breakfast', 'lunch', 'dinner')),
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, service_date, meal_type)
);

CREATE INDEX meal_plan_service_blackouts_date_idx
  ON public.meal_plan_service_blackouts(service_date);
CREATE INDEX meal_plan_pause_days_schedule_idx
  ON public.meal_plan_pause_days(subscription_id, service_date);

ALTER TABLE public.meal_plan_service_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_pause_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_plan_service_blackouts_staff_read
  ON public.meal_plan_service_blackouts FOR SELECT TO authenticated
  USING (
    public.is_admin((SELECT auth.uid()))
    OR (
      coalesce((SELECT auth.jwt()->>'aal'), 'aal1') = 'aal2'
      AND EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'kitchen'
      )
    )
  );

CREATE POLICY meal_plan_pause_days_read_own_admin_or_kitchen
  ON public.meal_plan_pause_days FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plan_subscriptions s
    WHERE s.id = subscription_id
      AND (
        s.user_id = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
        OR (
          coalesce((SELECT auth.jwt()->>'aal'), 'aal1') = 'aal2'
          AND EXISTS (
            SELECT 1 FROM public.user_roles r
            WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'kitchen'
          )
        )
      )
  ));

REVOKE ALL ON public.meal_plan_service_blackouts, public.meal_plan_pause_days
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meal_plan_service_blackouts, public.meal_plan_pause_days
  TO authenticated;

CREATE OR REPLACE FUNCTION private.generate_meal_plan_occurrences(p_subscription_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscription public.meal_plan_subscriptions%ROWTYPE;
  v_delivery_days INTEGER;
  v_service RECORD;
  v_candidate DATE;
  v_existing INTEGER;
  v_inserted INTEGER := 0;
  v_row_count INTEGER;
  v_completion_date DATE;
BEGIN
  SELECT s.* INTO v_subscription
  FROM public.meal_plan_subscriptions s
  WHERE s.id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery-day plan request was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_subscription.status <> 'active' OR v_subscription.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Only an active paid delivery-day plan can generate delivery dates.'
      USING ERRCODE = '22023';
  END IF;

  SELECT t.delivery_days INTO v_delivery_days
  FROM public.meal_plan_templates t
  WHERE t.id = v_subscription.template_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.meal_plan_services service
    WHERE service.subscription_id = p_subscription_id
  ) THEN
    RAISE EXCEPTION 'At least one meal service is required.' USING ERRCODE = '22023';
  END IF;

  FOR v_service IN
    SELECT service.meal_type
    FROM public.meal_plan_services service
    WHERE service.subscription_id = p_subscription_id
    ORDER BY service.meal_type
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.meal_plan_weekdays weekday
      WHERE weekday.subscription_id = p_subscription_id
        AND weekday.meal_type = v_service.meal_type
    ) THEN
      RAISE EXCEPTION 'Delivery weekdays are missing for %.', initcap(v_service.meal_type)
        USING ERRCODE = '22023';
    END IF;

    SELECT count(*)::INTEGER INTO v_existing
    FROM public.meal_plan_occurrences occurrence
    WHERE occurrence.subscription_id = p_subscription_id
      AND occurrence.meal_type = v_service.meal_type;
    IF v_existing > v_delivery_days THEN
      RAISE EXCEPTION 'The delivery calendar exceeds the purchased entitlement.'
        USING ERRCODE = '23514';
    END IF;

    v_candidate := v_subscription.preferred_start_date;
    WHILE v_existing < v_delivery_days LOOP
      IF v_candidate > v_subscription.preferred_start_date + 730 THEN
        RAISE EXCEPTION 'The delivery calendar could not be completed within two years.'
          USING ERRCODE = '22023';
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.meal_plan_weekdays weekday
        WHERE weekday.subscription_id = p_subscription_id
          AND weekday.meal_type = v_service.meal_type
          AND weekday.iso_weekday = extract(isodow FROM v_candidate)::SMALLINT
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.meal_plan_service_blackouts blackout
        WHERE blackout.service_date = v_candidate
          AND blackout.meal_type IN ('all', v_service.meal_type)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.meal_plan_pause_days pause_day
        WHERE pause_day.subscription_id = p_subscription_id
          AND pause_day.service_date = v_candidate
          AND pause_day.meal_type IN ('all', v_service.meal_type)
      ) THEN
        INSERT INTO public.meal_plan_occurrences (
          subscription_id, meal_type, service_date, status
        ) VALUES (
          p_subscription_id, v_service.meal_type, v_candidate, 'planned'
        )
        ON CONFLICT (subscription_id, service_date, meal_type) DO NOTHING;
        GET DIAGNOSTICS v_row_count = ROW_COUNT;
        v_existing := v_existing + v_row_count;
        v_inserted := v_inserted + v_row_count;
      END IF;
      v_candidate := v_candidate + 1;
    END LOOP;
  END LOOP;

  SELECT max(occurrence.service_date) INTO v_completion_date
  FROM public.meal_plan_occurrences occurrence
  WHERE occurrence.subscription_id = p_subscription_id;
  UPDATE public.meal_plan_subscriptions
  SET expected_completion_date = v_completion_date
  WHERE id = p_subscription_id
    AND expected_completion_date IS DISTINCT FROM v_completion_date;

  IF v_inserted > 0 THEN
    INSERT INTO private.meal_plan_events (
      subscription_id, actor_id, event_type, previous_status, next_status, event_data
    ) VALUES (
      p_subscription_id, auth.uid(), 'occurrence_calendar_generated', 'active', 'active',
      jsonb_build_object(
        'inserted_occurrences', v_inserted,
        'expected_completion_date', v_completion_date
      )
    );
  END IF;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION private.generate_meal_plan_occurrences(UUID)
  FROM PUBLIC, anon, authenticated;

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
  v_reference TEXT := btrim(coalesce(p_payment_reference, ''));
BEGIN
  IF char_length(v_reference) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Enter a valid payment reference.' USING ERRCODE = '22023';
  END IF;
  IF p_payment_method NOT IN ('manual_upi', 'manual_bank', 'cash') THEN
    RAISE EXCEPTION 'Choose a valid payment method.' USING ERRCODE = '22023';
  END IF;

  SELECT s.* INTO v_subscription
  FROM public.meal_plan_subscriptions s
  WHERE s.id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery-day plan request was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_subscription.status <> 'accepted' OR v_subscription.payment_status <> 'pending'
     OR v_subscription.accepted_quote_id IS NULL THEN
    RAISE EXCEPTION 'Customer acceptance is required before payment verification.' USING ERRCODE = '22023';
  END IF;
  SELECT q.* INTO v_quote
  FROM public.meal_plan_quotes q
  WHERE q.id = v_subscription.accepted_quote_id
    AND q.subscription_id = p_subscription_id
  FOR SHARE;
  IF NOT FOUND OR v_quote.status <> 'accepted' OR v_quote.total_amount <= 0 THEN
    RAISE EXCEPTION 'A valid accepted quote is required before activation.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.meal_plan_payments (
      subscription_id, quote_id, amount, payment_method,
      payment_reference, verified_by
    ) VALUES (
      p_subscription_id, v_quote.id, v_quote.total_amount, p_payment_method,
      v_reference, v_actor
    ) RETURNING id INTO v_payment_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This payment reference has already been used.' USING ERRCODE = '23505';
  END;

  UPDATE public.meal_plan_subscriptions s
  SET payment_status = 'paid', status = 'active', activated_at = now()
  WHERE s.id = p_subscription_id;
  v_generated := private.generate_meal_plan_occurrences(p_subscription_id);

  INSERT INTO private.meal_plan_events (
    subscription_id, actor_id, event_type, previous_status, next_status, event_data
  ) VALUES (
    p_subscription_id, v_actor, 'payment_verified_and_activated', 'accepted', 'active',
    jsonb_build_object(
      'quote_id', v_quote.id,
      'payment_id', v_payment_id,
      'amount', v_quote.total_amount,
      'payment_method', p_payment_method,
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

COMMENT ON TABLE public.meal_plan_service_blackouts IS
  'Operations-owned closed dates excluded from newly generated delivery-day plan calendars.';
COMMENT ON TABLE public.meal_plan_pause_days IS
  'Subscription-specific paused dates excluded from newly generated delivery-day plan calendars.';
COMMENT ON FUNCTION private.generate_meal_plan_occurrences(UUID) IS
  'Serialised idempotent calendar generation for an active paid delivery-day plan.';
