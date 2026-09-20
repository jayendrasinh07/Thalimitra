-- Verify the disposable browser QA lead reached the MFA admin document, then remove it.
DO $$
DECLARE
  v_admin_id UUID;
  v_document JSONB;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.area_waitlist
    WHERE contact = 'qa-ui-20260920@example.invalid'
      AND name = 'Thalimitra UI QA'
  ) THEN
    SELECT user_id INTO v_admin_id
    FROM public.user_roles
    WHERE role = 'admin'
    ORDER BY created_at
    LIMIT 1;

    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_admin_id, 'role', 'authenticated', 'aal', 'aal2')::TEXT,
      TRUE
    );
    v_document := public.get_area_waitlist();

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_document->'entries') entry
      WHERE entry->>'contact' = 'qa-ui-20260920@example.invalid'
        AND entry->>'name' = 'Thalimitra UI QA'
        AND entry ? 'formatted_address'
        AND entry ? 'created_at'
    ) THEN
      RAISE EXCEPTION 'Disposable waitlist UI record was not visible to the MFA admin document.';
    END IF;

    DELETE FROM public.area_waitlist
    WHERE contact = 'qa-ui-20260920@example.invalid'
      AND name = 'Thalimitra UI QA';
  END IF;
END;
$$;
