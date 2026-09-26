import { ArrowLeft, CalendarDays, ChevronDown, ClipboardList, House, LocateFixed, MapPin, Menu as MenuIcon, UserRound } from 'lucide-react';
import { useApp, type ActiveTab } from '../../context/AppContext';
import { getAddressPrimaryLine } from '../../utils/addressDisplay';
import { NotificationBell } from '../notifications/NotificationBell';

const tabs: Array<{ id: ActiveTab; label: string; icon: typeof House }> = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'todays_menu', label: 'Menu', icon: MenuIcon },
  { id: 'meal_plans', label: 'Plans', icon: CalendarDays },
  { id: 'order_history', label: 'Orders', icon: ClipboardList },
  { id: 'customer_dashboard', label: 'Account', icon: UserRound },
];

export const NativeNavigation = () => {
  const { activeTab, setActiveTab, setIsLocationModalOpen, centralLocation, activeDeliveryAddress } = useApp();
  const isPrimary = tabs.some(tab => tab.id === activeTab);
  const showLocation = activeTab === 'home' || activeTab === 'todays_menu';
  const confirmedAddress = centralLocation?.confirmedAddress || (activeDeliveryAddress?.id ? activeDeliveryAddress : null);
  const isDetectingLocation = centralLocation?.detectionStatus === 'requesting' || centralLocation?.detectionStatus === 'detecting';
  const hasConfirmedLocation = Boolean(confirmedAddress || centralLocation?.isAddressConfirmed);
  const locationTitle = isDetectingLocation ? 'Finding your location' : confirmedAddress
    ? confirmedAddress.customLabel || confirmedAddress.label || 'Delivery location'
    : hasConfirmedLocation ? 'Delivery location' : 'Choose delivery location';
  const locationDetail = isDetectingLocation ? 'Checking nearby delivery availability…' : confirmedAddress
    ? getAddressPrimaryLine(confirmedAddress)
    : hasConfirmedLocation
      ? centralLocation?.formattedAddress || centralLocation?.sector || centralLocation?.area || 'Gandhinagar'
      : 'Check if we deliver to your address';
  const title = activeTab === 'home' ? 'Thalimitra' : activeTab === 'todays_menu' ? 'Menu' :
    activeTab === 'order_history' ? 'Orders' : activeTab === 'customer_dashboard' ? 'Account' : activeTab === 'delivery_addresses' ? 'Delivery addresses' : activeTab === 'notifications' ? 'Notifications' :
      activeTab === 'order_once' ? 'Place order' : activeTab === 'contact' ? 'Help & support' :
        activeTab === 'meal_plans' || activeTab === 'my_subscription' ? 'Meal plans' :
        activeTab === 'coverage' ? 'Delivery areas' : 'Thalimitra';
  const navigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return <>
    <header className="sticky top-0 z-40 border-b border-stone-100 bg-white/95 px-4 py-2 backdrop-blur-md">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          {!isPrimary && <button type="button" aria-label="Back" onClick={() => activeTab === 'order_once' ? window.dispatchEvent(new Event('thalimitra:native-back')) : navigate('customer_dashboard')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-stone-200 text-stone-800">
            <ArrowLeft className="h-5 w-5" />
          </button>}
          {showLocation ? <button type="button" onClick={() => setIsLocationModalOpen(true)}
            aria-label={`Change delivery location. ${locationTitle}. ${locationDetail}`}
            aria-haspopup="dialog"
            className="flex min-h-12 min-w-0 flex-1 flex-col justify-center rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:opacity-70">
            <span className="flex w-full min-w-0 items-center gap-1.5 leading-5">
              {isDetectingLocation ? <LocateFixed className="h-4 w-4 shrink-0 text-emerald-700 motion-safe:animate-pulse" aria-hidden="true" /> : <MapPin className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />}
              {hasConfirmedLocation && !isDetectingLocation && <span className="shrink-0 text-xs font-medium text-stone-500">Deliver to ·</span>}
              <span className="truncate text-sm font-bold text-stone-900">{locationTitle}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            </span>
            <span className="mt-0.5 block w-full truncate pl-[22px] text-xs leading-4 text-stone-600">{locationDetail}</span>
          </button> : <div className="min-w-0 flex-1">
            <div className="text-lg font-black leading-tight text-stone-900">{title}</div>
          </div>}
          {activeTab !== 'order_once' && <NotificationBell compact />}
        </div>
      </div>
    </header>
    {isPrimary && <nav aria-label="Main app navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.07)] backdrop-blur-md">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => navigate(id)}
          aria-current={activeTab === id ? 'page' : undefined}
          className={`pressable flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-colors duration-200 ${activeTab === id ? 'bg-emerald-50 text-[#0D6E44]' : 'text-stone-500'}`}>
          <Icon className="h-5 w-5" strokeWidth={activeTab === id ? 2.5 : 2} />{label}
        </button>)}
      </div>
    </nav>}
  </>;
};
