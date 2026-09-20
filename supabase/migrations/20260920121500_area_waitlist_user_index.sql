-- Cover the optional auth user relationship used by administrative audits.
CREATE INDEX IF NOT EXISTS area_waitlist_user_id_idx
  ON public.area_waitlist(user_id)
  WHERE user_id IS NOT NULL;
