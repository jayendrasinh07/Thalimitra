import { Check, MapPin, Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAddressFullLine, getAddressPrimaryLine } from '../utils/addressDisplay';

export const DeliveryAddressesPage = () => {
  const {
    currentUser,
    savedAddresses,
    activeDeliveryAddress,
    isCustomerDataLoading,
    selectDeliveryAddress,
    setDefaultDeliveryAddress,
    deleteDeliveryAddress,
    setIsLocationModalOpen,
    setIsAuthModalOpen,
  } = useApp();

  if (!currentUser) {
    return <div className="mx-auto max-w-2xl px-4 py-6">
      <section className="rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[#0D6E44]"><MapPin className="h-6 w-6" /></span>
        <h1 className="mt-4 text-xl font-black text-stone-950">Keep your delivery addresses ready</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">Sign in to securely view and manage the addresses saved with your account.</p>
        <button type="button" onClick={() => setIsAuthModalOpen(true)} className="mt-5 min-h-12 w-full rounded-2xl bg-[#0D6E44] px-5 text-sm font-black text-white">Sign in</button>
      </section>
    </div>;
  }

  return <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
    <section className="rounded-3xl bg-[#0D6E44] p-5 text-white shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">Delivery profile</p>
      <h1 className="mt-2 text-2xl font-black">Your saved addresses</h1>
      <p className="mt-2 text-sm leading-6 text-emerald-50/90">Choose where your next meal should arrive. The full doorstep details stay visible here.</p>
      <button type="button" onClick={() => setIsLocationModalOpen(true)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white font-black text-[#0D6E44]"><Plus className="h-5 w-5" /> Add a new address</button>
    </section>

    {isCustomerDataLoading ? <section aria-live="polite" className="space-y-3">
      {[0, 1].map(item => <div key={item} className="h-40 animate-pulse rounded-3xl border border-stone-200 bg-white" />)}
    </section> : savedAddresses.length === 0 ? <section className="rounded-3xl border border-dashed border-stone-300 bg-white p-6 text-center">
      <MapPin className="mx-auto h-7 w-7 text-stone-400" />
      <h2 className="mt-3 font-black text-stone-900">No saved address yet</h2>
      <p className="mt-1 text-sm text-stone-500">Add your doorstep once, then select it during checkout.</p>
    </section> : <section aria-label="Saved delivery addresses" className="space-y-3">
      {savedAddresses.map(address => {
        const selected = activeDeliveryAddress?.id === address.id;
        return <article key={address.id} className={`rounded-3xl border bg-white p-4 shadow-sm ${selected ? 'border-emerald-500 ring-1 ring-emerald-100' : 'border-stone-200'}`}>
          <div className="flex items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${selected ? 'bg-emerald-100 text-[#0D6E44]' : 'bg-stone-100 text-stone-600'}`}><MapPin className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-stone-950">{address.customLabel || address.label}</h2>{address.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800"><Star className="h-3 w-3 fill-current" /> Default</span>}{selected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-800"><Check className="h-3 w-3" /> Selected</span>}</div>
              <p className="mt-2 text-sm font-bold leading-5 text-stone-800">{getAddressPrimaryLine(address)}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">{getAddressFullLine(address)}</p>
              {(address.fullName || address.phone) && <p className="mt-2 text-xs font-semibold text-stone-600">{[address.fullName, address.phone].filter(Boolean).join(' · ')}</p>}
              <p className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold ${address.isServiceable ? 'text-emerald-700' : 'text-amber-700'}`}><ShieldCheck className="h-3.5 w-3.5" />{address.isServiceable ? 'Delivery coverage verified' : 'Outside current delivery coverage'}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3">
            <button type="button" disabled={selected} onClick={() => selectDeliveryAddress(address)} className="min-h-10 rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-800 disabled:opacity-50">{selected ? 'Using this address' : 'Use this address'}</button>
            <button type="button" disabled={address.isDefault} onClick={() => void setDefaultDeliveryAddress(address.id)} className="min-h-10 rounded-xl border border-stone-200 px-3 text-xs font-black text-stone-700 disabled:opacity-50">{address.isDefault ? 'Default address' : 'Make default'}</button>
          </div>
          <button type="button" onClick={() => void deleteDeliveryAddress(address.id)} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Remove address</button>
        </article>;
      })}
    </section>}
  </div>;
};
