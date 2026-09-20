import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Plus, RefreshCw, RotateCcw, Save, Search, Undo2, X } from 'lucide-react';
import { Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  deliveryAreaService,
  type BoundaryGeometry,
  type DeliveryAreaDocument,
  type DeliveryAreaDraft,
  type ManagedDeliveryArea,
} from '../../services/deliveryAreaService';
import { getGooglePlaceDetails, searchGooglePlaces, type UnifiedPrediction } from '../../services/googleMapsLoader';

type Point = [number, number];
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const EMPTY_DRAFT: DeliveryAreaDraft = {
  name: '', status: 'draft', boundary: null,
  breakfastEnabled: true, lunchEnabled: true, dinnerEnabled: true,
  waitlistEnabled: true, deliveryFee: 0, minOrderAmount: 0,
  estimatedDurationMinutes: 30, priority: 100,
};

const pointsFromBoundary = (boundary: BoundaryGeometry | null): Point[] => {
  if (!boundary) return [];
  const ring = boundary.type === 'Polygon'
    ? (boundary.coordinates as number[][][])[0]
    : (boundary.coordinates as number[][][][])[0]?.[0];
  if (!ring) return [];
  const points = ring.map(point => [Number(point[0]), Number(point[1])] as Point);
  if (points.length > 1 && points[0][0] === points.at(-1)?.[0] && points[0][1] === points.at(-1)?.[1]) points.pop();
  return points;
};

const boundaryFromPoints = (points: Point[]): BoundaryGeometry | null => points.length < 3 ? null : {
  type: 'Polygon', coordinates: [[...points, points[0]]],
};

const draftFromArea = (area: ManagedDeliveryArea): DeliveryAreaDraft => ({
  id: area.id, name: area.name, status: area.status, boundary: area.boundary,
  breakfastEnabled: area.breakfast_enabled, lunchEnabled: area.lunch_enabled,
  dinnerEnabled: area.dinner_enabled, waitlistEnabled: area.waitlist_enabled,
  deliveryFee: area.delivery_fee, minOrderAmount: area.min_order_amount,
  estimatedDurationMinutes: area.estimated_duration_minutes, priority: area.priority,
});

