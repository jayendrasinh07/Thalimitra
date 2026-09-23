import React, { useState } from 'react';
import { 
  Sliders, 
  Plus, 
  Minus, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Utensils, 
  Flame, 
  Heart,
  Info
} from 'lucide-react';
import { DatabaseMeal, DatabaseMealCustomization } from '../../services/menuService';

interface Step3CustomizationProps {
  meal: DatabaseMeal;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  selectedAddons: Record<string, number>;
  onAddonQuantityChange: (addonId: string, quantity: number) => void;
  customizationCatalog: DatabaseMealCustomization[];
  spiceLevel: 'Regular' | 'Less Spicy';
  onSpiceLevelChange: (level: 'Regular' | 'Less Spicy') => void;
  oilLevel: 'Standard' | 'Less Oil (Fit)';
  onOilLevelChange: (level: 'Standard' | 'Less Oil (Fit)') => void;
  dietVariant: string;
  onDietVariantChange: (variant: string) => void;
}

export const Step3Customization: React.FC<Step3CustomizationProps> = ({
  meal,
  quantity,
  onQuantityChange,
  selectedAddons,
  onAddonQuantityChange,
  customizationCatalog,
  spiceLevel,
  onSpiceLevelChange,
  oilLevel,
  onOilLevelChange,
  dietVariant,
  onDietVariantChange
}) => {
  // Add-ons available for the selected meal.
  const displayAddons = customizationCatalog;
  const [showPreparationPreferences, setShowPreparationPreferences] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-100 pb-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#0D6E44] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Step 3 of 6
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-1 tracking-tight">
              Customize Your Meal & Quantity
            </h2>
          </div>
          <span className="text-xs font-bold text-stone-600">
            Selected: <strong className="text-stone-900">{meal.name}</strong> (₹{meal.basePrice}/meal)
          </span>
        </div>

        {/* 1. Meal Quantity Selector (1-20) */}
        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-stone-900">
              Number of Thalis
            </h3>
            <p className="text-xs text-stone-500">
              Individual hygienically packed meal boxes
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-2xl border border-stone-200 shadow-2xs">
            <button
              type="button"
              disabled={quantity <= 1}
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>

            <span className="w-8 text-center text-base font-black text-stone-900 font-mono">
              {quantity}
            </span>

            <button
              type="button"
              disabled={quantity >= 20}
              onClick={() => onQuantityChange(Math.min(20, quantity + 1))}
              className="w-8 h-8 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white flex items-center justify-center font-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Optional preparation preferences */}
      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <button
          type="button"
          id="toggle-preparation-preferences"
          aria-expanded={showPreparationPreferences}
          aria-controls="preparation-preference-options"
          onClick={() => setShowPreparationPreferences(value => !value)}
          className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-stone-50 sm:p-7"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#0D6E44]"><Sliders className="h-5 w-5" /></span>
            <div>
              <h3 className="text-sm font-black text-stone-900 sm:text-base">Need a preparation change?</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">Regular mild and homestyle preparation is selected.</p>
            </div>
          </div>
          <span className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-[#0D6E44]">
            {showPreparationPreferences ? 'Done' : 'Adjust'}
          </span>
        </button>

        {showPreparationPreferences && <div id="preparation-preference-options" className="content-enter grid grid-cols-1 gap-4 border-t border-stone-100 p-5 sm:grid-cols-2 sm:p-7">
          {/* Spice Level */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-stone-700 block">
              Spice Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSpiceLevelChange('Regular')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  spiceLevel === 'Regular'
                    ? 'bg-emerald-50 border-[#0D6E44] text-[#0D6E44] ring-1 ring-[#0D6E44]'
                    : 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:border-stone-300'
                }`}
              >
                🌶️ Regular Mild
              </button>
              <button
                type="button"
                onClick={() => onSpiceLevelChange('Less Spicy')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  spiceLevel === 'Less Spicy'
                    ? 'bg-emerald-50 border-[#0D6E44] text-[#0D6E44] ring-1 ring-[#0D6E44]'
                    : 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:border-stone-300'
                }`}
              >
                🌿 Very Mild (Less Spicy)
              </button>
            </div>
          </div>

          {/* Oil Preference */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-stone-700 block">
              Oil & Ghee Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOilLevelChange('Standard')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  oilLevel === 'Standard'
                    ? 'bg-emerald-50 border-[#0D6E44] text-[#0D6E44] ring-1 ring-[#0D6E44]'
                    : 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:border-stone-300'
                }`}
              >
                ✨ Homestyle Ghee Brush
              </button>
              <button
                type="button"
                onClick={() => onOilLevelChange('Less Oil (Fit)')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                  oilLevel === 'Less Oil (Fit)'
                    ? 'bg-emerald-50 border-[#0D6E44] text-[#0D6E44] ring-1 ring-[#0D6E44]'
                    : 'bg-[#FAF8F5] border-stone-200 text-stone-700 hover:border-stone-300'
                }`}
              >
                💧 Low-Oil (No Ghee)
              </button>
            </div>
          </div>
        </div>}
      </div>

      {/* 3. Add-Ons & Extras (Database Authoritative Prices) */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
              Add-ons & Extras
            </h3>
            <p className="text-xs text-stone-500">
              Freshly prepared side accompaniments
            </p>
          </div>
          <span className="text-xs font-bold text-[#0D6E44] bg-emerald-50 px-2.5 py-1 rounded-full">
            Fresh Today
          </span>
        </div>

        <div className="space-y-3">
          {displayAddons.map((addon) => {
            const currentQty = selectedAddons[addon.id] || 0;
            const isAdded = currentQty > 0;

            return (
              <div
                key={addon.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isAdded
                    ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-300/40 shadow-xs'
                    : 'bg-[#FAF8F5] border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-stone-900 truncate">
                      {addon.name}
                    </h4>
                  </div>
                  <span className="text-xs font-extrabold text-[#0D6E44]">
                    +₹{addon.price}
                  </span>
                </div>

                {/* Counter control */}
                {isAdded ? (
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-stone-200 shadow-2xs shrink-0">
                    <button
                      type="button"
                      onClick={() => onAddonQuantityChange(addon.id, currentQty - 1)}
                      className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-black text-stone-900 font-mono">
                      {currentQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddonQuantityChange(addon.id, currentQty + 1)}
                      className="w-6 h-6 rounded-lg bg-[#0D6E44] text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAddonQuantityChange(addon.id, 1)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-[#0D6E44] border border-emerald-300 text-xs font-black transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs hover:shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
