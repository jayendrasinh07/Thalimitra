export type BoundaryPoint = [number, number];

export interface DeliveryAreaPrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  latitude: number;
  longitude: number;
  outline: BoundaryPoint[];
  outlineKind: 'mapped' | 'approximate';
}

interface NominatimAreaResult {
  place_id?: number | string;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
  geojson?: { type?: string; coordinates?: unknown };
  namedetails?: { name?: string };
}

const searchCache = new Map<string, DeliveryAreaPrediction[]>();
let nextPublicSearchAt = 0;

const finitePoint = (value: unknown): BoundaryPoint | null => {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
};

const normalizeRing = (value: unknown): BoundaryPoint[] => {
  if (!Array.isArray(value)) return [];
  const ring = value.map(finitePoint).filter((point): point is BoundaryPoint => Boolean(point));
  if (ring.length > 1 && ring[0][0] === ring.at(-1)?.[0] && ring[0][1] === ring.at(-1)?.[1]) ring.pop();
  if (ring.length <= 240) return ring;
  const step = Math.ceil(ring.length / 240);
  return ring.filter((_, index) => index % step === 0);
};

const polygonArea = (points: BoundaryPoint[]) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0) / 2);

const mappedOutline = (geometry: NominatimAreaResult['geojson']): BoundaryPoint[] => {
  if (!geometry?.coordinates) return [];
  if (geometry.type === 'Polygon') return normalizeRing((geometry.coordinates as unknown[])[0]);
  if (geometry.type !== 'MultiPolygon') return [];
  const rings = (geometry.coordinates as unknown[])
    .map(polygon => normalizeRing(Array.isArray(polygon) ? polygon[0] : []))
    .filter(ring => ring.length >= 3);
  return rings.sort((left, right) => polygonArea(right) - polygonArea(left))[0] ?? [];
};

const approximateOutline = (box: string[] | undefined): BoundaryPoint[] => {
  if (!box || box.length < 4) return [];
  const [south, north, west, east] = box.map(Number);
  if (![south, north, west, east].every(Number.isFinite) || south === north || west === east) return [];
  return [[west, south], [east, south], [east, north], [west, north]];
};

export const parseDeliveryAreaPrediction = (value: unknown): DeliveryAreaPrediction | null => {
  const result = value as NominatimAreaResult;
  const latitude = Number(result?.lat);
  const longitude = Number(result?.lon);
  const description = typeof result?.display_name === 'string' ? result.display_name : '';
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !description) return null;
  const exactOutline = mappedOutline(result.geojson);
  const outline = exactOutline.length >= 3 ? exactOutline : approximateOutline(result.boundingbox);
  if (outline.length < 3) return null;
  const mainText = result.namedetails?.name || result.name || description.split(',')[0].trim();
  return {
    placeId: `osm-${result.place_id ?? `${latitude}-${longitude}`}`,
    description,
    mainText,
    secondaryText: description.split(',').slice(1, 4).join(',').trim(),
    latitude,
    longitude,
    outline,
    outlineKind: exactOutline.length >= 3 ? 'mapped' : 'approximate',
  };
};

const waitForPublicSearchSlot = async () => {
  const delay = Math.max(0, nextPublicSearchAt - Date.now());
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  nextPublicSearchAt = Date.now() + 1100;
};

export async function searchDeliveryAreaBoundaries(query: string): Promise<DeliveryAreaPrediction[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 3) return [];
  const cacheKey = cleanQuery.toLocaleLowerCase('en-IN');
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  await waitForPublicSearchSlot();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const parameters = new URLSearchParams({
      q: `${cleanQuery}, Gujarat, India`, format: 'jsonv2', addressdetails: '1', namedetails: '1',
      countrycodes: 'in', limit: '5', polygon_geojson: '1', polygon_threshold: '0.0002',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${parameters}`, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'en' },
    });
    if (!response.ok) throw new Error('Area search provider did not respond.');
    const payload = await response.json();
    const predictions = Array.isArray(payload)
      ? payload.map(parseDeliveryAreaPrediction).filter((item): item is DeliveryAreaPrediction => Boolean(item))
      : [];
    searchCache.set(cacheKey, predictions);
    return predictions;
  } finally {
    clearTimeout(timer);
  }
}
