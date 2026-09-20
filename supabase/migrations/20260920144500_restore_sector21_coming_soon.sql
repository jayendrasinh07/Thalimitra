-- Restore the owner-selected Sector 21 launch state after the public status fix.
-- Coming soon is visible to Customers but remains non-orderable.

DO $$
DECLARE
  v_before public.delivery_zones;
  v_after public.delivery_zones;
  v_actor UUID;
BEGIN
  SELECT * INTO v_before
  FROM public.delivery_zones
  WHERE id = 'area_sector_21_draft'
  FOR UPDATE;

  IF NOT FOUND OR v_before.status = 'coming_soon' THEN
    RETURN;
  END IF;

  v_actor := coalesce(
    v_before.published_by,
    (SELECT role.user_id FROM public.user_roles role WHERE role.role = 'admin' ORDER BY role.created_at LIMIT 1)
  );

  UPDATE public.delivery_zones
  SET status = 'coming_soon',
      is_active = false,
      published_at = clock_timestamp(),
      published_by = v_actor,
      version = version + 1,
      updated_at = clock_timestamp()
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  IF v_actor IS NOT NULL THEN
    INSERT INTO private.delivery_area_events(zone_id, actor_id, action, before_state, after_state)
    VALUES (
      v_after.id,
      v_actor,
      'updated',
      private.delivery_area_snapshot(v_before),
      private.delivery_area_snapshot(v_after)
    );
  END IF;
END;
$$;
