import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, MapPin, RefreshCw, Users } from 'lucide-react';
import { getAdminAreaWaitlist, type AdminWaitlistDocument } from '../../services/areaWaitlistAdminService';

const formatDate = (value: string) => new Date(value).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

export const AreaWaitlistManagement = () => {
  const [document, setDocument] = useState<AdminWaitlistDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDocument(await getAdminAreaWaitlist()); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Customer requests could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3"><div className="rounded-2xl bg-amber-100 p-2.5 text-amber-800"><Users size={20} /></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Demand intelligence</p><h2 className="mt-1 text-xl font-black text-stone-900">Notify-me requests</h2><p className="mt-1 max-w-2xl text-sm text-stone-500">Customer name, contact, exact searched address and request time. Visible only to MFA-verified admins.</p></div></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-700 disabled:opacity-40"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</button>
    </div>
    {error && <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>}
    <div className="mt-5 flex items-end justify-between rounded-2xl bg-stone-950 p-4 text-white"><div><p className="text-xs font-bold uppercase tracking-wider text-stone-400">Total interest</p><p className="mt-1 text-3xl font-black">{document?.total ?? '—'}</p></div><p className="text-xs text-stone-400">Newest first</p></div>
    {!loading && document?.entries.length === 0 && <div className="mt-4 rounded-2xl border border-dashed border-stone-300 p-7 text-center"><p className="font-black text-stone-800">No cloud requests yet</p><p className="mt-1 text-sm text-stone-500">New Notify Me submissions will appear here automatically.</p></div>}
    <div className="mt-4 grid gap-3 xl:grid-cols-2">
      {document?.entries.map(entry => <article key={entry.id} className="rounded-2xl border border-stone-200 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="truncate font-black text-stone-900">{entry.name}</h3><p className="mt-0.5 break-all text-sm font-bold text-emerald-800">{entry.contact}</p></div><span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-stone-500"><CalendarDays size={14} />{formatDate(entry.createdAt)}</span></div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-stone-50 p-3"><MapPin size={17} className="mt-0.5 shrink-0 text-amber-700" /><div className="min-w-0"><p className="text-sm font-bold leading-relaxed text-stone-800">{entry.formattedAddress || entry.area}</p><p className="mt-1 text-xs text-stone-500">{[entry.area, entry.city, entry.pincode].filter(Boolean).join(' · ')}</p></div></div>
      </article>)}
    </div>
  </section>;
};
