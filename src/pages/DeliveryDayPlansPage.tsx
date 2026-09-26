import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, RefreshCw, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { deliveryDayPlanService, type DeliveryDayPlan, type DeliveryDayPlanTemplate } from '../services/deliveryDayPlanService';

const statusLabel: Record<DeliveryDayPlan['status'], string> = {
  requested: 'Under review', quoted: 'Quote ready', accepted: 'Quote accepted', payment_pending: 'Awaiting payment',
  active: 'Active', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Unavailable',
};

export const DeliveryDayPlansPage: React.FC = () => {
  const { currentUser, openCheckoutForPlan, showToast } = useApp();
  const [templates, setTemplates] = useState<DeliveryDayPlanTemplate[]>([]);
  const [mine, setMine] = useState<DeliveryDayPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, plans] = await Promise.all([
        deliveryDayPlanService.getCatalog(),
        currentUser ? deliveryDayPlanService.getMine() : Promise.resolve([]),
      ]);
      setTemplates(catalog);
      setMine(plans);
    } catch (reason) {
      showToast('Meal plans unavailable', reason instanceof Error ? reason.message : 'Try again shortly.', 'error');
    } finally { setLoading(false); }
  }, [currentUser?.id]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('thalimitra:delivery-day-plans-updated', refresh);
    return () => window.removeEventListener('thalimitra:delivery-day-plans-updated', refresh);
  }, [load]);

  const openRequest = mine.some(item => ['requested', 'quoted', 'accepted', 'payment_pending', 'active', 'paused'].includes(item.status));

  return <div className="min-h-[80vh] bg-[#FAF8F5] py-5 sm:py-12">
    <div className="mx-auto max-w-6xl space-y-7 px-4 sm:space-y-9 sm:px-6">
      <section className="rounded-[28px] bg-[#0D6E44] px-5 py-7 text-white shadow-[0_14px_32px_rgba(13,110,68,0.12)] sm:px-10 sm:py-11">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-amber-200">Delivery-day meal plans</p>
        <h1 className="mt-3 max-w-3xl text-[29px] font-black leading-[1.12] tracking-tight sm:text-5xl">Choose the days. Pick the meals you need.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/90 sm:text-base">Select 7, 15 or 30 delivery days, then choose Breakfast, Lunch, Dinner or any combination. You see the exact total before sending the request.</p>
        <p className="mt-5 border-t border-white/20 pt-4 text-xs font-semibold text-white/90">No payment now. Operations confirms availability and an itemized quote first.</p>
      </section>

      {currentUser && <section id="my-delivery-day-plans" className="scroll-mt-24 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Your plans</p><h2 className="mt-1 text-xl font-black text-stone-900">Requests and active plans</h2></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh plan status" className="grid h-10 w-10 place-items-center rounded-xl border border-stone-200 text-stone-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
        <div className="mt-4 space-y-3">{!loading && mine.length === 0 && <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">You have no delivery-day plan request yet.</p>}{mine.map(item => <article key={item.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-stone-900">{item.plan_name}</h3><p className="mt-1 text-sm font-bold capitalize text-emerald-800">{item.meal_types.join(' + ')} · {item.meals_per_delivery_day} meal{item.meals_per_delivery_day === 1 ? '' : 's'}/day</p><p className="mt-1 text-xs text-stone-500">{item.delivery_days} delivery days · {item.total_meal_occurrences} meals total</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : item.status === 'payment_pending' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-700'}`}>{statusLabel[item.status]}</span></div></article>)}</div>
      </section>}

      <section aria-labelledby="delivery-plan-heading"><div className="mb-5"><h2 id="delivery-plan-heading" className="text-2xl font-black text-stone-900 sm:text-3xl">Choose your delivery-day plan</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">A delivery day can include one, two or three selected meal services. The review screen calculates the complete quantity.</p></div>
        {loading && <div className="grid gap-4 lg:grid-cols-3">{[1,2,3].map(item => <div key={item} className="h-64 animate-pulse rounded-[26px] bg-stone-200" />)}</div>}
        {!loading && templates.length === 0 && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-950"><strong className="block text-base">New plans are being prepared.</strong>One-time ordering remains available while the Kitchen finalizes delivery-day capacity.</div>}
        {!loading && templates.length > 0 && <div className="grid gap-4 lg:grid-cols-3">{templates.map(plan => <article key={plan.code} className="flex flex-col rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg sm:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-800">Flexible daily services</p>
          <h3 className="mt-3 text-4xl font-black tracking-tight text-stone-900">{plan.delivery_days} <span className="text-lg font-bold text-stone-600">delivery days</span></h3>
          <p className="mt-2 min-h-12 text-sm leading-6 text-stone-600">{plan.description}</p>
          <div className="mt-5 flex-1 border-t border-stone-100 pt-4"><p className="text-xs font-semibold text-stone-500">Breakfast, Lunch and/or Dinner</p><p className="mt-1 text-sm font-bold text-stone-900">Exact meal total shown before request</p></div>
          <button type="button" onClick={() => openRequest ? document.getElementById('my-delivery-day-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : openCheckoutForPlan(plan.code)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0D6E44] px-4 text-sm font-extrabold text-white hover:bg-[#095737]">{openRequest ? 'View your current plan' : <>Build {plan.delivery_days}-day plan <ArrowRight className="h-4 w-4" /></>}</button>
        </article>)}</div>}
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="text-xl font-black text-stone-900">How it works</h2><div className="mt-5 grid gap-5 sm:grid-cols-3"><Step icon={CalendarDays} title="1. Choose days" text="Pick 7, 15 or 30 delivery days and preferred weekdays." /><Step icon={UtensilsCrossed} title="2. Choose services" text="Pick Breakfast, Lunch, Dinner or any combination." /><Step icon={ShieldCheck} title="3. Review first" text="See total meals and receive a quote before payment." /></div></section>
    </div>
  </div>;
};

const Step = ({ icon: Icon, title, text }: { icon: typeof CalendarDays; title: string; text: string }) => <div className="flex gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" /><div><h3 className="font-black text-emerald-950">{title}</h3><p className="mt-1 text-xs leading-5 text-emerald-900/75">{text}</p></div></div>;
