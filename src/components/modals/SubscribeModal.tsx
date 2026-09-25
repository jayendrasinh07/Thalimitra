import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, ShieldCheck } from 'lucide-react';
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
    savedAddresses, isAuthModalOpen, setIsAuthModalOpen, isLocationModalOpen, setIsLocationModalOpen, setActiveTab, showToast } = useApp();
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
  const resumeAfterSetup = useRef<'auth' | 'address' | null>(null);

  useEffect(() => {
    if (!isSubscribeModalOpen) return;
    if (resumeAfterSetup.current) { resumeAfterSetup.current = null; return; }
    setPlanCode(initialPlan);
    setMealTypes(['lunch']);
    setAddressId(serviceableAddresses.find(address => address.isDefault)?.id || serviceableAddresses[0]?.id || '');
    setStartDate(todayInIndia());
    setNote('');
    setError(null);
  }, [isSubscribeModalOpen, initialPlan]);

  useEffect(() => {
    if (isSubscribeModalOpen && !serviceableAddresses.some(address => address.id === addressId)) {
      setAddressId(serviceableAddresses.find(address => address.isDefault)?.id || serviceableAddresses[0]?.id || '');
    }
  }, [isSubscribeModalOpen, serviceableAddresses, addressId]);

  useEffect(() => {
    if (isSubscribeModalOpen || !resumeAfterSetup.current) return;
    if (resumeAfterSetup.current === 'auth' && isAuthModalOpen) return;
    if (resumeAfterSetup.current === 'address' && isLocationModalOpen) return;
    setIsSubscribeModalOpen(true);
  }, [isSubscribeModalOpen, isAuthModalOpen, isLocationModalOpen, setIsSubscribeModalOpen]);

  useEffect(() => {
    if (!isSubscribeModalOpen) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = previousOverflow; };
  }, [isSubscribeModalOpen]);

  if (!isSubscribeModalOpen) return null;

  const openRequiredSetup = () => {
    resumeAfterSetup.current = currentUser ? 'address' : 'auth';
    setIsSubscribeModalOpen(false);
    if (currentUser) setIsLocationModalOpen(true);
    else setIsAuthModalOpen(true);
  };

  const submit = async () => {
    if (!currentUser) {
      openRequiredSetup();
      showToast('Sign in required', 'Sign in to save and track your meal plan request.', 'info');
      return;
    }
    if (!addressId) { setError('Add a saved serviceable delivery address first.'); return; }
    if (!startDate || startDate < todayInIndia()) { setError('Choose today or a future start date.'); return; }
    setBusy(true); setError(null);
    try {
      await subscriptionService.request({ planCode, mealTypes, addressId, preferredStartDate: startDate, note });
      window.dispatchEvent(new Event('thalimitra:subscriptions-updated'));
      setIsSubscribeModalOpen(false);
      setActiveTab('meal_plans');
      showToast('Request received', 'Check Your plans for its status. No payment is due yet.', 'success');
      requestAnimationFrame(() => document.getElementById('my-meal-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Meal plan request could not be saved.');
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#F7F6F2]" role="dialog" aria-modal="true" aria-labelledby="subscription-title">
    <header className="z-20 shrink-0 border-b border-stone-200 bg-white/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <button type="button" onClick={() => setIsSubscribeModalOpen(false)} aria-label="Back to meal plans" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-stone-200 bg-white text-stone-800 shadow-sm transition-colors hover:bg-stone-50"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Thalimitra meal plans</p><p className="truncate text-lg font-black text-stone-950">Set up your request</p></div>
        <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 sm:inline">No payment now</span>
      </div>
    </header>

    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-3xl space-y-4 px-4 pb-36 pt-5 sm:space-y-5 sm:px-6 sm:pb-32 sm:pt-8">
        <section className="rounded-[28px] bg-[#0D6E44] p-5 text-white shadow-[0_16px_38px_rgba(13,110,68,0.14)] sm:p-7">
          <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">Request details</p><span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-emerald-50 sm:hidden">No payment now</span></div>
          <h2 id="subscription-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Build your {plans[planCode].meals}-meal routine</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/90">Choose the services, preferred start date and delivery address. We confirm the schedule and total before you decide to pay.</p>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <fieldset><legend className="text-base font-black text-stone-950">How many meals?</legend><div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">{(Object.entries(plans) as [SubscriptionPlanCode, { name: string; meals: number }][]).map(([code, plan]) => <button key={code} type="button" aria-pressed={planCode === code} onClick={() => setPlanCode(code)} className={`min-h-20 rounded-2xl border p-3 text-left transition-colors ${planCode === code ? 'border-emerald-700 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-700' : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300'}`}><span className="block text-xl font-black">{plan.meals}</span><span className="text-xs font-bold">meals total</span></button>)}</div><p className="mt-3 text-xs leading-5 text-stone-600">One Breakfast, Lunch or Dinner serving for one person counts as one meal. The total is not a number of days.</p></fieldset>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><fieldset><legend className="text-base font-black text-stone-950">Which services do you prefer?</legend><p className="mt-1 text-xs leading-5 text-stone-600">Select any combination. Choosing all three still means {plans[planCode].meals} meals in total, not {plans[planCode].meals} of each.</p><div className="mt-3 grid grid-cols-3 gap-2">{services.map(type => { const selected = mealTypes.includes(type); return <button key={type} type="button" aria-pressed={selected} onClick={() => setMealTypes(current => selected ? (current.length === 1 ? current : current.filter(item => item !== type)) : services.filter(item => current.includes(item) || item === type))} className={`flex min-h-14 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-bold capitalize transition-colors ${selected ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}>{selected && <CheckCircle2 className="h-4 w-4" />}{type}</button>; })}</div>
          <p aria-live="polite" className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">{mealTypes.length === 3 ? `Example: Breakfast + Lunch + Dinner on one day would use 3 of your ${plans[planCode].meals} meals. This does not book those days automatically.` : `Your ${plans[planCode].meals} meals can include ${mealTypes.join(' and ')}. Tell us below how you would like to spread them across days.`}</p>
        </fieldset></section>

        <section className="space-y-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <label className="block text-sm font-black text-stone-900">Preferred start date<div className="relative mt-2"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-emerald-700" /><input type="date" min={todayInIndia()} value={startDate} onChange={event => setStartDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-stone-200 bg-white pl-11 pr-3 text-sm font-bold focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100" /></div></label>

        <div><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-stone-900">Delivery address</p><button type="button" onClick={openRequiredSetup} className="rounded-lg px-2 py-1 text-xs font-black text-emerald-700 hover:bg-emerald-50">{currentUser ? 'Add address' : 'Sign in'}</button></div>
          {serviceableAddresses.length > 0 ? <div className="mt-2 space-y-2">{serviceableAddresses.map(address => <label key={address.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${addressId === address.id ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}><input type="radio" name="subscription-address" checked={addressId === address.id} onChange={() => setAddressId(address.id)} className="mt-1 accent-emerald-700" /><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span className="min-w-0 text-sm"><strong className="block text-stone-900">{address.label}</strong><span className="block truncate text-stone-500">{[address.addressLine1, address.area, address.sector, address.pincode].filter(Boolean).join(', ')}</span></span></label>)}</div>
            : <button type="button" onClick={openRequiredSetup} className="mt-2 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-900"><MapPin className="h-5 w-5" />{currentUser ? 'Add a serviceable delivery address' : 'Sign in and add delivery address'}</button>}
        </div></section>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><label className="block text-sm font-black text-stone-900">Which days and meal pattern do you prefer? <span className="font-normal text-stone-500">Optional</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} placeholder="For example: Breakfast, Lunch and Dinner on weekdays; or Lunch on Monday to Friday." className="mt-2 w-full rounded-xl border border-stone-200 p-3 text-sm font-normal focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100" /><span className="mt-1 block text-xs leading-5 text-stone-500">We use this when confirming your dates and quote. No meals are scheduled by this form yet.</span></label></section>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
        <div className="rounded-2xl bg-white p-4 text-xs leading-5 text-stone-600 shadow-sm"><p className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" /><span><strong className="text-stone-900">No automatic charge.</strong> Your plan starts only after the schedule, price and payment are confirmed.</span></p></div>
      </div>
    </main>

    <footer className="z-20 shrink-0 border-t border-stone-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(28,25,23,0.07)] backdrop-blur-xl sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-3xl items-center gap-3 sm:justify-between">
        <div className="hidden min-w-0 sm:block"><p className="text-xs font-bold text-stone-500">Your request</p><p className="truncate text-sm font-black capitalize text-stone-900">{plans[planCode].meals} meals · {mealTypes.join(' + ')}</p></div>
        <button type="button" disabled={busy} onClick={() => void submit()} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#0D6E44] px-6 font-black text-white shadow-lg shadow-emerald-950/10 transition-colors hover:bg-[#095737] disabled:opacity-50 sm:w-auto sm:min-w-64">{busy ? 'Sending request…' : <><CheckCircle2 className="h-5 w-5" />Continue with request</>}</button>
      </div>
    </footer>
  </div>;
};
