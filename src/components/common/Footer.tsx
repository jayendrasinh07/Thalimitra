import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  MapPin, 
  Mail, 
  ShieldCheck, 
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { BRAND_CONFIG } from '../../data/config';

export const Footer: React.FC = () => {
  const { 
    setActiveTab, 
    openLegalModal, 
    setIsAreaCheckerOpen 
  } = useApp();

  // Mobile accordion states (default open or collapsible)
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    explore: false,
    forYou: false,
    help: false
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleNav = (tab: any) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer id="teffein-public-footer" className="bg-[#121815] text-stone-300 pt-12 pb-8 border-t border-stone-800/80 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main 4-Column Layout (Desktop) / Stacked Accordion (Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-8 pb-10 border-b border-stone-800/70">
          
          {/* COLUMN 1 — BRAND (Span 4 on LG) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0D6E44] to-[#08482C] flex items-center justify-center text-white shadow-md shadow-emerald-950/40 shrink-0">
                <span className="font-black text-xl text-amber-300 font-mono">T</span>
              </div>
              <div>
                <span className="font-black text-2xl tracking-tight text-white font-sans block leading-none">
                  Thali<span className="text-emerald-400">mitra</span>
                </span>
                <span className="text-xs text-stone-400 font-medium block mt-1">
                  Khana jo roz apna lage.
                </span>
              </div>
            </div>

            {/* Short Description */}
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed max-w-sm">
              Fresh home-style meals for students, workers and professionals in Gandhinagar.
            </p>

            {/* Primary Action CTA */}
            <div className="pt-1">
              <button
                id="footer-cta-order-meal"
                onClick={() => handleNav('todays_menu')}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D6E44] hover:bg-[#0A5434] active:bg-[#084229] text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/30 hover:shadow-emerald-900/40 transition-all cursor-pointer min-h-[44px]"
              >
                <span>See Menu & Price</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Delivery Area Note */}
            <div className="pt-2 flex items-start gap-2 text-xs text-stone-400 leading-normal">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span>Currently delivering across selected areas of Gandhinagar.</span>{' '}
                <button
                  type="button"
                  onClick={() => setIsAreaCheckerOpen(true)}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 ml-1 cursor-pointer transition-colors"
                >
                  View Delivery Areas
                </button>
              </div>
            </div>

            {/* Compact Support Contact */}
            <div className="pt-2 border-t border-stone-800/60 space-y-1 text-xs">
              <span className="text-stone-400 block font-medium">Need help?</span>
              <div className="flex flex-wrap items-center gap-3 text-stone-300">
                <a
                  href={`mailto:${BRAND_CONFIG.email}`}
                  className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1 text-stone-300"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{BRAND_CONFIG.email}</span>
                </a>
              </div>
            </div>
          </div>

          {/* COLUMN 2 — EXPLORE (Span 3 on LG) */}
          <div className="lg:col-span-3 border-t md:border-t-0 border-stone-800/60 pt-4 md:pt-0">
            {/* Desktop Header */}
            <h4 className="hidden md:block font-bold text-xs uppercase tracking-wider text-white mb-3">
              Explore
            </h4>

            {/* Mobile Collapsible Trigger */}
            <button
              type="button"
              onClick={() => toggleSection('explore')}
              className="md:hidden w-full flex items-center justify-between py-2 text-left font-bold text-xs uppercase tracking-wider text-white cursor-pointer min-h-[44px]"
              aria-expanded={openSections.explore}
            >
              <span>Explore</span>
              {openSections.explore ? (
                <ChevronUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </button>

            {/* Links List */}
            <nav
              aria-label="Explore navigation"
              className={`${openSections.explore ? 'block' : 'hidden'} md:block mt-2 md:mt-0`}
            >
              <ul className="space-y-2.5 text-xs sm:text-sm text-stone-400">
                <li>
                  <button
                    onClick={() => handleNav('home')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNav('todays_menu')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Today's Menu
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNav('how_it_works')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNav('quality_standards')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Food Quality
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNav('why_us')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    About Thalimitra
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          {/* COLUMN 3 — FOR YOU (Span 2 or 3 on LG) */}
          <div className="lg:col-span-2 border-t md:border-t-0 border-stone-800/60 pt-4 md:pt-0">
            {/* Desktop Header */}
            <h4 className="hidden md:block font-bold text-xs uppercase tracking-wider text-white mb-3">
              For You
            </h4>

            {/* Mobile Collapsible Trigger */}
            <button
              type="button"
              onClick={() => toggleSection('forYou')}
              className="md:hidden w-full flex items-center justify-between py-2 text-left font-bold text-xs uppercase tracking-wider text-white cursor-pointer min-h-[44px]"
              aria-expanded={openSections.forYou}
            >
              <span>For You</span>
              {openSections.forYou ? (
                <ChevronUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </button>

            {/* Links List */}
            <nav
              aria-label="Customer categories navigation"
              className={`${openSections.forYou ? 'block' : 'hidden'} md:block mt-2 md:mt-0`}
            >
              <ul className="space-y-2.5 text-xs sm:text-sm text-stone-400">
                <li>
                  <button
                    onClick={() => handleNav('students')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Students & PGs
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNav('workers')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Workers & Employees
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNav('corporate')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    For Companies
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNav('coverage')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Delivery Areas
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNav('todays_menu')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer font-medium text-emerald-400"
                  >
                    See Menu & Price
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          {/* COLUMN 4 — HELP & SUPPORT (Span 3 on LG) */}
          <div className="lg:col-span-3 border-t md:border-t-0 border-stone-800/60 pt-4 md:pt-0">
            {/* Desktop Header */}
            <h4 className="hidden md:block font-bold text-xs uppercase tracking-wider text-white mb-3">
              Help & Support
            </h4>

            {/* Mobile Collapsible Trigger */}
            <button
              type="button"
              onClick={() => toggleSection('help')}
              className="md:hidden w-full flex items-center justify-between py-2 text-left font-bold text-xs uppercase tracking-wider text-white cursor-pointer min-h-[44px]"
              aria-expanded={openSections.help}
            >
              <span>Help & Support</span>
              {openSections.help ? (
                <ChevronUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-stone-400" />
              )}
            </button>

            {/* Links List */}
            <nav
              aria-label="Support navigation"
              className={`${openSections.help ? 'block' : 'hidden'} md:block mt-2 md:mt-0`}
            >
              <ul className="space-y-2.5 text-xs sm:text-sm text-stone-400">
                <li>
                  <button
                    onClick={() => openLegalModal('faq')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    FAQs
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleNav('contact')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Contact Us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openLegalModal('delivery')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Delivery Information
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openLegalModal('refund')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Cancellation & Refund
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openLegalModal('privacy')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openLegalModal('terms')}
                    className="hover:text-emerald-400 transition-colors text-left py-1 cursor-pointer"
                  >
                    Terms & Conditions
                  </button>
                </li>
              </ul>
            </nav>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Subtle Trust / Legal Links */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          
          {/* Copyright & Location */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 text-center md:text-left">
            <span>© 2026 Thalimitra</span>
            <span className="hidden sm:inline">•</span>
            <span>Gandhinagar, Gujarat</span>
            
            {/* Food licence status */}
            <span className="hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1 text-stone-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Food licence verification pending</span>
            </span>
          </div>

          {/* Quick Legal Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-stone-400 text-xs">
            <button
              onClick={() => openLegalModal('privacy')}
              className="hover:text-emerald-400 transition-colors cursor-pointer py-1"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              onClick={() => openLegalModal('terms')}
              className="hover:text-emerald-400 transition-colors cursor-pointer py-1"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button
              onClick={() => openLegalModal('refund')}
              className="hover:text-emerald-400 transition-colors cursor-pointer py-1"
            >
              Cancellation & Refund
            </button>
            <span>•</span>
            <button
              onClick={() => handleNav('contact')}
              className="hover:text-emerald-400 transition-colors cursor-pointer py-1"
            >
              Contact Support
            </button>
          </div>

        </div>

      </div>
    </footer>
  );
};
