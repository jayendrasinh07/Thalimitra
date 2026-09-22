import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Clock3, Coffee, Leaf, Loader2, Moon, RefreshCw, Sun, UtensilsCrossed } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IMAGES } from '../../data/images';
import { checkMealAvailability, getOrderableDates } from '../../services/availabilityEngine';
import { DatabaseDayMenu, DatabaseMeal, dietLabel, formatSlotTime, menuService } from '../../services/menuService';
import { DeliverySlot, ServiceMealType } from '../../types';
import { SmartImage } from '../common/SmartImage';

type ServiceSlot = ServiceMealType;
const services: ServiceSlot[] = ['breakfast', 'lunch', 'dinner'];

const formatDate = (date: string, long = false) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
  weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short',
});

const getInitialSelection = () => {
  const dates = getOrderableDates();
  const today = dates[0]?.dateStr ?? '';
  const candidate = dates.flatMap(item => services.map(slot => ({ date: item.dateStr, slot })))
    .find(({ date, slot }) => checkMealAvailability({ date, mealSlot: slot }).isAvailable);
  return candidate ?? { date: dates[1]?.dateStr ?? today, slot: 'breakfast' as ServiceSlot };
};

export const HomeMealSelector = () => {
  const isNative = Capacitor.isNativePlatform();
  const { setActiveTab, setIsLocationModalOpen } = useApp();
  const dates = useMemo(() => getOrderableDates(), []);
  const initial = useMemo(getInitialSelection, []);
  const [selectedDate, setSelectedDate] = useState(initial.date);
  const [selectedSlot, setSelectedSlot] = useState<ServiceSlot>(initial.slot);
  const [menus, setMenus] = useState<Record<string, DatabaseDayMenu | null>>({});
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loadingMenus, setLoadingMenus] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [menuError, setMenuError] = useState(false);
  const [slotError, setSlotError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  const selectionTouched = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingMenus(true); setMenuError(false);
    menuService.getMenusForDates(dates.map(item => item.dateStr))
      .then(result => {
        if (!active) return;
        setMenus(result);
        if (!selectionTouched.current) {
          const candidate = dates
            .flatMap(item => services.map(slot => ({ date: item.dateStr, slot })))
            .find(({ date, slot }) => {
              const hasMeal = (result[date]?.meals ?? []).some(meal => meal.mealType === slot || (slot !== 'breakfast' && meal.mealType === 'both'));
              return hasMeal && checkMealAvailability({ date, mealSlot: slot }).isAvailable;
            });
          if (candidate) {
            setSelectedDate(candidate.date);
            setSelectedSlot(candidate.slot);
          }
        }
      })
      .catch(() => { if (active) setMenuError(true); })
      .finally(() => { if (active) setLoadingMenus(false); });
    return () => { active = false; };
  }, [dates, reloadKey]);

  useEffect(() => {
    let active = true;
    setLoadingSlots(true); setSlotError(false); setSlots([]);
    menuService.getDeliverySlots(selectedSlot, selectedDate)
      .then(result => { if (active) setSlots(result); })
      .catch(() => { if (active) setSlotError(true); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [selectedDate, selectedSlot, reloadKey]);

  const meals = (menus[selectedDate]?.meals ?? []).filter(meal => meal.mealType === selectedSlot || (selectedSlot !== 'breakfast' && meal.mealType === 'both'));
  const availability = checkMealAvailability({ date: selectedDate, mealSlot: selectedSlot, currentTime: clock });
  const availableSlots = slots.filter(slot => slot.maxCapacity > slot.bookedCount);
  const sortedSlots = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const serviceWindow = sortedSlots.length
    ? `${formatSlotTime(sortedSlots[0].startTime)} – ${formatSlotTime(sortedSlots[sortedSlots.length - 1].endTime)}`
    : selectedSlot === 'breakfast' ? '7:30 AM – 9:00 AM' : selectedSlot === 'lunch' ? '12:00 PM – 1:30 PM' : '7:30 PM – 9:00 PM';
  const cutoff = selectedSlot === 'breakfast' ? 'previous night, 10:00 PM' : selectedSlot === 'lunch' ? '10:30 AM' : '5:30 PM';
  const canOrder = availability.isAvailable && !loadingSlots && !slotError && availableSlots.length > 0;
  const hasAnyPublishedMeal = dates.some(item => (menus[item.dateStr]?.meals?.length ?? 0) > 0);
  const selectedDateIndex = dates.findIndex(item => item.dateStr === selectedDate);
  const selectionHeading = selectedDateIndex === 0
    ? 'Aaj kya khana hai?'
    : selectedDateIndex === 1
      ? 'Kal kya khana hai?'
      : `${formatDate(selectedDate)} ko kya khana hai?`;

  const openFullMenu = () => { setActiveTab('todays_menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startOrder = (meal: DatabaseMeal) => {
    if (!canOrder) return;
    const query = new URLSearchParams({ date: selectedDate, slot: selectedSlot, meal: meal.id });
    window.history.pushState(null, '', `/order?${query}`);
    setActiveTab('order_once');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section id="choose-meal" className={`border-t border-stone-200/80 bg-[#FAF8F5] ${isNative ? 'pb-8 pt-4' : 'pb-12 pt-6 sm:py-12 lg:py-14'}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className={`${isNative ? 'mb-4' : 'mb-5 sm:mb-7'} flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`}>
          <div className="max-w-2xl">
            {!isNative && <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#0D6E44]">
              <UtensilsCrossed className="h-3.5 w-3.5" /> Choose your meal
            </span>}
            <h2 className={`${isNative ? 'text-2xl' : 'mt-3 text-3xl sm:text-4xl'} font-black tracking-tight text-stone-900`}>
              {!loadingMenus && !menuError && !hasAnyPublishedMeal ? 'Fresh meals are coming to Gandhinagar.' : selectionHeading}
            </h2>
            {!isNative && <p className="mt-2 text-sm leading-relaxed text-stone-600 sm:text-base">
              {!loadingMenus && !menuError && !hasAnyPublishedMeal
                ? 'The first Kitchen-published menu, exact prices and delivery times will appear here when ordering opens.'
                : <><span className="sm:hidden">Date aur Breakfast/Lunch/Dinner choose karke exact menu aur price dekhiye.</span><span className="hidden sm:inline">Choose a date and service to see the Kitchen-published menu, exact price and delivery time.</span></>}
            </p>}
          </div>
          {!isNative && hasAnyPublishedMeal && <button id="preview-view-full-menu-btn" type="button" onClick={openFullMenu} className="group inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-black text-[#0D6E44] hover:underline sm:self-auto">
            More dates <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>}
        </div>

        {menuError ? <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-[0_18px_55px_-35px_rgba(28,25,23,0.45)] sm:p-6">
          <StateCard icon={<AlertCircle className="h-9 w-9 text-rose-600" />} title="Menu could not be loaded" detail="Check your connection and try again." action={<button type="button" onClick={() => setReloadKey(value => value + 1)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-sm font-black text-rose-800"><RefreshCw className="h-4 w-4" />Try again</button>} />
        </div> : !loadingMenus && !hasAnyPublishedMeal ? <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-[0_18px_55px_-35px_rgba(28,25,23,0.45)]">
          <div className="flex flex-col items-start gap-5 bg-gradient-to-br from-emerald-50 to-amber-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-[#0D6E44] shadow-sm"><CalendarDays className="h-6 w-6" /></span>
              <div><p className="text-xs font-black uppercase tracking-wider text-[#0D6E44]">Gandhinagar launch</p><h3 className="mt-1 text-xl font-black text-stone-900">Kitchen is preparing the first menu</h3><p className="mt-1 max-w-xl text-sm leading-relaxed text-stone-600">Once it is published, you will see the dish, exact price, order cutoff and delivery time here.</p></div>
            </div>
            <button type="button" onClick={() => setIsLocationModalOpen(true)} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0D6E44] px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#08482C] sm:w-auto"><span>Check delivery area</span><ArrowRight className="h-4 w-4" /></button>
          </div>
        </div> : <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_18px_55px_-35px_rgba(28,25,23,0.45)]">
          <div className="grid gap-6 border-b border-stone-200 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end lg:p-7">
            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3"><StepNumber number="1" label="Select date" /><span className="text-[11px] font-semibold text-stone-500">Next 7 days</span></div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none xl:grid xl:grid-cols-7 xl:gap-2 xl:overflow-visible" aria-label="Meal date">
                {dates.map((item, index) => {
                  const selected = item.dateStr === selectedDate;
                  const published = Boolean(menus[item.dateStr]);
                  return (
                    <button key={item.dateStr} id={`home-menu-date-${item.dateStr}`} type="button" onClick={() => { selectionTouched.current = true; setSelectedDate(item.dateStr); }} aria-pressed={selected}
                      className={`min-w-[104px] shrink-0 rounded-2xl border px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 xl:min-w-0 xl:px-3 ${selected ? 'border-[#0D6E44] bg-[#0D6E44] text-white shadow-md' : 'border-stone-200 bg-[#FAF8F5] text-stone-700 hover:border-emerald-300'}`}>
                      <span className="block text-[10px] font-black uppercase tracking-wide opacity-75">{index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : formatDate(item.dateStr).split(',')[0]}</span>
                      <span className="mt-0.5 block text-sm font-black">{formatDate(item.dateStr).replace(/^\w+,\s*/, '')}</span>
                      {!loadingMenus && published && <span className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${selected ? 'text-emerald-100' : 'text-emerald-700'}`}><CheckCircle2 className="h-3 w-3" />Menu ready</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-3"><StepNumber number="2" label="Select service" /></div>
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-stone-200 bg-stone-100 p-1.5">
                {services.map(slot => {
                  const selected = selectedSlot === slot;
                  const Icon = slot === 'breakfast' ? Coffee : slot === 'lunch' ? Sun : Moon;
                  return (
                    <button key={slot} id={`home-menu-slot-${slot}`} type="button" onClick={() => { selectionTouched.current = true; setSelectedSlot(slot); }} aria-pressed={selected}
                      className={`rounded-xl px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${selected ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}>
                      <span className="flex items-center gap-2 text-sm font-black capitalize"><Icon className={`h-4 w-4 ${slot === 'dinner' ? 'text-indigo-500' : 'text-amber-500'}`} />{slot}</span>
                      <span className="mt-0.5 block pl-6 text-[10px] font-semibold text-stone-500">{slot === 'breakfast' ? '7:30–9:00 AM' : slot === 'lunch' ? '12:00–1:30 PM' : '7:30–9:00 PM'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-[#F7F4EF] p-4 sm:p-6 lg:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-black uppercase tracking-wider text-[#0D6E44]">{formatDate(selectedDate, true)} · {selectedSlot}</p><h3 className="mt-1 text-xl font-black text-stone-900 sm:text-2xl">Kitchen-published choices</h3></div>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold text-stone-600">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5"><Clock3 className="h-3.5 w-3.5 text-[#0D6E44]" />Delivery {serviceWindow}</span>
                <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5">Orders close {cutoff} IST</span>
              </div>
            </div>

            {loadingMenus ? <StateCard icon={<Loader2 className="h-8 w-8 animate-spin text-[#0D6E44]" />} title="Loading the Kitchen menu…" />
              : meals.length === 0 ? <StateCard icon={<CalendarDays className="h-9 w-9 text-stone-400" />} title={`${selectedSlot[0].toUpperCase() + selectedSlot.slice(1)} menu is being prepared`} detail="Nothing appears until the Kitchen publishes this service. Select another day or check again later." />
              : <div className="grid gap-4 lg:grid-cols-2">{meals.map(meal => <div key={meal.id}><MealCard meal={meal} canOrder={canOrder} loadingSlots={loadingSlots} availabilityMessage={!availability.isAvailable ? availability.message : slotError ? 'Delivery availability could not be checked.' : !loadingSlots && availableSlots.length === 0 ? 'This service is currently full.' : ''} onStart={() => startOrder(meal)} /></div>)}</div>}
          </div>
        </div>}
      </div>
    </section>
  );
};

const StepNumber = ({ number, label }: { number: string; label: string }) => <div className="flex items-center gap-2 text-sm font-black text-stone-900"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#0D6E44] text-[11px] text-white">{number}</span>{label}</div>;

const StateCard = ({ icon, title, detail, action }: { icon: ReactNode; title: string; detail?: string; action?: ReactNode }) => <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white px-6 text-center">{icon}<h3 className="mt-3 text-xl font-black text-stone-900">{title}</h3>{detail && <p className="mt-1 max-w-md text-sm leading-relaxed text-stone-600">{detail}</p>}{action}</div>;

const MealCard = ({ meal, canOrder, loadingSlots, availabilityMessage, onStart }: { meal: DatabaseMeal; canOrder: boolean; loadingSlots: boolean; availabilityMessage: string; onStart: () => void }) => (
  <article className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:border-emerald-300 hover:shadow-md">
    <div className="grid h-full sm:grid-cols-[190px_minmax(0,1fr)]">
      <div className="relative h-48 overflow-hidden bg-stone-100 sm:h-full sm:min-h-[238px]"><SmartImage src={meal.imageUrl || IMAGES.hero.thaliSpread} alt={meal.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-stone-950/80 px-2.5 py-1 text-[10px] font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Kitchen published</span></div>
      <div className="flex min-w-0 flex-col p-5">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#0D6E44]"><Leaf className="h-3.5 w-3.5 shrink-0" />{dietLabel(meal.dietType)}</p><h4 className="mt-1.5 text-xl font-black leading-tight text-stone-900">{meal.name}</h4></div><div className="shrink-0 text-right"><span className="block text-2xl font-black leading-none text-stone-900">₹{meal.basePrice}</span><span className="text-[10px] font-semibold text-stone-500">per meal</span></div></div>
        <p className="mt-3 line-clamp-3 flex-1 text-xs leading-relaxed text-stone-600">{meal.description || 'Prepared for the selected Kitchen service.'}</p>
        {availabilityMessage && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">{availabilityMessage}</p>}
        <button type="button" onClick={onStart} disabled={!canOrder} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0D6E44] px-4 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-[#08482C] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none">{loadingSlots ? <Loader2 className="h-4 w-4 animate-spin" /> : <UtensilsCrossed className="h-4 w-4" />}Customize &amp; Continue <ArrowRight className="h-4 w-4" /></button>
      </div>
    </div>
  </article>
);
