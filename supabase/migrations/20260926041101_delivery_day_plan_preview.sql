-- Server-owned schedule and current-menu estimate for delivery-day plans.

CREATE OR REPLACE FUNCTION private.normalize_plan_weekdays(p_weekdays SMALLINT[])
RETURNS SMALLINT[]
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT coalesce(array_agg(day ORDER BY day), '{}'::SMALLINT[])
  FROM (
    SELECT value AS day
    FROM unnest(p_weekdays) AS selected(value)
    WHERE value BETWEEN 1 AND 7
    GROUP BY value
  ) normalized;
$$;

CREATE OR REPLACE FUNCTION private.meal_plan_schedule_document(
  p_delivery_days INTEGER,
  p_weekdays SMALLINT[],
  p_start_date DATE
) RETURNS JSONB
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  WITH eligible_days AS (
    SELECT candidate::DATE AS service_date
    FROM generate_series(
      p_start_date::TIMESTAMP,
      (p_start_date + 366)::TIMESTAMP,
      INTERVAL '1 day'
    ) AS candidate
    WHERE extract(isodow FROM candidate)::SMALLINT = ANY (p_weekdays)
    ORDER BY candidate
    LIMIT p_delivery_days
  )
  SELECT jsonb_build_object(
    'first_delivery_date', min(service_date),
    'expected_completion_date', max(service_date),
    'scheduled_days', count(*)::INTEGER
  )
  FROM eligible_days;
$$;

