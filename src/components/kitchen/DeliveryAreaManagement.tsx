import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Plus, RefreshCw, RotateCcw, Save, Search, Trash2, Undo2, X } from 'lucide-react';
import { divIcon, layerGroup, latLngBounds, map as createLeafletMap, marker as leafletMarker, polygon as leafletPolygon, polyline, tileLayer, type LayerGroup, type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  deliveryAreaService,
  type BoundaryGeometry,
  type DeliveryAreaDocument,
  type DeliveryAreaDraft,
  type ManagedDeliveryArea,
} from '../../services/deliveryAreaService';
import { searchDeliveryAreaBoundaries, type DeliveryAreaPrediction } from '../../services/areaBoundarySearch';

type Point = [number, number];
const MAP_TILES = 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
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

const distanceToSegmentSquared = (point: Point, start: Point, end: Point) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (!dx && !dy) return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2;
  const position = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
  return (point[0] - (start[0] + position * dx)) ** 2 + (point[1] - (start[1] + position * dy)) ** 2;
};

export const insertBoundaryPoint = (points: Point[], point: Point): Point[] => {
  if (points.length < 2) return [...points, point];
  let insertionIndex = 1;
  let shortestDistance = Number.POSITIVE_INFINITY;
  const edgeCount = points.length >= 3 ? points.length : points.length - 1;
  for (let index = 0; index < edgeCount; index += 1) {
    const distance = distanceToSegmentSquared(point, points[index], points[(index + 1) % points.length]);
    if (distance < shortestDistance) { shortestDistance = distance; insertionIndex = index + 1; }
  }
  return [...points.slice(0, insertionIndex), point, ...points.slice(insertionIndex)];
};

const draftFromArea = (area: ManagedDeliveryArea): DeliveryAreaDraft => ({
  id: area.id, name: area.name, status: area.status, boundary: area.boundary,
  breakfastEnabled: area.breakfast_enabled, lunchEnabled: area.lunch_enabled,
  dinnerEnabled: area.dinner_enabled, waitlistEnabled: area.waitlist_enabled,
  deliveryFee: area.delivery_fee, minOrderAmount: area.min_order_amount,
  estimatedDurationMinutes: area.estimated_duration_minutes, priority: area.priority,
});

const AREA_STATUS_STYLE: Record<ManagedDeliveryArea['status'], { color: string; fill: string; dash?: string }> = {
  available: { color: '#047857', fill: '#10B981' },
  coming_soon: { color: '#B45309', fill: '#F59E0B', dash: '8 6' },
  paused: { color: '#B91C1C', fill: '#EF4444', dash: '4 6' },
  draft: { color: '#64748B', fill: '#94A3B8', dash: '4 6' },
};

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
  const statusCounts = document?.areas.reduce((counts, area) => ({ ...counts, [area.status]: counts[area.status] + 1 }), { available: 0, coming_soon: 0, paused: 0, draft: 0 }) ?? { available: 0, coming_soon: 0, paused: 0, draft: 0 };
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
          <div className="grid grid-cols-2 gap-2 border-y border-stone-100 bg-white p-3">
            <StatusCount label="Available" count={statusCounts.available} tone="emerald" />
            <StatusCount label="Coming soon" count={statusCounts.coming_soon} tone="amber" />
            <StatusCount label="Paused" count={statusCounts.paused} tone="red" />
            <StatusCount label="Draft" count={statusCounts.draft} tone="stone" />
          </div>
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

          <BoundaryEditor points={points} onChange={setPoints} focusKey={selectedId ?? 'new-area'} areas={document?.areas ?? []} selectedId={selectedId} onSelectArea={choose} />

          {reviewingPublish && <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="font-black text-amber-950">Confirm public area</p><p className="mt-1 text-sm text-amber-900"><strong>{draft.name.trim()}</strong> will become {draft.status === 'available' ? 'orderable' : 'visible as coming soon'} for {[draft.breakfastEnabled && 'Breakfast', draft.lunchEnabled && 'Lunch', draft.dinnerEnabled && 'Dinner'].filter(Boolean).join(', ') || 'no meal service'}. Review the boundary, fee, minimum order and ETA first.</p></div></div><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setReviewingPublish(false)} className="min-h-11 rounded-xl border border-amber-300 px-4 text-sm font-bold text-amber-950">Keep editing</button><button type="button" onClick={() => void save(true)} disabled={saving || !draft.breakfastEnabled && !draft.lunchEnabled && !draft.dinnerEnabled} className="min-h-11 rounded-xl bg-amber-900 px-4 text-sm font-bold text-white disabled:opacity-40">Confirm & publish</button></div></div>}

          <div className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-stone-600">{points.length >= 3 ? `${points.length} boundary points ready.` : draft.id && !draft.boundary ? 'This legacy zone stays compatible until you draw and save a boundary.' : 'Add at least three points before creating a new area.'}</p><button type="button" onClick={() => void save()} disabled={saving || !draft.name.trim() || (!draft.id && points.length < 3) || ((draft.status === 'available' || draft.status === 'coming_soon') && !draft.breakfastEnabled && !draft.lunchEnabled && !draft.dinnerEnabled)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 text-sm font-bold text-white disabled:opacity-40">{saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Saving…' : draft.status === 'available' || draft.status === 'coming_soon' ? 'Review public change' : 'Save area'}</button></div>
        </div>
      </div>
    </section>
  );
};

