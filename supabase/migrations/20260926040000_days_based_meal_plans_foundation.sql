-- Additive foundation for delivery-day meal plans.
-- The existing meal_subscriptions workflow remains intact until the new flow is enabled.

CREATE TABLE public.meal_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code IN ('starter_7_days', 'regular_15_days', 'monthly_30_days')),
  customer_name TEXT NOT NULL CHECK (char_length(customer_name) BETWEEN 3 AND 80),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 3 AND 240),
  delivery_days INTEGER NOT NULL CHECK (delivery_days IN (7, 15, 30)),
  is_active BOOLEAN NOT NULL DEFAULT false,
  display_order SMALLINT NOT NULL CHECK (display_order BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meal_plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_subscription_id UUID UNIQUE REFERENCES public.meal_subscriptions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE RESTRICT,
  template_id UUID NOT NULL REFERENCES public.meal_plan_templates(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'quoted', 'accepted', 'payment_pending', 'active', 'paused',
    'completed', 'cancelled', 'rejected'
  )),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partially_refunded')),
  preferred_start_date DATE NOT NULL,
  expected_completion_date DATE,
  customer_note TEXT CHECK (customer_note IS NULL OR char_length(customer_note) <= 500),
  activated_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expected_completion_date IS NULL OR expected_completion_date >= preferred_start_date)
);

CREATE TABLE public.meal_plan_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.meal_plan_subscriptions(id) ON DELETE RESTRICT,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  locked_unit_price NUMERIC(10,2) CHECK (locked_unit_price IS NULL OR locked_unit_price > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, meal_type)
);

CREATE TABLE public.meal_plan_weekdays (
  subscription_id UUID NOT NULL,
  meal_type TEXT NOT NULL,
  iso_weekday SMALLINT NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, meal_type, iso_weekday),
  FOREIGN KEY (subscription_id, meal_type)
    REFERENCES public.meal_plan_services(subscription_id, meal_type) ON DELETE RESTRICT
);

CREATE TABLE public.meal_plan_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.meal_plan_subscriptions(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'offered', 'accepted', 'declined', 'expired', 'superseded')),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  subtotal_amount NUMERIC(10,2) NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  valid_until TIMESTAMPTZ,
  offered_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, version),
  UNIQUE (id, subscription_id),
  CHECK (total_amount = subtotal_amount - discount_amount + delivery_fee + tax_amount),
  CHECK (discount_amount <= subtotal_amount)
);

CREATE TABLE public.meal_plan_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.meal_plan_quotes(id) ON DELETE RESTRICT,
  item_type TEXT NOT NULL CHECK (item_type IN ('service', 'delivery', 'discount', 'tax', 'adjustment')),
  meal_type TEXT CHECK (meal_type IS NULL OR meal_type IN ('breakfast', 'lunch', 'dinner')),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_amount NUMERIC(10,2) NOT NULL,
  line_amount NUMERIC(10,2) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (line_amount = quantity * unit_amount)
);

ALTER TABLE public.meal_plan_subscriptions
  ADD COLUMN accepted_quote_id UUID,
  ADD CONSTRAINT meal_plan_subscriptions_accepted_quote_fk
    FOREIGN KEY (accepted_quote_id, id)
    REFERENCES public.meal_plan_quotes(id, subscription_id) ON DELETE RESTRICT;

CREATE TABLE public.meal_plan_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
  meal_type TEXT NOT NULL,
  service_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'reserved', 'order_created', 'fulfilled', 'customer_skipped',
    'kitchen_cancelled', 'cancelled', 'credited'
  )),
  entitlement_quantity SMALLINT NOT NULL DEFAULT 1 CHECK (entitlement_quantity = 1),
  reservation_key UUID NOT NULL DEFAULT gen_random_uuid(),
  fulfilled_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, service_date, meal_type),
  UNIQUE (reservation_key),
  UNIQUE (id, subscription_id),
  FOREIGN KEY (subscription_id, meal_type)
    REFERENCES public.meal_plan_services(subscription_id, meal_type) ON DELETE RESTRICT
);

