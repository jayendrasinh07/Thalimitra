-- Disposable fixtures: safe to run on cloud in this transaction; nothing survives rollback.
BEGIN;
SELECT set_config('request.jwt.claim.aal','aal2',true);
DO $$
DECLARE owner_id UUID:=gen_random_uuid(); staff UUID:=gen_random_uuid(); admin_id UUID:=gen_random_uuid();
 delivery UUID:=gen_random_uuid(); corporate UUID:=gen_random_uuid(); addr UUID; meal UUID; slot UUID; addon UUID; day UUID;
 d DATE:=(clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+1; o JSONB;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (owner_id,owner_id||'@example.invalid','{"role":"admin","roles":["kitchen"]}'),
 (staff,staff||'@example.invalid','{}'),(admin_id,admin_id||'@example.invalid','{}'),
 (delivery,delivery||'@example.invalid','{}'),(corporate,corporate||'@example.invalid','{}');
 INSERT INTO public.user_roles(user_id,role) VALUES(staff,'kitchen'),(admin_id,'admin'),(delivery,'delivery'),(corporate,'corporate');
 UPDATE public.delivery_zones SET status='available',is_active=true,lunch_enabled=true,
   boundary=extensions.ST_Multi(extensions.ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[72.62,23.17],[72.64,23.17],[72.64,23.19],[72.62,23.19],[72.62,23.17]]]}'))
 WHERE id='zone_a_core';
 INSERT INTO public.addresses(user_id,recipient_name,recipient_phone,area,pincode,latitude,longitude)
 VALUES(owner_id,'Private customer','0000000000','Kudasan','382421',23.18,72.63) RETURNING id INTO addr;
 INSERT INTO public.meals(name,meal_type,base_price) VALUES('Frozen kitchen thali','lunch',100) RETURNING id INTO meal;
 INSERT INTO public.menu_days(menu_date,is_published) VALUES(d,true) ON CONFLICT(menu_date) DO UPDATE SET is_published=true RETURNING id INTO day;
 INSERT INTO public.menu_items(menu_day_id,meal_id,service_meal_types) VALUES(day,meal,ARRAY['lunch']);
 INSERT INTO public.delivery_slots(name,meal_type,start_time,end_time,cutoff_time,max_orders)
 VALUES('Kitchen test','lunch','12:00','12:45','10:30',20) RETURNING id INTO slot;
 INSERT INTO public.meal_customizations(name,price,meal_id) VALUES('Frozen roti',10,meal) RETURNING id INTO addon;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 o:=public.place_order_secure(d,'lunch',slot,addr,meal,2,
 jsonb_build_array(jsonb_build_object('customization_id',addon,'quantity',3)),
 'Less salt',gen_random_uuid(),'{"spiceLevel":"Less Spicy","oilLevel":"Less Oil (Fit)"}');
 PERFORM set_config('test.kitchen',jsonb_build_object('owner',owner_id,'staff',staff,'admin',admin_id,'delivery',delivery,'corporate',corporate,'id',o->>'id','date',d,'before',o)::text,true);
 UPDATE public.meals SET name='Changed catalog' WHERE id=meal;
 UPDATE public.meal_customizations SET name='Changed add-on' WHERE id=addon;
 UPDATE public.delivery_slots SET start_time='13:00',end_time='13:45' WHERE id=slot;
 -- Inactive states, another shift, and another date must not enter the selected queue.
 INSERT INTO public.orders(user_id,order_number,idempotency_key,request_payload,order_date,meal_type,status)
 SELECT owner_id,gen_random_uuid()::text,gen_random_uuid(),'{}',d,'lunch',s
 FROM unnest(ARRAY['pending','cancelled','out_for_delivery','delivered']) s;
 INSERT INTO public.orders(user_id,order_number,idempotency_key,request_payload,order_date,meal_type,status)
 VALUES(owner_id,gen_random_uuid()::text,gen_random_uuid(),'{}',d,'dinner','confirmed'),
 (owner_id,gen_random_uuid()::text,gen_random_uuid(),'{}',d+1,'lunch','confirmed');
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.get_kitchen_orders(current_date,'lunch'); RAISE EXCEPTION 'Anonymous queue access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.update_kitchen_order_status(gen_random_uuid(),'confirmed','preparing'); RAISE EXCEPTION 'Anonymous mutation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
DECLARE f JSONB:=current_setting('test.kitchen')::jsonb; who TEXT; rows JSONB; result JSONB; args TEXT[];
BEGIN
 FOREACH who IN ARRAY ARRAY['owner','delivery','corporate'] LOOP
  PERFORM set_config('request.jwt.claim.sub',f->>who,true);
  BEGIN PERFORM public.get_kitchen_orders((f->>'date')::date,'lunch'); RAISE EXCEPTION 'Unauthorized role read: %',who; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.update_kitchen_order_status((f->>'id')::uuid,'confirmed','preparing'); RAISE EXCEPTION 'Unauthorized role write: %',who; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM public.get_kitchen_orders((f->>'date')::date,'lunch'); RAISE EXCEPTION 'Missing identity allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',f->>'staff',true);
 rows:=public.get_kitchen_orders((f->>'date')::date,'lunch');
 SELECT entry INTO result
 FROM jsonb_array_elements(rows) AS entry
 WHERE entry->>'id'=f->>'id';
 IF result IS NULL THEN RAISE EXCEPTION 'Queue filter failed: %',rows; END IF;
 IF result->>'slot_label'<>'12:00:00 – 12:45:00' OR result#>>'{items,0,meal_name}'<>'Frozen kitchen thali'
 OR result#>>'{items,0,quantity}'<>'2' OR result#>>'{items,0,addons,0,name}'<>'Frozen roti'
 OR result#>>'{items,0,addons,0,quantity}'<>'3' OR result#>>'{items,0,preferences,spiceLevel}'<>'Less Spicy'
 OR result->>'customer_phone'<>'0000000000' OR result->>'delivery_area'<>'Kudasan'
 OR result->>'delivery_pincode'<>'382421' OR result->>'payment_status'<>'pending'
 OR NOT (result ? 'grand_total')
 OR result->>'notes'<>'Less salt' THEN RAISE EXCEPTION 'Preparation snapshots failed: %',result; END IF;
 IF result ?| ARRAY['user_id','address_snapshot','request_payload','address_id']
 OR (result#>'{items,0}') ?| ARRAY['unit_price','line_total','meal_id']
 OR (result#>'{items,0,addons,0}') ?| ARRAY['unit_price','line_total'] THEN RAISE EXCEPTION 'Kitchen exposed private fields'; END IF;
 IF EXISTS(SELECT 1 FROM public.orders) OR EXISTS(SELECT 1 FROM public.order_items) OR EXISTS(SELECT 1 FROM public.order_customizations) THEN RAISE EXCEPTION 'Kitchen unrestricted table access'; END IF;
 BEGIN UPDATE public.orders SET payment_status='paid' WHERE id=(f->>'id')::uuid; RAISE EXCEPTION 'Direct payment write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN SELECT count(*) INTO rows FROM private.kitchen_status_events; RAISE EXCEPTION 'Private audit exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_kitchen_orders(NULL,'lunch'); RAISE EXCEPTION 'Missing date accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.get_kitchen_orders((f->>'date')::date,'snack'); RAISE EXCEPTION 'Invalid shift accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 FOREACH args SLICE 1 IN ARRAY ARRAY[['confirmed','ready'],['preparing','confirmed'],['ready','delivered'],['confirmed','cancelled']] LOOP
  BEGIN PERFORM public.update_kitchen_order_status((f->>'id')::uuid,args[1],args[2]); RAISE EXCEPTION 'Invalid transition accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 result:=public.update_kitchen_order_status((f->>'id')::uuid,'confirmed','preparing');
 IF result->>'status'<>'preparing' THEN RAISE EXCEPTION 'Preparation failed'; END IF;
 IF public.update_kitchen_order_status((f->>'id')::uuid,'confirmed','preparing')<>result THEN RAISE EXCEPTION 'Retry changed the order'; END IF;
 PERFORM set_config('request.jwt.claim.sub',f->>'owner',true);
 BEGIN PERFORM public.cancel_customer_order((f->>'id')::uuid); RAISE EXCEPTION 'Customer cancelled preparing order'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Customer cancelled preparing order' THEN RAISE; END IF; END;
 IF (SELECT status FROM public.orders WHERE id=(f->>'id')::uuid)<>'preparing' THEN RAISE EXCEPTION 'Customer tracking RLS failed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',f->>'admin',true);
 result:=public.update_kitchen_order_status((f->>'id')::uuid,'preparing','ready');
 IF result->>'status'<>'ready' THEN RAISE EXCEPTION 'Ready failed'; END IF;
 BEGIN PERFORM public.update_kitchen_order_status((f->>'id')::uuid,'confirmed','preparing'); RAISE EXCEPTION 'Stale update accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM public.update_kitchen_order_status(gen_random_uuid(),'confirmed','preparing'); RAISE EXCEPTION 'Missing order accepted'; EXCEPTION WHEN no_data_found THEN NULL; END;
END $$;
RESET ROLE;
DO $$
DECLARE f JSONB:=current_setting('test.kitchen')::jsonb; snapshot JSONB; actor UUID;
BEGIN
 snapshot:=private.order_document((f->>'id')::uuid);
 IF snapshot-ARRAY['status','updated_at']<>(f->'before')-ARRAY['status','updated_at'] THEN RAISE EXCEPTION 'Kitchen changed immutable order data or payment'; END IF;
 IF (SELECT count(*) FROM private.kitchen_status_events WHERE order_id=(f->>'id')::uuid)<>2 THEN RAISE EXCEPTION 'Transition audit count incorrect'; END IF;
 SELECT actor_id INTO actor FROM private.kitchen_status_events WHERE order_id=(f->>'id')::uuid AND next_status='preparing';
 IF actor<>(f->>'staff')::uuid THEN RAISE EXCEPTION 'Preparation actor missing'; END IF;
 DELETE FROM public.user_roles WHERE user_id=(f->>'staff')::uuid AND role='kitchen';
 PERFORM set_config('request.jwt.claim.sub',f->>'staff',true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.get_kitchen_orders((current_setting('test.kitchen')::jsonb->>'date')::date,'lunch'); RAISE EXCEPTION 'Revoked role retained read access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.update_kitchen_order_status((current_setting('test.kitchen')::jsonb->>'id')::uuid,'preparing','ready'); RAISE EXCEPTION 'Revoked role retained write access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: kitchen authorization, projection, snapshots, filters, transitions, retries, audit, revocation and customer isolation' AS result;

-- Catalog management, customer identification, and RLS-protected realtime signals.
BEGIN;
SELECT set_config('request.jwt.claim.aal','aal2',true);
DO $$
DECLARE
  owner_id UUID := gen_random_uuid();
  staff_id UUID := gen_random_uuid();
  outsider_id UUID := gen_random_uuid();
  order_id UUID := gen_random_uuid();
  item_id UUID := gen_random_uuid();
  service_date DATE := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date + 1;
BEGIN
  INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
    (owner_id, owner_id || '@example.invalid', '{}'),
    (staff_id, staff_id || '@example.invalid', '{}'),
    (outsider_id, outsider_id || '@example.invalid', '{}');
  INSERT INTO public.user_roles(user_id, role) VALUES (staff_id, 'kitchen');

  INSERT INTO public.orders(
    id, user_id, order_number, idempotency_key, request_payload,
    order_date, meal_type, status, address_snapshot
  ) VALUES (
    order_id, owner_id, 'TEF-CATALOG-TEST', gen_random_uuid(), '{}',
    service_date, 'lunch', 'confirmed',
    jsonb_build_object(
      'recipient_name', 'Realtime Customer',
      'recipient_phone', '9999999999',
      'formatted_address', 'Private address',
      'slotLabel', '12:00:00 – 12:45:00'
    )
  );
  INSERT INTO public.order_items(
    id, order_id, meal_name_snapshot, preparation_preferences, quantity, unit_price, line_total
  ) VALUES (
    item_id, order_id, 'Snapshot Thali', '{"spiceLevel":"Regular","oilLevel":"Standard","dietType":"standard_gujarati"}', 2, 100, 200
  );

  PERFORM set_config('test.kitchen_catalog', jsonb_build_object(
    'owner', owner_id,
    'staff', staff_id,
    'outsider', outsider_id,
    'order', order_id,
    'date', service_date
  )::text, true);
END $$;

SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.get_kitchen_catalog(); RAISE EXCEPTION 'Anonymous catalog access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.save_kitchen_meal(NULL, 'Unsafe meal', '', '', 'lunch', 'standard_gujarati', 99, true); RAISE EXCEPTION 'Anonymous catalog write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.archive_kitchen_meal(gen_random_uuid()); RAISE EXCEPTION 'Anonymous catalog delete'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM count(*) FROM public.kitchen_order_signals; RAISE EXCEPTION 'Anonymous signal access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  f JSONB := current_setting('test.kitchen_catalog')::jsonb;
  catalog JSONB;
  queue JSONB;
  queued_order JSONB;
  meal_id UUID;
  signal_count BIGINT;
  affected_rows INTEGER;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', f->>'outsider', true);
  BEGIN PERFORM public.get_kitchen_catalog(); RAISE EXCEPTION 'Customer catalog access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.save_kitchen_meal(NULL, 'Unsafe meal', '', '', 'lunch', 'standard_gujarati', 99, true); RAISE EXCEPTION 'Customer catalog write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.archive_kitchen_meal(gen_random_uuid()); RAISE EXCEPTION 'Customer catalog delete'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT count(*) INTO signal_count FROM public.kitchen_order_signals;
  IF signal_count <> 0 THEN RAISE EXCEPTION 'Customer received kitchen signals'; END IF;

  PERFORM set_config('request.jwt.claim.sub', f->>'staff', true);
  catalog := public.save_kitchen_meal(
    NULL, 'Catalog Test Thali', 'Created by Kitchen', '',
    'both', 'standard_gujarati', 125.50, true
  );
  SELECT (entry->>'id')::uuid INTO meal_id
  FROM jsonb_array_elements(catalog) entry
  WHERE entry->>'name' = 'Catalog Test Thali';
  IF meal_id IS NULL THEN RAISE EXCEPTION 'Kitchen meal was not created: %', catalog; END IF;

  catalog := public.save_kitchen_meal(
    meal_id, 'Catalog Test Thali Updated', 'Updated by Kitchen', '',
    'lunch', 'jain_satvik', 139.75, false
  );
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(catalog) entry
    WHERE entry->>'id' = meal_id::text
      AND entry->>'name' = 'Catalog Test Thali Updated'
      AND entry->>'base_price' = '139.75'
      AND entry->>'is_active' = 'false'
  ) THEN RAISE EXCEPTION 'Kitchen meal update failed: %', catalog; END IF;

  BEGIN PERFORM public.save_kitchen_meal(meal_id, 'Bad price', '', '', 'lunch', 'standard_gujarati', 10.999, true); RAISE EXCEPTION 'Invalid price accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  UPDATE public.meals SET base_price = 1 WHERE id = meal_id;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN RAISE EXCEPTION 'Kitchen bypassed catalog RPC'; END IF;
  BEGIN PERFORM count(*) FROM private.kitchen_catalog_events; RAISE EXCEPTION 'Catalog audit exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  catalog := public.archive_kitchen_meal(meal_id);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(catalog) entry WHERE entry->>'id' = meal_id::text) THEN
    RAISE EXCEPTION 'Kitchen meal archive failed: %', catalog;
  END IF;

  queue := public.get_kitchen_orders((f->>'date')::date, 'lunch');
  SELECT entry INTO queued_order
  FROM jsonb_array_elements(queue) AS entry
  WHERE entry->>'id' = f->>'order';
  IF queued_order IS NULL
     OR queued_order->>'customer_name' <> 'Realtime Customer'
     OR queued_order->>'customer_phone' <> '9999999999'
     OR queued_order->>'delivery_address' <> 'Private address'
     OR queued_order->>'payment_status' <> 'pending'
     OR queued_order#>>'{items,0,meal_name}' <> 'Snapshot Thali'
     OR queued_order#>>'{items,0,quantity}' <> '2' THEN
    RAISE EXCEPTION 'Kitchen customer/order projection failed: %', queue;
  END IF;
  IF queued_order ?| ARRAY['user_id', 'address_snapshot', 'request_payload', 'address_id'] THEN
    RAISE EXCEPTION 'Kitchen projection exposed private fields: %', queue;
  END IF;

  SELECT count(*) INTO signal_count FROM public.kitchen_order_signals
  WHERE order_id = (f->>'order')::uuid
    AND order_date = (f->>'date')::date
    AND meal_type = 'lunch'
    AND status = 'confirmed';
  IF signal_count <> 1 THEN RAISE EXCEPTION 'Realtime insert signal missing'; END IF;

  PERFORM public.update_kitchen_order_status((f->>'order')::uuid, 'confirmed', 'preparing');
  IF (SELECT status FROM public.kitchen_order_signals WHERE order_id = (f->>'order')::uuid) <> 'preparing' THEN
    RAISE EXCEPTION 'Realtime status signal was not updated';
  END IF;
END $$;
RESET ROLE;

DO $$
DECLARE
  f JSONB := current_setting('test.kitchen_catalog')::jsonb;
  v_meal_id UUID;
BEGIN
  SELECT id INTO v_meal_id FROM public.meals WHERE name = 'Catalog Test Thali Updated';
  IF NOT EXISTS (
    SELECT 1 FROM public.meals
    WHERE id = v_meal_id AND archived_at IS NOT NULL AND NOT is_active
  ) THEN
    RAISE EXCEPTION 'Kitchen meal archive state is incorrect';
  END IF;
  IF (SELECT count(*) FROM private.kitchen_catalog_events e WHERE e.meal_id = v_meal_id) <> 3 THEN
    RAISE EXCEPTION 'Catalog audit count is incorrect';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.kitchen_catalog_events
    WHERE meal_id = v_meal_id AND (actor_id IS DISTINCT FROM (f->>'staff')::uuid OR after_state IS NULL)
  ) THEN RAISE EXCEPTION 'Catalog audit actor or snapshot is incorrect'; END IF;