const StatusBadge = ({ status }: { status: ManagedDeliveryArea['status'] }) => <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${status === 'available' ? 'bg-emerald-100 text-emerald-800' : status === 'coming_soon' ? 'bg-amber-100 text-amber-800' : status === 'paused' ? 'bg-red-100 text-red-800' : 'bg-stone-200 text-stone-700'}`}>{status.replace('_', ' ')}</span>;

const StatusCount = ({ label, count, tone }: { label: string; count: number; tone: 'emerald' | 'amber' | 'red' | 'stone' }) => <div className={`rounded-xl px-3 py-2 ${tone === 'emerald' ? 'bg-emerald-50 text-emerald-900' : tone === 'amber' ? 'bg-amber-50 text-amber-900' : tone === 'red' ? 'bg-red-50 text-red-900' : 'bg-stone-100 text-stone-700'}`}><p className="text-lg font-black">{count}</p><p className="text-[10px] font-black uppercase tracking-wide">{label}</p></div>;

const NumberField = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) => <label className="text-xs font-bold text-stone-600">{label}<input type="number" min={min} max={max} step={1} value={value} onChange={event => onChange(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm text-stone-900" /></label>;

const BoundaryEditor = ({ points, onChange, focusKey, areas, selectedId, onSelectArea }: { points: Point[]; onChange: (points: Point[]) => void; focusKey: string; areas: ManagedDeliveryArea[]; selectedId: string | null; onSelectArea: (area: ManagedDeliveryArea) => void }) => {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const referenceLayerRef = useRef<LayerGroup | null>(null);
  const boundaryLayerRef = useRef<LayerGroup | null>(null);
  const previewLayerRef = useRef<LayerGroup | null>(null);
  const callback = useRef(onChange);
  const selectAreaCallback = useRef(onSelectArea);
  const pointsRef = useRef(points);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [predictions, setPredictions] = useState<DeliveryAreaPrediction[]>([]);
  const [preview, setPreview] = useState<DeliveryAreaPrediction | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  callback.current = onChange;
  selectAreaCallback.current = onSelectArea;
  pointsRef.current = points;

  const focusBoundary = (map: LeafletMap, boundaryPoints: Point[]) => {
    if (!boundaryPoints.length) return;
    const bounds = latLngBounds(boundaryPoints.map(([lng, lat]) => [lat, lng]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: false });
  };

  useEffect(() => {
    if (!container.current) return;
    const map = createLeafletMap(container.current, { center: [23.2156, 72.6369], zoom: 12, minZoom: 9, maxZoom: 19, zoomControl: true, attributionControl: true });
    tileLayer(MAP_TILES, { maxZoom: 20, attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }).addTo(map);
    const referenceLayer = layerGroup().addTo(map);
    const boundaryLayer = layerGroup().addTo(map);
    const previewLayer = layerGroup().addTo(map);
    mapRef.current = map;
    referenceLayerRef.current = referenceLayer;
    boundaryLayerRef.current = boundaryLayer;
    previewLayerRef.current = previewLayer;
    map.on('click', event => {
      const point: Point = [Number(event.latlng.lng.toFixed(6)), Number(event.latlng.lat.toFixed(6))];
      callback.current(insertBoundaryPoint(pointsRef.current, point));
      setSelectedPoint(null);
    });
    map.whenReady(() => { map.invalidateSize(); focusBoundary(map, pointsRef.current); });
    return () => { previewLayerRef.current = null; boundaryLayerRef.current = null; referenceLayerRef.current = null; mapRef.current = null; map.remove(); };
  }, []);
  useEffect(() => {
    const layer = referenceLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    areas.filter(area => area.id !== selectedId && area.boundary).forEach(area => {
      const areaPoints = pointsFromBoundary(area.boundary);
      if (areaPoints.length < 3) return;
      const style = AREA_STATUS_STYLE[area.status];
      const polygon = leafletPolygon(areaPoints.map(([lng, lat]) => [lat, lng] as [number, number]), {
        color: style.color, weight: 2, dashArray: style.dash, fillColor: style.fill, fillOpacity: 0.1, bubblingMouseEvents: false,
      }).addTo(layer);
      polygon.bindTooltip(`${area.name} · ${area.status.replace('_', ' ')}`, { sticky: true });
      polygon.on('click', () => selectAreaCallback.current(area));
    });
  }, [areas, selectedId]);
  useEffect(() => {
    const layer = boundaryLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const latLngs = points.map(([lng, lat]) => [lat, lng] as [number, number]);
    if (latLngs.length >= 3) leafletPolygon(latLngs, { color: '#0D6E44', weight: 3, fillColor: '#0D6E44', fillOpacity: 0.2 }).addTo(layer);
    else if (latLngs.length >= 2) polyline(latLngs, { color: '#0D6E44', weight: 3 }).addTo(layer);
    latLngs.forEach((latLng, index) => {
      const isSelected = selectedPoint === index;
      const marker = leafletMarker(latLng, {
        draggable: true,
        bubblingMouseEvents: false,
        keyboard: true,
        title: `Boundary point ${index + 1}. Drag to move or select to remove.`,
        icon: divIcon({
          className: '', iconSize: [32, 32], iconAnchor: [16, 16],
          html: `<span style="display:flex;width:32px;height:32px;align-items:center;justify-content:center;border:3px solid white;border-radius:9999px;background:${isSelected ? '#0D6E44' : '#D97706'};color:white;font:800 12px system-ui;box-shadow:0 2px 8px rgba(0,0,0,.3)">${index + 1}</span>`,
        }),
      }).addTo(layer);
      marker.on('click', () => setSelectedPoint(index));
      marker.on('dragend', () => {
        const moved = marker.getLatLng();
        const next = [...pointsRef.current];
        next[index] = [Number(moved.lng.toFixed(6)), Number(moved.lat.toFixed(6))];
        callback.current(next);
        setSelectedPoint(index);
      });
    });
  }, [points, selectedPoint]);
  useEffect(() => {
    const layer = previewLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!preview) return;
    const latLngs = preview.outline.map(([lng, lat]) => [lat, lng] as [number, number]);
    leafletPolygon(latLngs, {
      color: '#D97706', weight: 3, dashArray: '8 7', fillColor: '#F59E0B', fillOpacity: 0.14,
    }).addTo(layer);
  }, [preview]);
  useEffect(() => {
    setSelectedPoint(null);
    const map = mapRef.current;
    if (!map) return;
    if (pointsRef.current.length) focusBoundary(map, pointsRef.current);
    else focusBoundary(map, areas.flatMap(area => pointsFromBoundary(area.boundary)));
  }, [focusKey, areas]);
  useEffect(() => { if (selectedPoint !== null && selectedPoint >= points.length) setSelectedPoint(null); }, [points.length, selectedPoint]);

  const search = async () => {
    if (searchQuery.trim().length < 3) return;
    setSearching(true); setSearchError(null);
    try {
      const results = await searchDeliveryAreaBoundaries(searchQuery);
      setPredictions(results.slice(0, 5));
      const first = results[0];
      if (first) {
        setPreview(first);
        const map = mapRef.current;
        if (map) focusBoundary(map, first.outline);
      }
      if (!results.length) setSearchError('No matching place found. Try a society, road, sector or landmark.');
    } catch {
      setPredictions([]); setSearchError('Map search is temporarily unavailable. You can still move the map manually.');
    } finally { setSearching(false); }
  };

  const selectPrediction = (prediction: DeliveryAreaPrediction) => {
    setPreview(prediction);
    setSearchQuery(prediction.mainText || prediction.description);
    setPredictions([]);
    const map = mapRef.current;
    if (map) focusBoundary(map, prediction.outline);
  };

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-stone-500">Map boundary</p><p className="mt-1 text-xs text-stone-500">Search an area, use its draft, then drag numbered points. Click the map to add a point on the nearest edge.</p></div><div className="flex gap-2"><button type="button" onClick={() => { onChange(points.slice(0, -1)); setSelectedPoint(null); }} disabled={!points.length} className="flex min-h-10 items-center gap-1 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700 disabled:opacity-40"><Undo2 size={14} />Undo</button><button type="button" onClick={() => { onChange([]); setSelectedPoint(null); }} disabled={!points.length} className="flex min-h-10 items-center gap-1 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700 disabled:opacity-40"><RotateCcw size={14} />Clear</button></div></div>
    <form onSubmit={event => { event.preventDefault(); void search(); }} className="relative mt-3">
      <div className="flex gap-2"><label className="relative min-w-0 flex-1"><span className="sr-only">Search map area</span><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-stone-400" /><input value={searchQuery} onChange={event => { setSearchQuery(event.target.value); setPredictions([]); setPreview(null); setSearchError(null); }} placeholder="Search society, road, sector or landmark" className="min-h-11 w-full rounded-xl border border-stone-200 pl-10 pr-10 text-sm text-stone-900" />{searchQuery && <button type="button" onClick={() => { setSearchQuery(''); setPredictions([]); setPreview(null); setSearchError(null); }} aria-label="Clear map search" className="absolute right-2 top-2 rounded-lg p-2 text-stone-400 hover:bg-stone-100"><X size={15} /></button>}</label><button type="submit" disabled={searching || searchQuery.trim().length < 3} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-40">{searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}Find</button></div>
      {predictions.length > 0 && <div className="absolute z-[1000] mt-2 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">{predictions.map(prediction => <button key={prediction.placeId} type="button" onClick={() => selectPrediction(prediction)} className="block w-full border-b border-stone-100 px-4 py-3 text-left last:border-0 hover:bg-stone-50"><span className="flex items-center justify-between gap-3 text-sm font-bold text-stone-900"><span>{prediction.mainText}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${prediction.outlineKind === 'mapped' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{prediction.outlineKind === 'mapped' ? 'Mapped outline' : 'Approx. box'}</span></span><span className="mt-0.5 block text-xs text-stone-500">{prediction.secondaryText || prediction.description}</span></button>)}</div>}
      {searchError && <p role="alert" className="mt-2 text-xs font-bold text-amber-800">{searchError}</p>}
    </form>
    <div className="relative mt-3 h-[360px] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"><div ref={container} aria-label="Delivery boundary map" className="absolute inset-0 z-0" /><div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-stone-700 shadow"><MapPin size={14} className="mr-1 inline text-emerald-700" />{points.length} points</div></div>
    <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-stone-600"><span className="text-emerald-700">● Available</span><span className="text-amber-700">● Coming soon</span><span className="text-red-700">● Paused</span><span className="text-slate-600">● Draft</span><span>Click any saved boundary to edit it.</span></div>
    {selectedPoint !== null && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><p className="text-xs font-bold text-emerald-950">Point {selectedPoint + 1} selected. Drag it on the map to resize the area.</p><button type="button" onClick={() => { if (points.length > 3) onChange(points.filter((_, index) => index !== selectedPoint)); setSelectedPoint(null); }} disabled={points.length <= 3} className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-red-700 disabled:opacity-40"><Trash2 size={14} />Remove point</button></div>}
    {preview && <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-amber-950">Search preview: {preview.mainText}</p><p className="mt-1 text-xs text-amber-900">{preview.outlineKind === 'mapped' ? 'Orange outline comes from OpenStreetMap. Review the roads before using it.' : 'Only an approximate search box is available. Use it as a starting point, then adjust every corner before saving.'}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => setPreview(null)} className="min-h-10 rounded-xl border border-amber-300 px-3 text-xs font-bold text-amber-950">Dismiss</button><button type="button" onClick={() => { onChange(preview.outline); setPreview(null); setSelectedPoint(null); }} className="min-h-10 rounded-xl bg-amber-800 px-4 text-xs font-bold text-white">Use as editable draft</button></div></div>}
  </div>;
};
