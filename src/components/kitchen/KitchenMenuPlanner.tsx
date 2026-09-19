import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, Check, LockKeyhole, RefreshCw, Send } from 'lucide-react';
import { addCalendarDays, istDate } from '../../services/availabilityEngine';
import { dietLabel } from '../../services/menuService';
import { KitchenMenuMeal, KitchenMenuPlan, kitchenMenuService } from '../../services/kitchenMenuService';
import type { KitchenShift } from '../../services/kitchenService';

const mealBelongsTo = (meal: KitchenMenuMeal, shift: KitchenShift) => meal.serviceMealType === shift;

const formatUpdatedAt = (value: string | null) => value
  ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  : 'Not saved yet';
const longDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
  weekday: 'short', day: 'numeric', month: 'short',
});

export const KitchenMenuPlanner: React.FC = () => {
  const today = istDate(new Date());
  const menuDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addCalendarDays(today, index)), [today]);
  const [date, setDate] = useState(today);
  const [plan, setPlan] = useState<KitchenMenuPlan | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef(0);

  const load = async (menuDate: string) => {
    const current = ++request.current;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const next = await kitchenMenuService.get(menuDate);
      if (request.current !== current) return;
      setPlan(next);
      setSelectedKeys(next.meals.filter(meal => meal.selected).map(meal => meal.selectionKey));
    } catch (caught) {
      if (request.current === current) {
        setPlan(null);
        setSelectedKeys([]);
        setError((caught as Error).message);
      }
    } finally {
      if (request.current === current) setLoading(false);
    }
  };

  useEffect(() => {
    void load(date);
    return () => { request.current += 1; };
  }, [date]);

  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const hasSelection = selectedKeys.length > 0;
  const dirty = plan ? plan.meals.some(meal => meal.selected !== selected.has(meal.selectionKey)) : false;

  const toggle = (selectionKey: string) => {
    if (saving || plan?.isLocked) return;
    setSelectedKeys(current => current.includes(selectionKey)
      ? current.filter(key => key !== selectionKey)
      : [...current, selectionKey]);
    setNotice('');
  };

  const save = async (publish: boolean) => {
    setSaving(publish ? 'publish' : 'draft');
    setError('');
    setNotice('');
    try {
      const selections = (plan?.meals ?? [])
        .filter(meal => selected.has(meal.selectionKey))
        .map(meal => ({ mealId: meal.id, serviceMealType: meal.serviceMealType }));
      const next = await kitchenMenuService.save(date, selections, publish);
      setPlan(next);
      setSelectedKeys(next.meals.filter(meal => meal.selected).map(meal => meal.selectionKey));
      setNotice(publish ? 'Menu published. Customers can now order these meals.' : 'Draft saved. Customers cannot see it yet.');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section aria-label="Menu planning" className="mt-6 space-y-5">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#0D6E44]"><CalendarDays size={17} /> Daily menu</p>
            <h2 className="mt-2 text-2xl font-black text-stone-900">Plan breakfast, lunch and dinner</h2>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">Choose from the approved meal catalog, save a draft, then publish the complete day to customers.</p>
          </div>
          <label className="text-xs font-bold text-stone-600">Menu date · IST
            <input type="date" value={date} min={today} max={addCalendarDays(today, 6)} onChange={event => event.target.value && setDate(event.target.value)}
              className="mt-2 block min-h-11 rounded-xl border border-stone-200 px-3 text-sm text-stone-900" />
          </label>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4">
          <p className="text-sm font-black text-stone-900">Selected: {longDate(date)}</p>
          <p className="mt-1 text-xs text-stone-500">Choose any day below. All dates use India Standard Time (IST).</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="Seven day menu dates">
            {menuDays.map((menuDate, index) => (
              <button key={menuDate} type="button" onClick={() => setDate(menuDate)} aria-pressed={date === menuDate}
                className={`min-h-14 rounded-xl border px-3 py-2 text-left transition ${date === menuDate ? 'border-[#0D6E44] bg-emerald-50 text-emerald-950 ring-1 ring-[#0D6E44]' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'}`}>
                <span className="block text-[11px] font-black uppercase tracking-wide">{index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : `Day ${index + 1}`}</span>
                <span className="mt-0.5 block text-sm font-bold">{shortDate(menuDate)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${plan?.isPublished ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
              {plan?.isPublished ? 'Published' : 'Draft'}
            </span>
            <span className="text-xs text-stone-500">Updated {formatUpdatedAt(plan?.updatedAt ?? null)}</span>
          </div>
          <button type="button" onClick={() => void load(date)} disabled={loading || !!saving}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertCircle size={20} className="shrink-0" /><p>{error}</p></div>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{notice}</p>}
      {plan?.isLocked && <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><LockKeyhole size={20} className="shrink-0" /><p>This menu is locked because a customer order already exists for this date. Existing orders and their meal snapshots stay protected.</p></div>}

      {loading && !plan ? <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">Loading the approved meal catalog…</div> : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {(['breakfast', 'lunch', 'dinner'] as KitchenShift[]).map(shift => (
            <section key={shift} aria-label={`${shift} menu`} className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-black capitalize text-stone-900">{shift}</h3>
                  <p className="text-xs text-stone-500">Select one or more meals</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-600">{plan?.meals.filter(meal => mealBelongsTo(meal, shift) && selected.has(meal.selectionKey)).length ?? 0} selected</span>
              </div>
              <div className="space-y-3">
                {plan?.meals.filter(meal => mealBelongsTo(meal, shift)).map(meal => {
                  const checked = selected.has(meal.selectionKey);
                  return <button key={meal.selectionKey} type="button" role="checkbox" aria-checked={checked} onClick={() => toggle(meal.selectionKey)} disabled={!!saving || plan.isLocked}
                    className={`flex min-h-24 w-full items-start gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${checked ? 'border-[#0D6E44] bg-emerald-50' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-[#0D6E44] bg-[#0D6E44] text-white' : 'border-stone-300 bg-white'}`}>{checked && <Check size={14} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-start justify-between gap-2"><strong className="text-sm text-stone-900">{meal.name}</strong><b className="text-sm text-[#0D6E44]">₹{meal.basePrice}</b></span>
                      <span className="mt-1 block text-xs font-semibold text-stone-500">{dietLabel(meal.dietType)}</span>
                      {meal.description && <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-stone-600">{meal.description}</span>}
                    </span>
                  </button>;
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="text-xs text-stone-600">Publish any one service or combine multiple services. Lunch and dinner selections stay independent; the menu locks after the first order.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void save(false)} disabled={!!saving || loading || !!plan?.isLocked || (!dirty && !plan?.isPublished)}
            className="min-h-11 rounded-xl border border-stone-300 px-5 text-sm font-bold text-stone-700 disabled:opacity-40">
            {saving === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
          <button type="button" onClick={() => void save(true)} disabled={!!saving || loading || !!plan?.isLocked || !hasSelection || (!dirty && !!plan?.isPublished)}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[#0D6E44] px-5 text-sm font-black text-white disabled:opacity-40">
            <Send size={16} /> {saving === 'publish' ? 'Publishing…' : plan?.isPublished ? 'Update published menu' : 'Publish to customers'}
          </button>
        </div>
      </div>
    </section>
  );
};

