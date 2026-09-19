import { CheckCircle2, MapPin, Navigation, ShieldCheck, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const LocationChecker = () => {
  const { detectUserLocation, locationState, detectedLocation, setIsLocationModalOpen } = useApp();
  const checking = locationState === 'requesting' || locationState === 'detecting';

  return <section id="location-checker-section" className="bg-[#FAF8F5] py-12 sm:py-16">
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="rounded-full border border-emerald-200 bg-emerald-100/70 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-[#0D6E44]">Exact delivery coverage</span>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-4xl">Check your doorstep, not just your pincode</h2>
        <p className="mt-2 text-sm text-stone-600">Move the map pin to your building. The result follows the latest area boundary published by Operations.</p>
      </div>
      <div className="mx-auto mt-8 grid max-w-3xl gap-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
        {detectedLocation && <div className={`flex items-start gap-3 rounded-2xl border p-4 ${detectedLocation.isServiceable ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>{detectedLocation.isServiceable ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}<div><p className="text-sm font-black text-stone-900">{detectedLocation.isServiceable ? 'Delivery is available here' : detectedLocation.serviceability?.status === 'coming_soon' ? 'Coming soon to this area' : 'Not available at this location yet'}</p><p className="mt-1 text-xs text-stone-600">{detectedLocation.displayName}</p><p className="mt-1 text-xs font-medium text-stone-700">{detectedLocation.serviceability?.message}</p></div></div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => void detectUserLocation()} disabled={checking} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-black text-[#0D6E44] disabled:opacity-50"><Navigation className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />{checking ? 'Checking location…' : 'Use my current location'}</button>
          <button type="button" onClick={() => setIsLocationModalOpen(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#0D6E44] px-5 text-sm font-black text-white"><MapPin className="h-4 w-4 text-amber-300" />Search or choose on map</button>
        </div>
        <div className="flex gap-2 rounded-2xl bg-stone-50 p-3 text-xs text-stone-600"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" /><span>Checkout checks the same database boundary again before accepting an order.</span></div>
      </div>
    </div>
  </section>;
};
