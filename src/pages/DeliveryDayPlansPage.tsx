import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Pause, Play, RefreshCw, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { deliveryDayPlanService, type DeliveryDayPlan, type DeliveryDayPlanTemplate } from '../services/deliveryDayPlanService';

const statusLabel: Record<DeliveryDayPlan['status'], string> = {
  requested: 'Under review', quoted: 'Quote ready', accepted: 'Quote accepted', payment_pending: 'Awaiting payment',
  active: 'Active', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Unavailable',
};
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
const dateTime = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export const DeliveryDayPlansPage: React.FC = () => {
  const { currentUser, openCheckoutForPlan, showToast } = useApp();
  const [templates, setTemplates] = useState<DeliveryDayPlanTemplate[]>([]);
  const [mine, setMine] = useState<DeliveryDayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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
  const respond = async (item: DeliveryDayPlan, decision: 'accept' | 'decline') => {
    if (!item.current_quote || busy) return;
    setBusy(item.id);
    try {
      await deliveryDayPlanService.respondToQuote(item.id, item.current_quote.id, decision);
      showToast(decision === 'accept' ? 'Quote accepted' : 'Quote declined', decision === 'accept' ? 'Payment is still pending. No charge has been made.' : 'This plan request is now closed.', 'success');
      await load();
    } catch (reason) {
      showToast('Quote was not updated', reason instanceof Error ? reason.message : 'Try again shortly.', 'error');
    } finally { setBusy(null); }
  };
  const runPlanAction = async (item: DeliveryDayPlan, action: 'skip' | 'pause' | 'resume', occurrenceId?: string) => {
    if (busy) return;
    setBusy(item.id);
    try {
      if (action === 'resume') await deliveryDayPlanService.resume(item.id);
      else if (action === 'pause') {
        const from = new Date(); from.setDate(from.getDate() + 1);
        const resume = new Date(from); resume.setDate(resume.getDate() + 7);
        await deliveryDayPlanService.pause(item.id, from.toISOString().slice(0, 10), resume.toISOString().slice(0, 10));
      } else {
        const occurrence = item.occurrences.find(value => value.id === occurrenceId);
        if (!occurrence) return;
        await deliveryDayPlanService.skip(item.id, occurrence.service_date, occurrence.meal_type);
      }
      showToast(action === 'skip' ? 'Delivery moved' : action === 'pause' ? 'Plan paused for 7 days' : 'Plan resumed', 'Your updated calendar is shown below.', 'success');
      await load();
    } catch (reason) {
      showToast('Plan was not updated', reason instanceof Error ? reason.message : 'Try again shortly.', 'error');
    } finally { setBusy(null); }
  };

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
        <div className="mt-4 space-y-3">{!loading && mine.length === 0 && <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">You have no delivery-day plan request yet.</p>}{mine.map(item => <article key={item.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-stone-900">{item.plan_name}</h3><p className="mt-1 text-sm font-bold capitalize text-emerald-800">{item.meal_types.join(' + ')} · {item.meals_per_delivery_day} meal{item.meals_per_delivery_day === 1 ? '' : 's'}/day</p><p className="mt-1 text-xs text-stone-500">{item.delivery_days} delivery days · {item.total_meal_occurrences} meals total</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : item.status === 'payment_pending' || item.status === 'accepted' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-700'}`}>{statusLabel[item.status]}</span></div>
          {item.current_quote && <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-800">Itemized quote · v{item.current_quote.version}</p><p className="mt-1 text-xs text-stone-500">{item.current_quote.valid_until ? `Valid until ${dateTime(item.current_quote.valid_until)}` : 'Validity not set'}</p></div><p className="text-xl font-black text-emerald-900">{money(item.current_quote.total_amount)}</p></div><div className="mt-3 space-y-2 border-y border-emerald-100 py-3">{item.current_quote.items.map(line => <div key={line.id} className="flex justify-between gap-4 text-xs"><span className="text-stone-600">{line.label}{line.item_type === 'service' ? ` · ${line.quantity} × ${money(line.unit_amount)}` : ''}</span><strong className="text-stone-900">{money(line.line_amount)}</strong></div>)}</div>
            {item.current_quote.status === 'offered' && <><p className="mt-3 text-xs leading-5 text-stone-600">Accept only after checking every service, quantity and amount. Acceptance does not charge you.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={busy === item.id} onClick={() => void respond(item, 'accept')} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0D6E44] px-4 text-sm font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Accept exact quote</button><button type="button" disabled={busy === item.id} onClick={() => void respond(item, 'decline')} className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-700 disabled:opacity-50">Decline and close request</button></div></>}
            {item.current_quote.status === 'accepted' && <p className="mt-3 rounded-xl bg-white p-3 text-xs font-bold text-emerald-900"><CheckCircle2 className="mr-1 inline h-4 w-4" />Accepted. Payment is still pending; no automatic charge was made.</p>}
          </div>}
          {['active', 'paused', 'completed', 'cancelled'].includes(item.status) && <ActivePlanDetails item={item} busy={busy === item.id} onAction={runPlanAction} />}
        </article>)}</div>
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

