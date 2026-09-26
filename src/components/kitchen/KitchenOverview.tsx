import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock3,
  Package,
  RefreshCw,
  Soup,
  UtensilsCrossed,
} from 'lucide-react';
import { kitchenMenuService, type KitchenMenuPlan } from '../../services/kitchenMenuService';
import { kitchenService, type KitchenOrder } from '../../services/kitchenService';
import { istDate } from '../../services/availabilityEngine';
import { KitchenShiftControl } from './KitchenShiftControl';
import { DeliveryDayPlanProductionSummary } from './DeliveryDayPlanProductionSummary';
import { DELIVERY_DAY_PLANS_ENABLED } from '../../config/featureFlags';

interface KitchenOverviewProps {
  onOpenCatalog: () => void;
  onOpenMenu: () => void;
  onOpenOrders: () => void;
}

interface OverviewData {
  menu: KitchenMenuPlan;
  orders: KitchenOrder[];
}

const countPortions = (orders: KitchenOrder[]) =>
  orders.reduce(
    (total, order) => total + order.items.reduce((itemTotal, item) => itemTotal + item.quantity, 0),
    0,
  );

export const KitchenOverview = ({ onOpenCatalog, onOpenMenu, onOpenOrders }: KitchenOverviewProps) => {
  const today = useMemo(() => istDate(new Date()), []);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const [menu, breakfastOrders, lunchOrders, dinnerOrders] = await Promise.all([
        kitchenMenuService.get(today),
        kitchenService.list(today, 'breakfast'),
        kitchenService.list(today, 'lunch'),
        kitchenService.list(today, 'dinner'),
      ]);
      setData({ menu, orders: [...breakfastOrders, ...lunchOrders, ...dinnerOrders] });
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load kitchen overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selectedMeals = data?.menu.meals.filter((meal) => meal.selected) ?? [];
  const breakfastMeals = selectedMeals.filter((meal) => meal.mealType === 'breakfast');
  const lunchMeals = selectedMeals.filter((meal) => meal.mealType === 'lunch' || meal.mealType === 'both');
  const dinnerMeals = selectedMeals.filter((meal) => meal.mealType === 'dinner' || meal.mealType === 'both');
  const orders = data?.orders ?? [];
  const activeOrders = orders;
  const confirmed = activeOrders.filter((order) => order.status === 'confirmed').length;
  const preparing = activeOrders.filter((order) => order.status === 'preparing').length;
  const ready = activeOrders.filter((order) => order.status === 'ready').length;

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-stone-200 bg-white">
        <div className="text-center text-stone-500">
          <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-emerald-700" />
          Loading today's kitchen operations…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Overview could not refresh</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => void load()} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Menu status"
          value={data?.menu.isPublished ? 'Published' : 'Draft'}
          detail={`${selectedMeals.length} meals selected`}
          icon={data?.menu.isPublished ? CheckCircle2 : CalendarDays}
          tone={data?.menu.isPublished ? 'green' : 'amber'}
        />
        <MetricCard label="Active orders" value={String(activeOrders.length)} detail={`${countPortions(activeOrders)} portions`} icon={UtensilsCrossed} tone="blue" />
        <MetricCard label="Preparing" value={String(preparing)} detail={`${confirmed} waiting to start`} icon={ChefHat} tone="amber" />
        <MetricCard label="Ready" value={String(ready)} detail="Awaiting dispatch" icon={CheckCircle2} tone="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Today's production</p>
              <h2 className="mt-1 text-xl font-bold text-stone-900">Menu plan</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onOpenCatalog} className="flex items-center gap-2 rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50">
                <Package size={16} /> Meal catalog
              </button>
              <button type="button" onClick={onOpenMenu} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800">
                Daily menu
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MealShift title="Breakfast" cutoff="Previous night 10:00 PM" meals={breakfastMeals.map((meal) => meal.name)} />
            <MealShift title="Lunch" cutoff="Cutoff 10:30 AM" meals={lunchMeals.map((meal) => meal.name)} />
            <MealShift title="Dinner" cutoff="Cutoff 5:30 PM" meals={dinnerMeals.map((meal) => meal.name)} />
          </div>

          {data?.menu.isLocked && (
            <div className="mt-4 flex gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
              This menu is locked because production orders already exist for the day.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Live queue</p>
              <h2 className="mt-1 text-xl font-bold text-stone-900">Order progress</h2>
            </div>
            <button type="button" onClick={() => void load(true)} disabled={refreshing} aria-label="Refresh overview" className="rounded-xl border border-stone-200 p-2.5 text-stone-600 transition hover:bg-stone-50 disabled:opacity-50">
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <QueueRow label="Confirmed" value={confirmed} color="bg-blue-500" />
            <QueueRow label="Preparing" value={preparing} color="bg-amber-500" />
            <QueueRow label="Ready" value={ready} color="bg-emerald-500" />
          </div>

          <button type="button" onClick={onOpenOrders} className="mt-6 w-full rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50">
            Open order queue
          </button>

          {lastUpdated && (
            <p className="mt-3 text-center text-xs text-stone-400">Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
          )}
        </section>
      </div>

      <KitchenShiftControl />
      {DELIVERY_DAY_PLANS_ENABLED && <DeliveryDayPlanProductionSummary />}
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: typeof ChefHat;
  tone: 'green' | 'amber' | 'blue';
}

const toneClasses = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
};

const MetricCard = ({ label, value, detail, icon: Icon, tone }: MetricCardProps) => (
  <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-stone-900">{value}</p>
        <p className="mt-1 text-sm text-stone-500">{detail}</p>
      </div>
      <span className={`rounded-2xl p-3 ${toneClasses[tone]}`}><Icon className="h-5 w-5" /></span>
    </div>
  </div>
);

const MealShift = ({ title, cutoff, meals }: { title: string; cutoff: string; meals: string[] }) => (
  <div className="rounded-2xl bg-stone-50 p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 font-bold text-stone-900"><Soup className="h-4 w-4 text-emerald-700" />{title}</div>
      <span className="text-xs font-medium text-stone-500">{cutoff}</span>
    </div>
    {meals.length > 0 ? (
      <ul className="mt-3 space-y-2 text-sm text-stone-700">
        {meals.map((meal) => <li key={meal} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{meal}</li>)}
      </ul>
    ) : <p className="mt-3 text-sm text-stone-500">No meals selected</p>}
  </div>
);

const QueueRow = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
    <div className="flex items-center gap-3 text-sm font-semibold text-stone-700"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</div>
    <span className="text-lg font-bold text-stone-900">{value}</span>
  </div>
);

