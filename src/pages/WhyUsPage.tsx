import React from 'react';
import { WhyUsSection } from '../components/public/WhyUsSection';
import { HealthQualitySection } from '../components/public/HealthQualitySection';
import { Check, X, Sparkles, Heart, Clock, DollarSign } from 'lucide-react';

export const WhyUsPage: React.FC = () => {
  return (
    <div className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0D6E44] bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
            The Thalimitra Standard
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-stone-900 mt-4 tracking-tight">
            Why Thalimitra vs The Alternatives
          </h1>
          <p className="text-stone-600 text-base mt-3 leading-relaxed">
            See how Thalimitra solves the daily dilemmas between expensive delivery apps, unhygienic local tiffins, and the stress of daily cooking.
          </p>
        </div>

        {/* 3-Way Comparison Table */}
        <div className="bg-[#FAF8F5] rounded-3xl p-6 sm:p-10 border border-stone-200 shadow-md overflow-x-auto">
          <h3 className="text-xl font-bold text-stone-900 mb-6">Daily Food Options Compared</h3>
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px]">
                <th className="pb-3">Dimension</th>
                <th className="pb-3 text-[#0D6E44] font-black">Thalimitra Daily Plan</th>
                <th className="pb-3">Restaurant Delivery Apps</th>
                <th className="pb-3">Unorganized Local Dabbas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 text-stone-700">
              <tr>
                <td className="py-3 font-bold text-stone-900">Cost per Meal</td>
                <td className="py-3 font-black text-emerald-800 text-sm">₹76 – ₹85 (Free Delivery)</td>
                <td className="py-3 text-stone-600">₹220 – ₹350 + Surge Fees</td>
                <td className="py-3 text-stone-600">₹70 – ₹90 (Inconsistent)</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-stone-900">Oil & Heavy Spices</td>
                <td className="py-3 font-bold text-emerald-800">Controlled cold-pressed oil</td>
                <td className="py-3 text-rose-700">High oil, heavy restaurant cream</td>
                <td className="py-3 text-amber-700">Unregulated palm oil</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-stone-900">Delivery Predictability</td>
                <td className="py-3 font-bold text-emerald-800">Fixed cluster slots (12:00 PM / 7:30 PM)</td>
                <td className="py-3 text-stone-500">Unpredictable 45-60 min wait</td>
                <td className="py-3 text-rose-700">Often late or missed</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-stone-900">Hygiene Records</td>
                <td className="py-3 font-bold text-emerald-800">Documented kitchen checks + QR trace preview</td>
                <td className="py-3 text-stone-500">Varies by restaurant</td>
                <td className="py-3 text-rose-700">No audited standards</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-stone-900">Pause & Skip Feature</td>
                <td className="py-3 font-bold text-emerald-800">1-Tap App Pause with Rollover</td>
                <td className="py-3 text-stone-400">Not Applicable (Per Order)</td>
                <td className="py-3 text-rose-700">Requires daily phone calls/disputes</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Core Benefits */}
        <WhyUsSection />

        {/* Operational Hygiene */}
        <HealthQualitySection />
      </div>
    </div>
  );
};
