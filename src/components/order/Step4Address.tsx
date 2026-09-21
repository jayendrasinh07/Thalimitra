import React, { useEffect, useState } from 'react';
import { 
  MapPin, 
  Home, 
  Building2, 
  Plus, 
  Check, 
  ShieldCheck, 
  AlertCircle, 
  Phone, 
  User, 
  Navigation, 
  Sparkles, 
  Search,
  CheckCircle2,
  X
} from 'lucide-react';
import { CustomerAddress, AddressLabel, DeliveryInstructionPreset } from '../../types';
import { checkAreaServiceability } from '../../services/locationService';
import { useApp } from '../../context/AppContext';

interface Step4AddressProps {
  selectedAddress: CustomerAddress;
  onSelectAddress: (addr: CustomerAddress) => void;
  savedAddresses?: CustomerAddress[];
  addressEntryRequest?: number;
}

export const Step4Address: React.FC<Step4AddressProps> = ({
  selectedAddress,
  onSelectAddress,
  savedAddresses = [],
  addressEntryRequest = 0
}) => {
  const { 
    saveDeliveryAddress, 
    detectUserLocation, 
    locationState,
    setIsLocationModalOpen,
    centralLocation,
    currentUser,
    setIsAuthModalOpen
  } = useApp();

  const [showAddForm, setShowAddForm] = useState(false);

  // New address form state
  const [newLabel, setNewLabel] = useState<AddressLabel>('Home');
  const [newName, setNewName] = useState(selectedAddress.fullName || '');
  const [newPhone, setNewPhone] = useState(selectedAddress.phone || '');
  const [newHouseNumber, setNewHouseNumber] = useState('');
  const [newBuilding, setNewBuilding] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  const [newInstructionPreset, setNewInstructionPreset] = useState<DeliveryInstructionPreset>('call_on_reach');
  const [newCustomInstruction, setNewCustomInstruction] = useState('');
  const [formError, setFormError] = useState('');

  const activeAddressList = savedAddresses;
  const [isSaving, setIsSaving] = useState(false);

  const startAddressFlow = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setShowAddForm(true);
  };

  useEffect(() => {
    if (addressEntryRequest > 0 && currentUser && activeAddressList.length === 0) setShowAddForm(true);
  }, [addressEntryRequest, currentUser, activeAddressList.length]);

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim() || (!newHouseNumber.trim() && !newBuilding.trim())) {
      setFormError('Please enter your name, phone number, and house/building details.');
      return;
    }

    if(!newArea.trim()||!/^\d{6}$/.test(newPincode.trim())){setFormError('Enter your actual area and a six-digit pincode.');return;}
    let finalInstruction = '';
    switch (newInstructionPreset) {
      case 'call_on_reach':
        finalInstruction = 'Call on arrival';
        break;
      case 'leave_at_security':
        finalInstruction = 'Leave with security guard / front desk';
        break;
      case 'ring_bell':
        finalInstruction = 'Ring doorbell';
        break;
      case 'deliver_at_reception':
        finalInstruction = 'Deliver at office reception';
        break;
      case 'custom':
        finalInstruction = newCustomInstruction.trim();
        break;
    }

    const fullLineParts = [
      newHouseNumber.trim(),
      newBuilding.trim(),
      newLandmark.trim() ? `Near ${newLandmark.trim()}` : '',
      newArea.trim(),
      'Gandhinagar'
    ].filter(Boolean);

    const fullAddress = fullLineParts.join(', ');

    const newAddr: CustomerAddress = {
      id: 'addr-' + Date.now(),
      label: newLabel,
      fullName: newName.trim(),
      name: newName.trim(),
      phone: newPhone.trim(),
      houseNumber: newHouseNumber.trim() || undefined,
      building: newBuilding.trim() || undefined,
      addressLine: fullAddress,
      addressLine1: fullAddress,
      area: newArea.trim(),
      sector: newArea.trim(),
      landmark: newLandmark.trim() || undefined,
      city: 'Gandhinagar',
      state: 'Gujarat',
      pincode: newPincode.trim(),
      clusterId: '',
      clusterName: '',
      zoneId: undefined,
      deliveryFee: 0,
      instructions: finalInstruction,
      instructionPreset: newInstructionPreset,
      isServiceable: false
    };

    if(isSaving)return;
    setIsSaving(true);
    try {const saved=await saveDeliveryAddress(newAddr as any);onSelectAddress({...saved,addressLine:saved.addressLine??saved.addressLine1});}
    catch(error){setFormError((error as Error).message);return;}
    finally{setIsSaving(false);}
    setShowAddForm(false);
    setFormError('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div id="order-address-panel" className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-100 pb-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#0D6E44] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Step 4 of 6
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-1 tracking-tight">
              Where should we deliver?
            </h2>
          </div>
          {(activeAddressList.length > 0 || showAddForm) && (
            <button
              id="add-delivery-address-btn"
              type="button"
              onClick={() => showAddForm ? setShowAddForm(false) : startAddressFlow()}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0D6E44] border border-emerald-200 text-xs font-black transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{showAddForm ? 'Cancel' : currentUser ? 'Add New Address' : 'Sign In to Add Address'}</span>
            </button>
          )}
        </div>

        {/* 1. Saved Addresses List */}
        {!showAddForm && (
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-stone-700 block">
              {activeAddressList.length > 0 ? 'Saved Delivery Addresses' : 'Delivery Address'}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeAddressList.length===0 && (
                <div className="sm:col-span-2 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="rounded-2xl bg-[#0D6E44] p-3 text-white shadow-sm">
                        {currentUser ? <MapPin className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Next: confirm delivery</p>
                        <h3 className="mt-1 text-lg font-black tracking-tight text-stone-900">
                          {currentUser ? 'Check delivery at your doorstep' : 'Save your meal. Add your delivery address.'}
                        </h3>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-stone-600">
                          {currentUser
                            ? 'Add your exact address. We will confirm availability and the delivery fee before you choose a slot.'
                            : 'Sign in once to keep this meal selected, save your address and check whether we deliver to your doorstep.'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-stone-700">
                          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Exact area check</span>
                          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Meal selection stays here</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={startAddressFlow} className="min-h-12 shrink-0 rounded-xl bg-[#0D6E44] px-5 text-sm font-black text-white shadow-md shadow-emerald-950/15 transition hover:bg-[#08482C]">
                      {currentUser ? 'Add delivery address' : 'Sign in & continue'}
                    </button>
                  </div>
                </div>
              )}
              {activeAddressList.map((addr) => {
                const isSelected = selectedAddress.id === addr.id;

                return (
                  <div
                    key={addr.id}
                    onClick={() => onSelectAddress(addr)}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/70 border-[#0D6E44] ring-2 ring-[#0D6E44]/25 shadow-sm'
                        : 'bg-[#FAF8F5] border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                          <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-[#0D6E44]' : 'text-stone-500'}`} />
                          <span>{addr.label}</span>
                        </span>

                        {isSelected && (
                          <span className="bg-[#0D6E44] text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Delivering Here</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-700 font-medium line-clamp-2 leading-snug">
                        {addr.addressLine || `${addr.houseNumber || ''} ${addr.building || ''}, ${addr.area}, Gandhinagar`}
                      </p>

                      <div className="text-[11px] text-stone-500 flex items-center gap-2">
                        <span>{addr.fullName}</span>
                        <span>•</span>
                        <span>{addr.phone}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[10px] text-stone-500 font-semibold">
                      <span className="text-[#0D6E44] font-black flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{addr.isServiceable ? "Within delivery coverage" : "Outside delivery coverage"}</span>
                      </span>
                      <span>Fee shown in order review</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Add New Address Form */}
        {showAddForm && (
          <form onSubmit={handleSaveNewAddress} className="space-y-4 pt-2">
            <div className="bg-[#FAF8F5] rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#0D6E44]" />
                  <span>Enter Delivery Location Details</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="text-xs font-bold text-[#0D6E44] underline cursor-pointer"
                >
                  Pinpoint on Map
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Label selector */}
              <div className="flex items-center gap-2">
                {(['Home', 'Office', 'PG', 'Other'] as AddressLabel[]).map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setNewLabel(lbl)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      newLabel === lbl
                        ? 'bg-[#0D6E44] text-white shadow-2xs'
                        : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-stone-600 block mb-1">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Aarav Patel"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/30"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-stone-600 block mb-1">
                    Phone Number (for delivery call) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. 98254 99120"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/30"
                  />
                </div>
              </div>

              {/* House/Flat & Building */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-stone-600 block mb-1">
                    Flat / House / Room No. *
                  </label>
                  <input
                    type="text"
                    required
                    value={newHouseNumber}
                    onChange={(e) => setNewHouseNumber(e.target.value)}
                    placeholder="e.g. Flat 402, Block B"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/30"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-stone-600 block mb-1">
                    Society / Building / Tech Park *
                  </label>
                  <input
                    type="text"
                    required
                    value={newBuilding}
                    onChange={(e) => setNewBuilding(e.target.value)}
                    placeholder="e.g. Shivalik Heights / Infocity Tower"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/30"
                  />
                </div>
              </div>

              {/* Area & Landmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-stone-600 block mb-1">
                    Area / Sector (Gandhinagar) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="e.g. Kudasan, Sector 1-30, Infocity, GIFT City"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/30"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-stone-600 block mb-1">
                    Nearby Landmark
                  </label>
                  <input
                    type="text"
                    value={newLandmark}
                    onChange={(e) => setNewLandmark(e.target.value)}
                    placeholder="e.g. Near PDPU Circle / Reliance Pump"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-stone-600 block mb-1" htmlFor="order-address-pincode">Pincode *</label>
                <input id="order-address-pincode" required pattern="[0-9]{6}" inputMode="numeric" maxLength={6} value={newPincode} onChange={e=>setNewPincode(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs" />
              </div>
              {/* Delivery Instructions Preset */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-stone-600 block mb-1">
                  Delivery Instruction Preference
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'call_on_reach', label: '📞 Call on Arrival' },
                    { id: 'leave_at_security', label: '🛡️ Leave at Guard' },
                    { id: 'ring_bell', label: '🔔 Ring Bell' },
                    { id: 'deliver_at_reception', label: '🏢 Reception Desk' }
                  ].map((inst) => (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => setNewInstructionPreset(inst.id as DeliveryInstructionPreset)}
                      className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-center cursor-pointer ${
                        newInstructionPreset === inst.id
                          ? 'bg-emerald-50 border-[#0D6E44] text-[#0D6E44]'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {inst.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  disabled={isSaving}
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save & Use This Address"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