CREATE TABLE public.meal_plan_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.meal_plan_subscriptions(id) ON DELETE RESTRICT,
  occurrence_id UUID,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'credit_granted', 'reserved', 'reservation_released', 'fulfilled',
    'customer_skip_credit', 'kitchen_cancel_credit', 'cancelled', 'refunded'
  )),
  quantity INTEGER NOT NULL CHECK (quantity <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  idempotency_key UUID NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, idempotency_key),
  FOREIGN KEY (occurrence_id, subscription_id)
    REFERENCES public.meal_plan_occurrences(id, subscription_id) ON DELETE RESTRICT
);

CREATE TABLE private.meal_plan_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.meal_plan_subscriptions(id) ON DELETE RESTRICT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (char_length(event_type) BETWEEN 2 AND 80),
  previous_status TEXT,
  next_status TEXT,
  event_data JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(event_data) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
  ADD COLUMN subscription_id UUID REFERENCES public.meal_plan_subscriptions(id) ON DELETE RESTRICT,
  ADD COLUMN subscription_occurrence_id UUID,
  ADD CONSTRAINT orders_subscription_occurrence_pair
    CHECK ((subscription_id IS NULL) = (subscription_occurrence_id IS NULL)),
  ADD CONSTRAINT orders_subscription_occurrence_fk
    FOREIGN KEY (subscription_occurrence_id, subscription_id)
    REFERENCES public.meal_plan_occurrences(id, subscription_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX meal_plan_templates_display_order_unique ON public.meal_plan_templates(display_order);
CREATE UNIQUE INDEX meal_plan_subscriptions_one_open_per_customer
  ON public.meal_plan_subscriptions(user_id)
  WHERE status IN ('requested', 'quoted', 'accepted', 'payment_pending', 'active', 'paused');
CREATE INDEX meal_plan_subscriptions_admin_queue_idx ON public.meal_plan_subscriptions(status, created_at DESC);
CREATE INDEX meal_plan_subscriptions_customer_idx ON public.meal_plan_subscriptions(user_id, created_at DESC);
CREATE INDEX meal_plan_subscriptions_address_idx ON public.meal_plan_subscriptions(address_id);
CREATE INDEX meal_plan_subscriptions_template_idx ON public.meal_plan_subscriptions(template_id);
CREATE INDEX meal_plan_subscriptions_accepted_quote_idx
  ON public.meal_plan_subscriptions(accepted_quote_id) WHERE accepted_quote_id IS NOT NULL;
CREATE INDEX meal_plan_services_subscription_idx ON public.meal_plan_services(subscription_id);
CREATE INDEX meal_plan_weekdays_schedule_idx ON public.meal_plan_weekdays(iso_weekday, meal_type);
CREATE INDEX meal_plan_quotes_subscription_idx ON public.meal_plan_quotes(subscription_id, version DESC);
CREATE INDEX meal_plan_quotes_created_by_idx ON public.meal_plan_quotes(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX meal_plan_quote_items_quote_idx ON public.meal_plan_quote_items(quote_id);
CREATE INDEX meal_plan_occurrences_kitchen_idx ON public.meal_plan_occurrences(service_date, meal_type, status);
CREATE INDEX meal_plan_occurrences_subscription_idx ON public.meal_plan_occurrences(subscription_id, service_date);
CREATE INDEX meal_plan_ledger_subscription_idx ON public.meal_plan_ledger(subscription_id, created_at, id);
CREATE INDEX meal_plan_ledger_occurrence_idx ON public.meal_plan_ledger(occurrence_id) WHERE occurrence_id IS NOT NULL;
CREATE INDEX meal_plan_events_subscription_idx ON private.meal_plan_events(subscription_id, created_at, id);
CREATE INDEX meal_plan_events_actor_idx ON private.meal_plan_events(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX orders_subscription_idx ON public.orders(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE UNIQUE INDEX orders_subscription_occurrence_unique
  ON public.orders(subscription_occurrence_id) WHERE subscription_occurrence_id IS NOT NULL;

CREATE TRIGGER meal_plan_templates_updated_at
  BEFORE UPDATE ON public.meal_plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER meal_plan_subscriptions_updated_at
  BEFORE UPDATE ON public.meal_plan_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER meal_plan_quotes_updated_at
  BEFORE UPDATE ON public.meal_plan_quotes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER meal_plan_occurrences_updated_at
  BEFORE UPDATE ON public.meal_plan_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION private.reject_meal_plan_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Meal plan history is immutable.' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER meal_plan_quote_items_immutable
  BEFORE UPDATE OR DELETE ON public.meal_plan_quote_items
  FOR EACH ROW EXECUTE FUNCTION private.reject_meal_plan_immutable_mutation();
CREATE TRIGGER meal_plan_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.meal_plan_ledger
  FOR EACH ROW EXECUTE FUNCTION private.reject_meal_plan_immutable_mutation();
CREATE TRIGGER meal_plan_events_immutable
  BEFORE UPDATE OR DELETE ON private.meal_plan_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_meal_plan_immutable_mutation();

ALTER TABLE public.meal_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_weekdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_plan_templates_public_read_active
  ON public.meal_plan_templates FOR SELECT TO anon, authenticated
  USING (is_active OR public.is_admin((SELECT auth.uid())));
CREATE POLICY meal_plan_subscriptions_read_own_or_admin
  ON public.meal_plan_subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())));
CREATE POLICY meal_plan_services_read_own_or_admin
  ON public.meal_plan_services FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plan_subscriptions s
    WHERE s.id = subscription_id
      AND (s.user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
  ));
