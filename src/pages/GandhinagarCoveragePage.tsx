import React from 'react';
import { MapPinCheck, Search, ShieldCheck } from 'lucide-react';
import { LocationChecker } from '../components/public/LocationChecker';
import { useApp } from '../context/AppContext';

export const GandhinagarCoveragePage: React.FC = () => {
  const { setIsLocationModalOpen } = useApp();

  return (
    <div className="bg-white py-12">
      <div className="mx-auto max-w-5xl space-y-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-extrabold uppercase tracking-widest text-[#107048]">Exact doorstep check</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl">Check your address in seconds</h1>
          <p className="mt-3 text-base leading-relaxed text-stone-600">Enter your location to see whether Breakfast, Lunch or Dinner delivery is available at your doorstep.</p>
        </div>

        <LocationChecker />

        <section className="overflow-hidden rounded-3xl border border-stone-200 bg-[#FAF8F5] p-6 sm:p-9">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Your location, your answer</p>
              <h2 className="mt-2 text-2xl font-black text-stone-900">Know before you order</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">Search your address and get the latest delivery status for that exact location.</p>
            </div>
            <button type="button" onClick={() => setIsLocationModalOpen(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 text-sm font-black text-white"><Search size={17} />Check my area</button>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-4"><MapPinCheck className="mt-0.5 shrink-0 text-emerald-700" size={20} /><div><p className="text-sm font-black text-stone-900">Exact result</p><p className="mt-1 text-xs leading-relaxed text-stone-500">A nearby sector name alone does not decide eligibility; the map pin does.</p></div></div>
            <div className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-4"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={20} /><div><p className="text-sm font-black text-stone-900">Current Operations rule</p><p className="mt-1 text-xs leading-relaxed text-stone-500">Availability is checked again before an order can be accepted.</p></div></div>
          </div>
        </section>
      </div>
    </div>
  );
};
