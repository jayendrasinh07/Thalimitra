-- Cover composite foreign keys and keep auth context as an RLS initplan.

CREATE INDEX meal_plan_ledger_occurrence_subscription_idx
  ON public.meal_plan_ledger(occurrence_id, subscription_id)
  WHERE occurrence_id IS NOT NULL;

CREATE INDEX meal_plan_occurrences_service_fk_idx
  ON public.meal_plan_occurrences(subscription_id, meal_type);

CREATE INDEX meal_plan_subscriptions_accepted_quote_fk_idx
  ON public.meal_plan_subscriptions(accepted_quote_id, id)
  WHERE accepted_quote_id IS NOT NULL;

CREATE INDEX orders_subscription_occurrence_fk_idx
  ON public.orders(subscription_occurrence_id, subscription_id)
  WHERE subscription_occurrence_id IS NOT NULL;

DROP POLICY meal_plan_occurrences_read_own_admin_or_kitchen
  ON public.meal_plan_occurrences;

CREATE POLICY meal_plan_occurrences_read_own_admin_or_kitchen
  ON public.meal_plan_occurrences FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plan_subscriptions s
    WHERE s.id = subscription_id
      AND (
        s.user_id = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
        OR (
          coalesce((SELECT auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
          AND EXISTS (
            SELECT 1 FROM public.user_roles r
            WHERE r.user_id = (SELECT auth.uid()) AND r.role = 'kitchen'
          )
        )
      )
  ));