CREATE POLICY meal_plan_weekdays_read_own_or_admin
  ON public.meal_plan_weekdays FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plan_subscriptions s
    WHERE s.id = subscription_id
      AND (s.user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
  ));
CREATE POLICY meal_plan_quotes_read_own_or_admin
  ON public.meal_plan_quotes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plan_subscriptions s
    WHERE s.id = subscription_id
      AND (s.user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
  ));
CREATE POLICY meal_plan_quote_items_read_own_or_admin
  ON public.meal_plan_quote_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plan_quotes q
    JOIN public.meal_plan_subscriptions s ON s.id = q.subscription_id
    WHERE q.id = quote_id
      AND (s.user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
  ));
CREATE POLICY meal_plan_occurrences_read_own_admin_or_kitchen
  ON public.meal_plan_occurrences FOR SELECT TO authenticated
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
CREATE POLICY meal_plan_ledger_read_own_or_admin
  ON public.meal_plan_ledger FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plan_subscriptions s
    WHERE s.id = subscription_id
      AND (s.user_id = (SELECT auth.uid()) OR public.is_admin((SELECT auth.uid())))
  ));

REVOKE ALL ON public.meal_plan_templates, public.meal_plan_subscriptions,
  public.meal_plan_services, public.meal_plan_weekdays, public.meal_plan_quotes,
  public.meal_plan_quote_items, public.meal_plan_occurrences, public.meal_plan_ledger
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.meal_plan_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reject_meal_plan_immutable_mutation() FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.meal_plan_templates TO anon, authenticated;
GRANT SELECT ON public.meal_plan_subscriptions, public.meal_plan_services,
  public.meal_plan_weekdays, public.meal_plan_quotes, public.meal_plan_quote_items,
  public.meal_plan_occurrences, public.meal_plan_ledger TO authenticated;

INSERT INTO public.meal_plan_templates (code, customer_name, description, delivery_days, is_active, display_order)
VALUES
  ('starter_7_days', '7-Day Starter Plan', 'Try a short delivery routine before planning more.', 7, false, 10),
  ('regular_15_days', '15-Day Regular Plan', 'Build a steady work or study meal routine.', 15, false, 20),
  ('monthly_30_days', '30-Day Monthly Plan', 'Plan a complete monthly meal routine.', 30, false, 30);

COMMENT ON TABLE public.meal_plan_templates IS 'Admin-controlled delivery-day plan catalog. Seeded templates remain inactive until rollout approval.';
COMMENT ON TABLE public.meal_plan_occurrences IS 'One immutable entitlement target per subscription date and selected service.';
COMMENT ON TABLE public.meal_plan_ledger IS 'Append-only entitlement accounting; balances must be changed only by guarded database functions.';
COMMENT ON COLUMN public.meal_plan_subscriptions.legacy_subscription_id IS 'Optional link used to migrate an existing meal_subscriptions request without deleting history.';
COMMENT ON COLUMN public.orders.subscription_occurrence_id IS 'Exact entitlement occurrence consumed by this generated subscription order.';
