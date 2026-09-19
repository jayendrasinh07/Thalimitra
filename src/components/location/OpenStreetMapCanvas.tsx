import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Coordinates { lat: number; lng: number }

interface OpenStreetMapCanvasProps {
  center: Coordinates;
  onMoveStart: () => void;
  onMoveEnd: (center: Coordinates) => void;
}

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const VECTOR_MAP_TIMEOUT_MS = 4500;
const TILE_SIZE = 256;

const clampLatitude = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

const toWorld = ({ lat, lng }: Coordinates, zoom: number) => {
  const scale = 2 ** zoom;
  const sin = Math.sin((clampLatitude(lat) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale * TILE_SIZE,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale * TILE_SIZE,
  };
};

const fromWorld = (x: number, y: number, zoom: number): Coordinates => {
  const worldSize = 2 ** zoom * TILE_SIZE;
  const wrappedX = ((x % worldSize) + worldSize) % worldSize;
  const normalizedY = Math.max(0, Math.min(worldSize, y));
  const lng = (wrappedX / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * normalizedY) / worldSize;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng };
};

const VectorMapCanvas: React.FC<OpenStreetMapCanvasProps & { onFailure: () => void }> = ({ center, onMoveStart, onMoveEnd, onFailure }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbacksRef = useRef({ onMoveStart, onMoveEnd });
  const [isReady, setIsReady] = useState(false);

  callbacksRef.current = { onMoveStart, onMoveEnd };

  useEffect(() => {
    if (!containerRef.current) return;

    const timeout = window.setTimeout(onFailure, VECTOR_MAP_TIMEOUT_MS);
    let interactionReady = false;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [center.lng, center.lat],
      zoom: 15.7,
      minZoom: 11,
      maxZoom: 19,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      renderWorldCopies: false,
      fadeDuration: 180,
    });

    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.on('load', () => {
      interactionReady = true;
      window.clearTimeout(timeout);
      setIsReady(true);
    });
    map.on('movestart', () => {
      if (interactionReady) callbacksRef.current.onMoveStart();
    });
    map.on('moveend', () => {
      if (!interactionReady) return;
      const next = map.getCenter();
      callbacksRef.current.onMoveEnd({ lat: next.lat, lng: next.lng });
    });

    return () => {
      interactionReady = false;
      window.clearTimeout(timeout);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || map.isMoving()) return;
    const current = map.getCenter();
    if (Math.abs(current.lat - center.lat) < 0.000001 && Math.abs(current.lng - center.lng) < 0.000001) return;
    map.easeTo({ center: [center.lng, center.lat], duration: 420 });
  }, [center.lat, center.lng]);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#EEF2EF] outline-none"
      role="region"
      aria-label="Interactive delivery location map"
    >
      <div ref={containerRef} className="absolute inset-0" />

      <div className={`pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-white/5 via-transparent to-[#0D6E44]/5 transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`} />

      {!isReady && (
        <div className="absolute inset-0 z-[3] overflow-hidden bg-[#EEF2EF]">
          <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_25%,rgba(13,110,68,0.10),transparent_34%),radial-gradient(circle_at_75%_70%,rgba(245,158,11,0.10),transparent_30%)]" />
          <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0D6E44]/20 border-t-[#0D6E44] animate-spin" />
        </div>
      )}

      <div className="absolute left-3 top-1/2 z-[4] flex -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-[0_10px_30px_rgba(28,40,34,0.18)] backdrop-blur-xl">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn({ duration: 220 })}
          className="grid h-11 w-11 place-items-center text-stone-700 transition-colors hover:bg-emerald-50 hover:text-[#0D6E44]"
        >
          <Plus className="h-4.5 w-4.5" strokeWidth={2.5} />
        </button>
        <div className="mx-2 h-px bg-stone-200/80" />
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => mapRef.current?.zoomOut({ duration: 220 })}
          className="grid h-11 w-11 place-items-center text-stone-700 transition-colors hover:bg-emerald-50 hover:text-[#0D6E44]"
        >
          <Minus className="h-4.5 w-4.5" strokeWidth={2.5} />
        </button>
      </div>

      <div className="absolute bottom-1 left-1 z-[4] rounded-md bg-white/85 px-1.5 py-0.5 text-[8px] font-medium text-stone-500 backdrop-blur-md">
        <a href="https://openfreemap.org/" target="_blank" rel="noreferrer" className="hover:text-stone-800">OpenFreeMap</a>
        {' © '}
        <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer" className="hover:text-stone-800">OpenMapTiles</a>
        {' © '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-stone-800">OpenStreetMap</a>
      </div>
    </div>
  );
};

