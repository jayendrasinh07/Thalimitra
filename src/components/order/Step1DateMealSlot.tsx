import React, { useState } from 'react';
import { 
  Calendar,
  Coffee,
  Sun, 
  Moon, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { AvailabilityCheckResult, DeliverySlot, ServiceMealType } from '../../types';
import { getOrderableDates, THALIMITRA_OPERATIONAL_CONFIG } from '../../services/availabilityEngine';
import { formatSlotTime } from '../../services/menuService';

interface Step1DateMealSlotProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (dateStr: string) => void;
  selectedMealSlot: ServiceMealType;
  onMealSlotChange: (slot: ServiceMealType) => void;
  availability: AvailabilityCheckResult;
  onSelectNextAvailable?: (date: string, slot: ServiceMealType) => void;
  breakfastSlots: DeliverySlot[];
  lunchSlots: DeliverySlot[];
  dinnerSlots: DeliverySlot[];
}

export const Step1DateMealSlot: React.FC<Step1DateMealSlotProps> = ({
  selectedDate,
  onDateChange,
  selectedMealSlot,
  onMealSlotChange,
  availability,
  onSelectNextAvailable,
  breakfastSlots,
  lunchSlots,
  dinnerSlots
}) => {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const orderableDates = getOrderableDates();

  const todayItem = orderableDates[0];
  const tomorrowItem = orderableDates[1];

  const isToday = selectedDate === todayItem?.dateStr;
  const isTomorrow = selectedDate === tomorrowItem?.dateStr;
  const isCustom = !isToday && !isTomorrow;

  // Selected date formatted readable
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const formattedSelectedDate = isToday 
    ? `Today (${todayItem?.subLabel})` 
    : isTomorrow 
    ? `Tomorrow (${tomorrowItem?.subLabel})` 
    : selectedDateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

  const breakfastTimeRange = breakfastSlots.length > 0
    ? `${formatSlotTime(breakfastSlots[0].startTime)} – ${formatSlotTime(breakfastSlots[breakfastSlots.length - 1].endTime)}`
    : '7:30 AM – 9:00 AM';

  // Get summary time range for each service
  const lunchTimeRange = lunchSlots.length > 0 
    ? `${formatSlotTime(lunchSlots[0].startTime)} – ${formatSlotTime(lunchSlots[lunchSlots.length - 1].endTime)}`
    : '12:00 PM – 1:30 PM';
    
  const dinnerTimeRange = dinnerSlots.length > 0
    ? `${formatSlotTime(dinnerSlots[0].startTime)} – ${formatSlotTime(dinnerSlots[dinnerSlots.length - 1].endTime)}`
    : '7:30 PM – 9:00 PM';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Date Selection Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-100 pb-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#0D6E44] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Step 1 of 6
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-1 tracking-tight">
              When would you like your meal?
            </h2>
          </div>
          <span className="text-xs font-semibold text-stone-500">
            Selected: <strong className="text-stone-900">{formattedSelectedDate}</strong>
          </span>
        </div>

        {/* Date Quick Pickers: Today, Tomorrow, Pick Date */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5">
          {/* Today */}
          <button
            type="button"
            id="date-btn-today"
            onClick={() => {
              setShowCustomPicker(false);
              if (todayItem) onDateChange(todayItem.dateStr);
            }}
            className={`p-3 sm:p-4 rounded-2xl text-center font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border ${
              isToday
                ? 'bg-[#0D6E44] text-white border-[#0D6E44] shadow-md shadow-emerald-950/15 scale-[1.02]'
                : 'bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border-stone-200'
            }`}
          >
            <span className="font-black text-sm sm:text-base">Today</span>
            <span className={`text-[11px] ${isToday ? 'text-emerald-100' : 'text-stone-500'}`}>
              {todayItem?.subLabel}
            </span>
          </button>

          {/* Tomorrow */}
          <button
            type="button"
            id="date-btn-tomorrow"
            onClick={() => {
              setShowCustomPicker(false);
              if (tomorrowItem) onDateChange(tomorrowItem.dateStr);
            }}
            className={`p-3 sm:p-4 rounded-2xl text-center font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border ${
              isTomorrow
                ? 'bg-[#0D6E44] text-white border-[#0D6E44] shadow-md shadow-emerald-950/15 scale-[1.02]'
                : 'bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border-stone-200'
            }`}
          >
            <span className="font-black text-sm sm:text-base">Tomorrow</span>
            <span className={`text-[11px] ${isTomorrow ? 'text-emerald-100' : 'text-stone-500'}`}>
              {tomorrowItem?.subLabel}
            </span>
          </button>

          {/* Choose Date */}
          <button
            type="button"
            id="date-btn-custom"
            onClick={() => setShowCustomPicker(!showCustomPicker)}
            className={`col-span-2 p-3 text-center font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer rounded-2xl border sm:col-span-1 sm:p-4 ${
              isCustom || showCustomPicker
                ? 'bg-stone-900 text-white border-stone-900 shadow-md scale-[1.02]'
                : 'bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 border-stone-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-black text-sm sm:text-base">
              <Calendar className="w-3.5 h-3.5" />
              <span>Select Date</span>
            </div>
            <span className={`text-[11px] truncate max-w-full px-1 ${isCustom || showCustomPicker ? 'text-stone-300' : 'text-stone-500'}`}>
              {isCustom ? selectedDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Next 6 Days'}
            </span>
          </button>
        </div>

        {/* Expanded 6-Day Calendar Picker */}
        {showCustomPicker && (
          <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-stone-200 animate-in fade-in zoom-in-95 space-y-2">
            <div className="text-xs font-bold text-stone-700 mb-2">
              Choose an advance delivery date:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {orderableDates.map((d) => {
                const isSelected = selectedDate === d.dateStr;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => {
                      onDateChange(d.dateStr);
                      setShowCustomPicker(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-left border text-xs font-bold transition-all flex flex-col cursor-pointer ${
                      isSelected
                        ? 'bg-[#0D6E44] text-white border-[#0D6E44] shadow-xs'
                        : 'bg-white hover:bg-stone-100 text-stone-800 border-stone-200'
                    }`}
                  >
                    <span className="font-extrabold">{d.label}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-stone-500'}`}>
                      {d.subLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Meal service selection */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col gap-1 border-b border-stone-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
            Choose Meal Type
          </h3>
          <span className="text-xs text-stone-500">
            Cooked fresh in dedicated batch
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <button
            type="button"
            id="meal-slot-breakfast"
            onClick={() => onMealSlotChange('breakfast')}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
              selectedMealSlot === 'breakfast'
                ? 'bg-emerald-50/70 border-[#0D6E44] ring-2 ring-[#0D6E44]/30 shadow-md'
                : 'bg-[#FAF8F5] border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedMealSlot === 'breakfast' ? 'bg-[#0D6E44] text-amber-300' : 'bg-stone-200 text-stone-700'}`}>
                  <Coffee className="w-5 h-5" />
                </div>
                <div><span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">Morning Meal</span><h4 className="text-lg font-black text-stone-900 leading-tight">Breakfast</h4></div>
              </div>
              {selectedMealSlot === 'breakfast' && <span className="bg-[#0D6E44] text-white text-[10px] font-black px-2 py-0.5 rounded-full">Selected</span>}
            </div>
            <div className="mt-4 pt-3 border-t border-stone-200/60 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-stone-600 font-semibold"><Clock className="w-3.5 h-3.5 text-[#0D6E44]" /><span>{breakfastTimeRange}</span></div>
              <span className="block text-[11px] text-stone-500 font-medium">Cutoff: {THALIMITRA_OPERATIONAL_CONFIG.breakfast.cutoffLabel}</span>
            </div>
          </button>

          {/* Lunch Option */}
          <button
            type="button"
            id="meal-slot-lunch"
            onClick={() => onMealSlotChange('lunch')}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
              selectedMealSlot === 'lunch'
                ? 'bg-emerald-50/70 border-[#0D6E44] ring-2 ring-[#0D6E44]/30 shadow-md'
                : 'bg-[#FAF8F5] border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedMealSlot === 'lunch' ? 'bg-[#0D6E44] text-amber-300' : 'bg-stone-200 text-stone-700'
                }`}>
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                    Daytime Meal
                  </span>
                  <h4 className="text-lg font-black text-stone-900 leading-tight">
                    Lunch Service
                  </h4>
                </div>
              </div>

              {selectedMealSlot === 'lunch' && (
                <span className="bg-[#0D6E44] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Selected
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1 border-t border-stone-200/60 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 text-stone-600 font-semibold">
                <Clock className="w-3.5 h-3.5 text-[#0D6E44]" />
                <span>{lunchTimeRange}</span>
              </div>
              <span className="text-[11px] text-stone-500 font-medium">
                Cutoff: {THALIMITRA_OPERATIONAL_CONFIG.lunch.cutoffLabel}
              </span>
            </div>
          </button>

          {/* Dinner Option */}
          <button
            type="button"
            id="meal-slot-dinner"
            onClick={() => onMealSlotChange('dinner')}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
              selectedMealSlot === 'dinner'
                ? 'bg-emerald-50/70 border-[#0D6E44] ring-2 ring-[#0D6E44]/30 shadow-md'
                : 'bg-[#FAF8F5] border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedMealSlot === 'dinner' ? 'bg-[#0D6E44] text-amber-300' : 'bg-stone-200 text-stone-700'
                }`}>
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
                    Evening Meal
                  </span>
                  <h4 className="text-lg font-black text-stone-900 leading-tight">
                    Dinner Service
                  </h4>
                </div>
              </div>

              {selectedMealSlot === 'dinner' && (
                <span className="bg-[#0D6E44] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Selected
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1 border-t border-stone-200/60 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 text-stone-600 font-semibold">
                <Clock className="w-3.5 h-3.5 text-[#0D6E44]" />
                <span>{dinnerTimeRange}</span>
              </div>
              <span className="text-[11px] text-stone-500 font-medium">
                Cutoff: {THALIMITRA_OPERATIONAL_CONFIG.dinner.cutoffLabel}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Operational Cutoff / Availability Status Alert (If slot is not available) */}
      {!availability.isAvailable && (
        <div className="bg-amber-50/90 border border-amber-300/80 rounded-3xl p-5 sm:p-6 shadow-sm animate-in fade-in space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 mt-0.5 font-black">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-amber-950">
                Ordering Window Closed for {selectedMealSlot[0].toUpperCase() + selectedMealSlot.slice(1)} on {formattedSelectedDate}
              </h4>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                {availability.message}
              </p>
            </div>
          </div>

          {/* Quick 1-Click Next Available Slot Suggestion */}
          {availability.nextAvailable && onSelectNextAvailable && (
            <div className="pt-2 border-t border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-amber-900 font-medium">
                Next fresh batch:{' '}
                <strong className="font-black text-stone-900">
                  {availability.nextAvailable.dateLabel} ({availability.nextAvailable.mealSlot[0].toUpperCase() + availability.nextAvailable.mealSlot.slice(1)})
                </strong>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (availability.nextAvailable) {
                    onSelectNextAvailable(
                      availability.nextAvailable.date,
                      availability.nextAvailable.mealSlot
                    );
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>{availability.nextAvailable.actionLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
