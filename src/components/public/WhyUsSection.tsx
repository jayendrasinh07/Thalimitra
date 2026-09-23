import React from 'react';
import { 
  Flame, 
  HeartHandshake, 
  Droplet, 
  CalendarCheck, 
  ShieldCheck, 
  Truck,
  Check
} from 'lucide-react';
import { IMAGES } from '../../data/images';
import { SmartImage } from '../common/SmartImage';

export const WhyUsSection: React.FC = () => {
  const features = [
    {
      icon: Flame,
      title: 'Fresh Every Day',
      desc: 'Cooked fresh twice daily in our Gandhinagar central steam kitchen. Never chilled, reheated, or held overnight.',
      image: IMAGES.journey.step3_cooking,
    },
    {
      icon: HeartHandshake,
      title: 'Home-Style Food',
      desc: '100% whole MP Sharbati wheat phulkas, slow-cooked yellow lentils, traditional sabjis, and digestive spices you can eat 30 days a month.',
      image: IMAGES.hero.warmRotis,
    },
    {
      icon: Droplet,
      title: 'Controlled Oil',
      desc: 'Prepared with measured virgin cold-pressed groundnut oil. Zero palm oil, zero soda, and zero artificial flavor enhancers.',
      image: IMAGES.quality.spicesGrains,
    },
    {
      icon: CalendarCheck,
      title: 'Order Only When Needed',
      desc: 'Choose Breakfast, Lunch or Dinner from the published menu. The exact meal, price and delivery window appear before checkout.',
      image: IMAGES.segments.studentEating,
    },
    {
      icon: ShieldCheck,
      title: 'Hygienic Packing',
      desc: '100% spill-proof, heat-sealed food-grade insulated containers with QR traceability and automated temperature control.',
      image: IMAGES.journey.step4_packing,
    },
    {
      icon: Truck,
      title: 'Reliable Delivery',
      desc: 'Dedicated cluster vans for Gandhinagar sectors, PDPU/DA-IICT college corridors, GIDC factory shifts, and GIFT City.',
      image: IMAGES.journey.step5_delivery,
    }
  ];

  return (
    <section className="py-16 sm:py-20 bg-white border-y border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-900/5 text-[#0D6E44] text-xs font-black uppercase tracking-wider mb-3">
            <span>The Thalimitra Standard</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 tracking-tight leading-tight">
            More than a tiffin. <br />
            <span className="text-[#0D6E44]">A better food routine.</span>
          </h2>
          <p className="text-stone-600 text-sm sm:text-base mt-3 max-w-2xl mx-auto">
            Traditional restaurant apps are made for irregular heavy dining. Thalimitra is engineered specifically as your daily, sustainable nutrition system.
          </p>
        </div>

        {/* 6 Rich Editorial Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, idx) => {
            const IconComp = f.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl bg-[#FAF8F5] border border-stone-200/90 hover:border-emerald-300 transition-all hover:shadow-lg overflow-hidden group flex flex-col justify-between"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white text-[#0D6E44] shadow-xs border border-stone-200/80 flex items-center justify-center group-hover:scale-105 group-hover:bg-[#0D6E44] group-hover:text-white transition-all">
                      <IconComp className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                      0{idx + 1}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-stone-900 mb-2">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">{f.desc}</p>
                </div>

                <div className="px-6 pb-6 pt-2">
                  <div className="h-32 w-full rounded-2xl overflow-hidden border border-stone-200/80">
                    <SmartImage
                      src={f.image}
                      alt={f.title}
                      aspectRatio="auto"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