export const DeliveryAreaManagement = () => {
  const [document, setDocument] = useState<DeliveryAreaDocument | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DeliveryAreaDraft>(EMPTY_DRAFT);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewingPublish, setReviewingPublish] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setDocument(await deliveryAreaService.get()); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Delivery Areas could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const choose = (area: ManagedDeliveryArea) => {
    setSelectedId(area.id); setDraft(draftFromArea(area)); setPoints(pointsFromBoundary(area.boundary));
    setNotice(null); setError(null); setReviewingPublish(false);
  };
  const createNew = () => {
    setSelectedId(null); setDraft(EMPTY_DRAFT); setPoints([]); setNotice(null); setError(null); setReviewingPublish(false);
  };
  const save = async (publishConfirmed = false) => {
    const isPublicStatus = draft.status === 'available' || draft.status === 'coming_soon';
    if (isPublicStatus && !publishConfirmed) {
      setReviewingPublish(true);
      setNotice(null);
      return;
    }
    setSaving(true); setError(null); setNotice(null);
    try {
      const boundary = boundaryFromPoints(points);
      const saved = await deliveryAreaService.save({ ...draft, boundary });
      setDocument(saved);
      const matched = saved.areas.find(area => area.id === draft.id)
        || saved.areas.find(area => area.name === draft.name.trim());
      if (matched) choose(matched);
      setReviewingPublish(false);
      setNotice(draft.status === 'available' ? 'Delivery area published.' : draft.status === 'coming_soon' ? 'Coming-soon area published.' : 'Delivery area saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Delivery area could not be saved.'); }
    finally { setSaving(false); }
  };

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Geographic service control</p><h2 className="mt-1 text-xl font-black text-stone-900">Delivery Areas</h2><p className="mt-1 max-w-3xl text-sm text-stone-500">Draw the exact boundary, choose which meal services operate there, then publish. Checkout rechecks this boundary in the database.</p></div>
        <button type="button" onClick={createNew} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white"><Plus size={17} />New area</button>
      </div>
      {error && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900"><CheckCircle2 size={18} />{notice}</div>}

      <div className="mt-5 grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-stone-200">
          <div className="flex items-center justify-between bg-stone-50 px-4 py-3"><p className="text-xs font-black uppercase tracking-wider text-stone-500">Saved areas</p><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh areas" className="rounded-lg p-2 text-stone-600 hover:bg-white"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button></div>
          <div className="max-h-[520px] divide-y divide-stone-100 overflow-y-auto">
            {!loading && document?.areas.length === 0 && <p className="p-4 text-sm text-stone-500">No delivery area yet.</p>}
            {document?.areas.map(area => <button key={area.id} type="button" onClick={() => choose(area)} className={`w-full p-4 text-left transition ${selectedId === area.id ? 'bg-emerald-50' : 'bg-white hover:bg-stone-50'}`}><div className="flex items-start justify-between gap-2"><p className="font-black text-stone-900">{area.name}</p><StatusBadge status={area.status} /></div><p className="mt-2 text-xs text-stone-500">{area.boundary ? 'Map boundary active' : 'Legacy sector/pincode rule'} · v{area.version}</p><p className="mt-1 text-xs font-bold text-stone-600">{[area.breakfast_enabled && 'Breakfast', area.lunch_enabled && 'Lunch', area.dinner_enabled && 'Dinner'].filter(Boolean).join(' · ') || 'No meal service'}</p></button>)}
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-stone-600 sm:col-span-2">Area name<input value={draft.name} maxLength={120} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Sector 21 pilot" className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm text-stone-900" /></label>
            <label className="text-xs font-bold text-stone-600">Status<select value={draft.status} onChange={event => { setDraft(current => ({ ...current, status: event.target.value as DeliveryAreaDraft['status'] })); setReviewingPublish(false); }} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900"><option value="draft">Draft</option><option value="available">Available — public</option><option value="coming_soon">Coming soon — public</option><option value="paused">Paused / unavailable</option></select></label>
            <label className="text-xs font-bold text-stone-600">Priority<input type="number" min={0} max={10000} value={draft.priority} onChange={event => setDraft(current => ({ ...current, priority: Number(event.target.value) }))} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm text-stone-900" /></label>
          </div>

          <div><p className="text-xs font-black uppercase tracking-wider text-stone-500">Meal services</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{(['breakfast', 'lunch', 'dinner'] as const).map(service => { const key = `${service}Enabled` as const; return <label key={service} className="flex min-h-11 items-center justify-between rounded-xl border border-stone-200 px-3 text-sm font-bold capitalize text-stone-700">{service}<input type="checkbox" checked={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5 accent-emerald-700" /></label>; })}</div></div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Delivery fee ₹" value={draft.deliveryFee} min={0} max={10000} onChange={value => setDraft(current => ({ ...current, deliveryFee: value }))} />
            <NumberField label="Minimum order ₹" value={draft.minOrderAmount} min={0} max={100000} onChange={value => setDraft(current => ({ ...current, minOrderAmount: value }))} />
            <NumberField label="ETA minutes" value={draft.estimatedDurationMinutes} min={5} max={240} onChange={value => setDraft(current => ({ ...current, estimatedDurationMinutes: value }))} />
          </div>
          <label className="flex min-h-11 items-center justify-between rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-700">Allow waitlist when unavailable<input type="checkbox" checked={draft.waitlistEnabled} onChange={event => setDraft(current => ({ ...current, waitlistEnabled: event.target.checked }))} className="h-5 w-5 accent-emerald-700" /></label>

          <BoundaryEditor points={points} onChange={setPoints} focusKey={selectedId ?? 'new-area'} />

          {reviewingPublish && <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="font-black text-amber-950">Confirm public area</p><p className="mt-1 text-sm text-amber-900"><strong>{draft.name.trim()}</strong> will become {draft.status === 'available' ? 'orderable' : 'visible as coming soon'} for {[draft.breakfastEnabled && 'Breakfast', draft.lunchEnabled && 'Lunch', draft.dinnerEnabled && 'Dinner'].filter(Boolean).join(', ') || 'no meal service'}. Review the boundary, fee, minimum order and ETA first.</p></div></div><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setReviewingPublish(false)} className="min-h-11 rounded-xl border border-amber-300 px-4 text-sm font-bold text-amber-950">Keep editing</button><button type="button" onClick={() => void save(true)} disabled={saving || (draft.status === 'available' && !draft.breakfastEnabled && !draft.lunchEnabled && !draft.dinnerEnabled)} className="min-h-11 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white disabled:opacity-40">Confirm & publish</button></div></div>}

          <div className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-stone-600">{points.length >= 3 ? `${points.length} boundary points ready.` : draft.id && !draft.boundary ? 'This legacy zone stays compatible until you draw and save a boundary.' : 'Add at least three points before creating a new area.'}</p><button type="button" onClick={() => void save()} disabled={saving || !draft.name.trim() || (!draft.id && points.length < 3) || (draft.status === 'available' && !draft.breakfastEnabled && !draft.lunchEnabled && !draft.dinnerEnabled)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 text-sm font-bold text-white disabled:opacity-40">{saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Saving…' : draft.status === 'available' || draft.status === 'coming_soon' ? 'Review public change' : 'Save area'}</button></div>
        </div>
      </div>
    </section>
  );
};

const StatusBadge = ({ status }: { status: ManagedDeliveryArea['status'] }) => <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${status === 'available' ? 'bg-emerald-100 text-emerald-800' : status === 'coming_soon' ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700'}`}>{status.replace('_', ' ')}</span>;

const NumberField = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) => <label className="text-xs font-bold text-stone-600">{label}<input type="number" min={min} max={max} step={1} value={value} onChange={event => onChange(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm text-stone-900" /></label>;

const BoundaryEditor = ({ points, onChange, focusKey }: { points: Point[]; onChange: (points: Point[]) => void; focusKey: string }) => {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callback = useRef(onChange);
  const pointsRef = useRef(points);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [predictions, setPredictions] = useState<UnifiedPrediction[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  callback.current = onChange;
  pointsRef.current = points;
  const geojson = useMemo(() => ({ type: 'FeatureCollection' as const, features: points.length ? [
    { type: 'Feature' as const, properties: { kind: 'shape' }, geometry: points.length >= 3 ? boundaryFromPoints(points)! : { type: 'LineString' as const, coordinates: points } },
    ...points.map((point, index) => ({ type: 'Feature' as const, properties: { kind: 'point', index: index + 1 }, geometry: { type: 'Point' as const, coordinates: point } })),
  ] : [] }), [points]);
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  const focusBoundary = (map: MapLibreMap, boundaryPoints: Point[]) => {
    if (!boundaryPoints.length) return;
    const lngs = boundaryPoints.map(point => point[0]);
    const lats = boundaryPoints.map(point => point[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
      padding: 56, maxZoom: 16, duration: 0,
    });
  };

  useEffect(() => {
    if (!container.current) return;
    const map = new MapLibreMap({ container: container.current, style: MAP_STYLE, center: [72.6369, 23.2156], zoom: 11.5, minZoom: 9, maxZoom: 19, attributionControl: { compact: true }, dragRotate: false, touchPitch: false });
    mapRef.current = map; map.touchZoomRotate.disableRotation(); map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      map.addSource('boundary', { type: 'geojson', data: geojsonRef.current as never });
      map.addLayer({ id: 'boundary-fill', type: 'fill', source: 'boundary', filter: ['==', ['get', 'kind'], 'shape'], paint: { 'fill-color': '#0D6E44', 'fill-opacity': 0.2 } });
      map.addLayer({ id: 'boundary-line', type: 'line', source: 'boundary', filter: ['==', ['get', 'kind'], 'shape'], paint: { 'line-color': '#0D6E44', 'line-width': 3 } });
      map.addLayer({ id: 'boundary-points', type: 'circle', source: 'boundary', filter: ['==', ['get', 'kind'], 'point'], paint: { 'circle-radius': 10, 'circle-color': '#D97706', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
      map.addLayer({ id: 'boundary-point-labels', type: 'symbol', source: 'boundary', filter: ['==', ['get', 'kind'], 'point'], layout: { 'text-field': ['to-string', ['get', 'index']], 'text-size': 11, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#ffffff' } });
      focusBoundary(map, pointsRef.current);
    });
    map.on('click', event => callback.current([...pointsRef.current, [Number(event.lngLat.lng.toFixed(6)), Number(event.lngLat.lat.toFixed(6))]]));
    return () => { mapRef.current = null; map.remove(); };
  }, []);
  useEffect(() => { const source = mapRef.current?.getSource('boundary') as unknown as { setData: (data: unknown) => void } | undefined; source?.setData(geojson); }, [geojson]);
  useEffect(() => { const map = mapRef.current; if (map?.loaded()) focusBoundary(map, pointsRef.current); }, [focusKey]);

  const search = async () => {
    if (searchQuery.trim().length < 3) return;
    setSearching(true); setSearchError(null);
    try {
      const results = await searchGooglePlaces(searchQuery, { lat: 23.2156, lng: 72.6369 });
      setPredictions(results.slice(0, 5));
      if (!results.length) setSearchError('No matching place found. Try a society, road, sector or landmark.');
    } catch {
      setPredictions([]); setSearchError('Map search is temporarily unavailable. You can still move the map manually.');
    } finally { setSearching(false); }
  };

  const selectPrediction = async (prediction: UnifiedPrediction) => {
    setSearching(true); setSearchError(null);
    try {
      const place = await getGooglePlaceDetails(prediction.placeId, prediction);
      mapRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 15, essential: true });
      setSearchQuery(prediction.mainText || prediction.description);
      setPredictions([]);
    } catch { setSearchError('This place could not be positioned on the map.'); }
    finally { setSearching(false); }
  };

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-stone-500">Map boundary</p><p className="mt-1 text-xs text-stone-500">Search the area, then click around the roads or societies you can actually deliver to.</p></div><div className="flex gap-2"><button type="button" onClick={() => onChange(points.slice(0, -1))} disabled={!points.length} className="flex min-h-10 items-center gap-1 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700 disabled:opacity-40"><Undo2 size={14} />Undo</button><button type="button" onClick={() => onChange([])} disabled={!points.length} className="flex min-h-10 items-center gap-1 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700 disabled:opacity-40"><RotateCcw size={14} />Clear</button></div></div>
    <form onSubmit={event => { event.preventDefault(); void search(); }} className="relative mt-3">
      <div className="flex gap-2"><label className="relative min-w-0 flex-1"><span className="sr-only">Search map area</span><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-stone-400" /><input value={searchQuery} onChange={event => { setSearchQuery(event.target.value); setPredictions([]); setSearchError(null); }} placeholder="Search society, road, sector or landmark" className="min-h-11 w-full rounded-xl border border-stone-200 pl-10 pr-10 text-sm text-stone-900" />{searchQuery && <button type="button" onClick={() => { setSearchQuery(''); setPredictions([]); setSearchError(null); }} aria-label="Clear map search" className="absolute right-2 top-2 rounded-lg p-2 text-stone-400 hover:bg-stone-100"><X size={15} /></button>}</label><button type="submit" disabled={searching || searchQuery.trim().length < 3} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-40">{searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}Find</button></div>
      {predictions.length > 0 && <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">{predictions.map(prediction => <button key={prediction.placeId} type="button" onClick={() => void selectPrediction(prediction)} className="block w-full border-b border-stone-100 px-4 py-3 text-left last:border-0 hover:bg-stone-50"><span className="block text-sm font-bold text-stone-900">{prediction.mainText}</span><span className="mt-0.5 block text-xs text-stone-500">{prediction.secondaryText || prediction.description}</span></button>)}</div>}
      {searchError && <p role="alert" className="mt-2 text-xs font-bold text-amber-800">{searchError}</p>}
    </form>
    <div className="relative mt-3 h-[360px] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"><div ref={container} className="absolute inset-0" /><div className="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-stone-700 shadow"><MapPin size={14} className="mr-1 inline text-emerald-700" />{points.length} points</div></div>
  </div>;
};
