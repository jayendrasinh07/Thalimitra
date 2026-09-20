import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  MapPin, 
  Check, 
  X, 
  Home, 
  Building2, 
  GraduationCap, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Crosshair,
  ShieldCheck,
} from 'lucide-react';
import { AddressLabel, DeliveryInstructionPreset, DetectedLocation } from '../../types';
import { joinAreaWaitlist } from '../../services/publicDeliveryAreaService';

interface LocationConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectedLoc: DetectedLocation | null;
  onConfirmed?: () => void;
}

export const LocationConfirmationModal: React.FC<LocationConfirmationModalProps> = ({
  isOpen,
  onClose,
  detectedLoc,
  onConfirmed
}) => {
  const { 
    confirmDetectedAddress, 
    activeDeliveryAddress,
    selectDeliveryAddress,
    savedAddresses,
    showToast 
  } = useApp();

  const [label, setLabel] = useState<AddressLabel>('Home');
  const [fullName, setFullName] = useState(activeDeliveryAddress?.fullName || '');
  const [phone, setPhone] = useState(activeDeliveryAddress?.phone || '');
  const [flatOrStreet, setFlatOrStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [instructionPreset, setInstructionPreset] = useState<DeliveryInstructionPreset>('call_on_reach');

  // Waitlist state for unserviceable regions
  const [waitlistName, setWaitlistName] = useState(fullName);
  const [waitlistContact, setWaitlistContact] = useState(phone);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  if (!isOpen || !detectedLoc) return null;

  const isServiceable = detectedLoc.isServiceable;
  const isLowAccuracy = Boolean(detectedLoc.accuracy && detectedLoc.accuracy > 1000);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      showToast('Contact Required', 'Please provide a contact phone number for delivery updates.', 'warning');
      return;
    }

    const formattedLine = flatOrStreet.trim() 
      ? `${flatOrStreet.trim()}, ${detectedLoc.displayName}`
      : detectedLoc.displayName;

    confirmDetectedAddress({
      label,
      fullName: fullName.trim(),
      phone: phone.trim(),
      addressLine1: formattedLine
    });

    if (onConfirmed) onConfirmed();
    onClose();
  };

  const handleKeepExistingAddress = () => {
    if (activeDeliveryAddress) {
      selectDeliveryAddress(activeDeliveryAddress);
      showToast('Address Preserved', `Kept current address: ${activeDeliveryAddress.label} (${activeDeliveryAddress.area})`, 'info');
    }
    onClose();
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistName.trim() || !waitlistContact.trim() || waitlistSubmitting) return;
    setWaitlistSubmitting(true); setWaitlistError(null);
    try {
      await joinAreaWaitlist({
        name: waitlistName.trim(), contact: waitlistContact.trim(),
        area: detectedLoc.area || detectedLoc.displayName,
        city: detectedLoc.city || 'Outside Gandhinagar', pincode: detectedLoc.pincode,
        formattedAddress: detectedLoc.displayName,
        latitude: detectedLoc.latitude, longitude: detectedLoc.longitude,
        source: detectedLoc.source || 'gps',
      });
      setWaitlistSubmitted(true);
      showToast('Priority alert is on', `We will notify you when delivery opens in ${detectedLoc.area || 'this area'}.`, 'success');
    } catch (cause) {
      setWaitlistError(cause instanceof Error ? cause.message : 'Your request could not be saved. Please try again.');
    } finally { setWaitlistSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FAF8F5] border border-stone-200 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-white border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-[#0D6E44] shrink-0">
              <Crosshair className="w-5 h-5 text-[#0D6E44]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                {isServiceable ? 'Confirm GPS Delivery Location' : 'Location Detected (Outside Service Area)'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Real-time browser coordinates verified
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Detected GPS summary banner */}
          <div className={`p-4 rounded-2xl border ${
            isServiceable 
              ? 'bg-emerald-50/70 border-emerald-200' 
              : 'bg-rose-50/70 border-rose-200'
          }`}>
            <div className="flex items-start gap-3">
              <MapPin className={`w-5 h-5 mt-0.5 shrink-0 ${isServiceable ? 'text-[#0D6E44]' : 'text-rose-600'}`} />
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-stone-900 uppercase tracking-wide">
                    {detectedLoc.displayName}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isServiceable 
                      ? 'bg-emerald-200/60 text-emerald-900' 
                      : 'bg-rose-200/60 text-rose-900'
                  }`}>
                    {isServiceable ? 'Delivery available' : 'Your area could be next'}
                  </span>
                </div>

                <p className="text-[11px] text-stone-600 font-mono">
                  GPS: {detectedLoc.latitude.toFixed(5)}° N, {detectedLoc.longitude.toFixed(5)}° E
                  {detectedLoc.accuracy ? ` (Accuracy: ±${Math.round(detectedLoc.accuracy)}m)` : ''}
                </p>

                {isServiceable && detectedLoc.serviceability && (
                  <p className="text-xs text-emerald-800 font-medium pt-1">
                    {detectedLoc.serviceability.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Conflict Notification if User Already has a Saved Address */}
          {activeDeliveryAddress && (
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-bold">
                  Existing Saved Address: <span className="font-normal">{activeDeliveryAddress.label} • {activeDeliveryAddress.area}</span>
                </p>
                <p className="text-[11px] text-amber-800">
                  Would you like to switch your delivery address to this detected GPS location or keep your saved address?
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleKeepExistingAddress}
                    className="px-3 py-1 rounded-xl bg-white border border-amber-300 text-stone-800 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    Keep Saved ({activeDeliveryAddress.label})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form for Serviceable Location Confirmation */}
          {isServiceable ? (
            <form onSubmit={handleConfirm} className="space-y-4">
              {/* Address label selector */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">Address Label</label>
                <div className="flex items-center gap-2">
                  {(['Home', 'Office', 'PG', 'College', 'Other'] as const).map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setLabel(lbl)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        label === lbl
                          ? 'bg-[#0D6E44] text-white border-[#0D6E44]'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/20 focus:border-[#0D6E44]"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Phone (for Delivery SMS)</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/20 focus:border-[#0D6E44]"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Flat / House No. / Building (Optional)</label>
                <input
                  type="text"
                  value={flatOrStreet}
                  onChange={(e) => setFlatOrStreet(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-xs text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/20 focus:border-[#0D6E44]"
                  placeholder="e.g. Flat 402, Block B, Royal Residency"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Address</span>
                </button>
              </div>
            </form>
          ) : (
            /* Outside Zone Waitlist Form */
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 text-sm leading-relaxed text-stone-700">
                <p className="font-black text-stone-950">Not here yet — but your area could be next.</p>
                <p className="mt-1 text-xs">We open only verified delivery routes. Join the priority list and we will alert you as soon as your doorstep opens.</p>
              </div>

              {waitlistSubmitted ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#0D6E44] shrink-0" />
                  <span>Your area is on our radar. We will contact you when verified delivery opens in {detectedLoc.area || detectedLoc.displayName}.</span>
                </div>
              ) : (
                <form onSubmit={handleJoinWaitlist} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={waitlistName}
                      onChange={(e) => setWaitlistName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-xs font-medium focus:outline-none focus:border-[#0D6E44]"
                    />
                    <input
                      type="text"
                      required
                      value={waitlistContact}
                      onChange={(e) => setWaitlistContact(e.target.value)}
                      placeholder="Mobile or Email"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-xs font-medium focus:outline-none focus:border-[#0D6E44]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={waitlistSubmitting}
                    className="w-full rounded-xl bg-stone-950 py-2.5 text-xs font-black text-white transition-colors disabled:opacity-50"
                  >
                    {waitlistSubmitting ? 'Saving…' : 'Notify me first'}
                  </button>
                  {waitlistError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800">{waitlistError}</p>}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
