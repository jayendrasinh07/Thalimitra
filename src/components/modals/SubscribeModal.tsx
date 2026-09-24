import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, MapPin, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { subscriptionService, type SubscriptionPlanCode } from '../../services/subscriptionService';
import type { ServiceMealType } from '../../types';

const plans: Record<SubscriptionPlanCode, { name: string; meals: number }> = {
  weekly_7: { name: '7-Meal Routine', meals: 7 },
  half_month_15: { name: '15-Meal Routine', meals: 15 },
  monthly_30: { name: '30-Meal Routine', meals: 30 },
};
const services: ServiceMealType[] = ['breakfast', 'lunch', 'dinner'];

const todayInIndia = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export const SubscribeModal: React.FC = () => {
  const { isSubscribeModalOpen, setIsSubscribeModalOpen, selectedPlanForCheckout, currentUser,
    savedAddresses, setIsAuthModalOpen, setIsLocationModalOpen, showToast } = useApp();
  const initialPlan = selectedPlanForCheckout === 'weekly_7' || selectedPlanForCheckout === 'monthly_30'
    ? selectedPlanForCheckout : 'half_month_15';
  const [planCode, setPlanCode] = useState<SubscriptionPlanCode>(initialPlan);
  const [mealTypes, setMealTypes] = useState<ServiceMealType[]>(['lunch']);
  const serviceableAddresses = useMemo(() => savedAddresses.filter(address => address.isServiceable), [savedAddresses]);
  const [addressId, setAddressId] = useState('');
  const [startDate, setStartDate] = useState(todayInIndia());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSubscribeModalOpen) return;
    setPlanCode(initialPlan);
    setMealTypes(['lunch']);
    setAddressId(serviceableAddresses.find(address => address.isDefault)?.id || serviceableAddresses[0]?.id || '');
    setError(null);
  }, [isSubscribeModalOpen, initialPlan, serviceableAddresses]);

  if (!isSubscribeModalOpen) return null;

  const submit = async () => {
    if (!currentUser) {
      setIsSubscribeModalOpen(false); setIsAuthModalOpen(true);
      showToast('Sign in required', 'Sign in to save and track your meal plan request.', 'info');
      return;
    }
    if (!addressId) { setError('Add a saved serviceable delivery address first.'); return; }
    setBusy(true); setError(null);
    try {
      await subscriptionService.request({ planCode, mealTypes, addressId, preferredStartDate: startDate, note });
      window.dispatchEvent(new Event('thalimitra:subscriptions-updated'));
      setIsSubscribeModalOpen(false);
      showToast('Meal plan request saved', 'Operations will verify the schedule, service area and final price before payment.', 'success');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Meal plan request could not be saved.');
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="subscription-title">
    <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-emerald-800/30 bg-[#0D6E44] p-5 text-white sm:p-6">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Meal routine request</p><h2 id="subscription-title" className="mt-1 text-2xl font-black">Plan your regular meals</h2><p className="mt-1 text-sm text-emerald-100">We confirm availability and the final amount before payment.</p></div>
        <button type="button" onClick={() => setIsSubscribeModalOpen(false)} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><X /></button>
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        <fieldset><legend className="text-sm font-black text-stone-900">Choose a routine</legend><div className="mt-2 grid grid-cols-3 gap-2">{(Object.entries(plans) as [SubscriptionPlanCode, { name: string; meals: number }][]).map(([code, plan]) => <button key={code} type="button" onClick={() => setPlanCode(code)} className={`min-h-20 rounded-2xl border p-3 text-left ${planCode === code ? 'border-emerald-700 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-700' : 'border-stone-200 bg-stone-50 text-stone-700'}`}><span className="block text-lg font-black">{plan.meals}</span><span className="text-xs font-bold">meals</span></button>)}</div></fieldset>

        <fieldset><legend className="text-sm font-black text-stone-900">Which meals do you need?</legend><p className="mt-1 text-xs text-stone-500">Select one, two, or all three services. Your meal credits can be used across the selected services.</p><div className="mt-3 grid grid-cols-3 gap-2">{services.map(type => { const selected = mealTypes.includes(type); return <button key={type} type="button" aria-pressed={selected} onClick={() => setMealTypes(current => selected ? (current.length === 1 ? current : current.filter(item => item !== type)) : services.filter(item => current.includes(item) || item === type))} className={`flex min-h-14 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-bold capitalize ${selected ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700' : 'border-stone-200 text-stone-600'}`}>{selected && <CheckCircle2 className="h-4 w-4" />}{type}</button>; })}</div></fieldset>

        <label className="block text-sm font-black text-stone-900">Preferred start date<div className="relative mt-2"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-emerald-700" /><input type="date" min={todayInIndia()} value={startDate} onChange={event => setStartDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-stone-200 pl-11 pr-3 text-sm font-bold" /></div></label>

        <div><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-stone-900">Delivery address</p><button type="button" onClick={() => { setIsSubscribeModalOpen(false); currentUser ? setIsLocationModalOpen(true) : setIsAuthModalOpen(true); }} className="text-xs font-black text-emerald-700">{currentUser ? 'Add address' : 'Sign in'}</button></div>
          {serviceableAddresses.length > 0 ? <div className="mt-2 space-y-2">{serviceableAddresses.map(address => <label key={address.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${addressId === address.id ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}><input type="radio" name="subscription-address" checked={addressId === address.id} onChange={() => setAddressId(address.id)} className="mt-1 accent-emerald-700" /><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span className="min-w-0 text-sm"><strong className="block text-stone-900">{address.label}</strong><span className="block truncate text-stone-500">{[address.addressLine1, address.area, address.sector, address.pincode].filter(Boolean).join(', ')}</span></span></label>)}</div>
            : <button type="button" onClick={() => { setIsSubscribeModalOpen(false); currentUser ? setIsLocationModalOpen(true) : setIsAuthModalOpen(true); }} className="mt-2 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-900"><MapPin className="h-5 w-5" />{currentUser ? 'Add a serviceable delivery address' : 'Sign in and add delivery address'}</button>}
        </div>

        <label className="block text-sm font-black text-stone-900">Anything Operations should know? <span className="font-normal text-stone-400">Optional</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Preferred weekdays, timing constraint, or food routine." className="mt-2 w-full rounded-xl border border-stone-200 p-3 text-sm font-normal" /></label>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
        <div className="rounded-2xl bg-stone-50 p-4 text-xs text-stone-600"><p className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" /><span><strong className="text-stone-900">No automatic charge.</strong> Operations first confirms serviceability, dates and price. Your plan becomes active only after verified payment.</span></p></div>
        <button type="button" disabled={busy} onClick={() => void submit()} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#0D6E44] px-5 font-black text-white shadow-lg disabled:opacity-50">{busy ? 'Saving request…' : <><CheckCircle2 className="h-5 w-5" />Request {plans[planCode].name}</>}</button>
      </div>
    </div>
  </div>;
};
