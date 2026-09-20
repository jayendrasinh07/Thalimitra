import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, MapPin, Radar, Sparkles, Truck } from 'lucide-react';
import { LocationChecker } from '../components/public/LocationChecker';
import { useApp } from '../context/AppContext';
import { listPublicDeliveryAreas, type PublicDeliveryArea } from '../services/publicDeliveryAreaService';

const serviceNames = (area: PublicDeliveryArea) => [
  area.services.breakfast && 'Breakfast',
  area.services.lunch && 'Lunch',
  area.services.dinner && 'Dinner',
].filter(Boolean).join(' · ');

export const GandhinagarCoveragePage: React.FC = () => {
  const { setIsLocationModalOpen } = useApp();
  const [areas, setAreas] = useState<PublicDeliveryArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void listPublicDeliveryAreas()
      .then(result => { if (active) setAreas(result); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const available = useMemo(() => areas.filter(area => area.status === 'available'), [areas]);
  const comingSoon = useMemo(() => areas.filter(area => area.status === 'coming_soon'), [areas]);

  return (
    <div className="bg-white py-12">
      <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-extrabold uppercase tracking-widest text-[#107048]">Live delivery network</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl">See exactly where we deliver</h1>
          <p className="mt-3 text-base leading-relaxed text-stone-600">Check your doorstep first. Every available area is verified by Operations before customers can place an order.</p>
        </div>

        <LocationChecker />

        <section aria-labelledby="delivery-area-statuses" className="rounded-3xl border border-stone-200 bg-[#FAF8F5] p-5 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Current status</p><h2 id="delivery-area-statuses" className="mt-1 text-2xl font-black text-stone-900">Delivery areas published by Operations</h2></div>
            <button type="button" onClick={() => setIsLocationModalOpen(true)} className="min-h-11 rounded-xl bg-stone-900 px-5 text-sm font-black text-white">Check my exact address</button>
          </div>

          {loading && <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="h-36 animate-pulse rounded-2xl bg-stone-200" /><div className="h-36 animate-pulse rounded-2xl bg-stone-200" /></div>}
          {error && !loading && <p role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Live area status could not be loaded. Please check your address directly.</p>}
          {!loading && !error && areas.length === 0 && <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 text-center"><Radar className="mx-auto h-7 w-7 text-stone-400" /><p className="mt-2 font-black text-stone-900">No public delivery area is open yet.</p><p className="mt-1 text-sm text-stone-500">Operations will publish verified routes here.</p></div>}

          {!loading && !error && available.length > 0 && <AreaGroup title="Available now" description="Ordering is open for the listed meal services." areas={available} status="available" onCheck={() => setIsLocationModalOpen(true)} />}
          {!loading && !error && comingSoon.length > 0 && <AreaGroup title="Coming soon" description="The route is being prepared. Join the priority list from the address checker." areas={comingSoon} status="coming_soon" onCheck={() => setIsLocationModalOpen(true)} />}
        </section>
      </div>
    </div>
  );
};

const AreaGroup = ({ title, description, areas, status, onCheck }: { title: string; description: string; areas: PublicDeliveryArea[]; status: PublicDeliveryArea['status']; onCheck: () => void }) => (
  <div className="mt-7">
    <div className="flex items-center gap-3">
      <div className={`rounded-xl p-2 ${status === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{status === 'available' ? <Truck size={19} /> : <Sparkles size={19} />}</div>
      <div><h3 className="font-black text-stone-900">{title} <span className="text-stone-400">({areas.length})</span></h3><p className="text-xs text-stone-500">{description}</p></div>
    </div>
    <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {areas.map(area => <button key={area.id} type="button" onClick={onCheck} className={`min-h-36 rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${status === 'available' ? 'border-emerald-200 hover:border-emerald-400' : 'border-amber-200 hover:border-amber-400'}`}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-black text-stone-900">{area.name}</p>{area.tagline && <p className="mt-1 text-xs text-stone-500">{area.tagline}</p>}</div><MapPin className={status === 'available' ? 'text-emerald-700' : 'text-amber-700'} size={19} /></div>
        <p className={`mt-4 text-xs font-black uppercase tracking-wide ${status === 'available' ? 'text-emerald-700' : 'text-amber-700'}`}>{serviceNames(area)}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">{status === 'available' && <span>{area.deliveryFee === 0 ? 'Free delivery' : `₹${area.deliveryFee} delivery`}</span>}<span className="flex items-center gap-1"><Clock3 size={13} />{area.estimatedDurationMinutes} min ETA</span></div>
      </button>)}
    </div>
  </div>
);
