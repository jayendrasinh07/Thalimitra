CREATE INDEX meal_subscriptions_address_idx
  ON public.meal_subscriptions(address_id);

CREATE INDEX meal_subscription_events_actor_idx
  ON private.meal_subscription_events(actor_id);

DROP POLICY meal_subscriptions_customer_read_own ON public.meal_subscriptions;
DROP POLICY meal_subscriptions_admin_read ON public.meal_subscriptions;

CREATE POLICY meal_subscriptions_read_own_or_admin
  ON public.meal_subscriptions FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin((SELECT auth.uid()))
  );
