import React, { useState } from 'react';
import { useApp, ActiveTab } from '../../context/AppContext';
import { 
  MapPin, 
  Menu as MenuIcon, 
  X, 
  User,
  ArrowRight,
  Crosshair,
  AlertTriangle,
  LogIn,
  LogOut
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    setIsLocationModalOpen,
    activeDeliveryAddress,
    centralLocation,
    locationState,
    detectedLocation,
    userRole,
    subscription,
    oneTimeOrders,
    currentUser,
    userProfile,
    setIsAuthModalOpen,
    signOutUser
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Centralized Header Location Label
  let locationLabel = 'Set location';
  let isGps = centralLocation?.source === 'gps';

  if (centralLocation?.detectionStatus === 'detecting' || locationState === 'detecting' || locationState === 'requesting') {
    locationLabel = 'Detecting location...';
  } else if (centralLocation?.isAddressConfirmed && centralLocation.confirmedAddress) {
    const addr = centralLocation.confirmedAddress;
    locationLabel = addr.label ? `${addr.label} • ${addr.sector || addr.area || 'Gandhinagar'}` : `${addr.sector || addr.area || 'Gandhinagar'}`;
    isGps = addr.source === 'gps';
  } else if (detectedLocation && !centralLocation?.isAddressConfirmed) {
    locationLabel = 'Location detected';
    isGps = true;
  } else if (activeDeliveryAddress && centralLocation?.isAddressConfirmed) {
    locationLabel = `${activeDeliveryAddress.label} • ${activeDeliveryAddress.sector || activeDeliveryAddress.area || 'Gandhinagar'}`;
    isGps = activeDeliveryAddress.source === 'gps';
  }

  // Only show Dashboard button if logged in as customer or admin
  const isCustomerLoggedIn = userRole === 'customer' || userRole === 'admin' || (subscription?.status === 'active' && userRole !== 'guest');

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-stone-200/80 transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* LEFT: Brand Logo + Tagline */}
          <div className="flex items-center min-w-0 shrink-0">
            <button
              id="brand-logo-btn"
              onClick={() => handleNavClick('home')}
              className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none cursor-pointer"
              aria-label="Thalimitra Home"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#0D6E44] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform duration-200 shrink-0">
                <span className="font-black text-lg sm:text-xl tracking-tighter text-amber-300 font-mono">T</span>
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="font-black text-xl sm:text-2xl tracking-tight text-stone-900 leading-none">
                  Thali<span className="text-[#0D6E44]">mitra</span>
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-stone-500 tracking-tight leading-tight mt-0.5 whitespace-nowrap hidden xs:inline-block">
                  Roz ka khana. Sahi khana.
                </span>
              </div>
            </button>
          </div>

          {/* CENTER: Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              id="nav-home"
              onClick={() => handleNavClick('home')}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'home'
                  ? 'text-[#0D6E44] bg-emerald-50 font-bold'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-100/70'
              }`}
            >
              Home
            </button>

            <button
              id="nav-menu"
              onClick={() => handleNavClick('todays_menu')}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'todays_menu'
                  ? 'text-[#0D6E44] bg-emerald-50 font-bold'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-100/70'
              }`}
            >
              Menu
            </button>

            <button
              id="nav-how"
              onClick={() => handleNavClick('how_it_works')}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'how_it_works'
                  ? 'text-[#0D6E44] bg-emerald-50 font-bold'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-100/70'
              }`}
            >
              How It Works
            </button>

            <button
              id="nav-plans"
              onClick={() => handleNavClick('meal_plans')}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'meal_plans'
                  ? 'text-[#0D6E44] bg-emerald-50 font-bold'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-100/70'
              }`}
            >
              Meal Plans
            </button>

            <button
              id="nav-business"
              onClick={() => handleNavClick('corporate')}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'corporate'
                  ? 'text-[#0D6E44] bg-emerald-50 font-bold'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-100/70'
              }`}
            >
              For Business
            </button>
          </nav>

          {/* RIGHT: Desktop Actions (Location + Dashboard + Order Now) */}
          <div className="hidden sm:flex items-center gap-2.5">
            {/* Small Location Chip */}
            <button
              id="location-checker-nav-btn"
              onClick={() => setIsLocationModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-[#0D6E44] text-xs font-semibold border border-stone-200 transition-colors cursor-pointer max-w-[170px] lg:max-w-[200px] truncate"
              title="Click to check or change your delivery location"
            >
              {isGps ? (
                <Crosshair className="w-3.5 h-3.5 text-emerald-600 shrink-0 animate-pulse" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-[#0D6E44] shrink-0" />
              )}
              <span className="truncate">{locationLabel}</span>
            </button>

            {/* Account / Sign In */}
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <button
                  id="nav-dashboard-btn"
                  onClick={() => handleNavClick('customer_dashboard')}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={userProfile?.fullName || currentUser.email || 'My Account'}
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#0D6E44] flex items-center justify-center font-black text-[10px]">
                    {(userProfile?.fullName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate">{userProfile?.fullName?.split(' ')[0] || 'Account'}</span>
                </button>
              </div>
            ) : (
              <button
                id="nav-signin-btn"
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#0D6E44]" />
                <span>Sign In</span>
              </button>
            )}

            {/* Primary Action: Order Now */}
            <button
              id="nav-order-now-btn"
              onClick={() => handleNavClick('todays_menu')}
              className="px-4.5 py-2.5 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 shrink-0"
            >
              <span>See Menu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* MOBILE RIGHT CONTROLS: [ Compact Location ] [ Menu ] (No overlapping Order Now button) */}
          <div className="flex sm:hidden items-center gap-2 min-w-0">
            <button
              id="mobile-location-header-btn"
              onClick={() => setIsLocationModalOpen(true)}
              className="px-2.5 py-1.5 rounded-full bg-stone-100/90 active:bg-emerald-50 text-stone-700 text-[11px] font-bold flex items-center gap-1 border border-stone-200 cursor-pointer max-w-[96px] sm:max-w-[130px] truncate shrink min-w-0"
              aria-label="Set or change delivery location"
            >
              <MapPin className="w-3 h-3 text-[#0D6E44] shrink-0" />
              <span className="truncate">{locationLabel === 'Set location' ? 'Area' : locationLabel}</span>
            </button>

            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-stone-100 active:bg-stone-200 text-stone-700 hover:text-stone-950 focus:outline-none cursor-pointer shrink-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Slide-Down Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 py-5 space-y-4 shadow-xl animate-fadeIn">
          {/* Primary Mobile Action */}
          <button
            id="mobile-menu-order-now-btn"
            onClick={() => handleNavClick('todays_menu')}
            className="w-full py-3.5 rounded-2xl bg-[#0D6E44] active:bg-[#08482C] text-white text-sm font-black shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>🍱</span>
            <span>See Menu & Price</span>
            <ArrowRight className="w-4 h-4 text-amber-300" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleNavClick('home')}
              className={`p-3 rounded-xl text-left text-xs font-bold cursor-pointer transition-colors ${
                activeTab === 'home' ? 'bg-emerald-50 text-[#0D6E44] border border-emerald-200' : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              Home
            </button>

            <button
              onClick={() => handleNavClick('todays_menu')}
              className={`p-3 rounded-xl text-left text-xs font-bold cursor-pointer transition-colors ${
                activeTab === 'todays_menu' ? 'bg-emerald-50 text-[#0D6E44] border border-emerald-200' : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              Today's Menu
            </button>

            <button
              onClick={() => handleNavClick('how_it_works')}
              className={`p-3 rounded-xl text-left text-xs font-bold cursor-pointer transition-colors ${
                activeTab === 'how_it_works' ? 'bg-emerald-50 text-[#0D6E44] border border-emerald-200' : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              How It Works
            </button>

            <button
              onClick={() => handleNavClick('meal_plans')}
              className={`p-3 rounded-xl text-left text-xs font-bold cursor-pointer transition-colors ${
                activeTab === 'meal_plans' ? 'bg-emerald-50 text-[#0D6E44] border border-emerald-200' : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              Meal Plans
            </button>

            <button
              onClick={() => handleNavClick('corporate')}
              className={`p-3 rounded-xl text-left text-xs font-bold cursor-pointer transition-colors ${
                activeTab === 'corporate' ? 'bg-emerald-50 text-[#0D6E44] border border-emerald-200' : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              For Business
            </button>

            <button
              onClick={() => handleNavClick('coverage')}
              className={`p-3 rounded-xl text-left text-xs font-bold cursor-pointer transition-colors ${
                activeTab === 'coverage' ? 'bg-emerald-50 text-[#0D6E44] border border-emerald-200' : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              Delivery Coverage
            </button>
          </div>

          <div className="pt-2 border-t border-stone-100 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setIsLocationModalOpen(true);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-stone-50 hover:bg-emerald-50 text-stone-700 hover:text-[#0D6E44] text-xs font-bold flex items-center justify-between border border-stone-200 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#0D6E44] shrink-0" />
                <span className="truncate">Delivering to: {locationLabel}</span>
              </span>
              <span className="text-[11px] text-[#0D6E44] underline font-bold shrink-0">Change</span>
            </button>

            {isCustomerLoggedIn && (
              <button
                onClick={() => handleNavClick('customer_dashboard')}
                className="w-full py-2.5 rounded-xl bg-stone-100 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <User className="w-4 h-4 text-[#0D6E44]" />
                <span>Customer Dashboard</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
