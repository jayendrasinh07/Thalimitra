-- Prepare the Sector 21 pilot for Operations review without publishing it.
-- These settings mirror the current core-zone defaults and remain ineffective
-- until an admin explicitly changes the area status from draft.

UPDATE public.delivery_zones
SET name = 'Sector 21',
    tagline = 'Pilot delivery area',
    description = 'Review the boundary and dispatch feasibility in Operations before publishing.',
    delivery_fee = 0,
    estimated_duration_minutes = 25,
    min_order_amount = 0,
    is_free_delivery = true,
    is_active = false,
    status = 'draft',
    breakfast_enabled = true,
    lunch_enabled = true,
    dinner_enabled = true,
    waitlist_enabled = true,
    priority = 1000,
    version = version + 1,
    updated_at = clock_timestamp(),
    published_at = NULL,
    published_by = NULL
WHERE id = 'area_sector_21_draft';