CREATE OR REPLACE FUNCTION public.preview_delivery_day_plan(
  p_template_code TEXT,
  p_meal_types TEXT[],
  p_weekdays SMALLINT[],
  p_address_id UUID,
  p_preferred_start_date DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := private.require_customer_access();
  v_template public.meal_plan_templates%ROWTYPE;
  v_meal_types TEXT[] := private.normalize_subscription_meal_types(p_meal_types);
  v_weekdays SMALLINT[] := private.normalize_plan_weekdays(p_weekdays);
  v_delivery JSONB;
  v_schedule JSONB;
  v_meal_type TEXT;
  v_missing_prices INTEGER;
  v_minimum_per_day NUMERIC(10,2);
  v_maximum_per_day NUMERIC(10,2);
  v_service_ranges JSONB;
  v_delivery_fee_per_occurrence NUMERIC(10,2);
  v_delivery_fee_total NUMERIC(10,2);
BEGIN
  SELECT template.* INTO v_template
  FROM public.meal_plan_templates template
  WHERE template.code = p_template_code AND template.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This delivery-day plan is not currently available.' USING ERRCODE = '22023';
  END IF;

  IF p_meal_types IS NULL OR cardinality(v_meal_types) NOT BETWEEN 1 AND 3
     OR cardinality(v_meal_types) <> cardinality(p_meal_types) THEN
    RAISE EXCEPTION 'Choose one or more valid meal services.' USING ERRCODE = '22023';
  END IF;
  IF p_weekdays IS NULL OR cardinality(v_weekdays) NOT BETWEEN 1 AND 7
     OR cardinality(v_weekdays) <> cardinality(p_weekdays) THEN
    RAISE EXCEPTION 'Choose one or more valid delivery weekdays.' USING ERRCODE = '22023';
  END IF;
  IF p_preferred_start_date < (now() AT TIME ZONE 'Asia/Kolkata')::DATE
     OR p_preferred_start_date > (now() AT TIME ZONE 'Asia/Kolkata')::DATE + 60 THEN
    RAISE EXCEPTION 'Choose a start date within the next 60 days.' USING ERRCODE = '22023';
  END IF;

  v_delivery := public.quote_delivery_address(p_address_id);
  FOREACH v_meal_type IN ARRAY v_meal_types LOOP
    IF coalesce((v_delivery->'services'->>v_meal_type)::BOOLEAN, false) IS NOT TRUE THEN
      RAISE EXCEPTION '% service is not available at this address.', initcap(v_meal_type)
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  v_schedule := private.meal_plan_schedule_document(
    v_template.delivery_days,
    v_weekdays,
    p_preferred_start_date
  );
  IF (v_schedule->>'scheduled_days')::INTEGER <> v_template.delivery_days THEN
    RAISE EXCEPTION 'The selected schedule could not be calculated.' USING ERRCODE = '22023';
  END IF;

  WITH selected_services AS (
    SELECT unnest(v_meal_types) AS meal_type
  ), service_prices AS (
    SELECT selected.meal_type,
      min(meal.base_price)::NUMERIC(10,2) AS minimum_price,
      max(meal.base_price)::NUMERIC(10,2) AS maximum_price
    FROM selected_services selected
    LEFT JOIN public.meals meal
      ON meal.is_active
      AND (
        meal.meal_type = selected.meal_type
        OR (meal.meal_type = 'both' AND selected.meal_type IN ('lunch', 'dinner'))
      )
    GROUP BY selected.meal_type
  )
  SELECT
    count(*) FILTER (WHERE minimum_price IS NULL),
    coalesce(sum(minimum_price), 0)::NUMERIC(10,2),
    coalesce(sum(maximum_price), 0)::NUMERIC(10,2),
    jsonb_agg(jsonb_build_object(
      'meal_type', meal_type,
      'minimum_unit_price', minimum_price,
      'maximum_unit_price', maximum_price
    ) ORDER BY CASE meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END)
  INTO v_missing_prices, v_minimum_per_day, v_maximum_per_day, v_service_ranges
  FROM service_prices;

  IF v_missing_prices > 0 THEN
    RAISE EXCEPTION 'A current menu price is not available for every selected service.' USING ERRCODE = '22023';
  END IF;

  v_delivery_fee_per_occurrence := coalesce((v_delivery->>'deliveryFee')::NUMERIC, 0);
  v_delivery_fee_total := round(
    v_delivery_fee_per_occurrence * v_template.delivery_days * cardinality(v_meal_types),
    2
  );

  RETURN jsonb_build_object(
    'template_code', v_template.code,
    'plan_name', v_template.customer_name,
    'delivery_days', v_template.delivery_days,
    'meal_types', to_jsonb(v_meal_types),
    'weekdays', to_jsonb(v_weekdays),
    'meals_per_delivery_day', cardinality(v_meal_types),
    'total_meal_occurrences', v_template.delivery_days * cardinality(v_meal_types),
    'first_delivery_date', v_schedule->>'first_delivery_date',
    'expected_completion_date', v_schedule->>'expected_completion_date',
    'currency', 'INR',
    'service_price_ranges', v_service_ranges,
    'estimated_subtotal_min', round(v_minimum_per_day * v_template.delivery_days, 2),
    'estimated_subtotal_max', round(v_maximum_per_day * v_template.delivery_days, 2),
    'estimated_delivery_fee', v_delivery_fee_total,
    'estimated_total_min', round(v_minimum_per_day * v_template.delivery_days + v_delivery_fee_total, 2),
    'estimated_total_max', round(v_maximum_per_day * v_template.delivery_days + v_delivery_fee_total, 2),
    'estimate_basis', 'current_active_menu_range',
    'final_quote_required', true
  );
END;
$$;



REVOKE ALL ON FUNCTION private.meal_plan_schedule_document(INTEGER,SMALLINT[],DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.normalize_plan_weekdays(SMALLINT[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preview_delivery_day_plan(TEXT,TEXT[],SMALLINT[],UUID,DATE)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.preview_delivery_day_plan(TEXT,TEXT[],SMALLINT[],UUID,DATE)
  TO authenticated;

COMMENT ON FUNCTION public.preview_delivery_day_plan(TEXT,TEXT[],SMALLINT[],UUID,DATE)
  IS 'Returns a customer-owned schedule and transparent current-menu price range. It is an estimate, never an accepted quote.';
