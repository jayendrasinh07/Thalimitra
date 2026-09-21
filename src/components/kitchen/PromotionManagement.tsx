import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeIndianRupee, BadgePercent, CalendarClock, CheckCircle2, ChevronDown, Pencil, Plus, RefreshCw, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  promotionService,
  type PromotionCampaign,
  type PromotionDraft,
  type PromotionManagementDocument,
} from '../../services/promotionService';
import type { ServiceMealType } from '../../types';

const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const freshDraft = (): PromotionDraft => {
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 86_400_000);
  return {
    code: '', name: '', description: '', discountType: 'fixed', discountValue: 40,
    minimumSubtotal: 249, maximumDiscount: 40, totalBudget: 4000,
    startsAt: localDateTime(start), endsAt: localDateTime(end),
    serviceDateStart: null, serviceDateEnd: null, isActive: false,
    firstOrderOnly: true, perUserLimit: 1,
    eligibleMealTypes: ['breakfast', 'lunch', 'dinner'], eligibleMealIds: [], eligibleZoneIds: [],
  };
};

const editDraft = (campaign: PromotionCampaign): PromotionDraft => ({
  id: campaign.id, code: campaign.code, name: campaign.name, description: campaign.description,
  discountType: campaign.discount_type, discountValue: campaign.discount_value,
  minimumSubtotal: campaign.minimum_subtotal, maximumDiscount: campaign.maximum_discount,
  totalBudget: campaign.total_budget, startsAt: localDateTime(new Date(campaign.starts_at)),
  endsAt: localDateTime(new Date(campaign.ends_at)), serviceDateStart: campaign.service_date_start,
  serviceDateEnd: campaign.service_date_end, isActive: campaign.is_active,
  firstOrderOnly: campaign.first_order_only, perUserLimit: campaign.per_user_limit,
  eligibleMealTypes: campaign.eligible_meal_types, eligibleMealIds: campaign.eligible_meal_ids,
  eligibleZoneIds: campaign.eligible_zone_ids,
});

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export const PromotionManagement = () => {
  const [document, setDocument] = useState<PromotionManagementDocument | null>(null);
  const [draft, setDraft] = useState<PromotionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDocument(await promotionService.getManagement()); setError(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Offers could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const activeCount = document?.campaigns.filter(item => item.is_active).length ?? 0;
  const totalSpent = document?.campaigns.reduce((sum, item) => sum + item.spent, 0) ?? 0;
  const totalRedemptions = document?.campaigns.reduce((sum, item) => sum + item.redemption_count, 0) ?? 0;

  const run = async (key: string, action: () => Promise<PromotionManagementDocument>, message: string) => {
    if (busy) return false;
    setBusy(key); setError(null); setNotice(null);
    try { setDocument(await action()); setNotice(message); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The offer change could not be saved.'); return false; }
    finally { setBusy(null); }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.code.trim() || !draft.name.trim() || draft.eligibleMealTypes.length === 0) {
      setError('Add an offer code, customer-facing name and at least one meal service.'); return;
    }
    const saved = await run('save', () => promotionService.save(draft), draft.id ? 'Offer updated.' : 'Offer created as configured.');
    if (saved) { setDraft(null); setAdvanced(false); }
  };

  const toggle = <T extends string>(items: T[], value: T) => items.includes(value) ? items.filter(item => item !== value) : [...items, value];
  const budgetRemaining = (campaign: PromotionCampaign) => campaign.total_budget == null ? null : Math.max(0, campaign.total_budget - campaign.spent);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3"><span className="rounded-2xl bg-amber-100 p-3 text-amber-800"><BadgePercent /></span><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Admin financial control</p><h2 className="mt-1 text-2xl font-black text-stone-900">Pricing & Offers</h2><p className="mt-1 max-w-2xl text-sm text-stone-600">Create controlled offers here. The database rechecks every rule, budget and customer limit when an order is placed.</p></div></div>
          <button type="button" onClick={() => { setDraft(freshDraft()); setAdvanced(false); setError(null); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 text-sm font-black text-white"><Plus size={18} />Create offer</button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metric label="Active" value={String(activeCount)} />
          <Metric label="Redemptions" value={String(totalRedemptions)} />
          <Metric label="Discount spent" value={money(totalSpent)} />
        </div>
      </section>

      {error && <div role="alert" className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertTriangle className="shrink-0" size={18} />{error}</div>}
      <div className="flex min-h-6 items-center justify-between gap-3"><p role="status" aria-live="polite" className="text-sm font-bold text-emerald-700">{notice}</p><button type="button" onClick={() => void load()} disabled={loading || !!busy} className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh</button></div>

      {draft && <OfferEditor draft={draft} document={document} advanced={advanced} busy={busy === 'save'} onAdvanced={() => setAdvanced(value => !value)} onChange={setDraft} onCancel={() => { setDraft(null); setAdvanced(false); }} onSave={() => void save()} toggle={toggle} />}

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-1 text-emerald-700" /><div><h2 className="text-xl font-black text-stone-900">Campaigns</h2><p className="mt-1 text-sm text-stone-500">Pause an offer instantly. Used campaigns stay in the audit history and cannot be deleted.</p></div></div>
        {loading && !document && <p className="mt-5 text-sm text-stone-500">Loading offers…</p>}
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {document?.campaigns.length === 0 && <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 xl:col-span-2">No offers yet. Create the first controlled campaign.</div>}
          {document?.campaigns.map(campaign => {
            const remaining = budgetRemaining(campaign);
            return <article key={campaign.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-white px-2 py-1 font-mono text-xs font-black text-stone-900 ring-1 ring-stone-200">{campaign.code}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${campaign.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'}`}>{campaign.is_active ? 'Active' : 'Paused'}</span></div><h3 className="mt-2 text-lg font-black text-stone-900">{campaign.name}</h3><p className="mt-1 text-sm text-stone-600">{campaign.description || 'No customer description.'}</p></div><div className="rounded-xl bg-amber-100 px-3 py-2 text-right text-amber-900"><p className="text-xs font-bold">Customer saving</p><p className="font-black">{campaign.discount_type === 'fixed' ? money(campaign.discount_value) : `${campaign.discount_value}%`}{campaign.maximum_discount && campaign.discount_type === 'percentage' ? ` · up to ${money(campaign.maximum_discount)}` : ''}</p></div></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><Detail label="Min. food" value={money(campaign.minimum_subtotal)} /><Detail label="Used" value={`${campaign.redemption_count}×`} /><Detail label="Spent" value={money(campaign.spent)} /><Detail label="Budget left" value={remaining == null ? 'No cap' : money(remaining)} /></div>
              <div className="mt-4 flex items-center gap-2 text-xs text-stone-500"><CalendarClock size={15} /><span>{date(campaign.starts_at)} → {date(campaign.ends_at)}</span></div>
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={() => { setDraft(editDraft(campaign)); setAdvanced(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 disabled:opacity-40"><Pencil size={15} />Edit</button><button type="button" disabled={!!busy} onClick={() => void run(`active:${campaign.id}`, () => promotionService.setActive(campaign.id, !campaign.is_active), campaign.is_active ? 'Offer paused.' : 'Offer activated.')} className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-white disabled:opacity-40 ${campaign.is_active ? 'bg-stone-700' : 'bg-emerald-700'}`}>{busy === `active:${campaign.id}` ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}{campaign.is_active ? 'Pause' : 'Activate'}</button>{campaign.redemption_count === 0 && (deleteId === campaign.id ? <><button type="button" onClick={() => setDeleteId(null)} className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold">Cancel</button><button type="button" disabled={!!busy} onClick={() => void run(`delete:${campaign.id}`, () => promotionService.deleteUnused(campaign.id), 'Unused offer deleted.').then(saved => { if (saved) setDeleteId(null); })} className="min-h-10 rounded-xl bg-red-700 px-3 text-sm font-bold text-white">Confirm delete</button></> : <button type="button" disabled={!!busy} onClick={() => setDeleteId(campaign.id)} className="flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-bold text-red-700"><Trash2 size={15} />Delete unused</button>)}</div>
            </article>;
          })}
        </div>
      </section>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl border border-white bg-white/80 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-stone-500">{label}</p><p className="mt-1 text-lg font-black text-stone-900">{value}</p></div>;
const Detail = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl bg-white p-2 ring-1 ring-stone-200"><p className="text-stone-400">{label}</p><p className="mt-0.5 font-black text-stone-800">{value}</p></div>;

const OfferEditor = ({ draft, document, advanced, busy, onAdvanced, onChange, onCancel, onSave, toggle }: {
  draft: PromotionDraft; document: PromotionManagementDocument | null; advanced: boolean; busy: boolean;
  onAdvanced: () => void; onChange: (draft: PromotionDraft) => void; onCancel: () => void; onSave: () => void;
  toggle: <T extends string>(items: T[], value: T) => T[];
}) => {
  const invalid = useMemo(() => !draft.code.trim() || !draft.name.trim() || draft.discountValue <= 0 || draft.minimumSubtotal < 0 || draft.perUserLimit < 1 || draft.eligibleMealTypes.length === 0 || !draft.startsAt || !draft.endsAt || new Date(draft.endsAt) <= new Date(draft.startsAt), [draft]);
  const set = <K extends keyof PromotionDraft>(key: K, value: PromotionDraft[K]) => onChange({ ...draft, [key]: value });
  return <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-lg sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{draft.id ? 'Edit campaign' : 'New campaign'}</p><h2 className="mt-1 text-xl font-black text-stone-900">Offer rules</h2><p className="mt-1 text-sm text-stone-500">Keep it paused until margin and customer wording are reviewed.</p></div><button type="button" onClick={onCancel} aria-label="Close editor" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"><X /></button></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label="Offer code"><input value={draft.code} maxLength={30} onChange={event => set('code', event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="WELCOME40" className="control font-mono uppercase" /></Field>
      <Field label="Customer-facing name"><input value={draft.name} maxLength={80} onChange={event => set('name', event.target.value)} placeholder="Welcome to Thalimitra" className="control" /></Field>
      <Field label="Description" wide><input value={draft.description} maxLength={240} onChange={event => set('description', event.target.value)} placeholder="₹40 off your first eligible order of ₹249 or more." className="control" /></Field>
      <Field label="Discount type"><select value={draft.discountType} onChange={event => set('discountType', event.target.value as PromotionDraft['discountType'])} className="control"><option value="fixed">Fixed amount (₹)</option><option value="percentage">Percentage (%)</option></select></Field>
      <Field label={draft.discountType === 'fixed' ? 'Discount amount (₹)' : 'Discount percent'}><input type="number" min="1" max={draft.discountType === 'percentage' ? 100 : 100000} value={draft.discountValue} onChange={event => set('discountValue', Number(event.target.value))} className="control" /></Field>
      <Field label="Minimum eligible food value (₹)"><input type="number" min="0" value={draft.minimumSubtotal} onChange={event => set('minimumSubtotal', Number(event.target.value))} className="control" /></Field>
      <Field label="Maximum discount (optional)"><input type="number" min="1" value={draft.maximumDiscount ?? ''} onChange={event => set('maximumDiscount', event.target.value ? Number(event.target.value) : null)} className="control" /></Field>
      <Field label="Campaign budget (optional)"><input type="number" min="1" value={draft.totalBudget ?? ''} onChange={event => set('totalBudget', event.target.value ? Number(event.target.value) : null)} className="control" /></Field>
      <Field label="Starts"><input type="datetime-local" value={draft.startsAt} onChange={event => set('startsAt', event.target.value)} className="control" /></Field>
      <Field label="Ends"><input type="datetime-local" value={draft.endsAt} onChange={event => set('endsAt', event.target.value)} className="control" /></Field>
    </div>
    <fieldset className="mt-5"><legend className="text-xs font-black uppercase tracking-wider text-stone-600">Meal services</legend><div className="mt-2 flex flex-wrap gap-2">{(['breakfast','lunch','dinner'] as ServiceMealType[]).map(type => <label key={type} className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold capitalize ${draft.eligibleMealTypes.includes(type) ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-stone-200 text-stone-600'}`}><input type="checkbox" checked={draft.eligibleMealTypes.includes(type)} onChange={() => set('eligibleMealTypes', toggle(draft.eligibleMealTypes, type))} className="accent-emerald-700" />{type}</label>)}</div></fieldset>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="flex min-h-12 items-center justify-between rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-700">First order only<input type="checkbox" checked={draft.firstOrderOnly} onChange={event => set('firstOrderOnly', event.target.checked)} className="h-5 w-5 accent-emerald-700" /></label><Field label="Uses per customer"><input type="number" min="1" max="100" value={draft.perUserLimit} onChange={event => set('perUserLimit', Number(event.target.value))} className="control" /></Field><label className="flex min-h-12 items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-black text-amber-900">Activate immediately<input type="checkbox" checked={draft.isActive} onChange={event => set('isActive', event.target.checked)} className="h-5 w-5 accent-amber-700" /></label></div>
    <button type="button" onClick={onAdvanced} className="mt-5 flex min-h-10 w-full items-center justify-between rounded-xl bg-stone-50 px-4 text-sm font-black text-stone-700"><span>Advanced scopes · dishes, areas and service dates</span><ChevronDown className={`transition ${advanced ? 'rotate-180' : ''}`} size={18} /></button>
    {advanced && <div className="mt-4 space-y-5 rounded-2xl border border-stone-200 p-4">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Service date from (optional)"><input type="date" value={draft.serviceDateStart ?? ''} onChange={event => set('serviceDateStart', event.target.value || null)} className="control" /></Field><Field label="Service date to (optional)"><input type="date" value={draft.serviceDateEnd ?? ''} onChange={event => set('serviceDateEnd', event.target.value || null)} className="control" /></Field></div>
      <Scope title="Specific dishes" hint="None selected means every eligible dish.">{document?.meals.map(meal => <ScopeOption key={meal.id} checked={draft.eligibleMealIds.includes(meal.id)} label={`${meal.name} · ${meal.meal_type}`} onChange={() => set('eligibleMealIds', toggle(draft.eligibleMealIds, meal.id))} />)}</Scope>
      <Scope title="Specific delivery areas" hint="None selected means every available area.">{document?.areas.map(area => <ScopeOption key={area.id} checked={draft.eligibleZoneIds.includes(area.id)} label={`${area.name} · ${area.status}`} onChange={() => set('eligibleZoneIds', toggle(draft.eligibleZoneIds, area.id))} />)}</Scope>
    </div>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-stone-500"><BadgeIndianRupee size={16} />Customer discount excludes delivery fee and can never exceed eligible food value.</p><div className="flex gap-2"><button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700">Cancel</button><button type="button" disabled={busy || invalid} onClick={onSave} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white disabled:opacity-40">{busy ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}{busy ? 'Saving…' : 'Save offer'}</button></div></div>
  </section>;
};

const Field = ({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) => <label className={`text-xs font-bold text-stone-600 ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label>;
const Scope = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => <fieldset><legend className="text-sm font-black text-stone-800">{title}</legend><p className="mt-0.5 text-xs text-stone-500">{hint}</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{children}</div></fieldset>;
const ScopeOption = ({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) => <label className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${checked ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-stone-200 text-stone-600'}`}><input type="checkbox" checked={checked} onChange={onChange} className="accent-emerald-700" />{label}</label>;
