-- Database-owned delivery areas with admin-managed geographic boundaries.
-- Existing text zones remain compatible until an admin publishes a boundary.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS boundary extensions.geometry(MultiPolygon, 4326),
  ADD COLUMN IF NOT EXISTS breakfast_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lunch_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dinner_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.delivery_zones
SET status = CASE WHEN is_active THEN 'available' ELSE 'paused' END,
    published_at = CASE WHEN is_active THEN coalesce(published_at, updated_at, created_at) ELSE published_at END;

ALTER TABLE public.delivery_zones DROP CONSTRAINT IF EXISTS delivery_zones_status_check;
ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_status_check
  CHECK (status IN ('draft', 'available', 'coming_soon', 'paused'));
ALTER TABLE public.delivery_zones DROP CONSTRAINT IF EXISTS delivery_zones_priority_check;
ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_priority_check
  CHECK (priority BETWEEN 0 AND 10000);
ALTER TABLE public.delivery_zones DROP CONSTRAINT IF EXISTS delivery_zones_boundary_check;
ALTER TABLE public.delivery_zones ADD CONSTRAINT delivery_zones_boundary_check CHECK (
  boundary IS NULL OR (
    NOT extensions.ST_IsEmpty(boundary)
    AND extensions.ST_IsValid(boundary)
    AND extensions.ST_NPoints(boundary) BETWEEN 4 AND 500
  )
);
CREATE INDEX IF NOT EXISTS delivery_zones_boundary_gix
  ON public.delivery_zones USING gist(boundary) WHERE boundary IS NOT NULL;
CREATE INDEX IF NOT EXISTS delivery_zones_status_priority_idx
  ON public.delivery_zones(status, priority DESC);

CREATE TABLE IF NOT EXISTS private.delivery_area_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  zone_id TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated')),
  before_state JSONB,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS delivery_area_events_zone_created_idx
  ON private.delivery_area_events(zone_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.delivery_area_snapshot(p_zone public.delivery_zones)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (to_jsonb(p_zone) - 'boundary') || jsonb_build_object(
    'boundary', CASE WHEN p_zone.boundary IS NULL THEN NULL
      ELSE extensions.ST_AsGeoJSON(p_zone.boundary)::jsonb END
  );
$$;

CREATE OR REPLACE FUNCTION private.delivery_area_document()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'areas', coalesce(jsonb_agg(
      private.delivery_area_snapshot(zone)
      ORDER BY zone.priority DESC, zone.name, zone.id
    ), '[]'::jsonb),
    'generated_at', clock_timestamp()
  )
  FROM public.delivery_zones zone;
$$;

CREATE OR REPLACE FUNCTION public.get_delivery_areas()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_admin_access();
  RETURN private.delivery_area_document();
END;
$$;

