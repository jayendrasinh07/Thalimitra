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
      WHERE zone_id = current_setting('test.delivery_area_id')) <> 2 THEN
    RAISE EXCEPTION 'Delivery area audit history is incomplete';
  END IF;
END $$;

ROLLBACK;
SELECT 'PASS: admin-only polygon areas, meal-specific serviceability, address quote, pause and audit' AS result;
