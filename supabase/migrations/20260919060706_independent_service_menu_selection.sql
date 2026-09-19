-- Service-specific menu availability.
-- A catalog meal may be reusable for Lunch and Dinner while each daily menu
-- decides independently which service actually offers it.

ALTER TABLE public.menu_items
  ADD COLUMN service_meal_types TEXT[];

UPDATE public.menu_items item
SET service_meal_types = CASE meal.meal_type
  WHEN 'both' THEN ARRAY['lunch', 'dinner']::TEXT[]
  ELSE ARRAY[meal.meal_type]::TEXT[]
END
FROM public.meals meal
WHERE meal.id = item.meal_id;

ALTER TABLE public.menu_items
  ALTER COLUMN service_meal_types SET NOT NULL;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_service_meal_types_check CHECK (
    cardinality(service_meal_types) BETWEEN 1 AND 3
    AND service_meal_types <@ ARRAY['breakfast', 'lunch', 'dinner']::TEXT[]
  );

ALTER TABLE private.kitchen_menu_events
  ADD COLUMN service_meal_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE OR REPLACE FUNCTION private.kitchen_menu_document(p_menu_date DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'menu_date', p_menu_date,
    'is_published', coalesce(day.is_published, false),
    'is_locked', EXISTS (
      SELECT 1 FROM public.orders orders
      WHERE orders.order_date = p_menu_date AND orders.status <> 'cancelled'
    ),
    'updated_at', day.updated_at,
    'meals', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', meal.id,
          'selection_key', meal.id::TEXT || ':' || service.service_meal_type,
          'name', meal.name,
          'description', meal.description,
          'meal_type', meal.meal_type,
          'service_meal_type', service.service_meal_type,
          'diet_type', meal.diet_type,
          'base_price', meal.base_price,
          'selected', coalesce(service.service_meal_type = ANY(item.service_meal_types), false)
        ) ORDER BY
          CASE service.service_meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END,
          meal.name,
          meal.id
      )
      FROM public.meals meal
      CROSS JOIN LATERAL unnest(
        CASE meal.meal_type
          WHEN 'both' THEN ARRAY['lunch', 'dinner']::TEXT[]
          ELSE ARRAY[meal.meal_type]::TEXT[]
        END
      ) AS service(service_meal_type)
      LEFT JOIN public.menu_items item
        ON item.menu_day_id = day.id
       AND item.meal_id = meal.id
      WHERE meal.is_active
        AND meal.meal_type IN ('breakfast', 'lunch', 'dinner', 'both')
    ), '[]'::JSONB)
  )
  FROM (SELECT 1) seed
  LEFT JOIN public.menu_days day ON day.menu_date = p_menu_date;
$$;

