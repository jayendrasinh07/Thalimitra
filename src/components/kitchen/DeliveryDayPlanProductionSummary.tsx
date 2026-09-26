import React, { useCallback, useEffect, useState } from 'react';
import { CalendarRange, RefreshCw } from 'lucide-react';
import { getSupabaseClient } from '../../services/supabaseClient';

type ProductionRow = {
  service_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  meal_name: string;
  portions: number;
  preparation_preferences: Record<string, unknown>;
};

export const DeliveryDayPlanProductionSummary = () => {
  const [rows, setRows] = useState<ProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcError } = await getSupabaseClient().rpc('get_kitchen_delivery_day_plan_production' as never);
    if (rpcError) setError(rpcError.message);
    else {
      const document = data as unknown as { production?: ProductionRow[] };
      setRows(Array.isArray(document?.production) ? document.production.map(row => ({ ...row, portions: Number(row.portions) })) : []);
      setError(null);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Plan production</p><h2 className="mt-1 text-xl font-black text-stone-900">Next 7 days</h2><p className="mt-1 text-sm text-stone-500">Kitchen quantities only. Customer and payment details stay hidden.</p></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh plan production" className="grid h-10 w-10 place-items-center rounded-xl border border-stone-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800">Production summary could not refresh.</p>}
    {!loading && !error && rows.length === 0 && <p className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">No plan meals are scheduled in the next 7 days.</p>}
    {rows.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{rows.map((row, index) => <article key={`${row.service_date}-${row.meal_type}-${row.meal_name}-${index}`} className="rounded-2xl bg-stone-50 p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black capitalize text-emerald-800">{row.meal_type}</p><p className="flex items-center gap-1 text-[11px] font-bold text-stone-500"><CalendarRange className="h-3.5 w-3.5" />{row.service_date}</p></div><p className="mt-2 text-sm font-black text-stone-900">{row.meal_name}</p><p className="mt-1 text-lg font-black text-emerald-800">{row.portions} portion{row.portions === 1 ? '' : 's'}</p>{Object.keys(row.preparation_preferences ?? {}).length > 0 && <p className="mt-2 text-[11px] text-stone-500">Preparation: {Object.entries(row.preparation_preferences).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</p>}</article>)}</div>}
  </section>;
};
