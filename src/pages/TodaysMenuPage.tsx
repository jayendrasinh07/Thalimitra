import React from 'react';
import { Capacitor } from '@capacitor/core';
import { TodaysMenuSection } from '../components/public/TodaysMenuSection';
import { HealthQualitySection } from '../components/public/HealthQualitySection';
import { Sparkles, Utensils, Leaf, CheckCircle2 } from 'lucide-react';

export const TodaysMenuPage: React.FC = () => {
  if (Capacitor.isNativePlatform()) return <TodaysMenuSection />;
  return (
    <div className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#107048] bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
            Published Daily Menu
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-stone-900 mt-4 tracking-tight">
            Fresh Meals Chosen by Our Kitchen
          </h1>
          <p className="text-stone-600 text-base mt-3 leading-relaxed">
            Browse the exact meals and prices published by our Gandhinagar kitchen for the next seven days.
          </p>
        </div>

        {/* Dynamic 7-day Menu */}
        <TodaysMenuSection />

        {/* Nutritional Pillars */}
        <div className="bg-[#FAF8F5] rounded-3xl p-8 sm:p-12 border border-stone-200">
          <h3 className="text-2xl font-bold text-stone-900 text-center mb-8">Our Balanced Plate Philosophy</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-stone-700">
            <div className="bg-white p-5 rounded-2xl border border-stone-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold mb-3">
                <Leaf className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-stone-900 mb-1">High Fiber & Micronutrients</h4>
              <p className="text-stone-500 leading-relaxed">
                Seasonal green vegetables like Bhindi, Gunda, Ringan, and Dudhi prepared with digestive spices (Ajwain, Hing, Cumin).
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold mb-3">
                <Utensils className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-stone-900 mb-1">Pure Plant Protein</h4>
              <p className="text-stone-500 leading-relaxed">
                Gujarati sweet-sour Toor Dal, Kathol (Mung, Chana, Val), and soft Paneer to fulfill daily amino acid requirements.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-stone-900 mb-1">Gut-Friendly Probiotics</h4>
              <p className="text-stone-500 leading-relaxed">
                Daily freshly churned Gujarati Chaas (buttermilk) with roasted jeera to aid smooth digestion through hot Gandhinagar afternoons.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
