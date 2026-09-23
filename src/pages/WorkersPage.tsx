import React from 'react';
import { useApp } from '../context/AppContext';
import { Briefcase, Clock, ShieldCheck, CheckCircle2, ArrowRight, Flame, MapPin } from 'lucide-react';

export const WorkersPage: React.FC = () => {
  const { setActiveTab, setIsAreaCheckerOpen } = useApp();

  const features = [
    { title: 'Sharp 12:00 PM Sirens', desc: 'Meals arrive before factory break bells ring in Sector 24, 25, 26, 28 GIDC.' },
    { title: 'Substantial Wholesome Portions', desc: '5 heavy Phulkas, dense lentils, and filling seasonal vegetables providing sustained physical energy.' },
    { title: 'Digestive Comfort', desc: 'Prepared with low oil and digestive spices so you don’t feel heavy or fatigued on your second shift.' },
    { title: 'Clear Single-Order Pricing', desc: 'The live meal price and delivery window are shown before checkout, with no subscription required.' }
  ];

  return (
    <div className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header */}
        <div className="bg-gradient-to-br from-stone-900 to-[#14261D] text-white rounded-3xl p-8 sm:p-14 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400 text-stone-950 text-xs font-black">
              <Briefcase className="w-4 h-4" />
              <span>GIDC & Industrial Zones • Sector 24, 25, 26, 28</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Reliable, Heavy, Home-Style Meals for Shift Workers & Technicians
            </h1>

            <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
              No more carrying cold food in the morning or eating oily roadside canteen food. Hot, hygienic home thalis delivered punctually to your plant reception or gate.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setActiveTab('order_once')}
                className="px-8 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs sm:text-sm shadow-md flex items-center gap-2"
              >
                <span>See Published Meals</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsAreaCheckerOpen(true)}
                className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20"
              >
                Check My Factory Area
              </button>
            </div>
          </div>
        </div>

        {/* 4 Feature Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, idx) => (
            <div key={idx} className="bg-[#FAF8F5] p-6 rounded-3xl border border-stone-200 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="font-bold text-sm text-stone-900">{f.title}</h3>
              <p className="text-xs text-stone-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
