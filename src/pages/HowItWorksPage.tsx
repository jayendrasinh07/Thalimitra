import React from 'react';
import { useApp } from '../context/AppContext';
import { HowItWorks } from '../components/public/HowItWorks';
import { 
  CheckCircle2, 
  ChefHat, 
  ThermometerSun, 
  Truck, 
  CalendarCheck, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Droplets,
  RotateCcw
} from 'lucide-react';

export const HowItWorksPage: React.FC = () => {
  const { setActiveTab } = useApp();

  return (
    <div className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0D6E44] bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
            Transparent Operations
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-stone-900 mt-4 tracking-tight">
            How Thalimitra Delivers Daily Perfection
          </h1>
          <p className="text-stone-600 text-base mt-3 leading-relaxed">
            From morning mandi procurement in Gandhinagar to hot steam cooking and cluster delivery at your doorstep.
          </p>
        </div>

        {/* 4 Core Steps Component */}
        <HowItWorks />

        {/* Deep Dive on Kitchen Process */}
        <div className="bg-[#FAF8F5] rounded-3xl p-8 sm:p-12 border border-stone-200">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mb-8 text-center">
            Inside Our Central Steam Kitchen
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-stone-900">1. Fresh 6:00 AM Prep</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Vegetables are triple-washed in RO water and sanitized. Lentils are slow-soaked for 4 hours to eliminate phytic acid and ease digestion.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <ThermometerSun className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-stone-900">2. Steam Sealed at 72°C</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Rotis are tossed fresh on heavy iron tawas and immediately packed in food-grade insulated recyclable trays that trap natural warmth.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-stone-900">3. Route-Optimized Dispatch</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Each van serves a compact cluster (e.g. PDPU-Kudasan or Infocity-GIFT), ensuring delivery times rarely exceed 25 minutes on the road.
              </p>
            </div>
          </div>
        </div>

        {/* Current single-order cutoff policy */}
        <div className="bg-emerald-950 text-white rounded-3xl p-8 sm:p-12 border border-emerald-800 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-300">
              <RotateCcw className="w-4 h-4" />
              <span>Clear ordering windows</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              Breakfast closes at 10:00 PM the previous night. Lunch at 10:30 AM. Dinner at 5:30 PM.
            </h3>
            <p className="text-xs text-stone-300">
              Choose a Kitchen-published meal, see the exact price, and review the delivery window before placing a single order.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('order_once')}
            className="px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs sm:text-sm font-black shadow-xl shrink-0 flex items-center gap-2 transition-all"
          >
            <span>Order a Meal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
