import React from 'react';
import { 
  ShieldCheck, 
  ArrowRight, 
  Clock, 
  MapPin, 
  Utensils, 
  CheckCircle2, 
  FileText,
  AlertCircle,
  LogIn
  ,BadgePercent
  ,LoaderCircle
  ,X
} from 'lucide-react';
import { DatabaseMeal, DatabaseMealCustomization } from '../../services/menuService';
import { CustomerAddress, DeliverySlot, ServiceMealType } from '../../types';
import { useApp } from '../../context/AppContext';
import type { PromotionQuote } from '../../services/promotionService';

interface Step6OrderReviewProps {
  meal: DatabaseMeal;
  quantity: number;
  selectedAddons: Record<string, number>;
  customizationCatalog: DatabaseMealCustomization[];
  spiceLevel: string;
  oilLevel: string;
  dietVariant: string;
  selectedDate: string;
  mealSlot: ServiceMealType;
  selectedSlot?: DeliverySlot;
  selectedAddress: CustomerAddress;
  notes: string;
  deliveryFee: number;
  promotionQuote: PromotionQuote | null;
  promotionCode: string;
  promotionLoading: boolean;
  promotionError?: string;
  onPromotionCodeChange: (code: string) => void;
  onApplyPromotion: (code: string) => Promise<void>;
  onRemovePromotion: () => void;
  onNotesChange: (notes: string) => void;
  onConfirmOrder: () => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
}

