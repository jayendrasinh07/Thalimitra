-- Cover new foreign keys and cache auth helpers once per RLS statement.

CREATE INDEX meal_plan_commands_actor_idx
  ON private.meal_plan_commands(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX meal_plan_service_blackouts_created_by_idx
  ON public.meal_plan_service_blackouts(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX meal_plan_payments_quote_subscription_idx
  ON public.meal_plan_payments(quote_id, subscription_id);

DROP POLICY meal_plan_service_blackouts_staff_read
  ON public.meal_plan_service_blackouts;
CREATE POLICY meal_plan_service_blackouts_staff_read
  ON public.meal_plan_service_blackouts FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin((SELECT auth.uid())))
    OR (
      (SELECT coalesce(auth.jwt()->>'aal', 'aal1')) = 'aal2'
      AND EXISTS (
        SELECT 1 FROM public.user_roles role
        WHERE role.user_id = (SELECT auth.uid()) AND role.role = 'kitchen'
      )
    )
  );

DROP POLICY meal_plan_pause_days_read_own_admin_or_kitchen
  ON public.meal_plan_pause_days;
CREATE POLICY meal_plan_pause_days_read_own_admin_or_kitchen
  ON public.meal_plan_pause_days FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plan_subscriptions subscription
    WHERE subscription.id = meal_plan_pause_days.subscription_id
      AND (
        subscription.user_id = (SELECT auth.uid())
        OR (SELECT public.is_admin((SELECT auth.uid())))
        OR (
          (SELECT coalesce(auth.jwt()->>'aal', 'aal1')) = 'aal2'
          AND EXISTS (
            SELECT 1 FROM public.user_roles role
            WHERE role.user_id = (SELECT auth.uid()) AND role.role = 'kitchen'
          )
        )
      )
  ));
