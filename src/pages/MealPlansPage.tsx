import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Clock3, RefreshCw, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { subscriptionService, type MealSubscription, type SubscriptionPlanCode } from '../services/subscriptionService';

const plans: Array<{ code: SubscriptionPlanCode; meals: number; label: string; description: string }> = [
  { code: 'weekly_7', meals: 7, label: 'A simple start', description: 'Try a shorter meal routine before planning more.' },
  { code: 'half_month_15', meals: 15, label: 'A steady routine', description: 'Plan more meals around your work or study days.' },
  { code: 'monthly_30', meals: 30, label: 'Plan further ahead', description: 'For a longer stretch of regular meals.' },
];

const statusLabel: Record<MealSubscription['status'], string> = {
  requested: 'Under review', payment_pending: 'Awaiting payment', active: 'Active', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Unavailable',
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

  return <div className="min-h-[80vh] bg-[#FAF8F5] py-5 sm:py-12">
    <div className="mx-auto max-w-6xl space-y-7 px-4 sm:space-y-9 sm:px-6">
      <section className="rounded-[28px] bg-[#0D6E44] px-5 py-7 text-white shadow-[0_14px_32px_rgba(13,110,68,0.12)] sm:px-10 sm:py-11">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-amber-200">Meal plans</p>
        <h1 className="mt-3 max-w-3xl text-[29px] font-black leading-[1.12] tracking-tight sm:text-5xl">Plan ahead for everyday meals.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/90 sm:mt-4 sm:text-base">Choose 7, 15 or 30 meals in total. Tell us which services and days you prefer; we confirm the schedule and price before you pay.</p>
        <p className="mt-5 border-t border-white/20 pt-4 text-xs font-semibold text-white/90">No payment to request a plan. You decide after seeing the quote.</p>
      </section>

      {currentUser && <section id="my-meal-plans" className="scroll-mt-24 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Your plans</p><h2 className="mt-1 text-xl font-black text-stone-900">Requests and active plans</h2></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh meal plan status" className="grid h-10 w-10 place-items-center rounded-xl border border-stone-200 text-stone-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
        <div className="mt-4 space-y-3">{loading && <p role="status" className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">Loading your plan requests…</p>}{!loading && mine.length === 0 && <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">You have no meal plan request yet.</p>}{mine.map(item => <article key={item.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-stone-900">{item.total_meals} meals total · <span className="capitalize">{item.meal_types.join(' + ')}</span></h3><p className="mt-1 text-xs text-stone-500">Preferred start {new Date(`${item.preferred_start_date}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === 'active' ? 'bg-emerald-100 text-emerald-800' : item.status === 'payment_pending' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-700'}`}>{statusLabel[item.status]}</span></div>
          {item.status === 'requested' && <p className="mt-3 text-sm text-stone-600">We are checking your preferred schedule, delivery area and price. Nothing is due yet.</p>}
          {item.status === 'payment_pending' && <p className="mt-3 text-sm text-stone-600">Your quote is ready. Review the total and wait for payment instructions before paying.</p>}
          {item.quoted_total != null && <p className="mt-3 text-sm font-bold text-stone-700">Quoted total: <span className="text-emerald-800">₹{item.quoted_total.toLocaleString('en-IN')}</span> · {item.payment_status === 'paid' ? 'Payment verified' : item.payment_status === 'refunded' ? 'Refunded' : 'Payment not yet verified'}</p>}
          {['requested','payment_pending'].includes(item.status) && <button type="button" onClick={() => void cancel(item.id)} disabled={busy === item.id} className="mt-3 min-h-10 rounded-xl border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-50">{busy === item.id ? 'Cancelling…' : 'Cancel request'}</button>}
        </article>)}</div>
      </section>}

      <section aria-labelledby="choose-plan-heading"><div className="mb-5"><h2 id="choose-plan-heading" className="text-2xl font-black text-stone-900 sm:text-3xl">Choose your meal count</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">One meal means one Breakfast, Lunch or Dinner serving for one person. These are total meals, not days or meals per service.</p></div>
        <div className="grid gap-4 lg:grid-cols-3">{plans.map(plan => <article key={plan.code} className="flex flex-col rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg sm:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-800">{plan.label}</p>
          <h3 className="mt-3 text-4xl font-black tracking-tight text-stone-900">{plan.meals} <span className="text-lg font-bold text-stone-600">meals total</span></h3>
          <p className="mt-2 min-h-12 text-sm leading-6 text-stone-600">{plan.description}</p>
          <div className="mt-5 flex-1 border-t border-stone-100 pt-4"><p className="text-xs font-semibold text-stone-500">Plan price</p><p className="mt-1 text-sm font-bold text-stone-900">Confirmed before payment</p></div>
          <button type="button" onClick={() => openRequest ? document.getElementById('my-meal-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : openCheckoutForPlan(plan.code)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0D6E44] px-4 text-sm font-extrabold text-white transition-colors hover:bg-[#095737] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            {openRequest ? 'View your current plan' : <>Set up {plan.meals}-meal request <ArrowRight className="h-4 w-4" /></>}
          </button>
        </article>)}</div>
      </section>

      <section aria-labelledby="plan-steps-heading" className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6"><h2 id="plan-steps-heading" className="text-xl font-black text-stone-900">What happens next?</h2><div className="mt-5 grid gap-5 sm:grid-cols-3"><Step icon={UtensilsCrossed} title="1. Choose" text="Pick your meal count, services, start date and delivery address." /><Step icon={Clock3} title="2. Get a quote" text="We check delivery and availability, then confirm the total." /><Step icon={ShieldCheck} title="3. Decide" text="Review the amount before paying. Your plan starts after payment is verified." /></div></section>
    </div>
  </div>;
};

const Step = ({ icon: Icon, title, text }: { icon: typeof Clock3; title: string; text: string }) => <div className="flex gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" /><div><h3 className="font-black text-emerald-950">{title}</h3><p className="mt-1 text-xs leading-5 text-emerald-900/75">{text}</p></div></div>;
