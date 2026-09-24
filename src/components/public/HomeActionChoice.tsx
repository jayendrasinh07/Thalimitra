import React from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRight, Check } from 'lucide-react';

export const HomeActionChoice: React.FC = () => {
  const { setActiveTab } = useApp();

  return (
    <section className="py-8 sm:py-12 bg-white border-y border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            What do you need today?
          </h2>
          <p className="text-stone-500 text-sm mt-1.5 font-medium">
            Choose the meal format that fits your day in Gandhinagar.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 max-w-6xl mx-auto">
          {/* Card 1: Order Once */}
          <div className="group relative bg-[#FAF8F5] hover:bg-emerald-50/50 rounded-3xl p-6 sm:p-8 border border-stone-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#0D6E44] flex items-center justify-center text-xl font-bold">
                  🍱
                </div>
                <span className="text-xs font-bold text-stone-500 bg-stone-200/70 px-3 py-1 rounded-full">
                  No subscription required
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-stone-900">
                  Order Once
                </h3>
                <p className="text-stone-600 text-sm mt-1">
                  Enjoy a single fresh home-style meal delivered hot to your doorstep.
                </p>
              </div>

              <div className="pt-2 space-y-1.5 text-xs text-stone-600 font-medium">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#0D6E44]" />
                  <span>Choose Breakfast, Lunch or Dinner</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#0D6E44]" />
                  <span>Custom spice & oil preferences</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-stone-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">Live menu pricing</span>
              <button
                id="home-action-order-once"
                onClick={() => {
                  setActiveTab('order_once');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-[#0D6E44] text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Order Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="group relative bg-emerald-50/60 rounded-3xl p-6 sm:p-8 border border-emerald-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between"><div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#0D6E44] flex items-center justify-center text-xl">📅</div><span className="text-xs font-black text-emerald-800 bg-white px-3 py-1 rounded-full">7 · 15 · 30 meals</span></div>
              <div><h3 className="text-xl sm:text-2xl font-black text-stone-900">Regular Meal Plan</h3><p className="text-stone-600 text-sm mt-1">Request a routine for regular breakfast, lunch or dinner.</p></div>
              <div className="pt-2 space-y-1.5 text-xs text-stone-600 font-medium"><div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#0D6E44]" /><span>Address and capacity verified first</span></div><div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#0D6E44]" /><span>No automatic charge</span></div></div>
            </div>
            <div className="pt-6 mt-6 border-t border-emerald-200 flex items-center justify-between"><span className="text-xs font-bold text-stone-700">Approval before payment</span><button id="home-action-meal-plan" onClick={() => { setActiveTab('meal_plans'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-5 py-2.5 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black transition-all flex items-center gap-1.5"><span>View Plans</span><ArrowRight className="w-3.5 h-3.5" /></button></div>
          </div>

          {/* Card 2: Business meals */}
          <div className="group relative bg-[#FAF8F5] hover:bg-emerald-50/50 rounded-3xl p-6 sm:p-8 border border-stone-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold">
                  🏢
                </div>
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  Teams & workplaces
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-stone-900">
                  Meals for Your Team
                </h3>
                <p className="text-stone-600 text-sm mt-1">
                  Discuss scheduled meal service for an office, factory, campus or team.
                </p>
              </div>

              <div className="pt-2 space-y-1.5 text-xs text-stone-600 font-medium">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#0D6E44]" />
                  <span>Service timing based on your workplace</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-[#0D6E44]" />
                  <span>Requirements reviewed before any commitment</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-stone-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">Custom enquiry</span>
              <button
                id="home-action-for-business"
                onClick={() => {
                  setActiveTab('corporate');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-5 py-2.5 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>For Business</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
