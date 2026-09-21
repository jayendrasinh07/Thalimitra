-- Promotion integration checks. All fixtures and redemptions are rolled back.
BEGIN;
DO $$
DECLARE admin_id UUID:=gen_random_uuid(); customer_a UUID:=gen_random_uuid(); customer_b UUID:=gen_random_uuid();
  address_a UUID; address_b UUID; meal_id UUID; slot_id UUID; menu_id UUID;
  service_date DATE := (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::DATE + 2;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (admin_id,admin_id||'@example.invalid','{"full_name":"Offer Admin"}'),
    (customer_a,customer_a||'@example.invalid','{"full_name":"Offer Customer A"}'),
    (customer_b,customer_b||'@example.invalid','{"full_name":"Offer Customer B"}');
  INSERT INTO public.user_roles(user_id,role) VALUES(admin_id,'admin');
  UPDATE public.delivery_zones SET status='available',is_active=true,lunch_enabled=true,is_free_delivery=false,delivery_fee=15,min_order_amount=0,
    boundary=extensions.ST_Multi(extensions.ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[72.62,23.17],[72.64,23.17],[72.64,23.19],[72.62,23.19],[72.62,23.17]]]}'))
  WHERE id='zone_a_core';
  INSERT INTO public.addresses(user_id,recipient_name,recipient_phone,area,pincode,is_default,latitude,longitude)
    VALUES(customer_a,'Customer A','0000000000','Kudasan','382421',true,23.18,72.63) RETURNING id INTO address_a;
  INSERT INTO public.addresses(user_id,recipient_name,recipient_phone,area,pincode,is_default,latitude,longitude)
    VALUES(customer_b,'Customer B','0000000000','Kudasan','382421',true,23.181,72.631) RETURNING id INTO address_b;
  INSERT INTO public.meals(name,meal_type,base_price) VALUES('Promotion test meal','lunch',250) RETURNING id INTO meal_id;
  INSERT INTO public.menu_days(menu_date,is_published) VALUES(service_date,true) RETURNING id INTO menu_id;
  INSERT INTO public.menu_items(menu_day_id,meal_id,availability,service_meal_types) VALUES(menu_id,meal_id,true,ARRAY['lunch']);
  INSERT INTO public.delivery_slots(name,meal_type,start_time,end_time,cutoff_time,max_orders) VALUES('Promotion lunch','lunch','12:00','12:45','10:30',20) RETURNING id INTO slot_id;
  PERFORM set_config('test.promotion_fixture',jsonb_build_object('admin',admin_id,'a',customer_a,'b',customer_b,'address_a',address_a,'address_b',address_b,'meal',meal_id,'slot',slot_id,'date',service_date)::TEXT,true);
END $$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE f JSONB:=current_setting('test.promotion_fixture')::JSONB; document JSONB;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',f->>'admin',true);
  PERFORM set_config('request.jwt.claim.aal','aal2',true);
  document := public.save_promotion_campaign(NULL,'AUDIT40','Audit welcome','₹40 first-order test','fixed',40,249,40,40,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '30 days',NULL,NULL,true,true,1,ARRAY['lunch'],ARRAY[(f->>'meal')::UUID],ARRAY['zone_a_core']);
  IF jsonb_array_length(document->'campaigns') < 1 THEN RAISE EXCEPTION 'Admin offer document missing'; END IF;
END $$;

DO $$
DECLARE f JSONB:=current_setting('test.promotion_fixture')::JSONB; quote JSONB; placed JSONB; failed BOOLEAN;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',f->>'a',true);
  PERFORM set_config('request.jwt.claim.aal','aal1',true);
  quote := public.get_order_promotion_quote((f->>'date')::DATE,'lunch',(f->>'address_a')::UUID,(f->>'meal')::UUID,1,'[]','AUDIT40');
  IF (quote->>'discount')::NUMERIC<>40 OR (quote->>'grand_total')::NUMERIC<>225 OR quote#>>'{applied_offer,code}'<>'AUDIT40' THEN RAISE EXCEPTION 'Promotion quote incorrect: %',quote; END IF;
  placed := public.place_order_secure((f->>'date')::DATE,'lunch',(f->>'slot')::UUID,(f->>'address_a')::UUID,(f->>'meal')::UUID,1,'[]',NULL,gen_random_uuid(),'{}','AUDIT40');
  IF (placed->>'discount')::NUMERIC<>40 OR (placed->>'grand_total')::NUMERIC<>225 OR placed->>'promotion_code_snapshot'<>'AUDIT40' THEN RAISE EXCEPTION 'Promotion order snapshot incorrect: %',placed; END IF;
  IF (SELECT count(*) FROM private.promotion_redemptions WHERE order_id=(placed->>'id')::UUID)<>1 THEN RAISE EXCEPTION 'Redemption ledger missing'; END IF;
  PERFORM public.cancel_customer_order((placed->>'id')::UUID);
  failed:=false; BEGIN PERFORM public.get_order_promotion_quote((f->>'date')::DATE,'lunch',(f->>'address_a')::UUID,(f->>'meal')::UUID,1,'[]','AUDIT40'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'Cancellation silently restored one-use offer'; END IF;
  PERFORM set_config('request.jwt.claim.sub',f->>'b',true);
  failed:=false; BEGIN PERFORM public.get_order_promotion_quote((f->>'date')::DATE,'lunch',(f->>'address_b')::UUID,(f->>'meal')::UUID,1,'[]','AUDIT40'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'Exhausted campaign budget accepted'; END IF;
  failed:=false; BEGIN PERFORM 1 FROM private.promotion_campaigns; EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'Customer read private campaign rules'; END IF;
END $$;

DO $$
DECLARE f JSONB:=current_setting('test.promotion_fixture')::JSONB; campaign_id UUID; failed BOOLEAN;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',f->>'admin',true);
  PERFORM set_config('request.jwt.claim.aal','aal2',true);
  SELECT id INTO campaign_id FROM private.promotion_campaigns WHERE code='AUDIT40';
  failed:=false; BEGIN PERFORM public.delete_unused_promotion_campaign(campaign_id); EXCEPTION WHEN foreign_key_violation THEN failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'Used offer was deleted'; END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_function_privilege('anon','public.get_order_promotion_quote(date,text,uuid,uuid,integer,jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous promotion quote exposed'; END IF;
  IF has_table_privilege('authenticated','private.promotion_campaigns','SELECT') THEN RAISE EXCEPTION 'Private campaign table exposed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: admin offers, secure quotes, immutable redemption, budget, cancellation, RLS and order snapshots' AS result;
