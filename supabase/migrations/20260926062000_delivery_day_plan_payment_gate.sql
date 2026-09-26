-- Manual payment verification and server-enforced activation gate.

CREATE TABLE public.meal_plan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.meal_plan_subscriptions(id) ON DELETE RESTRICT,
  quote_id UUID NOT NULL REFERENCES public.meal_plan_quotes(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('manual_upi', 'manual_bank', 'cash')),
  payment_reference TEXT NOT NULL CHECK (char_length(btrim(payment_reference)) BETWEEN 3 AND 120),
  status TEXT NOT NULL DEFAULT 'verified' CHECK (status = 'verified'),
  verified_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id),
  UNIQUE (quote_id),
  FOREIGN KEY (quote_id, subscription_id)
    REFERENCES public.meal_plan_quotes(id, subscription_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX meal_plan_payments_reference_unique
  ON public.meal_plan_payments (lower(btrim(payment_reference)));
CREATE INDEX meal_plan_payments_verified_by_idx ON public.meal_plan_payments(verified_by, verified_at DESC);

CREATE TRIGGER meal_plan_payments_immutable
  BEFORE UPDATE OR DELETE ON public.meal_plan_payments
  FOR EACH ROW EXECUTE FUNCTION private.reject_meal_plan_immutable_mutation();

ALTER TABLE public.meal_plan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY meal_plan_payments_admin_read
  ON public.meal_plan_payments FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));
REVOKE ALL ON public.meal_plan_payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meal_plan_payments TO authenticated;

CREATE OR REPLACE FUNCTION private.enforce_meal_plan_activation_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active')
     OR (NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid') THEN
    IF NEW.accepted_quote_id IS NULL
       OR NEW.payment_status <> 'paid'
       OR NOT EXISTS (
         SELECT 1
         FROM public.meal_plan_quotes q
         JOIN public.meal_plan_payments payment
           ON payment.quote_id = q.id AND payment.subscription_id = NEW.id
         WHERE q.id = NEW.accepted_quote_id
           AND q.subscription_id = NEW.id
           AND q.status = 'accepted'
           AND payment.status = 'verified'
           AND payment.amount = q.total_amount
       ) THEN
      RAISE EXCEPTION 'An accepted quote and verified full payment are required for activation.' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meal_plan_subscriptions_activation_gate ON public.meal_plan_subscriptions;
CREATE TRIGGER meal_plan_subscriptions_activation_gate
  BEFORE UPDATE OF status, payment_status, accepted_quote_id ON public.meal_plan_subscriptions
  FOR EACH ROW EXECUTE FUNCTION private.enforce_meal_plan_activation_gate();

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
      'address', concat_ws(', ',
        nullif(a.house_flat_number, ''), nullif(a.building_name, ''),
        nullif(a.street, ''), nullif(a.area, ''), nullif(a.sector, ''),
        nullif(a.city, ''), nullif(a.pincode, '')
      )
    ),
    'payment', CASE WHEN payment.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', payment.id,
      'amount', payment.amount,
      'currency', payment.currency,
      'payment_method', payment.payment_method,
      'status', payment.status,
      'verified_at', payment.verified_at
    ) END
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
    'subscriptions', coalesce((
      SELECT jsonb_agg(private.meal_plan_management_document(s.id) ORDER BY
        CASE s.status WHEN 'requested' THEN 0 WHEN 'quoted' THEN 1 WHEN 'accepted' THEN 2
          WHEN 'payment_pending' THEN 3 WHEN 'active' THEN 4 ELSE 5 END,
        s.created_at DESC
      )
      FROM public.meal_plan_subscriptions s
    ), '[]'::JSONB)
  );
END;
$$;

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
  INSERT INTO private.meal_plan_events (
    subscription_id, actor_id, event_type, previous_status, next_status, event_data
  ) VALUES (
    p_subscription_id, v_actor, 'payment_verified_and_activated', 'accepted', 'active',
    jsonb_build_object(
      'quote_id', v_quote.id,
      'payment_id', v_payment_id,
      'amount', v_quote.total_amount,
      'payment_method', p_payment_method
    )
  );
  RETURN private.meal_plan_management_document(p_subscription_id);
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_meal_plan_activation_gate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.meal_plan_management_document(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_and_activate_delivery_day_plan(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_and_activate_delivery_day_plan(UUID,TEXT,TEXT) TO authenticated;

COMMENT ON TABLE public.meal_plan_payments IS 'Append-only manual payment verification records. References are Operations-only and never returned to customers.';
COMMENT ON FUNCTION public.verify_and_activate_delivery_day_plan(UUID,TEXT,TEXT)
  IS 'MFA-admin-only atomic full-payment verification and activation after explicit customer quote acceptance.';