const occurrenceLabel: Record<string, string> = {
  planned: 'Scheduled', order_created: 'Kitchen confirmed', fulfilled: 'Delivered',
  customer_skipped: 'Moved by you', kitchen_cancelled: 'Moved by Kitchen', cancelled: 'Cancelled',
};
const ActivePlanDetails = ({ item, busy, onAction }: {
  item: DeliveryDayPlan; busy: boolean;
  onAction: (item: DeliveryDayPlan, action: 'skip' | 'pause' | 'resume', occurrenceId?: string) => Promise<void>;
}) => {
  const upcoming = item.occurrences.filter(entry => entry.can_move).slice(0, 8);
  const recent = item.occurrences.filter(entry => !entry.can_move).slice(-6).reverse();
  return <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
    <div className="grid gap-2 sm:grid-cols-3">{item.meal_types.map(type => {
      const progress = item.service_progress[type];
      return <div key={type} className="rounded-xl bg-stone-50 p-3"><p className="text-xs font-black capitalize text-stone-900">{type}</p><p className="mt-1 text-sm font-bold text-emerald-800">{progress?.fulfilled ?? 0} of {progress?.entitled ?? item.delivery_days} delivered</p><p className="mt-1 text-[11px] text-stone-500">{progress?.upcoming ?? 0} scheduled · {progress?.remaining ?? 0} not reserved</p></div>;
    })}</div>
    {(item.status === 'active' || item.status === 'paused') && <div className="flex flex-wrap gap-2">
      {item.status === 'active' ? <button type="button" disabled={busy} onClick={() => void onAction(item, 'pause')} className="flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-900 disabled:opacity-50"><Pause className="h-4 w-4" />Pause next 7 days</button>
        : <button type="button" disabled={busy} onClick={() => void onAction(item, 'resume')} className="flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-50"><Play className="h-4 w-4" />Resume plan</button>}
      {item.resume_on_date && <span className="self-center text-xs font-bold text-stone-500">Auto-resume {item.resume_on_date}</span>}
    </div>}
    <div><h4 className="text-sm font-black text-stone-900">Upcoming deliveries</h4>{upcoming.length === 0 ? <p className="mt-2 text-xs text-stone-500">No movable delivery is currently scheduled.</p> : <div className="mt-2 grid gap-2 sm:grid-cols-2">{upcoming.map(entry => <div key={entry.id} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 p-3"><div><p className="text-xs font-black capitalize">{entry.meal_type}</p><p className="text-[11px] text-stone-500">{entry.service_date} · {occurrenceLabel[entry.status]}</p></div><button type="button" disabled={busy} onClick={() => void onAction(item, 'skip', entry.id)} className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-[11px] font-black text-stone-700 disabled:opacity-50">Move</button></div>)}</div>}</div>
    {recent.length > 0 && <details className="rounded-xl bg-stone-50 p-3"><summary className="cursor-pointer text-xs font-black text-stone-800">Delivery history</summary><div className="mt-3 space-y-2">{recent.map(entry => <div key={entry.id} className="flex justify-between text-xs"><span className="capitalize text-stone-600">{entry.service_date} · {entry.meal_type}</span><strong className="text-stone-800">{occurrenceLabel[entry.status]}</strong></div>)}</div></details>}
    {item.latest_decision && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong className="block">Plan decision</strong>{item.latest_decision.customer_message}{item.latest_decision.amount > 0 && ` · ${money(item.latest_decision.amount)}`}</div>}
    {item.commercial_policy?.cancellation_summary && <p className="text-[11px] leading-5 text-stone-500"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{item.commercial_policy.cancellation_summary}</p>}
  </div>;
};
