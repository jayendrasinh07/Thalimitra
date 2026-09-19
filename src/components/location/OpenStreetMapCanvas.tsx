import React, { useEffect, useMemo, useRef, useState } from 'react';

interface Coordinates { lat: number; lng: number }

interface OpenStreetMapCanvasProps {
  center: Coordinates;
  onMoveStart: () => void;
  onMoveEnd: (center: Coordinates) => void;
}

const TILE_SIZE = 256;
const clampLatitude = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

const toWorld = ({ lat, lng }: Coordinates, zoom: number) => {
  const scale = 2 ** zoom;
  const safeLat = clampLatitude(lat);
  const sin = Math.sin((safeLat * Math.PI) / 180);
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
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
};

export const OpenStreetMapCanvas: React.FC<OpenStreetMapCanvasProps> = ({ center, onMoveStart, onMoveEnd }) => {
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

  const panBy = (x: number, y: number) => {
    onMoveStart();
    const world = toWorld(viewRef.current, zoom);
    moveToWorld(world.x + x, world.y + y);
    requestAnimationFrame(() => onMoveEnd(viewRef.current));
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
      onKeyDown={event => {
        const distance = event.shiftKey ? 160 : 80;
        if (event.key === 'ArrowLeft') { event.preventDefault(); panBy(-distance, 0); }
        if (event.key === 'ArrowRight') { event.preventDefault(); panBy(distance, 0); }
        if (event.key === 'ArrowUp') { event.preventDefault(); panBy(0, -distance); }
        if (event.key === 'ArrowDown') { event.preventDefault(); panBy(0, distance); }
      }}
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
      <div className="absolute left-3 top-3 z-10 flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
        <button type="button" aria-label="Zoom in" onPointerDown={event => event.stopPropagation()} onClick={() => setZoom(value => Math.min(18, value + 1))} className="h-10 w-10 text-xl font-bold text-stone-800 hover:bg-stone-100">+</button>
        <button type="button" aria-label="Zoom out" onPointerDown={event => event.stopPropagation()} onClick={() => setZoom(value => Math.max(11, value - 1))} className="h-10 w-10 border-t border-stone-200 text-xl font-bold text-stone-800 hover:bg-stone-100">−</button>
      </div>
      <div className="absolute bottom-1 left-1 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[9px] text-stone-700">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onPointerDown={event => event.stopPropagation()} className="underline">OpenStreetMap contributors</a>
      </div>
    </div>
  );
};
