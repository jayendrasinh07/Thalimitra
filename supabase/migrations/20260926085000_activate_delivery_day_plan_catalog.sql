-- Phase 6 controlled rollout: publish the reviewed 7, 15 and 30 delivery-day
-- templates after the backend, customer, Operations and Kitchen gates passed.
UPDATE public.meal_plan_templates
SET is_active = true, updated_at = now()
WHERE code IN ('starter_7_days','regular_15_days','monthly_30_days');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.meal_plan_templates WHERE is_active) <> 3 THEN
    RAISE EXCEPTION 'Delivery-day plan catalog rollout is incomplete.';
  END IF;
END;
$$;
