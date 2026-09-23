-- Qualify every identifier used by the promotion write RPC. The original
-- deployed function named an unnested value `id`, which collided with the
-- joined meals/delivery_zones `id` columns during campaign validation.
CREATE OR REPLACE FUNCTION public.save_promotion_campaign(
  p_id UUID,
  p_code TEXT,
  p_name TEXT,
  p_description TEXT,
  p_discount_type TEXT,
  p_discount_value NUMERIC,
  p_minimum_subtotal NUMERIC,
  p_maximum_discount NUMERIC,
  p_total_budget NUMERIC,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_service_date_start DATE,
  p_service_date_end DATE,
  p_is_active BOOLEAN,
  p_first_order_only BOOLEAN,
  p_per_user_limit INTEGER,
  p_eligible_meal_types TEXT[],
  p_eligible_meal_ids UUID[],
  p_eligible_zone_ids TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor UUID := private.require_admin_access();
  target UUID := coalesce(p_id, gen_random_uuid());
  normalized_code TEXT := upper(btrim(coalesce(p_code, '')));
  action_name TEXT;
BEGIN
  IF normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{2,29}$'
    OR length(btrim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 80
    OR length(coalesce(p_description, '')) > 240
  THEN
    RAISE EXCEPTION 'Check the offer code, name and description' USING ERRCODE = '22023';
  END IF;
  IF p_discount_type NOT IN ('fixed', 'percentage')
    OR p_discount_value <= 0
    OR (p_discount_type = 'percentage' AND p_discount_value > 100)
  THEN
    RAISE EXCEPTION 'Check the discount value' USING ERRCODE = '22023';
  END IF;
  IF p_minimum_subtotal < 0
    OR (p_maximum_discount IS NOT NULL AND p_maximum_discount <= 0)
    OR (p_total_budget IS NOT NULL AND p_total_budget <= 0)
    OR p_per_user_limit NOT BETWEEN 1 AND 100
  THEN
    RAISE EXCEPTION 'Check the offer limits' USING ERRCODE = '22023';
  END IF;
  IF p_discount_type = 'fixed'
    AND p_total_budget IS NOT NULL
    AND p_total_budget < least(p_discount_value, coalesce(p_maximum_discount, p_discount_value))
  THEN
    RAISE EXCEPTION 'Campaign budget is lower than one redemption' USING ERRCODE = '22023';
  END IF;
  IF p_starts_at IS NULL
    OR p_ends_at IS NULL
    OR p_ends_at <= p_starts_at
    OR (p_service_date_start IS NOT NULL AND p_service_date_end IS NOT NULL AND p_service_date_end < p_service_date_start)
  THEN
    RAISE EXCEPTION 'Check the offer dates' USING ERRCODE = '22023';
  END IF;
  IF cardinality(coalesce(p_eligible_meal_types, ARRAY[]::TEXT[])) = 0
    OR NOT coalesce(p_eligible_meal_types, ARRAY[]::TEXT[]) <@ ARRAY['breakfast', 'lunch', 'dinner']::TEXT[]
  THEN
    RAISE EXCEPTION 'Choose at least one meal service' USING ERRCODE = '22023';
  END IF;
  IF p_is_active AND p_ends_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'An expired offer cannot be activated' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(p_eligible_meal_ids, ARRAY[]::UUID[])) AS candidate(candidate_id)
    LEFT JOIN public.meals AS meal ON meal.id = candidate.candidate_id
    WHERE meal.id IS NULL
  ) THEN
    RAISE EXCEPTION 'An eligible meal no longer exists';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(p_eligible_zone_ids, ARRAY[]::TEXT[])) AS candidate(candidate_id)
    LEFT JOIN public.delivery_zones AS zone ON zone.id = candidate.candidate_id
    WHERE zone.id IS NULL
  ) THEN
    RAISE EXCEPTION 'An eligible delivery area no longer exists';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO private.promotion_campaigns(
      id, code, name, description, discount_type, discount_value,
      minimum_subtotal, maximum_discount, total_budget, starts_at, ends_at,
      service_date_start, service_date_end, is_active, first_order_only,
      per_user_limit, eligible_meal_types, eligible_meal_ids,
      eligible_zone_ids, created_by, updated_by
    ) VALUES (
      target, normalized_code, btrim(p_name), btrim(coalesce(p_description, '')),
      p_discount_type, p_discount_value, p_minimum_subtotal,
      p_maximum_discount, p_total_budget, p_starts_at, p_ends_at,
      p_service_date_start, p_service_date_end, p_is_active,
      p_first_order_only, p_per_user_limit, p_eligible_meal_types,
      coalesce(p_eligible_meal_ids, ARRAY[]::UUID[]),
      coalesce(p_eligible_zone_ids, ARRAY[]::TEXT[]), actor, actor
    );
    action_name := 'created';
  ELSE
    IF p_total_budget IS NOT NULL AND p_total_budget < (
      SELECT coalesce(sum(redemption.discount_amount), 0)
      FROM private.promotion_redemptions AS redemption
      WHERE redemption.promotion_id = p_id
    ) THEN
      RAISE EXCEPTION 'Campaign budget cannot be lower than discount already spent' USING ERRCODE = '23514';
    END IF;
    UPDATE private.promotion_campaigns AS campaign
    SET code = normalized_code,
        name = btrim(p_name),
        description = btrim(coalesce(p_description, '')),
        discount_type = p_discount_type,
        discount_value = p_discount_value,
        minimum_subtotal = p_minimum_subtotal,
        maximum_discount = p_maximum_discount,
        total_budget = p_total_budget,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        service_date_start = p_service_date_start,
        service_date_end = p_service_date_end,
        is_active = p_is_active,
        first_order_only = p_first_order_only,
        per_user_limit = p_per_user_limit,
        eligible_meal_types = p_eligible_meal_types,
        eligible_meal_ids = coalesce(p_eligible_meal_ids, ARRAY[]::UUID[]),
        eligible_zone_ids = coalesce(p_eligible_zone_ids, ARRAY[]::TEXT[]),
        updated_by = actor,
        updated_at = clock_timestamp()
    WHERE campaign.id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Offer not found' USING ERRCODE = 'P0002';
    END IF;
    action_name := 'updated';
  END IF;

  INSERT INTO private.promotion_events(promotion_id, actor_id, action, snapshot)
  SELECT target, actor, action_name, to_jsonb(campaign)
  FROM private.promotion_campaigns AS campaign
  WHERE campaign.id = target;

  RETURN private.promotion_management_document();
END;
$$;

REVOKE ALL ON FUNCTION public.save_promotion_campaign(
  UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  TIMESTAMPTZ, TIMESTAMPTZ, DATE, DATE, BOOLEAN, BOOLEAN, INTEGER,
  TEXT[], UUID[], TEXT[]
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_promotion_campaign(
  UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  TIMESTAMPTZ, TIMESTAMPTZ, DATE, DATE, BOOLEAN, BOOLEAN, INTEGER,
  TEXT[], UUID[], TEXT[]
) TO authenticated;
