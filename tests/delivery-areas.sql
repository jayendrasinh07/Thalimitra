BEGIN;
SELECT set_config('request.jwt.claim.aal','aal2',true);

DO $$
DECLARE
  v_admin UUID := gen_random_uuid();
  v_staff UUID := gen_random_uuid();
  v_customer UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
    (v_admin, 'area-admin@example.invalid', '{"full_name":"Area Admin"}'),
    (v_staff, 'area-kitchen@example.invalid', '{"full_name":"Kitchen Staff"}'),
    (v_customer, 'area-customer@example.invalid', '{"full_name":"Area Customer"}');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (v_admin, 'admin'), (v_staff, 'kitchen');
  PERFORM set_config('test.delivery_areas', jsonb_build_object(
    'admin', v_admin, 'staff', v_staff, 'customer', v_customer
  )::text, true);
END $$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE v_f JSONB := current_setting('test.delivery_areas')::jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_f->>'staff', true);
  BEGIN
    PERFORM public.get_delivery_areas();
    RAISE EXCEPTION 'Kitchen staff opened Delivery Areas';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
DECLARE
  v_first UUID;
  v_duplicate UUID;
BEGIN
  BEGIN
    INSERT INTO public.area_waitlist(name, contact, area, city)
    VALUES ('Blocked', 'blocked@example.invalid', 'Blocked', 'Gandhinagar');
    RAISE EXCEPTION 'Direct public waitlist insert was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  v_first := public.join_area_waitlist(
    'Interested Customer', '9000000011', 'Sector 4', 'Gandhinagar', '382004',
    'Block A, Sector 4, Gandhinagar', 23.220, 72.650, 'map'
  );
  v_duplicate := public.join_area_waitlist(
    'Interested Customer', '9000000011', 'Sector 4', 'Gandhinagar', '382004',
    'Block A, Sector 4, Gandhinagar', 23.220, 72.650, 'map'
  );
  IF v_first IS NULL OR v_first IS DISTINCT FROM v_duplicate THEN
    RAISE EXCEPTION 'Waitlist duplicate suppression failed';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE v_f JSONB := current_setting('test.delivery_areas')::jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_f->>'staff', true);
  BEGIN
    PERFORM public.get_area_waitlist();
    RAISE EXCEPTION 'Kitchen staff opened Customer waitlist';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_f JSONB := current_setting('test.delivery_areas')::jsonb;
  v_waitlist JSONB;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_f->>'admin', true);
  v_waitlist := public.get_area_waitlist();
  IF (v_waitlist->>'total')::integer <> 1
     OR v_waitlist#>>'{entries,0,formatted_address}' <> 'Block A, Sector 4, Gandhinagar'
     OR v_waitlist#>>'{entries,0,created_at}' IS NULL THEN
    RAISE EXCEPTION 'Admin waitlist document is incomplete: %', v_waitlist;
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_f JSONB := current_setting('test.delivery_areas')::jsonb;
  v_document JSONB;
  v_area_id TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_f->>'admin', true);
  v_document := public.save_delivery_area(
    NULL, 'Sector 21 pilot', 'available',
    '{"type":"Polygon","coordinates":[[[72.630,23.210],[72.640,23.210],[72.640,23.220],[72.630,23.220],[72.630,23.210]]]}'::jsonb,
    false, true, false, 12, 99, 30, true, 500
  );
  SELECT entry->>'id' INTO v_area_id
  FROM jsonb_array_elements(v_document->'areas') entry
  WHERE entry->>'name' = 'Sector 21 pilot';
  IF v_area_id IS NULL OR v_document->>'generated_at' IS NULL THEN
    RAISE EXCEPTION 'Saved area missing from admin document: %', v_document;
  END IF;
  PERFORM set_config('test.delivery_area_id', v_area_id, true);
END $$;
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.delivery_zones
    WHERE id IN ('zone_a_core', 'zone_b_extended', 'zone_c_periphery')
      AND (status <> 'paused' OR is_active)
  ) THEN
    RAISE EXCEPTION 'Phase-1 broad delivery rules were not retired';
  END IF;
END $$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.list_public_delivery_areas();
    RAISE EXCEPTION 'Public master area discovery remained executable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE v_f JSONB := current_setting('test.delivery_areas')::jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_f->>'admin', true);
  BEGIN
    PERFORM public.save_delivery_area(
      NULL, 'Ambiguous overlapping area', 'available',
      '{"type":"Polygon","coordinates":[[[72.635,23.215],[72.645,23.215],[72.645,23.225],[72.635,23.225],[72.635,23.215]]]}'::jsonb,
      false, true, false, 0, 0, 30, false, 500
    );
    RAISE EXCEPTION 'Same-priority overlap was accepted';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
