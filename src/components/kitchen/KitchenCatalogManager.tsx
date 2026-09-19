import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleOff,
  Image as ImageIcon,
  PackagePlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { dietLabel } from '../../services/menuService';
import {
  kitchenCatalogService,
  type KitchenCatalogDietType,
  type KitchenCatalogMeal,
  type KitchenCatalogMealInput,
  type KitchenCatalogMealType,
} from '../../services/kitchenCatalogService';

const emptyMeal = (mealType: KitchenCatalogMealType = 'lunch'): KitchenCatalogMealInput => ({
  name: '',
  description: '',
  imageUrl: '',
  mealType,
  dietType: 'standard_gujarati',
  basePrice: 89,
  isActive: true,
});

const toInput = (meal: KitchenCatalogMeal): KitchenCatalogMealInput => ({
  id: meal.id,
  name: meal.name,
  description: meal.description,
  imageUrl: meal.imageUrl,
  mealType: meal.mealType,
  dietType: meal.dietType,
  basePrice: meal.basePrice,
  isActive: meal.isActive,
});

const mealTypeLabel = (value: KitchenCatalogMealType) =>
  value === 'both' ? 'Lunch & dinner' : value[0].toUpperCase() + value.slice(1);

const catalogSections: Array<{
  mealType: KitchenCatalogMealType;
  title: string;
  description: string;
}> = [
  { mealType: 'breakfast', title: 'Breakfast', description: 'Morning meals for the 7:30–9:00 AM delivery window.' },
  { mealType: 'lunch', title: 'Lunch', description: 'Meals offered only during the lunch service.' },
  { mealType: 'dinner', title: 'Dinner', description: 'Meals offered only during the dinner service.' },
  { mealType: 'both', title: 'Lunch & dinner', description: 'Shared meals that can be selected for either service.' },
];