CREATE OR REPLACE FUNCTION public.save_delivery_area(
  p_area_id TEXT,
  p_name TEXT,
  p_status TEXT,
  p_boundary JSONB,
  p_breakfast_enabled BOOLEAN,
  p_lunch_enabled BOOLEAN,
  p_dinner_enabled BOOLEAN,
  p_delivery_fee NUMERIC,
  p_min_order_amount NUMERIC,
  p_estimated_duration_minutes INTEGER,
  p_waitlist_enabled BOOLEAN,
  p_priority INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID;
  v_id TEXT := nullif(btrim(coalesce(p_area_id, '')), '');
  v_name TEXT := btrim(coalesce(p_name, ''));
  v_before public.delivery_zones%ROWTYPE;
  v_after public.delivery_zones%ROWTYPE;
  v_boundary extensions.geometry(MultiPolygon, 4326);
  v_action TEXT;
BEGIN
  v_actor := private.require_admin_access();

  IF length(v_name) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Area name must be between 3 and 120 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('draft', 'available', 'coming_soon', 'paused') THEN
    RAISE EXCEPTION 'Choose a valid area status.' USING ERRCODE = '22023';
  END IF;
  IF p_delivery_fee IS NULL OR p_delivery_fee < 0 OR p_delivery_fee > 10000
     OR round(p_delivery_fee, 2) <> p_delivery_fee
     OR p_min_order_amount IS NULL OR p_min_order_amount < 0 OR p_min_order_amount > 100000
     OR round(p_min_order_amount, 2) <> p_min_order_amount THEN
    RAISE EXCEPTION 'Check delivery fee and minimum order.' USING ERRCODE = '22023';
  END IF;
  IF p_estimated_duration_minutes IS NULL OR p_estimated_duration_minutes NOT BETWEEN 5 AND 240
     OR p_priority IS NULL OR p_priority NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'Check ETA and priority.' USING ERRCODE = '22023';
  END IF;
  IF p_breakfast_enabled IS NULL OR p_lunch_enabled IS NULL OR p_dinner_enabled IS NULL
     OR p_waitlist_enabled IS NULL THEN
    RAISE EXCEPTION 'Area service settings are required.' USING ERRCODE = '22023';
  END IF;

  IF p_boundary IS NOT NULL AND p_boundary <> 'null'::jsonb THEN
    BEGIN
      v_boundary := extensions.ST_Multi(
        extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_boundary::text), 4326)
      )::extensions.geometry(MultiPolygon, 4326);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Draw a valid delivery boundary.' USING ERRCODE = '22023';
    END;
    IF extensions.ST_IsEmpty(v_boundary) OR NOT extensions.ST_IsValid(v_boundary)
       OR extensions.ST_NPoints(v_boundary) NOT BETWEEN 4 AND 500 THEN
      RAISE EXCEPTION 'Draw a valid delivery boundary with at least three points.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_id IS NULL THEN
    IF v_boundary IS NULL THEN
      RAISE EXCEPTION 'Draw a boundary before creating a new delivery area.' USING ERRCODE = '22023';
    END IF;
    v_id := 'area_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    INSERT INTO public.delivery_zones(
      id, name, tagline, description, delivery_fee, estimated_duration_minutes,
      min_order_amount, is_free_delivery, pincodes, sectors, is_active, status,
      boundary, breakfast_enabled, lunch_enabled, dinner_enabled,
      waitlist_enabled, priority, published_at, published_by
    ) VALUES (
      v_id, v_name, 'Admin-managed delivery area', NULL, p_delivery_fee,
      p_estimated_duration_minutes, p_min_order_amount, p_delivery_fee = 0,
      ARRAY[]::TEXT[], ARRAY[]::TEXT[], p_status = 'available', p_status,
      v_boundary, p_breakfast_enabled, p_lunch_enabled, p_dinner_enabled,
      p_waitlist_enabled, p_priority,
      CASE WHEN p_status IN ('available', 'coming_soon') THEN clock_timestamp() END,
      CASE WHEN p_status IN ('available', 'coming_soon') THEN v_actor END
    ) RETURNING * INTO v_after;
    v_action := 'created';
  ELSE
    SELECT * INTO v_before FROM public.delivery_zones WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Delivery area was not found.' USING ERRCODE = 'P0002';
    END IF;
    IF p_status IN ('available', 'coming_soon') AND coalesce(v_boundary, v_before.boundary) IS NULL
       AND v_before.id LIKE 'area\_%' ESCAPE '\' THEN
      RAISE EXCEPTION 'Draw a boundary before publishing this area.' USING ERRCODE = '23514';
    END IF;
    UPDATE public.delivery_zones SET
      name = v_name,
      status = p_status,
      boundary = coalesce(v_boundary, boundary),
      breakfast_enabled = p_breakfast_enabled,
      lunch_enabled = p_lunch_enabled,
      dinner_enabled = p_dinner_enabled,
      delivery_fee = p_delivery_fee,
      min_order_amount = p_min_order_amount,
      estimated_duration_minutes = p_estimated_duration_minutes,
      is_free_delivery = p_delivery_fee = 0,
      waitlist_enabled = p_waitlist_enabled,
      priority = p_priority,
      is_active = p_status = 'available',
      version = version + 1,
      published_at = CASE WHEN p_status IN ('available', 'coming_soon') THEN clock_timestamp() ELSE published_at END,
      published_by = CASE WHEN p_status IN ('available', 'coming_soon') THEN v_actor ELSE published_by END
    WHERE id = v_id
    RETURNING * INTO v_after;
    v_action := 'updated';
  END IF;

  INSERT INTO private.delivery_area_events(zone_id, actor_id, action, before_state, after_state)
  VALUES (
    v_after.id, v_actor, v_action,
    CASE WHEN v_action = 'updated' THEN private.delivery_area_snapshot(v_before) END,
    private.delivery_area_snapshot(v_after)
  );
  RETURN private.delivery_area_document();
END;
$$;

