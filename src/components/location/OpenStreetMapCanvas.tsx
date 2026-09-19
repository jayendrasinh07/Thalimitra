import React, { useEffect, useRef, useState } from 'react';
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

export const OpenStreetMapCanvas: React.FC<OpenStreetMapCanvasProps> = ({ center, onMoveStart, onMoveEnd }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbacksRef = useRef({ onMoveStart, onMoveEnd });
  const [isReady, setIsReady] = useState(false);

  callbacksRef.current = { onMoveStart, onMoveEnd };

  useEffect(() => {
    if (!containerRef.current) return;

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
    map.on('load', () => setIsReady(true));
    map.on('movestart', () => callbacksRef.current.onMoveStart());
    map.on('moveend', () => {
      const next = map.getCenter();
      callbacksRef.current.onMoveEnd({ lat: next.lat, lng: next.lng });
    });

    return () => {
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