const RasterMapFallback: React.FC<OpenStreetMapCanvasProps> = ({ center, onMoveStart, onMoveEnd }) => {
  const [zoom, setZoom] = useState(15);
  const [view, setView] = useState(center);
  const viewRef = useRef(center);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; worldX: number; worldY: number } | null>(null);

  useEffect(() => {
    if (draggingRef.current) return;
    viewRef.current = center;
    setView(center);
  }, [center.lat, center.lng]);

  const tiles = useMemo(() => {
    const world = toWorld(view, zoom);
    const tileCount = 2 ** zoom;
    const baseX = Math.floor(world.x / TILE_SIZE);
    const baseY = Math.floor(world.y / TILE_SIZE);
    const result: Array<{ key: string; url: string; left: number; top: number }> = [];

    for (let yOffset = -2; yOffset <= 2; yOffset += 1) {
      const tileY = baseY + yOffset;
      if (tileY < 0 || tileY >= tileCount) continue;
      for (let xOffset = -2; xOffset <= 2; xOffset += 1) {
        const rawX = baseX + xOffset;
        const tileX = ((rawX % tileCount) + tileCount) % tileCount;
        result.push({
          key: `${zoom}-${rawX}-${tileY}`,
          url: `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`,
          left: rawX * TILE_SIZE - world.x,
          top: tileY * TILE_SIZE - world.y,
        });
      }
    }
    return result;
  }, [view, zoom]);

  const moveToWorld = (worldX: number, worldY: number) => {
    const next = fromWorld(worldX, worldY, zoom);
    viewRef.current = next;
    setView(next);
  };

  const finishMove = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    dragStartRef.current = null;
    onMoveEnd(viewRef.current);
  };

  const changeZoom = (nextZoom: number) => {
    onMoveStart();
    setZoom(nextZoom);
    window.requestAnimationFrame(() => onMoveEnd(viewRef.current));
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#E5E3DF] outline-none"
      role="region"
      aria-label="Interactive delivery location map"
      tabIndex={0}
      style={{ touchAction: 'none' }}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const world = toWorld(viewRef.current, zoom);
        dragStartRef.current = { x: event.clientX, y: event.clientY, worldX: world.x, worldY: world.y };
        draggingRef.current = true;
        onMoveStart();
      }}
      onPointerMove={event => {
        const start = dragStartRef.current;
        if (!start || !draggingRef.current) return;
        moveToWorld(start.worldX - (event.clientX - start.x), start.worldY - (event.clientY - start.y));
      }}
      onPointerUp={finishMove}
      onPointerCancel={finishMove}
    >
      {tiles.map(tile => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute h-64 w-64 max-w-none select-none"
          style={{ left: `calc(50% + ${tile.left}px)`, top: `calc(50% + ${tile.top}px)` }}
        />
      ))}

      <div className="absolute left-3 top-1/2 z-[4] flex -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-[0_10px_30px_rgba(28,40,34,0.18)] backdrop-blur-xl">
        <button type="button" aria-label="Zoom in" onPointerDown={event => event.stopPropagation()} onClick={() => changeZoom(Math.min(18, zoom + 1))} className="grid h-11 w-11 place-items-center text-stone-700 hover:bg-emerald-50 hover:text-[#0D6E44]"><Plus className="h-4.5 w-4.5" strokeWidth={2.5} /></button>
        <div className="mx-2 h-px bg-stone-200/80" />
        <button type="button" aria-label="Zoom out" onPointerDown={event => event.stopPropagation()} onClick={() => changeZoom(Math.max(11, zoom - 1))} className="grid h-11 w-11 place-items-center text-stone-700 hover:bg-emerald-50 hover:text-[#0D6E44]"><Minus className="h-4.5 w-4.5" strokeWidth={2.5} /></button>
      </div>

      <div className="absolute bottom-1 left-1 z-[4] rounded-md bg-white/85 px-1.5 py-0.5 text-[8px] font-medium text-stone-500 backdrop-blur-md">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onPointerDown={event => event.stopPropagation()} className="hover:text-stone-800">OpenStreetMap contributors</a>
      </div>
    </div>
  );
};

export const OpenStreetMapCanvas: React.FC<OpenStreetMapCanvasProps> = (props) => {
  const [useFallback, setUseFallback] = useState(false);
  return useFallback
    ? <RasterMapFallback {...props} />
    : <VectorMapCanvas {...props} onFailure={() => setUseFallback(true)} />;
};
