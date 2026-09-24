import { ArrowLeft, ClipboardList, House, MapPin, Menu as MenuIcon, UserRound } from 'lucide-react';
import { useApp, type ActiveTab } from '../../context/AppContext';

const tabs: Array<{ id: ActiveTab; label: string; icon: typeof House }> = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'todays_menu', label: 'Menu', icon: MenuIcon },
  { id: 'order_history', label: 'Orders', icon: ClipboardList },
  { id: 'customer_dashboard', label: 'Account', icon: UserRound },
];

export const NativeNavigation = () => {
  const { activeTab, setActiveTab, setIsLocationModalOpen, centralLocation, activeDeliveryAddress } = useApp();
  const isPrimary = tabs.some(tab => tab.id === activeTab);
  const area = centralLocation?.confirmedAddress?.sector || centralLocation?.confirmedAddress?.area ||
    centralLocation?.area || activeDeliveryAddress?.sector || activeDeliveryAddress?.area || 'Set location';
  const title = activeTab === 'home' ? 'Thalimitra' : activeTab === 'todays_menu' ? 'Menu' :
    activeTab === 'order_history' ? 'Orders' : activeTab === 'customer_dashboard' ? 'Account' :
      activeTab === 'order_once' ? 'Place order' : activeTab === 'contact' ? 'Help & support' :
        activeTab === 'meal_plans' || activeTab === 'my_subscription' ? 'Meal plans' :
        activeTab === 'coverage' ? 'Delivery areas' : 'Thalimitra';
  const navigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return <>
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {!isPrimary && <button type="button" aria-label="Back" onClick={() => activeTab === 'order_once' ? window.dispatchEvent(new Event('thalimitra:native-back')) : navigate('customer_dashboard')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-stone-200 text-stone-800">
          <ArrowLeft className="h-5 w-5" />
        </button>}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-black leading-tight text-stone-900">{title}</div>
          {activeTab === 'home' && <div className="text-xs font-semibold text-emerald-800">Roz ka khana. Sahi khana.</div>}
        </div>
        {(activeTab === 'home' || activeTab === 'todays_menu') &&
          <button type="button" onClick={() => setIsLocationModalOpen(true)} aria-label={`Delivery location: ${area}`}
            className="flex min-h-11 max-w-[48%] items-center gap-1.5 rounded-2xl bg-emerald-50 px-3 text-xs font-bold text-emerald-900">
            <MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{area}</span>
          </button>}
      </div>
    </header>
    {isPrimary && <nav aria-label="Main app navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.07)] backdrop-blur-md">
      <div className="mx-auto grid max-w-2xl grid-cols-4">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => navigate(id)}
          aria-current={activeTab === id ? 'page' : undefined}
          className={`pressable flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-colors duration-200 ${activeTab === id ? 'bg-emerald-50 text-[#0D6E44]' : 'text-stone-500'}`}>
          <Icon className="h-5 w-5" strokeWidth={activeTab === id ? 2.5 : 2} />{label}
        </button>)}
      </div>
    </nav>}
  </>;
};