export const Step6OrderReview: React.FC<Step6OrderReviewProps> = ({
  meal,
  quantity,
  selectedAddons,
  customizationCatalog,
  spiceLevel,
  oilLevel,
  dietVariant,
  selectedDate,
  mealSlot,
  selectedSlot,
  selectedAddress,
  notes,
  deliveryFee,
  promotionQuote,
  promotionCode,
  promotionLoading,
  promotionError,
  onPromotionCodeChange,
  onApplyPromotion,
  onRemovePromotion,
  onNotesChange,
  onConfirmOrder,
  isSubmitting,
  errorMessage
}) => {
  const { currentUser, setIsAuthModalOpen } = useApp();

  // Calculate estimated itemized amounts for UI transparency
  let mealsSubtotal = meal.basePrice * quantity;

  let addonsTotal = 0;
  const addonItems: { name: string; qty: number; price: number; total: number }[] = [];

  Object.entries(selectedAddons).forEach(([addonId, qty]: [string, number]) => {
    if (qty > 0) {
      const addon = customizationCatalog.find((c) => c.id === addonId);
      const price = Number(addon?.price ?? 0);
      const total = price * qty;
      addonsTotal += total;
      addonItems.push({
        name: addon?.name || addonId,
        qty,
        price,
        total
      });
    }
  });

  const quotedDeliveryFee = promotionQuote?.deliveryFee ?? deliveryFee;
  if (promotionQuote) {
    mealsSubtotal = promotionQuote.mealsSubtotal;
    addonsTotal = promotionQuote.addonsTotal;
  }
  const discount = promotionQuote?.discount ?? 0;
  const estimatedGrandTotal = Math.max(0, mealsSubtotal + addonsTotal + quotedDeliveryFee - discount);

  // Format date
  const dateObj = new Date(selectedDate + 'T00:00:00');
  const dateDisplay = dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-100 pb-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#0D6E44] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Step 6 of 6 • Final Confirmation
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-1 tracking-tight">
              Review Your One-Time Meal Order
            </h2>
          </div>
          <span className="text-xs font-semibold text-stone-500">
            {dateDisplay} • {mealSlot[0].toUpperCase() + mealSlot.slice(1)}
          </span>
        </div>

        {/* Error Alert if order submission failed */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="block font-black">Order Verification Error</span>
              <span className="font-normal text-rose-700">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Order Details Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Meal Details Box */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200 space-y-3">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#0D6E44]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-800">
                Meal Selection
              </h3>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-black text-stone-900">
                {quantity}x {meal.name}
              </h4>
              <p className="text-xs text-stone-600 leading-snug">
                {meal.description}
              </p>
            </div>

            <div className="pt-2 border-t border-stone-200/60 flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 font-bold">
                🌶️ {spiceLevel}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 font-bold">
                ✨ {oilLevel}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 font-bold">
                🌱 Pure Veg
              </span>
            </div>
          </div>

          {/* Delivery Details Box */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#0D6E44]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-800">
                Delivery Details
              </h3>
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-black text-stone-900">
                {selectedAddress.fullName || 'Customer'} ({selectedAddress.phone || 'Phone provided'})
              </div>
              <p className="text-stone-700 leading-snug">
                {selectedAddress.addressLine || `${selectedAddress.houseNumber || ''} ${selectedAddress.building || ''}, ${selectedAddress.area}, Gandhinagar`}
              </p>
              <div className="text-stone-500 font-semibold pt-1">
                Window: <strong className="text-stone-900">{selectedSlot?.windowLabel || 'Select a slot'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Delivery & Kitchen Notes */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#0D6E44]" />
            <span>Delivery Instructions & Special Notes (Optional)</span>
          </label>
          <input
            maxLength={1000}
            type="text"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="e.g. Leave with building security guard / Call when entering gate"
            className="w-full px-4 py-2.5 bg-[#FAF8F5] rounded-2xl border border-stone-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0D6E44]/30"
          />
        </div>
      </div>

      {/* 2. Price Breakdown Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm space-y-4">
        <h3 className="text-base font-black text-stone-900 border-b border-stone-100 pb-3">
          Price Breakdown
        </h3>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-start gap-2"><BadgePercent className="mt-0.5 shrink-0 text-amber-700" size={19} /><div><p className="text-sm font-black text-stone-900">Offers & savings</p><p className="mt-0.5 text-xs text-stone-600">Only eligible offers are shown. Final savings are verified again when you place the order.</p></div></div>
          {promotionQuote?.appliedOffer ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white p-3"><div><p className="text-xs font-black text-emerald-800">{promotionQuote.appliedOffer.code} applied</p><p className="mt-0.5 text-xs text-stone-600">{promotionQuote.appliedOffer.name} · You save ₹{promotionQuote.appliedOffer.discount_amount}</p></div><button type="button" onClick={onRemovePromotion} className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-black text-red-700 hover:bg-red-50"><X size={15} />Remove</button></div>
            : <div className="mt-3 flex gap-2"><input aria-label="Offer code" value={promotionCode} maxLength={30} onChange={event => onPromotionCodeChange(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void onApplyPromotion(promotionCode); } }} placeholder="Enter offer code" className="min-h-11 min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 font-mono text-sm font-bold uppercase outline-none focus:border-amber-500" /><button type="button" disabled={promotionLoading || !promotionCode.trim()} onClick={() => void onApplyPromotion(promotionCode)} className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-black text-white disabled:opacity-40">{promotionLoading ? <LoaderCircle className="animate-spin" size={17} /> : 'Apply'}</button></div>}
          {promotionError && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{promotionError}</p>}
          {!promotionQuote?.appliedOffer && (promotionQuote?.availableOffers.length ?? 0) > 0 && <div className="mt-3 space-y-2"><p className="text-[10px] font-black uppercase tracking-wider text-stone-500">Available for this order</p>{promotionQuote?.availableOffers.map(offer => <button key={offer.id} type="button" disabled={promotionLoading} onClick={() => void onApplyPromotion(offer.code)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 text-left disabled:opacity-50"><span><span className="block text-xs font-black text-stone-900">{offer.code} · {offer.name}</span><span className="mt-0.5 block text-[11px] text-stone-500">{offer.description}</span></span><span className="shrink-0 text-xs font-black text-emerald-700">Save ₹{offer.discount_amount}</span></button>)}</div>}
        </div>

        <div className="space-y-2.5 text-xs">
          {/* Base Meals */}
          <div className="flex items-center justify-between font-bold text-stone-800">
            <span>{quantity}x Home-Style Meal (₹{meal.basePrice}/meal)</span>
            <span className="font-mono font-black text-stone-900">₹{mealsSubtotal}</span>
          </div>

          {/* Add-ons */}
          {addonItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-stone-600 pl-2 border-l-2 border-emerald-300">
              <span>{item.name} (×{item.qty})</span>
              <span className="font-mono font-medium text-stone-900">+₹{item.total}</span>
            </div>
          ))}

          {/* Delivery Fee */}
          <div className="flex items-center justify-between text-stone-600 pt-2 border-t border-stone-100">
            <div className="flex items-center gap-1.5">
              <span>Cluster Doorstep Delivery</span>
              <span className="text-[10px] font-black text-[#0D6E44] bg-emerald-100 px-2 py-0.2 rounded-full">
                {quotedDeliveryFee===0 ? "FREE" : ""}
              </span>
            </div>
            <span className="font-mono font-black text-[#0D6E44]">₹{quotedDeliveryFee}</span>
          </div>

          {discount > 0 && <div className="flex items-center justify-between font-bold text-emerald-700"><span>{promotionQuote?.appliedOffer?.code} savings</span><span className="font-mono font-black">−₹{discount}</span></div>}

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t border-stone-200 text-sm sm:text-base font-black text-stone-900">
            <span>Total Payable</span>
            <span className="text-xl font-mono text-[#0D6E44]">₹{estimatedGrandTotal}</span>
          </div>
        </div>

        {/* PostgreSQL Security Badge */}
        <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-stone-200/80 flex items-center gap-2.5 text-[11px] text-stone-600">
          <ShieldCheck className="w-4 h-4 text-[#0D6E44] shrink-0" />
          <span>
            Payment remains pending. No online payment is collected. We verify your price and slot before confirming the order.
          </span>
        </div>

        {/* Confirm Order CTA */}
        <div className="pt-2">
          {currentUser ? (
            <button
              type="button"
              id="confirm-place-order-btn"
              disabled={isSubmitting}
              onClick={onConfirmOrder}
              className="w-full py-4 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-base font-black shadow-lg shadow-emerald-950/15 hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying & Placing Order with Thalimitra...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-amber-300" />
                  <span>Confirm Order • ₹{estimatedGrandTotal}</span>
                  <ArrowRight className="w-5 h-5 text-amber-300 ml-1" />
                </>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                id="order-login-prompt-btn"
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full py-4 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-base font-black shadow-lg shadow-emerald-950/15 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-5 h-5 text-amber-300" />
                <span>Sign In to Place Order (Draft Preserved)</span>
              </button>
              <p className="text-center text-[11px] text-stone-500 font-medium">
                Your selected meal and preferences will remain intact after signing in.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