END $$;

ROLLBACK;
SELECT 'PASS: kitchen catalog RPC, audited archive, operational customer projection and realtime signal isolation' AS result;

BEGIN;
SELECT set_config('request.jwt.claim.aal','aal2',true);
DO $$
DECLARE
  owner_id UUID := gen_random_uuid();
  staff_id UUID := gen_random_uuid();
  outsider_id UUID := gen_random_uuid();
  slot_id UUID;
  order_id UUID := gen_random_uuid();
  cancelled_id UUID := gen_random_uuid();
  service_date DATE := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date + 2;
BEGIN
  INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
    (owner_id, owner_id || '@example.invalid', '{}'),
    (staff_id, staff_id || '@example.invalid', '{}'),
    (outsider_id, outsider_id || '@example.invalid', '{}');
  INSERT INTO public.user_roles(user_id, role) VALUES (staff_id, 'kitchen');
  UPDATE public.profiles SET full_name = 'Shift Lead' WHERE id = staff_id;
  INSERT INTO public.delivery_slots(name, meal_type, start_time, end_time, cutoff_time, max_orders)
  VALUES ('Capacity test', 'lunch', '12:00', '12:45', '10:30', 4) RETURNING id INTO slot_id;
  INSERT INTO public.orders(id, user_id, delivery_slot_id, order_number, idempotency_key, request_payload, order_date, meal_type, status)
  VALUES
    (order_id, owner_id, slot_id, 'TEF-CAPACITY', gen_random_uuid(), '{}', service_date, 'lunch', 'confirmed'),
    (cancelled_id, owner_id, slot_id, 'TEF-CANCELLED', gen_random_uuid(), '{}', service_date, 'lunch', 'cancelled');
  INSERT INTO public.order_items(order_id, meal_name_snapshot, preparation_preferences, quantity, unit_price, line_total)
  VALUES
    (order_id, 'Capacity Thali', '{}', 3, 100, 300),
    (cancelled_id, 'Cancelled Thali', '{}', 10, 100, 1000);
  PERFORM set_config('test.kitchen_shift', jsonb_build_object(
    'staff', staff_id, 'outsider', outsider_id, 'date', service_date, 'slot', slot_id
  )::text, true);
