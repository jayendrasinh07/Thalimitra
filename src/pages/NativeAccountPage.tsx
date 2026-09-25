import { ArrowRight, CalendarDays, CircleHelp, LogOut, MapPin, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAddressCompactLine } from '../utils/addressDisplay';

export const NativeAccountPage = () => {
  const { currentUser, userProfile, savedAddresses, activeDeliveryAddress, isCustomerDataLoading, setActiveTab, setIsAuthModalOpen,
    openLegalModal, signOutUser } = useApp();
  const name = userProfile?.fullName?.trim() || currentUser?.email?.split('@')[0] || 'Your account';

  return <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
    <section className="rounded-3xl bg-[#0D6E44] p-5 text-white shadow-sm">
      <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><UserRound className="h-6 w-6" /></div>
        <div className="min-w-0"><h1 className="truncate text-xl font-black">{currentUser ? name : 'Welcome to Thalimitra'}</h1>
          <p className="truncate text-sm text-emerald-100">{currentUser ? currentUser.email : 'Sign in to save addresses and see orders'}</p></div>
      </div>
      {!currentUser && <button type="button" onClick={() => setIsAuthModalOpen(true)} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white font-bold text-[#0D6E44]">Sign in or create account <ArrowRight className="h-4 w-4" /></button>}
    </section>

    <section aria-label="Your account" className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
      <AccountRow icon={ShoppingBag} label="My orders" detail="Status, help and past meals" onClick={() => setActiveTab('order_history')} />
      <AccountRow icon={CalendarDays} label="Meal plans" detail="Request a routine or track its approval" onClick={() => setActiveTab('meal_plans')} />
      <AccountRow icon={MapPin} label="Delivery addresses" detail={currentUser ? isCustomerDataLoading ? 'Loading your saved addresses…' : savedAddresses.length ? `${savedAddresses.length} saved · ${getAddressCompactLine(activeDeliveryAddress)}` : 'Add your first delivery address' : 'Choose your delivery location'} onClick={() => setActiveTab('delivery_addresses')} />
    </section>

    <section aria-label="Help and information" className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
      <AccountRow icon={CircleHelp} label="Help & support" onClick={() => setActiveTab('contact')} />
      <AccountRow icon={ShieldCheck} label="Privacy policy" onClick={() => openLegalModal('privacy')} />
      <AccountRow icon={ShieldCheck} label="Terms & conditions" onClick={() => openLegalModal('terms')} />
      <AccountRow icon={ShieldCheck} label="Cancellation & refunds" onClick={() => openLegalModal('refund')} />
    </section>

    {currentUser && <button type="button" onClick={() => void signOutUser()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white font-bold text-stone-700"><LogOut className="h-4 w-4" /> Sign out</button>}
    <p className="pb-4 text-center text-xs text-stone-500">Thalimitra · Gandhinagar</p>
  </div>;
};

const AccountRow = ({ icon: Icon, label, detail, onClick }: {
  icon: typeof ShoppingBag; label: string; detail?: string; onClick: () => void;
}) => <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 border-b border-stone-100 px-4 py-3 text-left last:border-b-0">
  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#0D6E44]"><Icon className="h-5 w-5" /></span>
  <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-stone-900">{label}</span>{detail && <span className="block truncate text-xs text-stone-500">{detail}</span>}</span>
  <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
</button>;
