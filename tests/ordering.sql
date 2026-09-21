-- Transactional integration checks. All fixtures are rolled back, including auth users.
BEGIN;
DO $$
DECLARE a UUID:=gen_random_uuid(); b UUID:=gen_random_uuid(); addr UUID; otheraddr UUID;
 m UUID; othermeal UUID; slot UUID; day UUID; addon UUID; wrongaddon UUID;
 d DATE := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+1;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(a,a||'@example.invalid','{"full_name":"Audit A","segment":"invalid"}'),(b,b||'@example.invalid','{"full_name":"Audit B"}');
 IF (SELECT segment FROM public.profiles WHERE id=a)<>'individual' THEN RAISE EXCEPTION 'Signup segment normalization failed'; END IF;
 -- Ordering tests use exact, non-overlapping map boundaries. Broad Phase-1
 -- pincode/sector records are retired in production.
 UPDATE public.delivery_zones SET status='available',is_active=true,lunch_enabled=true,
   boundary=extensions.ST_Multi(extensions.ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[72.62,23.17],[72.64,23.17],[72.64,23.19],[72.62,23.19],[72.62,23.17]]]}'))
 WHERE id='zone_a_core';
 UPDATE public.delivery_zones SET status='available',is_active=true,lunch_enabled=true,
   boundary=extensions.ST_Multi(extensions.ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[72.67,23.15],[72.69,23.15],[72.69,23.17],[72.67,23.17],[72.67,23.15]]]}'))
 WHERE id='zone_b_extended';
 UPDATE public.delivery_zones SET status='available',is_active=true,lunch_enabled=true,
   boundary=extensions.ST_Multi(extensions.ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[72.59,23.24],[72.61,23.24],[72.61,23.26],[72.59,23.26],[72.59,23.24]]]}'))
 WHERE id='zone_c_periphery';
 INSERT INTO public.addresses(user_id,recipient_name,recipient_phone,area,pincode,is_default,zone_id,is_serviceable,latitude,longitude)
 VALUES(a,'Audit A','0000000000','Kudasan','382421',true,'zone_c_periphery',false,23.18,72.63) RETURNING id INTO addr;
 IF (SELECT zone_id FROM public.addresses WHERE id=addr)<>'zone_a_core' THEN RAISE EXCEPTION 'Client zone was trusted'; END IF;
 INSERT INTO public.addresses(user_id,recipient_name,recipient_phone,area,pincode,is_default,latitude,longitude)
 VALUES(b,'Audit B','0000000000','GIFT City','382355',true,23.16,72.68) RETURNING id INTO otheraddr;
 INSERT INTO public.meals(name,meal_type,base_price) VALUES('Audit meal','both',100) RETURNING id INTO m;
 INSERT INTO public.meals(name,meal_type,base_price) VALUES('Other meal','both',200) RETURNING id INTO othermeal;
 INSERT INTO public.menu_days(menu_date,is_published) VALUES(d,true) ON CONFLICT(menu_date) DO UPDATE SET is_published=true RETURNING id INTO day;
 INSERT INTO public.menu_items(menu_day_id,meal_id,service_meal_types) VALUES(day,m,ARRAY['lunch','dinner']);
 INSERT INTO public.delivery_slots(name,meal_type,start_time,end_time,cutoff_time,max_orders) VALUES('Audit slot','lunch','12:00','12:45','10:30',3) RETURNING id INTO slot;
 INSERT INTO public.meal_customizations(name,price,meal_id) VALUES('Valid add-on',15,m) RETURNING id INTO addon;
 INSERT INTO public.meal_customizations(name,price,meal_id) VALUES('Wrong meal add-on',15,othermeal) RETURNING id INTO wrongaddon;
 PERFORM set_config('test.fixture',jsonb_build_object('a',a,'b',b,'addr',addr,'otheraddr',otheraddr,'meal',m,'othermeal',othermeal,'slot',slot,'date',d,'addon',addon,'wrongaddon',wrongaddon)::text,true);
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 -- Inclusive cutoff and IST midnight boundaries use the same helper as the RPC.
 PERFORM private.assert_order_window('2026-09-03','lunch','2026-09-03 04:59:59+00');
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE f JSONB:=current_setting('test.fixture')::jsonb; request UUID:=gen_random_uuid(); result JSONB; again JSONB; failed BOOLEAN; item UUID;
BEGIN
 IF (SELECT count(*) FROM public.addresses)<>1 THEN RAISE EXCEPTION 'Address RLS failed'; END IF;
 BEGIN INSERT INTO public.user_roles(user_id,role) VALUES((f->>'a')::uuid,'admin'); RAISE EXCEPTION 'Role escalation allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.orders DEFAULT VALUES; RAISE EXCEPTION 'Direct order insert allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 result := public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'addr')::uuid,(f->>'meal')::uuid,2,jsonb_build_array(jsonb_build_object('customization_id',f->>'addon','quantity',1)),'Less salt',request,'{"spiceLevel":"Less Spicy","oilLevel":"Less Oil (Fit)"}');
 IF result->>'status'<>'confirmed' OR result->>'payment_status'<>'pending' OR (result->>'grand_total')::numeric<>215 THEN RAISE EXCEPTION 'Confirmation/pricing incorrect: %',result; END IF;
 IF result#>>'{order_items,0,preparation_preferences,spiceLevel}'<>'Less Spicy' THEN RAISE EXCEPTION 'Preparation snapshot missing'; END IF;
 IF result->>'notes'<>'Less salt' THEN RAISE EXCEPTION 'Notes lost'; END IF;
 PERFORM set_config('test.order_id',result->>'id',true);
 again := public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'addr')::uuid,(f->>'meal')::uuid,2,jsonb_build_array(jsonb_build_object('customization_id',f->>'addon','quantity',1)),'Less salt',request,'{"spiceLevel":"Less Spicy","oilLevel":"Less Oil (Fit)"}');
 IF again->>'id'<>result->>'id' OR (SELECT count(*) FROM public.orders)<>1 THEN RAISE EXCEPTION 'Idempotency failed'; END IF;
 failed:=false; BEGIN PERFORM public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'addr')::uuid,(f->>'meal')::uuid,1,'[]',NULL,request); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Changed payload reused key'; END IF;
 failed:=false; BEGIN PERFORM public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'addr')::uuid,(f->>'meal')::uuid,2,'[]',NULL,gen_random_uuid()); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Portion capacity exceeded'; END IF;
 failed:=false; BEGIN PERFORM public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'otheraddr')::uuid,(f->>'meal')::uuid,1,'[]',NULL,gen_random_uuid()); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Foreign address accepted'; END IF;
 failed:=false; BEGIN PERFORM public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'addr')::uuid,(f->>'othermeal')::uuid,1,'[]',NULL,gen_random_uuid()); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Meal outside menu accepted'; END IF;
 failed:=false; BEGIN PERFORM public.place_order_secure((f->>'date')::date+1,'lunch',(f->>'slot')::uuid,(f->>'addr')::uuid,(f->>'meal')::uuid,1,'[]',NULL,gen_random_uuid()); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Missing menu accepted'; END IF;
 failed:=false; BEGIN PERFORM public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'addr')::uuid,(f->>'meal')::uuid,1,jsonb_build_array(jsonb_build_object('customization_id',f->>'wrongaddon','quantity',1)),NULL,gen_random_uuid()); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed OR (SELECT count(*) FROM public.orders)<>1 THEN RAISE EXCEPTION 'Invalid add-on accepted or partial order left'; END IF;
 UPDATE public.addresses SET area='Unknown',pincode='999999',latitude=20,longitude=70,zone_id='zone_a_core',is_serviceable=true WHERE id=(f->>'addr')::uuid;
 IF (SELECT is_serviceable FROM public.addresses WHERE id=(f->>'addr')::uuid) THEN RAISE EXCEPTION 'Client serviceability trusted'; END IF;
 IF (SELECT address_snapshot->>'area' FROM public.orders WHERE id=(result->>'id')::uuid)<>'Kudasan' THEN RAISE EXCEPTION 'Address snapshot changed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',f->>'b',true);
 IF (SELECT count(*) FROM public.orders)<>0 OR (SELECT count(*) FROM public.order_items)<>0 OR (SELECT count(*) FROM public.order_customizations)<>0 THEN RAISE EXCEPTION 'Cross-customer order leak'; END IF;
 failed:=false; BEGIN PERFORM public.cancel_customer_order((result->>'id')::uuid); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Foreign cancellation allowed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',f->>'a',true);
 result:=public.cancel_customer_order((result->>'id')::uuid);
 IF result->>'status'<>'cancelled' OR result->>'payment_status'<>'pending' THEN RAISE EXCEPTION 'Cancellation faked refund'; END IF;
 IF (SELECT booked_portions FROM public.get_delivery_slot_availability((f->>'date')::date,'lunch') WHERE id=(f->>'slot')::uuid)<>0 THEN RAISE EXCEPTION 'Cancellation did not release capacity'; END IF;
