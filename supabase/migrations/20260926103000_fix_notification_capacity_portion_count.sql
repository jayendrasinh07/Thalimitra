-- Count produced portions from immutable order item snapshots, not the order header.
CREATE OR REPLACE FUNCTION private.orders_notification_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event TEXT; v_title TEXT; v_body TEXT; v_capacity INTEGER; v_used INTEGER;
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM private.enqueue_notification(NEW.user_id,'customer','operational','order_received','Order received',
      'We received your meal order. Open Thalimitra for its latest status.','order_history','order',NEW.id,
      'order:'||NEW.id||':received',NULL);
  END IF;
  IF TG_OP='UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status='paid' THEN
    PERFORM private.enqueue_notification(NEW.user_id,'customer','operational','payment_verified','Payment verified',
      'Your payment was verified successfully.','order_history','order',NEW.id,'order:'||NEW.id||':payment:paid',NULL);
  END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'order_'||NEW.status;
    v_title := CASE NEW.status WHEN 'confirmed' THEN 'Order confirmed' WHEN 'preparing' THEN 'Kitchen is preparing your meal'
      WHEN 'ready' THEN 'Your meal is ready' WHEN 'out_for_delivery' THEN 'Meal is on the way'
      WHEN 'delivered' THEN 'Meal delivered' WHEN 'cancelled' THEN 'Order cancelled' ELSE 'Order updated' END;
    v_body := CASE NEW.status WHEN 'confirmed' THEN 'Your order is confirmed for the selected delivery time.'
      WHEN 'preparing' THEN 'Your meal is now being prepared.' WHEN 'ready' THEN 'Your meal is packed and ready for dispatch.'
      WHEN 'out_for_delivery' THEN 'Your meal has left the kitchen. Open the app for current details.'
      WHEN 'delivered' THEN 'Your meal has been marked delivered.' WHEN 'cancelled' THEN 'Your order was cancelled. Open the app for details.'
      ELSE 'Open Thalimitra to see the latest order status.' END;
    PERFORM private.enqueue_notification(NEW.user_id,'customer','operational',v_event,v_title,v_body,'order_history','order',NEW.id,
      'order:'||NEW.id||':status:'||NEW.status,NULL);
    IF NEW.status='confirmed' THEN
      PERFORM private.notify_role('kitchen','kitchen','operational','kitchen_order_confirmed','New confirmed meal',
        'A confirmed meal was added to the production queue.','kitchen_dashboard','order',NEW.id,'kitchen:order:'||NEW.id||':confirmed');
    ELSIF NEW.status='cancelled' THEN
      PERFORM private.notify_role('kitchen','kitchen','operational','kitchen_order_cancelled','Production order cancelled',
        'A meal was removed from the active production queue.','kitchen_dashboard','order',NEW.id,'kitchen:order:'||NEW.id||':cancelled');
    END IF;
  END IF;
  IF (TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)) AND NEW.status='confirmed' THEN
    SELECT slot.max_orders INTO v_capacity FROM public.delivery_slots slot WHERE slot.id=NEW.delivery_slot_id;
    SELECT coalesce(sum(item.quantity),0) INTO v_used
      FROM public.orders orders
      JOIN public.order_items item ON item.order_id=orders.id
      WHERE orders.order_date=NEW.order_date
        AND orders.delivery_slot_id=NEW.delivery_slot_id
        AND orders.status<>'cancelled';
    IF v_capacity>0 AND v_used*100>=v_capacity*80 THEN
      PERFORM private.notify_role('admin','admin','operational','capacity_threshold','Capacity needs attention',
        'A delivery batch has reached at least 80% of its portion capacity.','kitchen_alerts','system',NULL,
        'capacity:'||NEW.order_date||':'||NEW.delivery_slot_id||':80');
    END IF;
  END IF;
  RETURN NEW;
END $$;
