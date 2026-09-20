-- Retire Phase-1 broad pincode/sector compatibility records.
-- Exact polygon checks remain the only Customer delivery authority.

UPDATE public.delivery_zones
SET status = 'paused',
    is_active = false,
    description = 'Retired Phase-1 compatibility record. Preserved only for historical references; not used for new delivery checks.',
    version = version + 1,
    updated_at = clock_timestamp()
WHERE id IN ('zone_a_core', 'zone_b_extended', 'zone_c_periphery')
  AND boundary IS NULL
  AND (status <> 'paused' OR is_active);

-- Area-by-area discovery is private business routing data. Customers receive
-- only the result for coordinates they explicitly check.
REVOKE ALL ON FUNCTION public.list_public_delivery_areas()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.list_public_delivery_areas() IS
  'Internal compatibility function. Public execution is revoked; use exact coordinate serviceability checks.';
