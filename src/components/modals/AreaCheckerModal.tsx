import { MapPin, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AreaCheckerModal = () => {
  const { isAreaCheckerOpen, setIsAreaCheckerOpen, setIsLocationModalOpen } = useApp();
  if (!isAreaCheckerOpen) return null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/75 p-4 backdrop-blur-sm">
    <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
      <div className="relative bg-gradient-to-r from-[#107048] to-[#0A4E32] p-6 text-white">
        <button type="button" aria-label="Close" onClick={() => setIsAreaCheckerOpen(false)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X className="h-4 w-4" /></button>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-amber-300"><MapPin className="h-5 w-5" /></div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-emerald-200">Exact doorstep check</p>
        <h3 className="mt-1 text-xl font-black">Can we deliver to your address?</h3>
        <p className="mt-2 max-w-md text-sm text-emerald-100">Search your address or use GPS, then place the pin at your exact building. Availability comes from the current Operations boundary.</p>
      </div>
      <div className="space-y-4 p-6">
        <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><p className="text-sm font-black text-emerald-950">One accurate answer</p><p className="mt-1 text-xs leading-relaxed text-emerald-900/75">Sector or pincode alone can be misleading. The map pin is checked against the exact published delivery boundary.</p></div></div>
        <button type="button" onClick={() => { setIsAreaCheckerOpen(false); setIsLocationModalOpen(true); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0D6E44] px-5 text-sm font-black text-white shadow-lg shadow-emerald-950/15 hover:bg-[#08482C]"><MapPin className="h-4 w-4 text-amber-300" />Check exact address on map</button>
        <p className="text-center text-[11px] text-stone-500">Breakfast, Lunch and Dinner availability may differ by area. Date, menu, cutoff and capacity are confirmed during ordering.</p>
      </div>
    </div>
  </div>;
};