DECLARE
  v_inside JSONB;
  v_breakfast JSONB;
  v_outside JSONB;
BEGIN
  v_inside := public.check_delivery_serviceability(23.215, 72.635, '382021', 'Sector 21', 'Sector 21', 'lunch');
  v_breakfast := public.check_delivery_serviceability(23.215, 72.635, '382021', 'Sector 21', 'Sector 21', 'breakfast');
  v_outside := public.check_delivery_serviceability(22.900, 72.100, '000000', 'Outside', 'Outside', 'lunch');
  IF v_inside->>'status' <> 'available'
     OR (v_inside->>'isServiceable')::boolean IS DISTINCT FROM true
     OR (v_inside->>'deliveryFee')::numeric <> 12
     OR v_inside ? 'boundary' THEN
    RAISE EXCEPTION 'Inside public result is unsafe or incorrect: %', v_inside;
  END IF;
  IF v_breakfast->>'status' <> 'unavailable'
     OR (v_breakfast#>>'{services,lunch}')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Service-specific result is incorrect: %', v_breakfast;
  END IF;
  IF v_outside->>'status' <> 'unavailable' OR v_outside->>'areaId' IS NOT NULL THEN
    RAISE EXCEPTION 'Outside result is incorrect: %', v_outside;
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_f JSONB := current_setting('test.delivery_areas')::jsonb;
  v_address UUID;
  v_quote JSONB;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_f->>'customer', true);
  INSERT INTO public.addresses(
    user_id, recipient_name, recipient_phone, house_flat_number, area, sector,
    city, pincode, latitude, longitude, formatted_address, is_default
  ) VALUES (
    (v_f->>'customer')::uuid, 'Area Customer', '9000000000', '21/A',
    'Sector 21', 'Sector 21', 'Gandhinagar', '382021', 23.215, 72.635,
    '21/A, Sector 21, Gandhinagar', true
  ) RETURNING id INTO v_address;
  IF (SELECT zone_id FROM public.addresses WHERE id = v_address) <> current_setting('test.delivery_area_id')
     OR NOT (SELECT is_serviceable FROM public.addresses WHERE id = v_address) THEN
    RAISE EXCEPTION 'Address trigger did not use polygon source of truth';
  END IF;
  v_quote := public.quote_delivery_address(v_address);
  IF (v_quote->>'deliveryFee')::numeric <> 12
     OR (v_quote#>>'{services,lunch}')::boolean IS DISTINCT FROM true
     OR (v_quote#>>'{services,breakfast}')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Address quote is incorrect: %', v_quote;
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_f JSONB := current_setting('test.delivery_areas')::jsonb;
  v_area_id TEXT := current_setting('test.delivery_area_id');
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_f->>'admin', true);
  PERFORM public.save_delivery_area(
    v_area_id, 'Sector 21 pilot', 'coming_soon', NULL,
    false, true, false, 12, 99, 30, true, 500
  );
END $$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
DECLARE
  v_result JSONB := public.check_delivery_serviceability(23.215,72.635,'382021','Sector 21','Sector 21','lunch');
BEGIN
  IF v_result->>'status' <> 'coming_soon'
       OR (v_result->>'isServiceable')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Coming-soon exact check is not safely blocked: %', v_result;
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_f JSONB := current_setting('test.delivery_areas')::jsonb;
  v_area_id TEXT := current_setting('test.delivery_area_id');
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_f->>'admin', true);
  PERFORM public.save_delivery_area(
    v_area_id, 'Sector 21 pilot', 'paused', NULL,
    false, true, false, 12, 99, 30, true, 500
  );
  IF (public.check_delivery_serviceability(23.215,72.635,'382021','Sector 21','Sector 21','lunch')->>'status') <> 'unavailable' THEN
    RAISE EXCEPTION 'Paused area still accepts serviceability checks';
  END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM private.delivery_area_events
      WHERE zone_id = current_setting('test.delivery_area_id')) <> 3 THEN
    RAISE EXCEPTION 'Delivery area audit history is incomplete';
  END IF;
END $$;

ROLLBACK;
SELECT 'PASS: private area discovery, retired legacy rules, exact available/coming-soon/paused lifecycle, waitlist, quote and audit' AS result;
