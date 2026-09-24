import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Clock3, RefreshCw, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { subscriptionService, type MealSubscription, type SubscriptionPlanCode } from '../services/subscriptionService';

const plans: Array<{ code: SubscriptionPlanCode; meals: number; name: string; bestFor: string; benefits: string[]; popular?: boolean }> = [
  { code: 'weekly_7', meals: 7, name: '7-Meal Routine', bestFor: 'Trying a predictable weekly routine', benefits: ['Choose one or more meal services', 'Serviceability checked before payment', 'Final price confirmed by Operations'] },
  { code: 'half_month_15', meals: 15, name: '15-Meal Routine', bestFor: 'Students and busy work schedules', benefits: ['15 meal credits after activation', 'Preferred start date recorded', 'Pause support through Operations'], popular: true },
  { code: 'monthly_30', meals: 30, name: '30-Meal Routine', bestFor: 'A regular monthly food routine', benefits: ['30 meal credits after activation', 'One verified delivery address', 'Status visible in your account'] },
];

const statusLabel: Record<MealSubscription['status'], string> = {
  requested: 'Review pending', payment_pending: 'Payment pending', active: 'Active', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Not approved',
};

export const MealPlansPage: React.FC = () => {
  const { currentUser, openCheckoutForPlan, showToast } = useApp();
  const [mine, setMine] = useState<MealSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUser) { setMine([]); return; }
    setLoading(true);
    try { setMine(await subscriptionService.getMine()); }
    catch { showToast('Meal plan status unavailable', 'Try refreshing in a moment.', 'error'); }
    finally { setLoading(false); }
  }, [currentUser?.id]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('thalimitra:subscriptions-updated', refresh);
    return () => window.removeEventListener('thalimitra:subscriptions-updated', refresh);
  }, [load]);

  const cancel = async (id: string) => {
    setBusy(id);
    try { await subscriptionService.cancel(id); await load(); showToast('Request cancelled', 'No payment was taken.', 'info'); }
    catch (reason) { showToast('Request not cancelled', reason instanceof Error ? reason.message : 'Contact support.', 'error'); }
    finally { setBusy(null); }
  };

  const openRequest = mine.some(item => ['requested','payment_pending','active','paused'].includes(item.status));

  return <div className="min-h-[80vh] bg-[#FAF8F5] py-8 sm:py-14">
    <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
      <section className="overflow-hidden rounded-3xl bg-[#0D6E44] p-6 text-white shadow-xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Regular meal routines</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">Choose your routine. Pay only after we confirm it.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100 sm:text-base">Select a meal count, one or more services, and a start date. Operations checks your address, kitchen capacity and final amount before activation.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-white/10 px-3 py-2">No automatic charge</span><span className="rounded-full bg-white/10 px-3 py-2">Manual approval</span><span className="rounded-full bg-white/10 px-3 py-2">Trackable status</span></div>
      </section>

      {currentUser && <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">My meal plans</p><h2 className="mt-1 text-xl font-black text-stone-900">Requests and active plans</h2></div><button type="button" onClick={() => void load()} disabled={loading} className="grid h-10 w-10 place-items-center rounded-xl border border-stone-200 text-stone-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
        <div className="mt-4 space-y-3">{!loading && mine.length === 0 && <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">You have no meal plan request yet.</p>}{mine.map(item => <article key={item.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-stone-900">{item.plan_name} · <span className="capitalize">{item.meal_types.join(' + ')}</span></h3><p className="mt-1 text-xs text-stone-500">Preferred start {new Date(`${item.preferred_start_date}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : item.status === 'payment_pending' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-700'}`}>{statusLabel[item.status]}</span></div>
          {item.quoted_total != null && <p className="mt-3 text-sm font-bold text-stone-700">Confirmed plan amount: <span className="text-emerald-800">₹{item.quoted_total.toLocaleString('en-IN')}</span> · Payment {item.payment_status}</p>}
          {['requested','payment_pending'].includes(item.status) && <button type="button" onClick={() => void cancel(item.id)} disabled={busy === item.id} className="mt-3 min-h-10 rounded-xl border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-50">{busy === item.id ? 'Cancelling…' : 'Cancel request'}</button>}
        </article>)}</div>
      </section>}

      <section><div className="mb-5"><h2 className="text-2xl font-black text-stone-900">Select a routine</h2><p className="mt-1 text-sm text-stone-500">The final price depends on the current kitchen menu, service and delivery area.</p></div>
        <div className="grid gap-5 lg:grid-cols-3">{plans.map(plan => <article key={plan.code} className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${plan.popular ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-stone-200'}`}>{plan.popular && <span className="absolute -top-3 left-6 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase text-stone-950">Balanced choice</span>}<div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><UtensilsCrossed /></span><span className="text-3xl font-black text-stone-900">{plan.meals}<small className="ml-1 text-xs font-bold text-stone-500">meals</small></span></div><h3 className="mt-5 text-xl font-black text-stone-900">{plan.name}</h3><p className="mt-1 min-h-10 text-sm text-stone-500">{plan.bestFor}</p><ul className="mt-5 flex-1 space-y-3">{plan.benefits.map(item => <li key={item} className="flex gap-2 text-sm text-stone-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />{item}</li>)}</ul><button type="button" onClick={() => openCheckoutForPlan(plan.code)} disabled={openRequest} className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-stone-900 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-300">{openRequest ? 'Open plan already exists' : <>Request this plan <ArrowRight className="h-4 w-4" /></>}</button></article>)}</div>
      </section>

      <section className="grid gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:grid-cols-3 sm:p-6"><Step icon={Clock3} title="1. Request" text="Choose meal credits, services, start date and address." /><Step icon={ShieldCheck} title="2. Operations check" text="We verify delivery, capacity and final price." /><Step icon={UtensilsCrossed} title="3. Activate" text="The admin confirms verified payment, then activates the plan." /></section>
    </div>
  </div>;
};

const Step = ({ icon: Icon, title, text }: { icon: typeof Clock3; title: string; text: string }) => <div className="flex gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" /><div><h3 className="font-black text-emerald-950">{title}</h3><p className="mt-1 text-xs leading-5 text-emerald-900/75">{text}</p></div></div>;
