import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Coffee,
  Leaf,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
  UtensilsCrossed,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IMAGES } from '../../data/images';
import { addCalendarDays, istDate } from '../../services/availabilityEngine';
import { DatabaseDayMenu, dietLabel, menuService } from '../../services/menuService';
import { ServiceMealType } from '../../types';
import { SmartImage } from '../common/SmartImage';

const dateLabel = (date: string, long = false) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: long ? 'long' : 'short',
    day: 'numeric',
    month: long ? 'long' : 'short',
  });

export const TodaysMenuSection = () => {
  const { setActiveTab } = useApp();
  const today = useMemo(() => istDate(), []);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addCalendarDays(today, index)), [today]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<ServiceMealType>('breakfast');
  const [menus, setMenus] = useState<Record<string, DatabaseDayMenu | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    menuService.getMenusForDates(dates)
      .then(result => {
        if (active) setMenus(result);
      })
      .catch(() => {
        if (active) setError('Published menu could not be loaded. Please try again.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dates, reloadKey]);

  const selectedMenu = menus[selectedDate];
  const meals = (selectedMenu?.meals ?? []).filter(
    meal => meal.mealType === selectedSlot || (selectedSlot !== 'breakfast' && meal.mealType === 'both'),
  );

  const startOrder = () => {
    setActiveTab('order_once');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section id="todays-menu-section" className="scroll-mt-24 py-16 sm:py-20 bg-white border-y border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-9">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-[#0D6E44] bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
              Live Kitchen Menu
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 mt-3 tracking-tight">
              {dateLabel(selectedDate, true)} {selectedSlot[0].toUpperCase() + selectedSlot.slice(1)}
            </h2>
            <p className="text-stone-600 text-sm sm:text-base mt-2 max-w-xl">
              Every meal and price below is published directly by the Thalimitra kitchen.
            </p>
          </div>

          <div className="flex items-center p-1.5 rounded-2xl bg-stone-100 border border-stone-200 self-start md:self-auto shrink-0">
            {(['breakfast', 'lunch', 'dinner'] as ServiceMealType[]).map(slot => {
              const Icon = slot === 'breakfast' ? Coffee : slot === 'lunch' ? Sun : Moon;
              return (
                <button
                  key={slot}
                  id={`menu-toggle-${slot}`}
                  onClick={() => setSelectedSlot(slot)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    selectedSlot === slot
                      ? 'bg-white text-[#0D6E44] shadow-sm font-black'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${slot === 'dinner' ? 'text-indigo-500' : 'text-amber-500'}`} />
                  <span className="capitalize">{slot}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-stretch gap-2.5 overflow-x-auto pb-4 mb-7 scrollbar-none">
          {dates.map((date, index) => {
            const isSelected = date === selectedDate;
            const isPublished = Boolean(menus[date]);
            return (
              <button
                key={date}
                id={`menu-date-${date}`}
                onClick={() => setSelectedDate(date)}
                className={`px-4 py-3 rounded-2xl border transition-all shrink-0 min-w-[112px] cursor-pointer text-left ${
                  isSelected
                    ? 'border-emerald-700 bg-[#0D6E44] text-white shadow-md shadow-emerald-950/20'
                    : 'border-stone-200 bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 hover:border-stone-300'
                }`}
              >
                <span className="block text-[11px] font-bold uppercase tracking-wide opacity-75">
                  {index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : dateLabel(date).split(',')[0]}
                </span>
                <span className="block text-sm font-black mt-0.5">{dateLabel(date).replace(/^\w+,\s*/, '')}</span>
                {!isLoading && (
                  <span className={`block text-[10px] font-bold mt-1 ${isSelected ? 'text-emerald-100' : isPublished ? 'text-emerald-700' : 'text-stone-400'}`}>
                    {isPublished ? 'Published' : 'Awaiting menu'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="min-h-64 rounded-3xl border border-stone-200 bg-[#FAF8F5] flex flex-col items-center justify-center text-stone-600">
            <Loader2 className="w-7 h-7 animate-spin text-[#0D6E44]" />
            <p className="mt-3 text-sm font-bold">Loading the kitchen's published menu…</p>
          </div>
        ) : error ? (
          <div className="min-h-64 rounded-3xl border border-red-200 bg-red-50 flex flex-col items-center justify-center text-center px-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <p className="mt-3 text-sm font-bold text-red-900">{error}</p>
            <button
              onClick={() => setReloadKey(value => value + 1)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white border border-red-200 px-4 py-2.5 text-sm font-black text-red-800 hover:bg-red-100"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        ) : meals.length === 0 ? (
          <div className="min-h-64 rounded-3xl border border-stone-200 bg-[#FAF8F5] flex flex-col items-center justify-center text-center px-6">
            <CalendarDays className="w-9 h-9 text-stone-400" />
            <h3 className="mt-3 text-xl font-black text-stone-900">
              {selectedSlot[0].toUpperCase() + selectedSlot.slice(1)} menu is being prepared
            </h3>
            <p className="mt-1 text-sm text-stone-600 max-w-md">
              The kitchen has not published meals for this service yet. Please check again soon or select another day.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {meals.map(meal => (
              <article key={meal.id} className="overflow-hidden rounded-3xl bg-[#FAF8F5] border border-stone-200 shadow-sm flex flex-col">
                <div className="relative h-52 bg-stone-100 overflow-hidden">
                  <SmartImage
                    src={meal.imageUrl || IMAGES.hero.thaliSpread}
                    alt={meal.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 bg-stone-950/80 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-full">
                    Kitchen published
                  </span>
                </div>

                <div className="p-5 sm:p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-[#0D6E44] flex items-center gap-1.5">
                        <Leaf className="w-3.5 h-3.5" /> {dietLabel(meal.dietType)}
                      </p>
                      <h3 className="text-xl font-black text-stone-900 mt-1.5">{meal.name}</h3>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-2xl font-black text-stone-900">₹{meal.basePrice}</span>
                      <span className="text-[10px] font-bold text-stone-500">per meal</span>
                    </div>
                  </div>

                  <p className="text-sm text-stone-600 leading-relaxed mt-3 flex-1">
                    {meal.description || 'Freshly prepared by the Thalimitra kitchen.'}
                  </p>

                  <button
                    onClick={startOrder}
                    className="mt-5 w-full rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white px-5 py-3.5 text-sm font-black flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <UtensilsCrossed className="w-4 h-4" /> Start order <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
