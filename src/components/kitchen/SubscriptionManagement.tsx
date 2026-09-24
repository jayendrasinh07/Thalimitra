import React, { useCallback, useEffect, useState } from 'react';
import { BadgeIndianRupee, CheckCircle2, CirclePause, CirclePlay, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { subscriptionService, type ManagedMealSubscription, type SubscriptionManagementDocument } from '../../services/subscriptionService';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export const SubscriptionManagement = () => {
  const [document, setDocument] = useState<SubscriptionManagementDocument | null>(null);
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDocument(await subscriptionService.getManagement()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Subscriptions could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (item: ManagedMealSubscription, action: Parameters<typeof subscriptionService.manage>[1], quote?: number, message?: string, paymentReference?: string) => {
    if (busy) return;
    setBusy(item.id); setError(null); setNotice(null);
    try { setDocument(await subscriptionService.manage(item.id, action, quote, undefined, paymentReference)); setNotice(message || 'Subscription updated.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Subscription was not updated.'); }
    finally { setBusy(null); }
  };

  const items = document?.subscriptions ?? [];
  const pending = items.filter(item => item.status === 'requested' || item.status === 'payment_pending').length;
  const active = items.filter(item => item.status === 'active' || item.status === 'paused').length;

  return <div className="space-y-6">
    <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="rounded-2xl bg-emerald-100 p-3 text-emerald-800"><ShieldCheck /></span><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Admin financial control</p><h2 className="mt-1 text-2xl font-black text-stone-900">Meal subscriptions</h2><p className="mt-1 max-w-2xl text-sm text-stone-600">Review serviceability, set the final quote, confirm payment, then activate. No customer is charged automatically.</p></div></div><button type="button" onClick={() => void load()} disabled={loading || !!busy} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
      <div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Needs action" value={pending} /><Metric label="Active / paused" value={active} /></div>
    </section>

    {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</p>}

    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-black text-stone-900">Subscription queue</h2><p className="mt-1 text-sm text-stone-500">Customer contact details are visible here only for Operations follow-up.</p>
      {loading && !document && <p className="mt-5 text-sm text-stone-500">Loading subscriptions…</p>}
      {!loading && items.length === 0 && <p className="mt-5 rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">No meal plan requests yet.</p>}
      <div className="mt-5 space-y-4">{items.map(item => <article key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black capitalize ring-1 ring-stone-200">{item.status.replace('_',' ')}</span><span className="text-xs font-bold capitalize text-emerald-700">{item.meal_type}</span></div><h3 className="mt-2 text-lg font-black text-stone-900">{item.customer_name} · {item.plan_name}</h3><p className="mt-1 text-xs text-stone-500">Requested {date(item.created_at)} · Start {item.preferred_start_date}</p></div><div className="text-right"><p className="text-sm font-black text-stone-900">{item.quoted_total == null ? 'Quote not set' : money(item.quoted_total)}</p><p className="text-xs font-bold capitalize text-stone-500">Payment {item.payment_status}</p></div></div>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><Detail label="Phone" value={item.customer_phone || 'Not provided'} /><Detail label="Email" value={item.customer_email || 'Not provided'} /><Detail label="Delivery address" value={item.address || 'Address unavailable'} wide /><Detail label="Customer note" value={item.customer_note || 'No note'} wide /></div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          {item.status === 'requested' && <><label className="text-xs font-bold text-stone-600">Final plan amount (₹)<input type="number" min="1" step="1" value={quotes[item.id] ?? ''} onChange={event => setQuotes(current => ({ ...current, [item.id]: event.target.value }))} className="mt-1 block min-h-10 w-40 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold" /></label><button type="button" disabled={busy === item.id || !(Number(quotes[item.id]) > 0)} onClick={() => void run(item, 'quote', Number(quotes[item.id]), 'Quote saved. Customer can now be asked to pay.')} className="flex min-h-10 items-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-black text-stone-950 disabled:opacity-40"><BadgeIndianRupee className="h-4 w-4" />Request payment</button><button type="button" disabled={busy === item.id} onClick={() => void run(item, 'reject', undefined, 'Request rejected.')} className="min-h-10 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-700">Reject</button></>}
          {item.status === 'payment_pending' && <><label className="text-xs font-bold text-stone-600">Verified payment reference<input type="text" maxLength={120} value={paymentReferences[item.id] ?? ''} onChange={event => setPaymentReferences(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Bank / UPI reference" className="mt-1 block min-h-10 w-52 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold" /></label><button type="button" disabled={busy === item.id || (paymentReferences[item.id]?.trim().length ?? 0) < 3} onClick={() => void run(item, 'activate', undefined, 'Verified payment recorded and plan activated.', paymentReferences[item.id])} className="flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Mark paid & activate</button><p className="text-xs font-bold text-red-700">Use only after payment is visible in the business account.</p></>}
          {item.status === 'active' && <><button type="button" disabled={busy === item.id} onClick={() => void run(item, 'pause', undefined, 'Plan paused.')} className="flex min-h-10 items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-black text-white"><CirclePause className="h-4 w-4" />Pause</button><button type="button" disabled={busy === item.id} onClick={() => void run(item, 'complete', undefined, 'Plan completed.')} className="min-h-10 rounded-xl border border-emerald-300 px-3 text-sm font-bold text-emerald-800">Complete</button><button type="button" disabled={busy === item.id} onClick={() => void run(item, 'cancel', undefined, 'Plan cancelled.')} className="flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-700"><XCircle className="h-4 w-4" />Cancel</button></>}
          {item.status === 'paused' && <button type="button" disabled={busy === item.id} onClick={() => void run(item, 'resume', undefined, 'Plan resumed.')} className="flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"><CirclePlay className="h-4 w-4" />Resume</button>}
          {busy === item.id && <RefreshCw className="h-5 w-5 animate-spin text-emerald-700" />}
        </div>
      </article>)}</div>
    </section>
  </div>;
};

const Metric = ({ label, value }: { label: string; value: number }) => <div className="rounded-2xl border border-white bg-white/80 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-stone-500">{label}</p><p className="mt-1 text-2xl font-black text-stone-900">{value}</p></div>;
const Detail = ({ label, value, wide }: { label: string; value: string; wide?: boolean }) => <div className={`rounded-xl bg-white p-3 ring-1 ring-stone-200 ${wide ? 'sm:col-span-2' : ''}`}><p className="font-black uppercase tracking-wider text-stone-400">{label}</p><p className="mt-1 break-words text-sm font-bold text-stone-800">{value}</p></div>;
