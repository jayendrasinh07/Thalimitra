import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Save, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import {
  kitchenManagementService,
  type KitchenManagementDocument,
  type ManagedDeliverySlot,
} from '../../services/kitchenManagementService';
import { KitchenSupportQueue } from './KitchenSupportQueue';
import { DeliveryAreaManagement } from './DeliveryAreaManagement';
import { AreaWaitlistManagement } from './AreaWaitlistManagement';

const formatTime = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};

export const KitchenManagement = () => {
  const [document, setDocument] = useState<KitchenManagementDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocument(await kitchenManagementService.get());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Management could not be refreshed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, action: () => Promise<KitchenManagementDocument>, success: string) => {
    if (busy) return false;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      setDocument(await action());
      setNotice(success);
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The change could not be saved.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (await run('grant', () => kitchenManagementService.grantStaff(email), 'Kitchen access added.')) setEmail('');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" />
          <div><p className="font-black text-emerald-950">Admin-only management</p><p className="mt-1 text-sm text-emerald-900/75">Kitchen staff cannot open these controls. Customer ordering and payment records stay outside this page.</p></div>
        </div>
      </section>

      {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertTriangle className="mt-0.5 shrink-0" size={18} />{error}</div>}
      <div className="flex min-h-6 items-center justify-between gap-3"><p role="status" aria-live="polite" className="text-sm font-bold text-emerald-700">{notice}</p><button type="button" onClick={() => void load()} disabled={loading || !!busy} className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh</button></div>

      <DeliveryAreaManagement />
      <AreaWaitlistManagement />

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Delivery controls</p><h2 className="mt-1 text-xl font-black text-stone-900">Slot capacity</h2><p className="mt-1 text-sm text-stone-500">Capacity means portions per delivery window. Breakfast closes the previous night at 10:00 PM; lunch at 10:30 AM; dinner at 5:30 PM.</p></div>
        {loading && !document && <p className="mt-5 text-sm text-stone-500">Loading delivery slots…</p>}
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {document?.slots.map(slot => (
            <div key={slot.id}><SlotEditor slot={slot} busy={busy === slot.id} disabled={!!busy}
              onSave={(maxPortions, isActive) => run(slot.id, () => kitchenManagementService.saveSlot(slot.id, maxPortions, isActive), `${slot.name} updated.`)} /></div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><Users className="mt-1 shrink-0 text-emerald-700" /><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Access control</p><h2 className="mt-1 text-xl font-black text-stone-900">Kitchen staff</h2><p className="mt-1 text-sm text-stone-500">Add an existing Thalimitra account by email. Access changes take effect on the user's next role refresh or sign-in.</p></div></div>
        <form onSubmit={addStaff} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="min-w-0 flex-1 text-xs font-bold text-stone-600">Account email<input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm text-stone-900 outline-none focus:border-emerald-600" /></label>
          <button type="submit" disabled={!!busy || !email.trim()} className="flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-40"><UserPlus size={17} />{busy === 'grant' ? 'Adding…' : 'Add Kitchen access'}</button>
        </form>
        <div className="mt-5 divide-y divide-stone-100 rounded-2xl border border-stone-200">
          {document?.staff.length === 0 && <p className="p-4 text-sm text-stone-500">No Kitchen staff role is assigned.</p>}
          {document?.staff.map(member => (
            <div key={member.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="truncate font-bold text-stone-900">{member.full_name}</p><p className="truncate text-sm text-stone-500">{member.email}</p><p className="mt-1 text-xs text-stone-400">Added {new Date(member.added_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
              {confirmRemove === member.user_id ? <div className="flex gap-2"><button type="button" onClick={() => setConfirmRemove(null)} className="min-h-10 rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-700">Cancel</button><button type="button" disabled={!!busy} onClick={() => void run(`revoke:${member.user_id}`, () => kitchenManagementService.revokeStaff(member.user_id), `${member.full_name}'s Kitchen access removed.`).then(saved => { if (saved) setConfirmRemove(null); })} className="min-h-10 rounded-xl bg-red-700 px-3 text-sm font-bold text-white disabled:opacity-40">{busy === `revoke:${member.user_id}` ? 'Removing…' : 'Confirm remove'}</button></div>
                : <button type="button" onClick={() => setConfirmRemove(member.user_id)} disabled={!!busy} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-bold text-red-700 disabled:opacity-40"><UserMinus size={16} />Remove access</button>}
            </div>
          ))}
        </div>
      </section>

      <KitchenSupportQueue />
    </div>
  );
};

const SlotEditor = ({ slot, busy, disabled, onSave }: { slot: ManagedDeliverySlot; busy: boolean; disabled: boolean; onSave: (max: number, active: boolean) => Promise<unknown> }) => {
  const [max, setMax] = useState(slot.max_portions);
  const [active, setActive] = useState(slot.is_active);
  useEffect(() => { setMax(slot.max_portions); setActive(slot.is_active); }, [slot.max_portions, slot.is_active]);
  const changed = max !== slot.max_portions || active !== slot.is_active;
  const invalid = !Number.isInteger(max) || max < slot.peak_booked_portions || max > 5000;
  return (
    <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-stone-500">{slot.meal_type}</p><h3 className="mt-1 font-black text-stone-900">{slot.name}</h3><p className="mt-1 text-xs text-stone-500">Delivery {formatTime(slot.start_time)}–{formatTime(slot.end_time)} · cutoff {formatTime(slot.cutoff_time)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'}`}>{active ? 'Accepting orders' : 'Paused'}</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-stone-600">Maximum portions<input type="number" min={slot.peak_booked_portions} max={5000} step={1} value={max} onChange={event => setMax(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-900" /></label><label className="flex min-h-11 items-center justify-between self-end rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700">Slot active<input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} className="h-5 w-5 accent-emerald-700" /></label></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-stone-500"><span className="font-black text-stone-800">{slot.booked_today}</span> today · highest current/future booking <span className="font-black text-stone-800">{slot.peak_booked_portions}</span></p><button type="button" onClick={() => void onSave(max, active)} disabled={disabled || !changed || invalid} className="flex min-h-10 items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-40">{busy ? <RefreshCw size={15} className="animate-spin" /> : changed ? <Save size={15} /> : <CheckCircle2 size={15} />}{busy ? 'Saving…' : changed ? 'Save' : 'Saved'}</button></div>
      {invalid && <p className="mt-2 text-xs font-bold text-red-700">Use {slot.peak_booked_portions}–5000 portions.</p>}
    </article>
  );
};