CREATE OR REPLACE FUNCTION public.check_delivery_serviceability(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_pincode TEXT DEFAULT NULL,
  p_area TEXT DEFAULT NULL,
  p_sector TEXT DEFAULT NULL,
  p_meal_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_zone public.delivery_zones%ROWTYPE;
  v_point extensions.geometry(Point, 4326);
  v_service_enabled BOOLEAN;
BEGIN
  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Valid coordinates are required.' USING ERRCODE = '22023';
  END IF;
  IF p_meal_type IS NOT NULL AND p_meal_type NOT IN ('breakfast', 'lunch', 'dinner') THEN
    RAISE EXCEPTION 'Choose breakfast, lunch, or dinner.' USING ERRCODE = '22023';
  END IF;
  v_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326);

  SELECT zone.* INTO v_zone
  FROM public.delivery_zones zone
  WHERE zone.boundary IS NOT NULL
    AND zone.status IN ('available', 'coming_soon')
    AND extensions.ST_Covers(zone.boundary, v_point)
  ORDER BY zone.priority DESC,
    CASE zone.status WHEN 'available' THEN 0 ELSE 1 END,
    zone.id
  LIMIT 1;

  -- Transitional compatibility: a legacy zone remains text-based only until
  -- its first map boundary is saved.
  IF NOT FOUND THEN
    SELECT zone.* INTO v_zone
    FROM public.delivery_zones zone
    WHERE zone.boundary IS NULL
      AND zone.status IN ('available', 'coming_soon')
      AND btrim(coalesce(p_pincode, '')) = ANY(zone.pincodes)
      AND EXISTS (
        SELECT 1 FROM unnest(zone.sectors) approved
        WHERE regexp_replace(lower(approved), '[^a-z0-9]', '', 'g') IN (
          regexp_replace(lower(coalesce(p_area, '')), '[^a-z0-9]', '', 'g'),
          regexp_replace(lower(coalesce(p_sector, '')), '[^a-z0-9]', '', 'g')
        )
      )
    ORDER BY zone.priority DESC, zone.id
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'unavailable', 'isServiceable', false, 'areaId', NULL,
      'areaName', coalesce(nullif(btrim(p_area), ''), 'Selected location'),
      'deliveryFee', 0, 'minOrderAmount', 0, 'estimatedDurationMinutes', NULL,
      'waitlistEnabled', true,
      'services', jsonb_build_object('breakfast', false, 'lunch', false, 'dinner', false),
      'message', 'Thalimitra is not delivering to this exact location yet.'
    );
  END IF;

  v_service_enabled := CASE p_meal_type
    WHEN 'breakfast' THEN v_zone.breakfast_enabled
    WHEN 'lunch' THEN v_zone.lunch_enabled
    WHEN 'dinner' THEN v_zone.dinner_enabled
    ELSE v_zone.breakfast_enabled OR v_zone.lunch_enabled OR v_zone.dinner_enabled
  END;

  RETURN jsonb_build_object(
    'status', CASE
      WHEN v_zone.status = 'coming_soon' THEN 'coming_soon'
      WHEN v_service_enabled THEN 'available'
      ELSE 'unavailable'
    END,
    'isServiceable', v_zone.status = 'available' AND v_service_enabled,
    'areaId', v_zone.id,
    'areaName', v_zone.name,
    'deliveryFee', CASE WHEN v_zone.is_free_delivery THEN 0 ELSE v_zone.delivery_fee END,
    'minOrderAmount', v_zone.min_order_amount,
    'estimatedDurationMinutes', v_zone.estimated_duration_minutes,
    'waitlistEnabled', v_zone.waitlist_enabled,
    'services', jsonb_build_object(
      'breakfast', v_zone.breakfast_enabled,
      'lunch', v_zone.lunch_enabled,
      'dinner', v_zone.dinner_enabled
    ),
    'message', CASE
      WHEN v_zone.status = 'coming_soon' THEN 'Thalimitra is coming soon to this area.'
      WHEN v_service_enabled THEN 'Thalimitra delivers to this exact location.'
      ELSE 'The selected meal service is not available in this area.'
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_delivery_zone_v2(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_pincode TEXT,
  p_area TEXT,
  p_sector TEXT,
  p_meal_type TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
  v_zone TEXT;
BEGIN
  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    SELECT zone.id INTO v_zone
    FROM public.delivery_zones zone
    WHERE zone.boundary IS NULL
      AND zone.status = 'available'
      AND btrim(coalesce(p_pincode, '')) = ANY(zone.pincodes)
      AND EXISTS (
        SELECT 1 FROM unnest(zone.sectors) approved
        WHERE regexp_replace(lower(approved), '[^a-z0-9]', '', 'g') IN (
          regexp_replace(lower(coalesce(p_area, '')), '[^a-z0-9]', '', 'g'),
          regexp_replace(lower(coalesce(p_sector, '')), '[^a-z0-9]', '', 'g')
        )
      )
      AND CASE p_meal_type
        WHEN 'breakfast' THEN zone.breakfast_enabled
        WHEN 'lunch' THEN zone.lunch_enabled
        WHEN 'dinner' THEN zone.dinner_enabled
        ELSE zone.breakfast_enabled OR zone.lunch_enabled OR zone.dinner_enabled
      END
    ORDER BY zone.priority DESC, zone.id
    LIMIT 1;
    RETURN v_zone;
  END IF;
  v_result := public.check_delivery_serviceability(
    p_latitude, p_longitude, p_pincode, p_area, p_sector, p_meal_type
  );
  RETURN CASE WHEN v_result->>'status' = 'available' THEN v_result->>'areaId' END;
END;
$$;

CREATE OR REPLACE FUNCTION private.normalize_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (NEW.latitude IS NULL) <> (NEW.longitude IS NULL) THEN
    RAISE EXCEPTION 'Both latitude and longitude are required together.' USING ERRCODE = '22023';
  END IF;
  IF NEW.latitude IS NOT NULL THEN
    NEW.zone_id := private.resolve_delivery_zone_v2(
      NEW.latitude, NEW.longitude, NEW.pincode, NEW.area, NEW.sector, NULL
    );
  ELSE
    NEW.zone_id := private.resolve_delivery_zone(NEW.pincode, NEW.area, NEW.sector);
  END IF;
  NEW.is_serviceable := NEW.zone_id IS NOT NULL;
  NEW.is_verified := false;
  NEW.cluster_id := CASE NEW.zone_id
    WHEN 'zone_a_core' THEN 'cluster-a'
    WHEN 'zone_b_extended' THEN 'cluster-b'
    WHEN 'zone_c_periphery' THEN 'cluster-c'
    ELSE CASE WHEN NEW.zone_id IS NULL THEN NULL ELSE 'admin-area' END
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_delivery_address(p_address_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_address public.addresses%ROWTYPE;
  v_zone public.delivery_zones%ROWTYPE;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_address FROM public.addresses
  WHERE id = p_address_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery address not found'; END IF;

  IF v_address.latitude IS NULL OR v_address.longitude IS NULL THEN
    SELECT * INTO v_zone FROM public.delivery_zones
    WHERE id = private.resolve_delivery_zone(v_address.pincode, v_address.area, v_address.sector)
      AND status = 'available';
    IF NOT FOUND THEN RAISE EXCEPTION 'This address is outside current delivery coverage'; END IF;
    v_result := jsonb_build_object(
      'status', 'available',
      'services', jsonb_build_object(
        'breakfast', v_zone.breakfast_enabled,
        'lunch', v_zone.lunch_enabled,
        'dinner', v_zone.dinner_enabled
      )
    );
  ELSE
    v_result := public.check_delivery_serviceability(
      v_address.latitude, v_address.longitude, v_address.pincode,
      v_address.area, v_address.sector, NULL
    );
    SELECT * INTO v_zone FROM public.delivery_zones WHERE id = v_result->>'areaId';
  END IF;
  IF NOT FOUND OR v_result->>'status' <> 'available' OR v_zone.id IS DISTINCT FROM v_address.zone_id THEN
    RAISE EXCEPTION 'This address is outside current delivery coverage';
  END IF;
  RETURN jsonb_build_object(
    'zoneId', v_zone.id,
    'deliveryFee', CASE WHEN v_zone.is_free_delivery THEN 0 ELSE v_zone.delivery_fee END,
    'minOrderAmount', v_zone.min_order_amount,
    'estimatedDurationMinutes', v_zone.estimated_duration_minutes,
    'services', v_result->'services'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_areas(),
  public.save_delivery_area(TEXT,TEXT,TEXT,JSONB,BOOLEAN,BOOLEAN,BOOLEAN,NUMERIC,NUMERIC,INTEGER,BOOLEAN,INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_areas(),
  public.save_delivery_area(TEXT,TEXT,TEXT,JSONB,BOOLEAN,BOOLEAN,BOOLEAN,NUMERIC,NUMERIC,INTEGER,BOOLEAN,INTEGER)
  TO authenticated;
REVOKE ALL ON FUNCTION public.check_delivery_serviceability(DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,TEXT,TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_delivery_serviceability(DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,TEXT,TEXT)
  TO anon, authenticated;
REVOKE ALL ON FUNCTION private.delivery_area_snapshot(public.delivery_zones),
  private.delivery_area_document(),
  private.resolve_delivery_zone_v2(DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,TEXT,TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.delivery_area_events FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Delivery zones are viewable by everyone" ON public.delivery_zones;
REVOKE ALL ON TABLE public.delivery_zones FROM anon, authenticated;

COMMENT ON FUNCTION public.check_delivery_serviceability(DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,TEXT,TEXT)
  IS 'Public-safe coordinate serviceability result; returns no boundary geometry or operational audit data.';

-- Recheck the exact current boundary and meal service during checkout.
CREATE OR REPLACE FUNCTION public.place_order_secure(
 p_order_date DATE,p_meal_type TEXT,p_delivery_slot_id UUID,p_address_id UUID,p_meal_id UUID,p_quantity INT,
 p_customizations JSONB DEFAULT '[]',p_notes TEXT DEFAULT NULL,p_idempotency_key UUID DEFAULT NULL,p_preferences JSONB DEFAULT '{}'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 u UUID := auth.uid(); m public.meals%ROWTYPE; md public.menu_days%ROWTYPE; mi public.menu_items%ROWTYPE;
 s public.delivery_slots%ROWTYPE; a public.addresses%ROWTYPE; z public.delivery_zones%ROWTYPE;
 c public.meal_customizations%ROWTYPE; e JSONB; extras JSONB := '[]'; normalized JSONB; payload JSONB; existing public.orders%ROWTYPE;
 preferences JSONB; cid UUID; qty INT; booked BIGINT; subtotal NUMERIC(10,2); addons NUMERIC(10,2):=0;
 fee NUMERIC(10,2); oid UUID := gen_random_uuid(); iid UUID; snapshot JSONB;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'A checkout request key is required'; END IF;
 IF p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Quantity must be between 1 and 20'; END IF;
 IF p_customizations IS NULL OR jsonb_typeof(p_customizations) <> 'array' THEN RAISE EXCEPTION 'Add-ons must be an array'; END IF;
 IF jsonb_array_length(p_customizations)>20 THEN RAISE EXCEPTION 'Too many add-ons'; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_customizations) LOOP
   IF jsonb_typeof(e)<>'object' OR e->>'customization_id' IS NULL OR coalesce(e->>'quantity','') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Invalid add-on'; END IF;
   cid := (e->>'customization_id')::uuid; qty := (e->>'quantity')::int;
   IF qty NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Add-on quantity must be between 1 and 100'; END IF;
   extras := extras || jsonb_build_array(jsonb_build_object('customization_id',cid,'quantity',qty));
 END LOOP;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(extras) v GROUP BY v->>'customization_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate add-on'; END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'customization_id'),'[]') INTO normalized FROM jsonb_array_elements(extras);
 IF p_preferences IS NULL OR jsonb_typeof(p_preferences)<>'object' THEN RAISE EXCEPTION 'Invalid preparation preferences'; END IF;
 IF coalesce(p_preferences->>'spiceLevel','Regular') NOT IN ('Regular','Less Spicy') OR coalesce(p_preferences->>'oilLevel','Standard') NOT IN ('Standard','Less Oil (Fit)') THEN RAISE EXCEPTION 'Invalid preparation preference'; END IF;
 IF length(coalesce(p_notes,''))>1000 THEN RAISE EXCEPTION 'Notes must be at most 1000 characters'; END IF;
 payload := jsonb_build_object('date',p_order_date,'type',p_meal_type,'slot',p_delivery_slot_id,'address',p_address_id,'meal',p_meal_id,'quantity',p_quantity,'addons',normalized,'notes',nullif(btrim(p_notes),''),'preferences',p_preferences);
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||p_idempotency_key::text,0));
 SELECT * INTO existing FROM public.orders WHERE user_id=u AND idempotency_key=p_idempotency_key;
 IF FOUND THEN
   IF existing.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'This request key belongs to different order details'; END IF;
   RETURN private.order_document(existing.id);
 END IF;
 SELECT * INTO s FROM public.delivery_slots WHERE id=p_delivery_slot_id FOR UPDATE;
 IF NOT FOUND OR NOT s.is_active OR s.meal_type IS DISTINCT FROM p_meal_type THEN RAISE EXCEPTION 'Choose an active delivery slot for this meal'; END IF;
 -- clock_timestamp is evaluated after lock waits, not at transaction start.
 PERFORM private.assert_order_window(p_order_date,p_meal_type,clock_timestamp());
 SELECT * INTO m FROM public.meals WHERE id=p_meal_id FOR SHARE;
 IF NOT FOUND OR NOT m.is_active OR m.meal_type NOT IN (p_meal_type,'both') THEN RAISE EXCEPTION 'This meal is unavailable'; END IF;
 SELECT * INTO md FROM public.menu_days WHERE menu_date=p_order_date FOR SHARE;
 IF NOT FOUND OR NOT md.is_published THEN RAISE EXCEPTION 'The menu for this day has not been published'; END IF;
 SELECT * INTO mi FROM public.menu_items WHERE menu_day_id=md.id AND meal_id=m.id FOR SHARE;
 IF NOT FOUND OR NOT mi.availability THEN RAISE EXCEPTION 'This meal is not available in the selected menu'; END IF;
 SELECT coalesce(sum(i.quantity),0) INTO booked FROM public.orders o JOIN public.order_items i ON i.order_id=o.id
 WHERE o.delivery_slot_id=s.id AND o.order_date=p_order_date AND o.status<>'cancelled';
 IF booked+p_quantity>s.max_orders THEN RAISE EXCEPTION 'This delivery slot has insufficient remaining portions'; END IF;
 SELECT * INTO a FROM public.addresses WHERE id=p_address_id AND user_id=u FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose a saved address belonging to your account'; END IF;
 SELECT * INTO z FROM public.delivery_zones WHERE id=private.resolve_delivery_zone_v2(a.latitude,a.longitude,a.pincode,a.area,a.sector,p_meal_type) AND status='available' FOR SHARE;
 IF NOT FOUND OR NOT a.is_serviceable OR z.id IS DISTINCT FROM a.zone_id THEN RAISE EXCEPTION 'This address is outside current delivery coverage'; END IF;
 fee := CASE WHEN z.is_free_delivery THEN 0 ELSE z.delivery_fee END;
 subtotal := m.base_price*p_quantity;
 FOR e IN SELECT value FROM jsonb_array_elements(normalized) LOOP
   SELECT * INTO c FROM public.meal_customizations WHERE id=(e->>'customization_id')::uuid FOR SHARE;
   IF NOT FOUND OR NOT c.is_active OR (c.meal_id IS NOT NULL AND c.meal_id<>m.id) THEN RAISE EXCEPTION 'An add-on is unavailable for this meal'; END IF;
   addons := addons+c.price*(e->>'quantity')::int;
 END LOOP;
 IF subtotal+addons<z.min_order_amount THEN RAISE EXCEPTION 'Minimum order amount for this zone is %',z.min_order_amount; END IF;
 preferences := jsonb_build_object('spiceLevel',coalesce(p_preferences->>'spiceLevel','Regular'),'oilLevel',coalesce(p_preferences->>'oilLevel','Standard'),'dietType',m.diet_type);
 snapshot := to_jsonb(a) || jsonb_build_object('zoneId',z.id,'deliveryFee',fee,'slotLabel',s.start_time::text||' – '||s.end_time::text,'capturedAt',clock_timestamp());
 INSERT INTO public.orders(id,user_id,address_id,order_number,idempotency_key,request_payload,order_date,meal_type,delivery_slot_id,status,subtotal,customization_total,delivery_fee,discount,grand_total,payment_status,notes,address_snapshot)
 VALUES(oid,u,a.id,'TEF-'||to_char(p_order_date,'YYYYMMDD')||'-'||replace(oid::text,'-',''),p_idempotency_key,payload,p_order_date,p_meal_type,s.id,'confirmed',subtotal,addons,fee,0,subtotal+addons+fee,'pending',nullif(btrim(p_notes),''),snapshot);
 INSERT INTO public.order_items(order_id,meal_id,meal_name_snapshot,preparation_preferences,quantity,unit_price,line_total)
 VALUES(oid,m.id,m.name,preferences,p_quantity,m.base_price,subtotal) RETURNING id INTO iid;
 FOR e IN SELECT value FROM jsonb_array_elements(normalized) LOOP
   SELECT * INTO c FROM public.meal_customizations WHERE id=(e->>'customization_id')::uuid;
   INSERT INTO public.order_customizations(order_item_id,customization_id,customization_name_snapshot,quantity,unit_price,line_total)
   VALUES(iid,c.id,c.name,(e->>'quantity')::int,c.price,c.price*(e->>'quantity')::int);
 END LOOP;
 RETURN private.order_document(oid);
END;
$$;
