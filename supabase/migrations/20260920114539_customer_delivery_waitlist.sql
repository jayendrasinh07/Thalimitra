-- Persist Customer expansion requests and expose only minimum public area data.
-- Customer PII remains behind an MFA-verified admin RPC.

ALTER TABLE public.area_waitlist
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE public.area_waitlist
  DROP CONSTRAINT IF EXISTS area_waitlist_latitude_check,
  ADD CONSTRAINT area_waitlist_latitude_check
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  DROP CONSTRAINT IF EXISTS area_waitlist_longitude_check,
  ADD CONSTRAINT area_waitlist_longitude_check
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  DROP CONSTRAINT IF EXISTS area_waitlist_source_check,
  ADD CONSTRAINT area_waitlist_source_check
    CHECK (source IS NULL OR source IN ('map', 'gps', 'search', 'saved', 'manual'));

CREATE INDEX IF NOT EXISTS area_waitlist_created_at_idx
  ON public.area_waitlist(created_at DESC);
CREATE INDEX IF NOT EXISTS area_waitlist_area_created_idx
  ON public.area_waitlist(lower(area), created_at DESC);

CREATE OR REPLACE FUNCTION public.list_public_delivery_areas()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', zone.id,
    'name', zone.name,
    'tagline', zone.tagline,
    'deliveryFee', CASE WHEN zone.is_free_delivery THEN 0 ELSE zone.delivery_fee END,
    'minOrderAmount', zone.min_order_amount,
    'estimatedDurationMinutes', zone.estimated_duration_minutes,
    'services', jsonb_build_object(
      'breakfast', zone.breakfast_enabled,
      'lunch', zone.lunch_enabled,
      'dinner', zone.dinner_enabled
    ),
    'latitude', extensions.ST_Y(extensions.ST_PointOnSurface(zone.boundary)),
    'longitude', extensions.ST_X(extensions.ST_PointOnSurface(zone.boundary))
  ) ORDER BY zone.priority DESC, zone.name), '[]'::jsonb)
  FROM public.delivery_zones zone
  WHERE zone.status = 'available'
    AND zone.is_active
    AND zone.boundary IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.join_area_waitlist(
  p_name TEXT,
  p_contact TEXT,
  p_area TEXT,
  p_city TEXT,
  p_pincode TEXT,
  p_formatted_address TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_source TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name TEXT := btrim(coalesce(p_name, ''));
  v_contact TEXT := btrim(coalesce(p_contact, ''));
  v_area TEXT := btrim(coalesce(p_area, ''));
  v_city TEXT := btrim(coalesce(p_city, ''));
  v_pincode TEXT := nullif(btrim(coalesce(p_pincode, '')), '');
  v_address TEXT := btrim(coalesce(p_formatted_address, ''));
  v_source TEXT := lower(btrim(coalesce(p_source, 'map')));
  v_existing UUID;
  v_id UUID;
BEGIN
  IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Enter a valid name.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_contact) NOT BETWEEN 5 AND 254 THEN
    RAISE EXCEPTION 'Enter a valid mobile number or email.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_area) NOT BETWEEN 2 AND 240 OR char_length(v_city) NOT BETWEEN 2 AND 120
     OR char_length(v_address) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Choose a valid delivery location.' USING ERRCODE = '22023';
  END IF;
  IF v_pincode IS NOT NULL AND (char_length(v_pincode) > 10 OR v_pincode !~ '^[0-9A-Za-z -]+$') THEN
    RAISE EXCEPTION 'Enter a valid pincode.' USING ERRCODE = '22023';
  END IF;
  IF p_latitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude IS NULL OR p_longitude NOT BETWEEN -180 AND 180
     OR v_source NOT IN ('map', 'gps', 'search', 'saved', 'manual') THEN
    RAISE EXCEPTION 'Choose a valid map location.' USING ERRCODE = '22023';
  END IF;

  SELECT waitlist.id INTO v_existing
  FROM public.area_waitlist waitlist
  WHERE lower(waitlist.contact) = lower(v_contact)
    AND lower(coalesce(waitlist.formatted_address, waitlist.area)) = lower(v_address)
    AND waitlist.created_at >= clock_timestamp() - interval '30 days'
  ORDER BY waitlist.created_at DESC
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.area_waitlist(
    user_id, name, contact, area, city, pincode, segment,
    formatted_address, latitude, longitude, source
  ) VALUES (
    auth.uid(), v_name, v_contact, v_area, v_city, v_pincode, 'individual',
    v_address, p_latitude, p_longitude, v_source
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_area_waitlist()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_admin_access();
  RETURN jsonb_build_object(
    'generated_at', clock_timestamp(),
    'total', (SELECT count(*) FROM public.area_waitlist),
    'entries', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', waitlist.id,
        'name', waitlist.name,
        'contact', waitlist.contact,
        'area', waitlist.area,
        'city', waitlist.city,
        'pincode', waitlist.pincode,
        'formatted_address', waitlist.formatted_address,
        'latitude', waitlist.latitude,
        'longitude', waitlist.longitude,
        'source', waitlist.source,
        'created_at', waitlist.created_at
      ) ORDER BY waitlist.created_at DESC)
      FROM public.area_waitlist waitlist
    ), '[]'::jsonb)
  );
END;
$$;

DROP POLICY IF EXISTS "Anyone can join the area waitlist" ON public.area_waitlist;
DROP POLICY IF EXISTS "Only admins can view area waitlist entries" ON public.area_waitlist;
REVOKE ALL ON TABLE public.area_waitlist FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.list_public_delivery_areas(),
  public.join_area_waitlist(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,TEXT),
  public.get_area_waitlist()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_delivery_areas() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_area_waitlist(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_area_waitlist() TO authenticated;

COMMENT ON FUNCTION public.list_public_delivery_areas() IS
  'Public-safe list of active polygon-backed delivery areas; excludes boundary geometry and internal metadata.';
COMMENT ON FUNCTION public.join_area_waitlist(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DOUBLE PRECISION,DOUBLE PRECISION,TEXT) IS
  'Validated public waitlist submission path with 30-day duplicate suppression.';
COMMENT ON FUNCTION public.get_area_waitlist() IS
  'MFA-verified admin view of Customer expansion requests and exact submitted locations.';
