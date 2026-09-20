-- Keep Operations and Customer delivery-area status semantics in sync.

ALTER TABLE public.delivery_zones
  DROP CONSTRAINT IF EXISTS delivery_zones_available_service_check;
ALTER TABLE public.delivery_zones
  DROP CONSTRAINT IF EXISTS delivery_zones_public_service_check;
ALTER TABLE public.delivery_zones
  ADD CONSTRAINT delivery_zones_public_service_check CHECK (
    status NOT IN ('available', 'coming_soon')
    OR breakfast_enabled
    OR lunch_enabled
    OR dinner_enabled
  );

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
    'status', zone.status,
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
  ) ORDER BY
    CASE zone.status WHEN 'available' THEN 0 ELSE 1 END,
    zone.priority DESC,
    zone.name
  ), '[]'::jsonb)
  FROM public.delivery_zones zone
  WHERE zone.boundary IS NOT NULL
    AND (
      (zone.status = 'available' AND zone.is_active)
      OR zone.status = 'coming_soon'
    );
$$;

COMMENT ON FUNCTION public.list_public_delivery_areas() IS
  'Public-safe list of available and coming-soon polygon-backed delivery areas; excludes boundaries and private data.';