END $$;
RESET ROLE;
DO $$
DECLARE f JSONB:=current_setting('test.fixture')::jsonb; r JSONB; failed BOOLEAN;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',f->>'b',true);
 r:=public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'otheraddr')::uuid,(f->>'meal')::uuid,1,'[]',NULL,gen_random_uuid());
 IF (r->>'delivery_fee')::numeric<>15 OR (r->>'grand_total')::numeric<>115 THEN RAISE EXCEPTION 'Zone B fee incorrect'; END IF;
 UPDATE public.addresses SET area='Vavol',pincode='382016',latitude=23.25,longitude=72.60 WHERE id=(f->>'otheraddr')::uuid;
 r:=public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'otheraddr')::uuid,(f->>'meal')::uuid,1,'[]',NULL,gen_random_uuid());
 IF (r->>'delivery_fee')::numeric<>25 OR (r->>'grand_total')::numeric<>125 THEN RAISE EXCEPTION 'Zone C fee incorrect'; END IF;
 UPDATE public.meals SET base_price=900,name='Renamed meal' WHERE id=(f->>'meal')::uuid;
 IF (SELECT unit_price FROM public.order_items WHERE order_id=(r->>'id')::uuid)<>100 THEN RAISE EXCEPTION 'Price snapshot changed'; END IF;
 UPDATE public.menu_days SET is_published=false WHERE menu_date=(f->>'date')::date;
 failed:=false;BEGIN PERFORM public.place_order_secure((f->>'date')::date,'lunch',(f->>'slot')::uuid,(f->>'otheraddr')::uuid,(f->>'meal')::uuid,1,'[]',NULL,gen_random_uuid());EXCEPTION WHEN OTHERS THEN failed:=true;END;
 IF NOT failed THEN RAISE EXCEPTION 'Unpublished menu accepted'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.menu_items i JOIN public.menu_days d ON d.id=i.menu_day_id WHERE d.menu_date=(current_setting('test.fixture')::jsonb->>'date')::date) THEN RAISE EXCEPTION 'Unpublished menu exposed'; END IF;
END $$;
RESET ROLE;
DO $$
DECLARE failed BOOLEAN; cutoff TEXT;
BEGIN
 FOREACH cutoff IN ARRAY ARRAY['2026-09-03 05:00:00+00','2026-09-03 05:00:01+00','2026-09-04 00:00:00+00'] LOOP
  failed:=false; BEGIN PERFORM private.assert_order_window('2026-09-03','lunch',cutoff::timestamptz); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'Cutoff/date accepted at %',cutoff; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.place_order_secure(date,text,uuid,uuid,uuid,integer,jsonb,text,uuid,jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous checkout exposed'; END IF;
 IF has_table_privilege('authenticated','public.orders','INSERT') THEN RAISE EXCEPTION 'Direct write privilege exposed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: pricing, persistence, snapshots, RLS, roles, menu, serviceability, cutoff, capacity, cancellation and idempotency' AS result;