END $$;

SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.get_kitchen_shift_brief(current_date, 'lunch'); RAISE EXCEPTION 'Anonymous shift read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.save_kitchen_shift_handover(current_date, 'lunch', 'Unsafe', NULL); RAISE EXCEPTION 'Anonymous handover write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  f JSONB := current_setting('test.kitchen_shift')::jsonb;
  brief JSONB;
  target JSONB;
  saved JSONB;
  first_version TIMESTAMPTZ;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', f->>'outsider', true);
  BEGIN PERFORM public.get_kitchen_shift_brief((f->>'date')::date, 'lunch'); RAISE EXCEPTION 'Outsider shift read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.save_kitchen_shift_handover((f->>'date')::date, 'lunch', 'Unsafe', NULL); RAISE EXCEPTION 'Outsider handover write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('request.jwt.claim.sub', f->>'staff', true);
  brief := public.get_kitchen_shift_brief((f->>'date')::date, 'lunch');
  SELECT entry INTO target FROM jsonb_array_elements(brief->'slots') entry
  WHERE entry->>'id' = f->>'slot';
  IF target IS NULL
     OR target->>'max_portions' <> '4'
     OR target->>'booked_portions' <> '3'
     OR target->>'remaining_portions' <> '1'
     OR target->>'utilization_percent' <> '75.0' THEN
    RAISE EXCEPTION 'Capacity semantics failed: %', brief;
  END IF;

  saved := public.save_kitchen_shift_handover((f->>'date')::date, 'lunch', '  Check Jain portions  ', NULL);
  IF saved#>>'{handover,note}' <> 'Check Jain portions'
     OR saved#>>'{handover,updated_by}' <> 'Shift Lead'
     OR saved#>>'{handover,updated_at}' IS NULL THEN
    RAISE EXCEPTION 'Handover create failed: %', saved;
  END IF;
  first_version := (saved#>>'{handover,updated_at}')::timestamptz;
  saved := public.save_kitchen_shift_handover((f->>'date')::date, 'lunch', 'Prep complete', first_version);
  IF saved#>>'{handover,note}' <> 'Prep complete' THEN RAISE EXCEPTION 'Handover update failed'; END IF;
  BEGIN
    PERFORM public.save_kitchen_shift_handover((f->>'date')::date, 'lunch', 'Stale overwrite', first_version);
    RAISE EXCEPTION 'Stale handover accepted';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  BEGIN PERFORM count(*) FROM private.kitchen_shift_handovers; RAISE EXCEPTION 'Private handover exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM count(*) FROM private.kitchen_handover_events; RAISE EXCEPTION 'Private handover audit exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

DO $$
DECLARE f JSONB := current_setting('test.kitchen_shift')::jsonb;
BEGIN
  IF (SELECT count(*) FROM private.kitchen_handover_events e JOIN private.kitchen_shift_handovers h ON h.id = e.handover_id WHERE h.service_date = (f->>'date')::date AND h.meal_type = 'lunch') <> 2 THEN RAISE EXCEPTION 'Handover audit count failed'; END IF;
  IF EXISTS (SELECT 1 FROM private.kitchen_handover_events e JOIN private.kitchen_shift_handovers h ON h.id = e.handover_id WHERE h.service_date = (f->>'date')::date AND h.meal_type = 'lunch' AND e.actor_id IS DISTINCT FROM (f->>'staff')::uuid) THEN RAISE EXCEPTION 'Handover audit actor failed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: kitchen slot capacity, handover authorization, optimistic locking and private audit' AS result;


