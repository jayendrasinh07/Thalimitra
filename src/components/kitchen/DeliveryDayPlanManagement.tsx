import React, { useCallback, useEffect, useState } from 'react';
import { BadgeIndianRupee, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  deliveryDayPlanManagementService,
  type DeliveryDayPlanManagementDocument,
  type ManagedDeliveryDayPlan,
} from '../../services/deliveryDayPlanManagementService';
import type { ServiceMealType } from '../../types';

type QuoteDraft = {
  prices: Partial<Record<ServiceMealType, string>>;
  deliveryFee: string;
  discount: string;
  tax: string;
  validUntil: string;
};

const money = (value: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(value);
const date = (value: string) => new Date(value).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
});
const defaultValidity = () => {
  const value = new Date(Date.now() + 48 * 60 * 60 * 1000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
};
const emptyDraft = (): QuoteDraft => ({ prices: {}, deliveryFee: '0', discount: '0', tax: '0', validUntil: defaultValidity() });

export const DeliveryDayPlanManagement = () => {
  const [document, setDocument] = useState<DeliveryDayPlanManagementDocument | null>(null);
  const [drafts, setDrafts] = useState<Record<string, QuoteDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDocument(await deliveryDayPlanManagementService.getManagement()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Delivery-day plans could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const updateDraft = (id: string, update: (current: QuoteDraft) => QuoteDraft) => {
    setDrafts(current => ({ ...current, [id]: update(current[id] ?? emptyDraft()) }));
  };
  const offer = async (item: ManagedDeliveryDayPlan) => {
    if (busy) return;
    const draft = drafts[item.id] ?? emptyDraft();
    const prices = Object.fromEntries(item.meal_types.map(type => [type, Number(draft.prices[type])])) as Partial<Record<ServiceMealType, number>>;
    if (item.meal_types.some(type => !(prices[type]! > 0))) {
      setError('Enter a unit price for every selected meal service.'); return;
    }
    const validUntil = new Date(draft.validUntil);
    if (Number.isNaN(validUntil.getTime())) { setError('Choose a valid quote expiry.'); return; }
    setBusy(item.id); setError(null); setNotice(null);
    try {
      await deliveryDayPlanManagementService.offerQuote({
        subscriptionId: item.id,
        serviceUnitPrices: prices,
        deliveryFee: Number(draft.deliveryFee || 0),
        discountAmount: Number(draft.discount || 0),
        taxAmount: Number(draft.tax || 0),
        validUntil: validUntil.toISOString(),
      });
      setNotice('Itemized quote offered. The customer can now accept or decline it.');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Quote was not offered.'); }
    finally { setBusy(null); }
  };

  const items = document?.subscriptions ?? [];
  const needsQuote = items.filter(item => item.status === 'requested' || item.status === 'quoted').length;
  const accepted = items.filter(item => item.status === 'accepted' || item.status === 'payment_pending').length;

  return <div className="space-y-6">
    <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="rounded-2xl bg-emerald-100 p-3 text-emerald-800"><ShieldCheck /></span><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Admin quote control</p><h2 className="mt-1 text-2xl font-black text-stone-900">Delivery-day plan quotes</h2><p className="mt-1 max-w-2xl text-sm text-stone-600">Set each selected service price. The database calculates the final total and locks the quote after customer acceptance.</p></div></div><button type="button" onClick={() => void load()} disabled={loading || !!busy} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
      <div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Needs quote" value={needsQuote} /><Metric label="Customer accepted" value={accepted} /></div>
    </section>

    {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</p>}

    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-black text-stone-900">Plan request queue</h2><p className="mt-1 text-sm text-stone-500">Customer details are shown only in the protected Operations app.</p>
      {loading && !document && <p className="mt-5 text-sm text-stone-500">Loading requests…</p>}
      {!loading && items.length === 0 && <p className="mt-5 rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">No delivery-day plan requests yet.</p>}
      <div className="mt-5 space-y-4">{items.map(item => {
        const draft = drafts[item.id] ?? emptyDraft();
        const canQuote = item.status === 'requested' || item.status === 'quoted';
        return <article key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black capitalize ring-1 ring-stone-200">{item.status.replace('_', ' ')}</span><span className="text-xs font-bold capitalize text-emerald-700">{item.meal_types.join(' + ')}</span></div><h3 className="mt-2 text-lg font-black text-stone-900">{item.customer.name} · {item.plan_name}</h3><p className="mt-1 text-xs text-stone-500">Requested {date(item.created_at)} · {item.delivery_days} delivery days · {item.total_meal_occurrences} meals</p></div><div className="text-right"><p className="text-sm font-black text-stone-900">{item.current_quote ? money(item.current_quote.total_amount) : 'Quote not set'}</p><p className="text-xs font-bold capitalize text-stone-500">Payment {item.payment_status}</p></div></div>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><Detail label="Phone" value={item.customer.phone || 'Not provided'} /><Detail label="Email" value={item.customer.email || 'Not provided'} /><Detail label="Delivery address" value={item.customer.address || 'Address unavailable'} wide /><Detail label="Customer note" value={item.customer_note || 'No note'} wide /></div>

          {item.current_quote && <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-stone-900">Quote v{item.current_quote.version}</p><p className="text-xs font-bold capitalize text-emerald-800">{item.current_quote.status}</p></div><div className="mt-3 space-y-2">{item.current_quote.items.map(line => <div key={line.id} className="flex justify-between gap-4 text-xs"><span className="text-stone-600">{line.label}{line.item_type === 'service' ? ` · ${line.quantity} × ${money(line.unit_amount)}` : ''}</span><strong className="text-stone-900">{money(line.line_amount)}</strong></div>)}</div><div className="mt-3 flex justify-between border-t border-stone-200 pt-3 text-sm"><strong>Total</strong><strong className="text-emerald-800">{money(item.current_quote.total_amount)}</strong></div>{item.current_quote.valid_until && <p className="mt-2 text-[11px] text-stone-500">Valid until {date(item.current_quote.valid_until)}</p>}</div>}

          {canQuote && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-black text-amber-950">{item.status === 'quoted' ? 'Replace current quote' : 'Create itemized quote'}</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{item.meal_types.map(type => <MoneyInput key={type} label={`${type} price per meal`} value={draft.prices[type] ?? ''} onChange={value => updateDraft(item.id, current => ({ ...current, prices: { ...current.prices, [type]: value } }))} />)}</div><div className="mt-3 grid gap-3 sm:grid-cols-4"><MoneyInput label="Total delivery fee" value={draft.deliveryFee} onChange={value => updateDraft(item.id, current => ({ ...current, deliveryFee: value }))} /><MoneyInput label="Plan discount" value={draft.discount} onChange={value => updateDraft(item.id, current => ({ ...current, discount: value }))} /><MoneyInput label="Tax" value={draft.tax} onChange={value => updateDraft(item.id, current => ({ ...current, tax: value }))} /><label className="text-xs font-bold text-stone-600">Valid until<input type="datetime-local" value={draft.validUntil} onChange={event => updateDraft(item.id, current => ({ ...current, validUntil: event.target.value }))} className="mt-1 block min-h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold" /></label></div><button type="button" disabled={busy === item.id} onClick={() => void offer(item)} className="mt-4 flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-black text-stone-950 disabled:opacity-40"><BadgeIndianRupee className="h-4 w-4" />{item.status === 'quoted' ? 'Offer revised quote' : 'Offer quote'}</button><p className="mt-2 text-xs font-semibold text-amber-900">This sends no payment request. The customer must accept this exact quote first.</p></div>}
        </article>;
      })}</div>
    </section>
  </div>;
};

const Metric = ({ label, value }: { label: string; value: number }) => <div className="rounded-2xl border border-white bg-white/80 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-stone-500">{label}</p><p className="mt-1 text-2xl font-black text-stone-900">{value}</p></div>;
const Detail = ({ label, value, wide }: { label: string; value: string; wide?: boolean }) => <div className={`rounded-xl bg-white p-3 ring-1 ring-stone-200 ${wide ? 'sm:col-span-2' : ''}`}><p className="font-black uppercase tracking-wider text-stone-400">{label}</p><p className="mt-1 break-words text-sm font-bold text-stone-800">{value}</p></div>;
const MoneyInput = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <label className="text-xs font-bold capitalize text-stone-600">{label}<input type="number" min="0" max="100000" step="0.01" inputMode="decimal" value={value} onChange={event => onChange(event.target.value)} className="mt-1 block min-h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold" /></label>;
