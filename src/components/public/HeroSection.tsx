import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  MapPin 
} from 'lucide-react';
import { IMAGES } from '../../data/images';
import { SmartImage } from '../common/SmartImage';

export const HeroSection: React.FC = () => {
  const { 
    setIsLocationModalOpen,
    centralLocation,
    activeDeliveryAddress 
  } = useApp();

  const currentArea = centralLocation?.confirmedAddress?.sector || 
    centralLocation?.confirmedAddress?.area || 
    centralLocation?.area || 
    activeDeliveryAddress?.sector || 
    activeDeliveryAddress?.area || 
    'Gandhinagar';

  return (
    <section className="relative overflow-hidden bg-[#FAF8F5] pb-5 pt-6 sm:pb-10 sm:pt-9 lg:py-10">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-4 left-10 w-80 h-80 bg-amber-100/25 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-7 lg:grid-cols-12 lg:gap-12">
          
          {/* LEFT COLUMN: Copy & Clear CTAs */}
          <div className="space-y-4 text-left lg:col-span-7 lg:space-y-5">
            {/* Subtle Location Context */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-stone-700">
                <MapPin className="w-3.5 h-3.5 text-[#0D6E44] shrink-0" />
                <span>Delivering to <strong className="text-stone-900 font-black">{currentArea}</strong></span>
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="text-[11px] font-bold text-[#0D6E44] hover:text-[#08482C] underline ml-1 cursor-pointer"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-stone-900 tracking-tight leading-[1.08]">
              Khana jo roz <br />
              <span className="text-[#0D6E44]">apna lage.</span>
            </h1>

            {/* Short supporting text */}
            <p className="max-w-lg text-base font-normal leading-relaxed text-stone-600 sm:text-lg">
              <span className="sm:hidden">Menu, exact price aur delivery time pehle dekhiye.</span>
              <span className="hidden sm:inline">Choose a day and Breakfast, Lunch or Dinner. See the Kitchen-published meal, exact price and delivery time before you order.</span>
            </p>

            {/* Action Buttons */}
            <div className="hidden items-stretch gap-3 pt-2 sm:flex sm:flex-row sm:items-center">
              <button
                id="hero-primary-order-btn"
                onClick={() => {
                  document.getElementById('choose-meal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-7 py-3.5 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-base font-black shadow-lg shadow-emerald-950/15 hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>See Menu & Price</span>
                <ArrowRight className="w-5 h-5 text-amber-300 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                id="hero-secondary-menu-btn"
                onClick={() => {
                  setIsLocationModalOpen(true);
                }}
                className="px-6 py-3.5 rounded-2xl bg-white hover:bg-stone-50 text-stone-900 text-base font-bold border border-stone-300 shadow-2xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Check Delivery Area</span>
              </button>
            </div>

            {/* Trust Line */}
            <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm font-medium text-stone-500 sm:flex">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#0D6E44] shrink-0" />
                <span>Kitchen-published menu</span>
              </span>
              <span className="text-stone-300 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#0D6E44] shrink-0" />
                <span>Price before checkout</span>
              </span>
              <span className="text-stone-300 hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#0D6E44] shrink-0" />
                <span>Cancel before cutoff</span>
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN: Large Clean Food Showcase Card (40-45% width) */}
          <div className="relative hidden lg:col-span-5 lg:mt-0 lg:block">
            <div className="relative mx-auto max-w-md bg-white rounded-3xl p-3 sm:p-4 shadow-xl border border-stone-200/90 overflow-hidden group">
              
              {/* Photo Area */}
              <div className="relative h-60 w-full overflow-hidden rounded-2xl bg-stone-100 shadow-inner">
                <SmartImage
                  src={IMAGES.hero.mainThali}
                  alt="Fresh wholesome Indian thali with dal, sabji, rotis, rice, salad and chaas"
                  priority={true}
                  aspectRatio="auto"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Subtle Image Tag */}
                <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-950/80 backdrop-blur-md text-white text-[11px] font-bold border border-white/10 shadow-sm">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Serving Inspiration</span>
                </div>
              </div>

              {/* Clean Information Area below photograph */}
              <div className="pt-3 px-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-black text-stone-900 leading-snug">
                      A balanced Thalimitra-style meal
                    </div>
                    <div className="text-xs text-stone-600 font-medium mt-0.5">
                      The exact dish and price appear only after the Kitchen publishes them.
                    </div>
                  </div>

                  <div className="text-right shrink-0 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                    <span className="text-[10px] uppercase block text-emerald-800 font-bold leading-tight">Changes</span>
                    <span className="text-base font-black text-[#0D6E44] leading-tight">Daily</span>
                  </div>
                </div>

                {/* Bottom Metadata */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 font-medium">
                  <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    Vegetarian options
                  </span>
                  <span>Sample serving</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