export const KitchenCatalogManager = () => {
  const [meals, setMeals] = useState<KitchenCatalogMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<KitchenCatalogMealInput | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<KitchenCatalogMeal | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMeals(await kitchenCatalogService.list());
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('en-IN');
    return term
      ? meals.filter(meal => `${meal.name} ${dietLabel(meal.dietType)} ${meal.mealType}`.toLocaleLowerCase('en-IN').includes(term))
      : meals;
  }, [meals, query]);

  const sections = useMemo(() => catalogSections.map(section => ({
    ...section,
    meals: filtered.filter(meal => meal.mealType === section.mealType),
  })), [filtered]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const next = await kitchenCatalogService.save(editor);
      setMeals(next);
      setNotice(editor.id ? 'Meal updated. New customer orders will use the latest catalog details.' : 'Meal added to the catalog. It is ready for Daily Menu selection.');
      setEditor(null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const archiveMeal = async () => {
    if (!archiveTarget || archiving) return;
    setArchiving(true);
    setError('');
    setNotice('');
    try {
      setMeals(await kitchenCatalogService.archive(archiveTarget.id));
      setNotice(`“${archiveTarget.name}” was removed from the catalog. Existing orders remain unchanged.`);
      setArchiveTarget(null);
    } catch (caught) {
      setError((caught as Error).message);
      setArchiveTarget(null);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <section aria-label="Meal catalog" className="space-y-5">
      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Master catalog</p>
            <h2 className="mt-1 text-2xl font-black text-stone-900">Meals and prices</h2>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">Add meals here, edit their price and details, or pause availability. Existing orders always keep the name and price captured at checkout.</p>
          </div>
          <button type="button" onClick={() => { setEditor(emptyMeal()); setNotice(''); }}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[#0D6E44] px-5 text-sm font-black text-white transition hover:bg-[#095535]">
            <PackagePlus size={18} /> Add meal
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-5">
          <label className="relative min-w-[240px] flex-1 sm:max-w-md">
            <span className="sr-only">Search meals</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search meal or style"
              className="min-h-11 w-full rounded-xl border border-stone-200 pl-10 pr-3 text-sm outline-none focus:border-emerald-600" />
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500"><b className="text-stone-900">{meals.filter(meal => meal.isActive).length}</b> active · {meals.length} total</span>
            <button type="button" onClick={() => void load()} disabled={loading}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700 disabled:opacity-50">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertCircle size={20} className="shrink-0" /><p>{error}</p></div>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{notice}</p>}

      {loading && meals.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">Loading meal catalog…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center text-sm text-stone-500">No meals match this search.</div>
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <section key={section.mealType} aria-labelledby={`catalog-${section.mealType}`} className="rounded-3xl border border-stone-200 bg-stone-50/70 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 id={`catalog-${section.mealType}`} className="text-xl font-black text-stone-900">{section.title}</h3>
                  <p className="mt-1 text-xs text-stone-500">{section.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-600">{section.meals.length} meals</span>
                  <button type="button" onClick={() => { setEditor(emptyMeal(section.mealType)); setNotice(''); }}
                    className="min-h-10 rounded-xl border border-emerald-700 bg-white px-3 text-xs font-black text-emerald-800 hover:bg-emerald-50">
                    Add {section.title}
                  </button>
                </div>
              </div>
              {section.meals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">No {section.title.toLocaleLowerCase('en-IN')} meals in this section.</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {section.meals.map(meal => (
                    <article key={meal.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${meal.isActive ? 'border-stone-200' : 'border-stone-300 opacity-75'}`}>
              {meal.imageUrl ? <img src={meal.imageUrl} alt="" className="h-36 w-full object-cover" /> : (
                <div className="flex h-28 items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 text-emerald-700"><ImageIcon size={30} /></div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-stone-900">{meal.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-stone-500">{mealTypeLabel(meal.mealType)} · {dietLabel(meal.dietType)}</p>
                  </div>
                  <b className="shrink-0 text-lg text-[#0D6E44]">₹{meal.basePrice.toFixed(2)}</b>
                </div>
                {meal.description && <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-relaxed text-stone-600">{meal.description}</p>}
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meal.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                    {meal.isActive ? <CheckCircle2 size={14} /> : <CircleOff size={14} />}{meal.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setEditor(toInput(meal)); setNotice(''); }} className="flex min-h-10 items-center gap-2 rounded-lg border border-stone-200 px-3 text-sm font-bold text-stone-700 hover:bg-stone-50"><Pencil size={15} /> Edit</button>
                    <button type="button" onClick={() => { setArchiveTarget(meal); setNotice(''); }} aria-label={`Delete ${meal.name}`} className="flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700 hover:bg-red-50"><Trash2 size={15} /> Delete</button>
                  </div>
                </div>
              </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setEditor(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="meal-editor-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-6">
              <div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Meal catalog</p><h2 id="meal-editor-title" className="text-xl font-black text-stone-900">{editor.id ? 'Edit meal' : 'Add new meal'}</h2></div>
              <button type="button" onClick={() => setEditor(null)} disabled={saving} aria-label="Close meal editor" className="rounded-xl border border-stone-200 p-2.5 text-stone-600"><X size={20} /></button>
            </div>
            <form onSubmit={save} className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm font-bold text-stone-700">Meal name
                  <input required minLength={3} maxLength={120} value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-600" placeholder="e.g. Gujarati Executive Thali" />
                </label>
                <label className="text-sm font-bold text-stone-700">Service
                  <select value={editor.mealType} onChange={event => setEditor({ ...editor, mealType: event.target.value as KitchenCatalogMealType })} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-normal">
                    <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="both">Lunch & dinner</option>
                  </select>
                </label>
                <label className="text-sm font-bold text-stone-700">Meal style
                  <select value={editor.dietType} onChange={event => setEditor({ ...editor, dietType: event.target.value as KitchenCatalogDietType })} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 font-normal">
                    {(['standard_gujarati', 'jain_satvik', 'kathiyawadi', 'low_oil_fit', 'north_indian'] as const).map(value => <option key={value} value={value}>{dietLabel(value)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-bold text-stone-700">Price (₹)
                  <input required type="number" min="0.01" max="10000" step="0.01" value={editor.basePrice} onChange={event => setEditor({ ...editor, basePrice: Number(event.target.value) })} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-600" />
                </label>
                <label className="flex min-h-[70px] items-center justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-700">
                  <span><span className="block">Available to use</span><span className="mt-1 block text-xs font-normal text-stone-500">Inactive meals cannot be added to a daily menu.</span></span>
                  <input type="checkbox" checked={editor.isActive} onChange={event => setEditor({ ...editor, isActive: event.target.checked })} className="h-5 w-5 accent-emerald-700" />
                </label>
                <label className="sm:col-span-2 text-sm font-bold text-stone-700">Description
                  <textarea maxLength={1000} rows={4} value={editor.description} onChange={event => setEditor({ ...editor, description: event.target.value })} className="mt-2 w-full rounded-xl border border-stone-200 p-3 font-normal outline-none focus:border-emerald-600" placeholder="What is included in this meal?" />
                </label>
                <label className="sm:col-span-2 text-sm font-bold text-stone-700">Image URL <span className="font-normal text-stone-400">(optional)</span>
                  <input type="url" maxLength={2048} pattern="https://.*" value={editor.imageUrl} onChange={event => setEditor({ ...editor, imageUrl: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 font-normal outline-none focus:border-emerald-600" placeholder="https://…" />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-5">
                <p className="max-w-md text-xs leading-relaxed text-stone-500">Catalog updates affect future checkouts. Orders already placed retain their captured meal name, preferences, add-ons, and price.</p>
                <div className="flex gap-2"><button type="button" onClick={() => setEditor(null)} disabled={saving} className="min-h-11 rounded-xl border border-stone-300 px-5 text-sm font-bold text-stone-700">Cancel</button><button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-[#0D6E44] px-5 text-sm font-black text-white disabled:opacity-50">{saving ? 'Saving…' : editor.id ? 'Save changes' : 'Add meal'}</button></div>
              </div>
            </form>
          </div>
        </div>
      )}

      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !archiving) setArchiveTarget(null); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="archive-meal-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700"><Trash2 size={22} /></div>
            <h2 id="archive-meal-title" className="mt-4 text-xl font-black text-stone-900">Delete this meal?</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600"><strong>{archiveTarget.name}</strong> will disappear from the catalog and future menu selection. Existing orders and their saved meal details will remain safe.</p>
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">If this meal is on a published current or future menu, remove it from that menu first.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setArchiveTarget(null)} disabled={archiving} className="min-h-11 rounded-xl border border-stone-300 px-5 text-sm font-bold text-stone-700">Cancel</button>
              <button type="button" onClick={() => void archiveMeal()} disabled={archiving} className="min-h-11 rounded-xl bg-red-700 px-5 text-sm font-black text-white disabled:opacity-50">{archiving ? 'Deleting…' : 'Delete meal'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

