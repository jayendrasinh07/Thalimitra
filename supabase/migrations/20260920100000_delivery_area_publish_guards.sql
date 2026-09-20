-- Prevent ambiguous or unusable public delivery areas at the database boundary.

ALTER TABLE public.delivery_zones
  DROP CONSTRAINT IF EXISTS delivery_zones_available_service_check;
ALTER TABLE public.delivery_zones
  ADD CONSTRAINT delivery_zones_available_service_check CHECK (
    status <> 'available'
    OR breakfast_enabled
    OR lunch_enabled
    OR dinner_enabled
  );

CREATE OR REPLACE FUNCTION private.guard_delivery_area_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.boundary IS NULL OR NEW.status NOT IN ('available', 'coming_soon') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.delivery_zones existing
    WHERE existing.id <> NEW.id
      AND existing.boundary IS NOT NULL
      AND existing.status IN ('available', 'coming_soon')
      AND existing.priority = NEW.priority
      AND extensions.ST_Intersects(existing.boundary, NEW.boundary)
      AND NOT extensions.ST_Touches(existing.boundary, NEW.boundary)
  ) THEN
    RAISE EXCEPTION 'This boundary overlaps another public area with the same priority. Change the boundary or priority.'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_delivery_area_overlap ON public.delivery_zones;
CREATE TRIGGER guard_delivery_area_overlap
BEFORE INSERT OR UPDATE OF boundary, status, priority ON public.delivery_zones
FOR EACH ROW EXECUTE FUNCTION private.guard_delivery_area_overlap();

REVOKE ALL ON FUNCTION private.guard_delivery_area_overlap()
  FROM PUBLIC, anon, authenticated;
