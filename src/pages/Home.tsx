import React from 'react';
import { Capacitor } from '@capacitor/core';
import { HomeReturningUserBanner } from '../components/public/HomeReturningUserBanner';
import { HeroSection } from '../components/public/HeroSection';
import { HomeMealSelector } from '../components/public/HomeMealSelector';
import { HomeThreeBenefits } from '../components/public/HomeThreeBenefits';
import { HomeFinalCTA } from '../components/public/HomeFinalCTA';

export const Home: React.FC = () => {
  if (Capacitor.isNativePlatform()) {
    return <HomeMealSelector />;
  }
  return (
    <div className="w-full">
      {/* 0. Optional Compact Returning Customer Bar (only if authenticated customer) */}
      <HomeReturningUserBanner />

      {/* 1. Hero: Roz ka khana. Sahi khana. */}
      <HeroSection />

      {/* 2. Today's Meal: Aaj Thalimitra mein kya mil raha hai? */}
      <HomeMealSelector />

      {/* 3. Why Thalimitra: 3 Key Benefits (Freshly Cooked, Home-Style, Flexible) */}
      <HomeThreeBenefits />

      {/* 4. Final CTA: return to the live menu */}
      <HomeFinalCTA />
    </div>
  );
};
