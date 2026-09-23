import React from 'react';
import { useApp } from '../../context/AppContext';
import { GraduationCap, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { IMAGES } from '../../data/images';
import { SmartImage } from '../common/SmartImage';

export const StudentSection: React.FC = () => {
  const { setActiveTab } = useApp();

  const studentFeatures = [
    { title: 'Price Before Checkout', desc: 'See the exact Kitchen-published meal price before placing a single order.' },
    { title: 'Home-Style Meals', desc: 'Clean, light daily Gujarati & North Indian food that keeps you energetic during long study sessions.' },
    { title: 'Order Only When Needed', desc: 'Choose Breakfast, Lunch or Dinner only on the days that fit your classes and budget.' },
    { title: 'Published Daily Menu', desc: 'The real meal, price, cutoff and delivery window are shown before checkout.' },
    { title: 'Address Service Check', desc: 'Confirm delivery availability for your exact PG, hostel or campus location.' },
    { title: 'Simple Single Orders', desc: 'No subscription or long-term commitment is required.' }
  ];

  return (
    <section id="student-section" className="py-16 sm:py-24 bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-[#1A2E24] via-[#0D442C] to-[#082E1E] text-white rounded-3xl p-6 sm:p-10 lg:p-14 shadow-2xl relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-400/30 text-amber-300 text-xs font-black mb-4">
                <GraduationCap className="w-4 h-4" />
                <span>Campus Routine • PDPU • DA-IICT • GNLU • NIFT • IITGN</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                Student life is busy enough. <br />
                <span className="text-amber-300">Food shouldn’t be a hassle.</span>
              </h2>

              <p className="text-stone-200 text-sm sm:text-base mt-4 leading-relaxed">
                Tired of oily canteen snacks or spending ₹250 on restaurant delivery apps every evening? Thalimitra delivers authentic mom-style comfort meals right to your PG gate or hostel reception.
              </p>

              {/* Feature Highlights Grid */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {studentFeatures.map((feat, idx) => (
                  <div key={idx} className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
                      <h4 className="font-bold text-sm text-white">{feat.title}</h4>
                    </div>
                    <p className="text-xs text-stone-200 mt-1 leading-relaxed pl-6">{feat.desc}</p>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <button
                  id="btn-order-student-meal"
                  onClick={() => setActiveTab('order_once')}
                  className="px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-sm font-black shadow-lg shadow-amber-950/20 hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-stone-950" />
                  <span>Order a Student Meal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setActiveTab('todays_menu')}
                  className="px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold border border-white/20 transition-colors cursor-pointer"
                >
                  View Weekly Student Menu
                </button>
              </div>
            </div>

            {/* Right Photo */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/20 h-72 sm:h-96 w-full relative">
                <SmartImage
                  src={IMAGES.segments.studentEating}
                  alt="Students enjoying fresh healthy home meal"
                  aspectRatio="auto"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 right-4 bg-stone-950/80 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 text-xs text-white flex items-center justify-between">
                  <div>
                    <span className="font-bold block">Kudasan & Bhaijipura Corridors</span>
                    <span className="text-stone-300 text-[11px]">Check availability for your exact address</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-bold">Published daily</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
