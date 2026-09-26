-- Keep the new Phase 5 schema clear of fresh advisor findings while retaining
-- RPC-only writes and reads.
CREATE POLICY meal_plan_commercial_policy_admin_read
  ON public.meal_plan_commercial_policy FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

CREATE INDEX meal_plan_commercial_policy_updated_by_idx
  ON public.meal_plan_commercial_policy(updated_by)
  WHERE updated_by IS NOT NULL;
CREATE INDEX meal_plan_financial_decisions_actor_idx
  ON private.meal_plan_financial_decisions(actor_id, created_at DESC);
