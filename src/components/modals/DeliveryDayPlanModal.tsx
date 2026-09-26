import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { deliveryDayPlanService } from '../../services/deliveryDayPlanService';
import type { DeliveryDayPlanPreview } from '../../services/deliveryDayPlanService';
import type { DeliveryDayPlanCode, ServiceMealType } from '../../types';

const plans: Record<DeliveryDayPlanCode, { days: 7 | 15 | 30; name: string }> = {
  starter_7_days: { days: 7, name: '7-Day Starter Plan' },
  regular_15_days: { days: 15, name: '15-Day Regular Plan' },
  monthly_30_days: { days: 30, name: '30-Day Monthly Plan' },
};
const services: ServiceMealType[] = ['breakfast', 'lunch', 'dinner'];
const weekdays = [
  { value: 1, short: 'Mon' }, { value: 2, short: 'Tue' }, { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' }, { value: 5, short: 'Fri' }, { value: 6, short: 'Sat' },
  { value: 7, short: 'Sun' },
];

const todayInIndia = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const newRequestKey = () => crypto.randomUUID();
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const displayDate = (value: string) => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(`${value}T00:00:00+05:30`));

export const DeliveryDayPlanModal: React.FC = () => {
  const { isSubscribeModalOpen, setIsSubscribeModalOpen, selectedPlanForCheckout, currentUser,
    savedAddresses, isAuthModalOpen, setIsAuthModalOpen, isLocationModalOpen, setIsLocationModalOpen,
    setActiveTab, showToast } = useApp();
  const initialPlan: DeliveryDayPlanCode = selectedPlanForCheckout === 'starter_7_days'
    || selectedPlanForCheckout === 'monthly_30_days' ? selectedPlanForCheckout : 'regular_15_days';
  const [planCode, setPlanCode] = useState<DeliveryDayPlanCode>(initialPlan);
  const [mealTypes, setMealTypes] = useState<ServiceMealType[]>(['lunch']);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const serviceableAddresses = useMemo(() => savedAddresses.filter(address => address.isServiceable), [savedAddresses]);
  const [addressId, setAddressId] = useState('');
  const [startDate, setStartDate] = useState(todayInIndia());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DeliveryDayPlanPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewSequence = useRef(0);
  const requestKey = useRef(newRequestKey());
  const resumeAfterSetup = useRef<'auth' | 'address' | null>(null);
  const totalMeals = plans[planCode].days * mealTypes.length;

  useEffect(() => {
    if (!isSubscribeModalOpen) return;
    if (resumeAfterSetup.current) { resumeAfterSetup.current = null; return; }
    setPlanCode(initialPlan);
    setMealTypes(['lunch']);
    setSelectedWeekdays([1, 2, 3, 4, 5, 6]);
    setAddressId(serviceableAddresses.find(address => address.isDefault)?.id || serviceableAddresses[0]?.id || '');
    setStartDate(todayInIndia());
    setNote('');
    setError(null);
    setPreview(null);
    setPreviewError(null);
    requestKey.current = newRequestKey();
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

  useEffect(() => {
    const sequence = ++previewSequence.current;
    if (!isSubscribeModalOpen || !currentUser || !addressId || !startDate || selectedWeekdays.length === 0 || mealTypes.length === 0) {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    const timer = window.setTimeout(() => {
      void deliveryDayPlanService.preview({
        templateCode: planCode,
        mealTypes,
        weekdays: selectedWeekdays,
        addressId,
        preferredStartDate: startDate,
      }).then(result => {
        if (previewSequence.current !== sequence) return;
        setPreview(result);
      }).catch(reason => {
        if (previewSequence.current !== sequence) return;
        setPreview(null);
        setPreviewError(reason instanceof Error ? reason.message : 'Plan estimate is unavailable.');
      }).finally(() => {
        if (previewSequence.current === sequence) setPreviewLoading(false);
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isSubscribeModalOpen, currentUser, planCode, mealTypes, selectedWeekdays, addressId, startDate]);

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
      showToast('Sign in required', 'Sign in to save and track your plan request.', 'info');
      return;
    }
    if (!addressId) { setError('Add a saved serviceable delivery address first.'); return; }
    if (!startDate || startDate < todayInIndia()) { setError('Choose today or a future start date.'); return; }
    if (selectedWeekdays.length === 0) { setError('Choose at least one preferred delivery weekday.'); return; }
    setBusy(true); setError(null);
    try {
      await deliveryDayPlanService.request({
        templateCode: planCode,
        mealTypes,
        weekdays: selectedWeekdays,
        addressId,
        preferredStartDate: startDate,
        requestIdempotencyKey: requestKey.current,
        note,
      });
      window.dispatchEvent(new Event('thalimitra:delivery-day-plans-updated'));
      setIsSubscribeModalOpen(false);
      setActiveTab('meal_plans');
      showToast('Plan request received', 'No payment is due until you review and accept the quote.', 'success');
      requestAnimationFrame(() => document.getElementById('my-delivery-day-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Plan request could not be saved.');
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#F7F6F2]" role="dialog" aria-modal="true" aria-labelledby="delivery-plan-title">
    <header className="z-20 shrink-0 border-b border-stone-200 bg-white/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl sm:px-6 sm:py-4"><div className="mx-auto flex max-w-3xl items-center gap-3"><button type="button" onClick={() => setIsSubscribeModalOpen(false)} aria-label="Back to delivery-day plans" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-stone-200 bg-white text-stone-800 shadow-sm"><ArrowLeft className="h-5 w-5" /></button><div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Thalimitra meal plans</p><p className="truncate text-lg font-black text-stone-950">Build your delivery routine</p></div><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 sm:inline">No payment now</span></div></header>

    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto max-w-3xl space-y-4 px-4 pb-36 pt-5 sm:space-y-5 sm:px-6 sm:pb-32 sm:pt-8">
      <section className="rounded-[28px] bg-[#0D6E44] p-5 text-white shadow-[0_16px_38px_rgba(13,110,68,0.14)] sm:p-7"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">Plan builder</p><h2 id="delivery-plan-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{plans[planCode].name}</h2><p className="mt-2 text-sm leading-6 text-emerald-50/90">Choose your daily services and preferred weekdays. We calculate the full meal quantity immediately.</p></section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><fieldset><legend className="text-base font-black text-stone-950">How many delivery days?</legend><div className="mt-3 grid grid-cols-3 gap-2">{(Object.entries(plans) as [DeliveryDayPlanCode, { days: number; name: string }][]).map(([code, plan]) => <button key={code} type="button" aria-pressed={planCode === code} onClick={() => setPlanCode(code)} className={`min-h-20 rounded-2xl border p-3 text-left ${planCode === code ? 'border-emerald-700 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-700' : 'border-stone-200 bg-stone-50 text-stone-700'}`}><span className="block text-xl font-black">{plan.days}</span><span className="text-xs font-bold">delivery days</span></button>)}</div></fieldset></section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><fieldset><legend className="text-base font-black text-stone-950">Meals on each delivery day</legend><p className="mt-1 text-xs leading-5 text-stone-600">Choose one or more. Every selected service is prepared separately.</p><div className="mt-3 grid grid-cols-3 gap-2">{services.map(type => { const selected = mealTypes.includes(type); return <button key={type} type="button" aria-pressed={selected} onClick={() => setMealTypes(current => selected ? (current.length === 1 ? current : current.filter(item => item !== type)) : services.filter(item => current.includes(item) || item === type))} className={`flex min-h-14 items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold capitalize ${selected ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-700' : 'border-stone-200 text-stone-600'}`}>{selected && <CheckCircle2 className="h-4 w-4" />}{type}</button>; })}</div><div aria-live="polite" className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950"><strong>{mealTypes.length} meal{mealTypes.length === 1 ? '' : 's'} per delivery day</strong><span className="mt-1 block text-xs">{plans[planCode].days} days × {mealTypes.length} service{mealTypes.length === 1 ? '' : 's'} = <strong>{totalMeals} meals total</strong></span></div></fieldset></section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><fieldset><legend className="text-base font-black text-stone-950">Preferred delivery weekdays</legend><div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">{weekdays.map(day => { const selected = selectedWeekdays.includes(day.value); return <button key={day.value} type="button" aria-pressed={selected} onClick={() => setSelectedWeekdays(current => selected ? (current.length === 1 ? current : current.filter(item => item !== day.value)) : [...current, day.value].sort())} className={`min-h-11 rounded-xl border text-xs font-black ${selected ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-stone-200 text-stone-500'}`}>{day.short}</button>; })}</div><p className="mt-3 text-xs leading-5 text-stone-500">These are preferred weekdays. Final dates appear in the quote before payment.</p></fieldset></section>

      <section className="space-y-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><label className="block text-sm font-black text-stone-900">Preferred start date<div className="relative mt-2"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-emerald-700" /><input type="date" min={todayInIndia()} value={startDate} onChange={event => setStartDate(event.target.value)} className="min-h-12 w-full rounded-xl border border-stone-200 bg-white pl-11 pr-3 text-sm font-bold focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100" /></div></label><div><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-stone-900">Delivery address</p><button type="button" onClick={openRequiredSetup} className="rounded-lg px-2 py-1 text-xs font-black text-emerald-700">{currentUser ? 'Add address' : 'Sign in'}</button></div>{serviceableAddresses.length > 0 ? <div className="mt-2 space-y-2">{serviceableAddresses.map(address => <label key={address.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${addressId === address.id ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200'}`}><input type="radio" name="delivery-day-plan-address" checked={addressId === address.id} onChange={() => setAddressId(address.id)} className="mt-1 accent-emerald-700" /><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span className="min-w-0 text-sm"><strong className="block text-stone-900">{address.customLabel || address.label}</strong><span className="block text-stone-500">{[address.houseNumber, address.building, address.street, address.area, address.sector, address.pincode].filter(Boolean).join(', ')}</span></span></label>)}</div> : <button type="button" onClick={openRequiredSetup} className="mt-2 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-900"><MapPin className="h-5 w-5" />{currentUser ? 'Add a serviceable delivery address' : 'Sign in and add delivery address'}</button>}</div></section>

      <section aria-live="polite" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Database-calculated preview</p>{!currentUser || !addressId ? <p className="mt-3 text-sm leading-6 text-stone-600">Sign in and choose a serviceable address to see the expected period and current menu estimate.</p> : previewLoading ? <div className="mt-4 space-y-3" aria-label="Calculating plan preview"><div className="h-5 w-2/3 animate-pulse rounded bg-stone-100" /><div className="h-14 animate-pulse rounded-2xl bg-stone-100" /></div> : preview ? <div className="mt-4 space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-stone-50 p-3"><p className="text-xs font-bold text-stone-500">Expected period</p><p className="mt-1 text-sm font-black text-stone-900">{displayDate(preview.first_delivery_date)} – {displayDate(preview.expected_completion_date)}</p></div><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-800">Current menu estimate</p><p className="mt-1 text-lg font-black text-emerald-950">{preview.estimated_total_min === preview.estimated_total_max ? rupees.format(preview.estimated_total_min) : `${rupees.format(preview.estimated_total_min)} – ${rupees.format(preview.estimated_total_max)}`}</p></div></div><p className="text-xs leading-5 text-stone-500">For {preview.total_meal_occurrences} meals, using current active menu prices and this address's delivery fee. Your final itemized quote may include an approved plan discount. Nothing is charged now.</p></div> : <p role={previewError ? 'alert' : undefined} className={`mt-3 text-sm leading-6 ${previewError ? 'font-bold text-red-700' : 'text-stone-600'}`}>{previewError || 'Choose your plan details to calculate the preview.'}</p>}</section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><label className="block text-sm font-black text-stone-900">Anything Operations should know? <span className="font-normal text-stone-500">Optional</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Work schedule, reception timing or other useful detail" className="mt-2 w-full rounded-xl border border-stone-200 p-3 text-sm font-normal focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100" /></label></section>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
      <div className="rounded-2xl bg-white p-4 text-xs leading-5 text-stone-600 shadow-sm"><p className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" /><span><strong className="text-stone-900">No automatic charge.</strong> Your plan starts only after you review the itemized quote and payment is verified.</span></p></div>
    </div></main>

    <footer className="z-20 shrink-0 border-t border-stone-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(28,25,23,0.07)] backdrop-blur-xl sm:px-6 sm:py-4"><div className="mx-auto flex max-w-3xl items-center gap-3 sm:justify-between"><div className="hidden sm:block"><p className="text-xs font-bold text-stone-500">Your request</p><p className="text-sm font-black text-stone-900">{plans[planCode].days} days · {totalMeals} meals total</p></div><button type="button" disabled={busy || Boolean(currentUser && addressId && (previewLoading || !preview))} onClick={() => void submit()} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#0D6E44] px-6 font-black text-white shadow-lg shadow-emerald-950/10 disabled:opacity-50 sm:w-auto sm:min-w-64">{busy ? 'Sending request…' : <><CheckCircle2 className="h-5 w-5" />Send plan request</>}</button></div></footer>
  </div>;
};
