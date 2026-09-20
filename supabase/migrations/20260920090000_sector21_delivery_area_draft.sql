-- Review-only pilot boundary. It cannot affect Customer eligibility while draft.
-- Source: OpenStreetMap way 1370480249 via Nominatim, retrieved 2026-09-20.
-- Operations must verify the road-level boundary and business settings before publish.

INSERT INTO public.delivery_zones (
  id,
  name,
  tagline,
  description,
  delivery_fee,
  estimated_duration_minutes,
  min_order_amount,
  is_free_delivery,
  pincodes,
  sectors,
  is_active,
  status,
  boundary,
  breakfast_enabled,
  lunch_enabled,
  dinner_enabled,
  waitlist_enabled,
  priority
)
VALUES (
  'area_sector_21_draft',
  'Sector 21 — Draft boundary',
  'Review before publishing',
  'Imported geographic draft for Operations review. Delivery settings are intentionally disabled.',
  0,
  30,
  0,
  true,
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  false,
  'draft',
  extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(
    '{"type":"Polygon","coordinates":[[[72.6587248,23.2294457],[72.6653383,23.225841],[72.6703494,23.2338624],[72.6637009,23.2373592],[72.6587248,23.2294457]]]}'
  )),
  false,
  false,
  false,
  false,
  1000
)
ON CONFLICT (id) DO NOTHING;
