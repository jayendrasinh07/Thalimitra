import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Sparkles, 
  ArrowRight, 
  Utensils, 
  MapPin, 
  ChefHat, 
  Smile,
  CheckCircle2 
} from 'lucide-react';
import { IMAGES } from '../../data/images';
import { SmartImage } from '../common/SmartImage';

export const HowItWorks: React.FC = () => {
  const { setActiveTab, setIsOrderOnceModalOpen } = useApp();

  const fourSteps = [
    {
      step: '01',
      title: 'Choose your meal',
      desc: 'Choose a Kitchen-published Breakfast, Lunch or Dinner. Review the exact price, then customize available preparation preferences.',
      icon: Utensils,
      image: IMAGES.journey.step1_ingredients,
    },
    {
      step: '02',
      title: 'Choose delivery',
      desc: 'Select your preferred lunch (12:15 PM) or dinner (7:45 PM) slot with free doorstep drop in Gandhinagar.',
      icon: MapPin,
      image: IMAGES.journey.step5_delivery,
    },
    {
      step: '03',
      title: 'We prepare & pack',
      desc: 'Cooked fresh in our Gandhinagar steam kitchen in cold-pressed oil and heat-sealed in leak-proof food trays.',
      icon: ChefHat,
      image: IMAGES.journey.step4_packing,
    },
    {
      step: '04',
      title: 'Enjoy your meal',
      desc: 'Piping hot, wholesome, comforting home-style food delivered on time to your desk, home, or hostel room.',
      icon: Smile,
      image: IMAGES.journey.step6_meal,
    }
  ];

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {fourSteps.map((item) => {
          const IconComp = item.icon;
          return (
            <div
              key={item.step}
              className="bg-[#FAF8F5] rounded-3xl p-6 border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="relative h-44 w-full rounded-2xl overflow-hidden shadow-inner">
                  <SmartImage
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 bg-stone-900/85 backdrop-blur-sm text-white font-mono font-black text-xs px-2.5 py-1 rounded-lg">
                    {item.step}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#0D6E44] flex items-center justify-center">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <h3 className="font-black text-base text-stone-900">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-4">
        <button
          onClick={() => {
            setActiveTab('order_once');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="px-8 py-4 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-sm font-black shadow-lg shadow-emerald-950/20 transition-all inline-flex items-center gap-2 cursor-pointer"
        >
          <span>Order Your First Meal</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
