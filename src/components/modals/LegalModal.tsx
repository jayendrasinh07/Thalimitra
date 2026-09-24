import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, ShieldCheck, FileText, RotateCcw, Truck, HelpCircle, Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { BRAND_CONFIG, FAQS } from '../../data/config';

export const LegalModal: React.FC = () => {
  const { isLegalModalOpen, setIsLegalModalOpen, legalModalTab, openLegalModal, setActiveTab } = useApp();

  const closeModal = () => {
    setIsLegalModalOpen(false);
    if (window.location.pathname !== '/') window.history.pushState(null, '', '/');
  };

  if (!isLegalModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-[#141A17] text-white flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-800/80 flex items-center justify-center text-emerald-300">
              {legalModalTab === 'privacy' && <ShieldCheck className="w-4 h-4" />}
              {legalModalTab === 'terms' && <FileText className="w-4 h-4" />}
              {legalModalTab === 'refund' && <RotateCcw className="w-4 h-4" />}
              {legalModalTab === 'delivery' && <Truck className="w-4 h-4" />}
              {legalModalTab === 'faq' && <HelpCircle className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white tracking-tight">
                {legalModalTab === 'privacy' && 'Privacy Policy'}
                {legalModalTab === 'terms' && 'Terms & Conditions'}
                {legalModalTab === 'refund' && 'Cancellation & Refund Policy'}
                {legalModalTab === 'delivery' && 'Delivery Information & Timings'}
                {legalModalTab === 'faq' && 'Frequently Asked Questions'}
              </h3>
              <p className="text-[11px] text-stone-400">Thalimitra Customer Trust & Operations • Gandhinagar</p>
            </div>
          </div>

          <button
            onClick={closeModal}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Nav Switcher */}
        <div className="px-5 sm:px-6 py-2.5 bg-stone-100 border-b border-stone-200 flex items-center gap-1 sm:gap-2 overflow-x-auto shrink-0 no-scrollbar">
          <button
            type="button"
            onClick={() => openLegalModal('privacy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              legalModalTab === 'privacy' ? 'bg-[#0D6E44] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => openLegalModal('terms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              legalModalTab === 'terms' ? 'bg-[#0D6E44] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
          >
            Terms of Service
          </button>
          <button
            type="button"
            onClick={() => openLegalModal('refund')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              legalModalTab === 'refund' ? 'bg-[#0D6E44] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
          >
            Cancellation & Refund
          </button>
          <button
            type="button"
            onClick={() => openLegalModal('delivery')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              legalModalTab === 'delivery' ? 'bg-[#0D6E44] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
          >
            Delivery Info
          </button>
          <button
            type="button"
            onClick={() => openLegalModal('faq')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              legalModalTab === 'faq' ? 'bg-[#0D6E44] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
          >
            FAQs
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-stone-700 text-xs sm:text-sm leading-relaxed">
          
          {/* PRIVACY POLICY */}
          {legalModalTab === 'privacy' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <p className="font-bold text-xs">Effective Date: September 10, 2026 • Last updated: September 10, 2026</p>
                <p className="text-xs text-emerald-800 mt-1">
                  At Thalimitra, we respect your privacy and are committed to protecting the personal information you share with us for daily home meal deliveries.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">1. Information We Collect</h4>
                <p>
                  To fulfill doorstep food orders in Gandhinagar, we collect:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1 text-stone-600">
                  <li><strong>Contact details:</strong> Account email, name, and delivery phone number.</li>
                  <li><strong>Location data:</strong> Doorstep address (house/flat number, society/building name, landmark, sector/area, and GPS coordinates if verified).</li>
                  <li><strong>Meal preferences:</strong> Dietary selections (Standard Gujarati, Jain Satvik, Low-Oil Fitness), spice levels, and delivery instructions.</li>
                  <li><strong>Order and payment records:</strong> Ordered items, prices, order status, and payment, refund, or gateway reference identifiers. We do not receive your UPI PIN, card PIN, CVV, or complete card number.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">2. How We Use Your Data</h4>
                <p className="text-stone-600">
                  We use this information to authenticate your account, confirm serviceability, prepare and deliver orders, process or reconcile payments, answer support requests, prevent abuse, and meet legal or accounting obligations. We share only the information needed with service providers that support hosting, authentication, maps, payment processing, and delivery operations. We do not sell or rent personal information for advertising.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">3. Payment Security</h4>
                <p className="text-stone-600">
                  Until an online payment option appears at checkout, Thalimitra does not accept online payments. When enabled, Razorpay will process payment credentials on its secured interface. Thalimitra will store only the references and verified status needed to match a payment, refund, or dispute with an order.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">4. Data Retention & Deletion</h4>
                <p className="text-stone-600">
                  You can request correction or deletion of saved profile and address information by contacting <a href={`mailto:${BRAND_CONFIG.email}`} className="text-[#0D6E44] font-bold underline">{BRAND_CONFIG.email}</a>. Order, payment, refund, tax, fraud-prevention, and dispute records may be retained for the period required by applicable law or to establish and defend legal claims.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">5. Privacy Questions & Grievances</h4>
                <p className="text-stone-600">
                  Contact us at <a href={`mailto:${BRAND_CONFIG.email}`} className="text-[#0D6E44] font-bold underline">{BRAND_CONFIG.email}</a>. Include only the account email and order number needed to locate your request; never send an OTP, UPI PIN, card PIN, or CVV.
                </p>
              </div>
            </div>
          )}

          {/* TERMS OF SERVICE */}
          {legalModalTab === 'terms' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-stone-100 border border-stone-200 text-stone-900">
                <p className="font-bold text-xs">Thalimitra Platform & Service Terms</p>
                <p className="text-xs text-stone-600 mt-1">
                  By placing a one-time order with Thalimitra in Gandhinagar, you agree to the following terms.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">1. Kitchen Cutoff & Batch Timings</h4>
                <p className="text-stone-600">
                  Our meals are freshly prepared daily in scheduled batches. Breakfast orders close at <strong>10:00 PM on the previous night</strong>, same-day lunch at <strong>10:30 AM</strong>, and same-day dinner at <strong>5:30 PM</strong>. Orders received after cutoff must use a later orderable date.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">2. Service Coverage & Cluster Handover</h4>
                <p className="text-stone-600">
                  Delivery is available only for addresses marked serviceable during checkout. Orders may be handed to you or to the recipient named in your delivery instructions.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">3. Food Quality & Consumption Window</h4>
                <p className="text-stone-600">
                  Thalimitra meals are cooked without chemical preservatives or artificial shelf-life extenders. Meals should ideally be consumed within <strong>2.5 hours</strong> of delivery for optimal nutritional freshness and aroma.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">4. Prices & Payment Confirmation</h4>
                <p className="text-stone-600">
                  The published menu and checkout show the meal price, customization charges, delivery fee, discount, and final payable total before you place an order. An online payment is treated as successful only after Thalimitra verifies the payment status with Razorpay. A bank debit, screenshot, or customer-side success screen alone does not change an order to paid; contact support if money is debited but the order remains pending.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">5. Offers & Coupon Codes</h4>
                <p className="text-stone-600">
                  Each offer is subject to the eligibility, minimum food value, meal service, delivery area, validity period, usage limit, and campaign limit shown at checkout. Only one offer may be used per order. Discounts apply to eligible meal and customization value unless stated otherwise, and do not reduce delivery charges. Thalimitra verifies the offer again when the order is placed; an expired, paused, exhausted, or ineligible offer will not be applied.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">6. Subscriptions</h4>
                <p className="text-stone-600">
                  A meal plan request does not create a paid subscription. We first confirm the delivery address, preferred service, capacity and final price. A plan becomes active only after the customer accepts the quote and Operations verifies payment. Pause, cancellation and any applicable refund are handled against the active plan record.
                </p>
              </div>
            </div>
          )}

          {/* CANCELLATION & REFUND */}
          {legalModalTab === 'refund' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950">
                <p className="font-bold text-xs">One-Time Order Cancellation & Refund Rules</p>
                <p className="text-xs text-amber-800 mt-1">
                  These rules apply to one-time meal orders. Meal plan cancellations and any applicable refund are reviewed against the separately confirmed plan and payment record.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">1. One-Time Meal Orders</h4>
                <p className="text-stone-600">
                  You may cancel a confirmed order before the Kitchen cutoff: 10:00 PM IST on the previous night for breakfast, 10:30 AM IST for lunch, and 5:30 PM IST for dinner. If the order was paid, the full order amount will be eligible for refund to the original payment method. Customer cancellation is unavailable after the cutoff or after preparation begins because ingredients and kitchen capacity have already been committed.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">2. Merchant Cancellation, Failed or Duplicate Debit</h4>
                <p className="text-stone-600">
                  If Thalimitra cancels a paid order, the full order amount will be refunded. If a payment fails, remains unverified, or appears to be debited more than once, contact support with the order and payment reference. We will reconcile it against Razorpay's verified records before confirming or refunding any amount.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">3. Quality or Delivery Guarantee</h4>
                <p className="text-stone-600">
                  If an order is not delivered, arrives damaged, or contains materially incorrect items, contact support at <a href={`mailto:${BRAND_CONFIG.email}`} className="text-[#0D6E44] font-bold underline">{BRAND_CONFIG.email}</a> within 2 hours of the delivery window. After verifying the order and issue, Thalimitra may provide a replacement, account credit, partial refund, or full refund as appropriate.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">4. Refund Processing Time</h4>
                <p className="text-stone-600">
                  Approved refunds will be initiated to the original payment method within 2 business days. Razorpay states that a normal refund generally takes 5–7 working days after initiation, although the customer's bank or payment network may take longer. The refund reference will be shared when available. An unpaid or pending order that was never successfully charged does not create a refund.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">5. Offer Use After Cancellation</h4>
                <p className="text-stone-600">
                  Cancelling an order does not automatically restore a one-time coupon or promotion. Contact support with the order number if the cancellation resulted from a verified Thalimitra service failure; any replacement offer or account adjustment will be reviewed and recorded separately.
                </p>
              </div>
            </div>
          )}

          {/* DELIVERY INFORMATION */}
          {legalModalTab === 'delivery' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <p className="font-bold text-xs">Punctual Cluster Logistics • Gandhinagar</p>
                <p className="text-xs text-emerald-800 mt-1">
                  Available delivery windows and serviceability are confirmed during checkout. Arrival time may vary with route and local traffic conditions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="font-bold text-xs text-stone-900 block">Lunch Delivery Slot</span>
                  <span className="text-sm font-extrabold text-[#0D6E44]">12:00 PM – 1:30 PM</span>
                  <p className="text-[11px] text-stone-500 mt-1">Timed for college breaks and corporate lunch hours.</p>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="font-bold text-xs text-stone-900 block">Dinner Delivery Slot</span>
                  <span className="text-sm font-extrabold text-[#0D6E44]">7:30 PM – 9:00 PM</span>
                  <p className="text-[11px] text-stone-500 mt-1">Delivered hot for a relaxing evening routine.</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-stone-900 text-sm mb-1">Key Delivery Clusters</h4>
                <ul className="list-disc pl-5 space-y-1 text-stone-600 text-xs">
                  <li><strong>Cluster A (Student & Tech Corridor):</strong> Kudasan, PDPU Road, Bhaijipura, Raysan, Infocity Phase 1 & 2, DA-IICT area.</li>
                  <li><strong>Cluster B (GIFT City & Koba):</strong> GIFT City SEZ & Domestic Towers, Randesan, Sargasan Cross Roads, Koba Circle.</li>
                  <li><strong>Cluster C (GIDC Industrial Hub):</strong> Sector 24, Sector 25 Electronic Estate, Sector 26, Sector 28.</li>
                  <li><strong>Cluster D (Central Sectors):</strong> Sectors 1 to 30 Residential rows, Old & New Sachivalaya, Vidhan Sabha area, Vavol.</li>
                </ul>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    closeModal();
                    setActiveTab('coverage');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0D6E44] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#08482C] transition-colors"
                >
                  <span>View Full Coverage Map & Sector List</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* FAQS */}
          {legalModalTab === 'faq' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {FAQS.map((faq, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                  <h4 className="font-bold text-stone-900 text-xs sm:text-sm flex items-start gap-2">
                    <span className="text-[#0D6E44] font-black">Q:</span>
                    <span>{faq.q}</span>
                  </h4>
                  <p className="text-stone-600 text-xs pl-5 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-[#0D6E44]" />
              <span>{BRAND_CONFIG.email}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