CREATE OR REPLACE FUNCTION public.save_kitchen_menu(
  p_menu_date DATE,
  p_meal_ids UUID[],
  p_service_meal_types TEXT[],
  p_publish BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID;
  v_today DATE := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_day_id UUID;
  v_meal_ids UUID[] := coalesce(p_meal_ids, ARRAY[]::UUID[]);
  v_service_types TEXT[] := coalesce(p_service_meal_types, ARRAY[]::TEXT[]);
BEGIN
  v_actor := private.require_kitchen_access();

  IF p_menu_date IS NULL OR p_menu_date < v_today OR p_menu_date > v_today + 6 THEN
    RAISE EXCEPTION 'Choose a menu date within the next seven days.' USING ERRCODE = '22023';
  END IF;
  IF p_publish IS NULL THEN
    RAISE EXCEPTION 'Choose whether to save a draft or publish the menu.' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_meal_ids) <> cardinality(v_service_types)
     OR array_position(v_meal_ids, NULL) IS NOT NULL
     OR array_position(v_service_types, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Each selected meal must include one valid service.' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_meal_ids) <> (
    SELECT count(DISTINCT chosen.meal_id::TEXT || ':' || chosen.service_meal_type)
    FROM unnest(v_meal_ids, v_service_types) AS chosen(meal_id, service_meal_type)
  ) THEN
    RAISE EXCEPTION 'A meal can only be selected once per service.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(v_meal_ids, v_service_types) AS chosen(meal_id, service_meal_type)
    LEFT JOIN public.meals meal ON meal.id = chosen.meal_id
    WHERE meal.id IS NULL
       OR NOT meal.is_active
       OR chosen.service_meal_type NOT IN ('breakfast', 'lunch', 'dinner')
       OR NOT (
         meal.meal_type = chosen.service_meal_type
         OR (meal.meal_type = 'both' AND chosen.service_meal_type IN ('lunch', 'dinner'))
       )
  ) THEN
    RAISE EXCEPTION 'The menu contains a meal unavailable for the selected service.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orders orders
    WHERE orders.order_date = p_menu_date AND orders.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'This menu is locked because a customer order already exists for this date.' USING ERRCODE = '23514';
  END IF;
  IF p_publish AND cardinality(v_meal_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one meal in any service before publishing.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.menu_days(menu_date, is_published)
  VALUES (p_menu_date, p_publish)
  ON CONFLICT (menu_date) DO UPDATE SET is_published = EXCLUDED.is_published
  RETURNING id INTO v_day_id;

  DELETE FROM public.menu_items WHERE menu_day_id = v_day_id;
  INSERT INTO public.menu_items(
    menu_day_id, meal_id, service_meal_types, availability, display_order
  )
  SELECT
    v_day_id,
    grouped.meal_id,
    grouped.service_meal_types,
    true,
    grouped.display_order
  FROM (
    SELECT
      chosen.meal_id,
      array_agg(chosen.service_meal_type ORDER BY chosen.position) AS service_meal_types,
      min(chosen.position)::INTEGER AS display_order
    FROM unnest(v_meal_ids, v_service_types) WITH ORDINALITY
      AS chosen(meal_id, service_meal_type, position)
    GROUP BY chosen.meal_id
  ) grouped
  ORDER BY grouped.display_order;

  INSERT INTO private.kitchen_menu_events(
    menu_date, actor_id, is_published, meal_ids, service_meal_types
  ) VALUES (
    p_menu_date, v_actor, p_publish, v_meal_ids, v_service_types
  );

  RETURN private.kitchen_menu_document(p_menu_date);
END;
$$;

-- Compatibility for an already-open older Operations tab during deployment.
CREATE OR REPLACE FUNCTION public.save_kitchen_menu(
  p_menu_date DATE,
  p_meal_ids UUID[],
  p_publish BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meal_ids UUID[];
  v_service_types TEXT[];
BEGIN
  SELECT
    coalesce(array_agg(expanded.meal_id ORDER BY expanded.position, expanded.service_meal_type), ARRAY[]::UUID[]),
    coalesce(array_agg(expanded.service_meal_type ORDER BY expanded.position, expanded.service_meal_type), ARRAY[]::TEXT[])
  INTO v_meal_ids, v_service_types
  FROM (
    SELECT chosen.meal_id, chosen.position, service.service_meal_type
    FROM unnest(coalesce(p_meal_ids, ARRAY[]::UUID[])) WITH ORDINALITY AS chosen(meal_id, position)
    JOIN public.meals meal ON meal.id = chosen.meal_id
    CROSS JOIN LATERAL unnest(
      CASE meal.meal_type
        WHEN 'both' THEN ARRAY['lunch', 'dinner']::TEXT[]
        ELSE ARRAY[meal.meal_type]::TEXT[]
      END
    ) AS service(service_meal_type)
  ) expanded;

  RETURN public.save_kitchen_menu(p_menu_date, v_meal_ids, v_service_types, p_publish);
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_order_item_service_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_order_type TEXT;
  v_order_date DATE;
  v_meal_type TEXT;
BEGIN
  SELECT meal_type, order_date INTO v_order_type, v_order_date
  FROM public.orders WHERE id = NEW.order_id;
  SELECT meal_type INTO v_meal_type FROM public.meals WHERE id = NEW.meal_id;

  IF v_order_type = 'breakfast' AND v_meal_type <> 'breakfast' THEN
    RAISE EXCEPTION 'Choose a Breakfast meal for Breakfast service';
  END IF;
  IF v_order_type IN ('lunch', 'dinner') AND v_meal_type NOT IN (v_order_type, 'both') THEN
    RAISE EXCEPTION 'Choose a meal for the selected service';
  END IF;
  IF NEW.meal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.menu_days day
    JOIN public.menu_items item ON item.menu_day_id = day.id
    WHERE day.menu_date = v_order_date
      AND day.is_published
      AND item.meal_id = NEW.meal_id
      AND item.availability
      AND v_order_type = ANY(item.service_meal_types)
  ) THEN
    RAISE EXCEPTION 'This meal is not published for the selected service';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.save_kitchen_menu(DATE, UUID[], TEXT[], BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_kitchen_menu(DATE, UUID[], TEXT[], BOOLEAN)
  TO authenticated;
REVOKE ALL ON FUNCTION private.kitchen_menu_document(DATE),
  private.assert_order_item_service_match()
  FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.menu_items.service_meal_types IS
  'Daily services in which this catalog meal is offered; shared meals may independently include lunch, dinner, or both.';
