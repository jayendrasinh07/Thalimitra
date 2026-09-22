import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Truck, 
  Sparkles, 
  ArrowRight, 
  RotateCcw, 
  ShieldCheck, 
  ChefHat, 
  PackageCheck,
  Calendar,
  Bell,
  BellRing,
  Check
} from 'lucide-react';
import { OneTimeOrder } from '../../types';
import { useApp } from '../../context/AppContext';
import { Capacitor } from '@capacitor/core';

interface OrderConfirmedViewProps {
  order: OneTimeOrder;
  onOrderAnother: () => void;
  onTrackOrder: () => void;
}

export const OrderConfirmedView: React.FC<OrderConfirmedViewProps> = ({
  order,
  onOrderAnother,
  onTrackOrder
}) => {
  const { 
    setActiveTab, 
    setIsSubscribeModalOpen,
    notificationPermission,
    requestNotificationPermission
  } = useApp();

  const [notificationCardDismissed, setNotificationCardDismissed] = useState(false);
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);

  const handleEnableNotifications = async () => {
    setIsEnablingNotifications(true);
    await requestNotificationPermission();
    setIsEnablingNotifications(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-400">
      
      {/* 1. Main Celebration Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 bg-emerald-100 text-[#0D6E44] rounded-full flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-black uppercase tracking-widest text-[#0D6E44] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Order Confirmed 🎉
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mt-2">
            Your meal is in the kitchen queue!
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto">
            Order <strong className="text-stone-900 font-mono">#{order.id}</strong> scheduled for{' '}
            <strong className="text-stone-900">{order.scheduledDateLabel}</strong> ({order.deliverySlotLabel}).
          </p>
        </div>

        {/* 2. Live Status Progress Stepper */}
        <div className="pt-4 border-t border-stone-150">
          <div className="flex items-center justify-between relative max-w-lg mx-auto">
            {/* Background Line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-200 -translate-y-1/2 z-0" />
            <div className="absolute top-1/2 left-0 w-1/4 h-1 bg-[#0D6E44] -translate-y-1/2 z-0" />

            {/* Steps */}
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-[#0D6E44] text-white flex items-center justify-center text-xs font-black shadow-sm">
                ✓
              </div>
              <span className="text-[10px] font-black text-stone-900 text-center">Confirmed</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#0D6E44] border-2 border-[#0D6E44] flex items-center justify-center text-xs font-black animate-pulse">
                <ChefHat className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-stone-900 text-center">Preparing</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-white text-stone-400 border-2 border-stone-300 flex items-center justify-center text-xs font-bold">
                <PackageCheck className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-medium text-stone-400 text-center">Packed</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-white text-stone-400 border-2 border-stone-300 flex items-center justify-center text-xs font-bold">
                <Truck className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-medium text-stone-400 text-center">Out</span>
            </div>
          </div>
        </div>

        {/* 3. Delivery & Meal Details Breakdown */}
        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200 text-left space-y-3 text-xs">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Item Details</span>
              <p className="font-black text-stone-900 text-sm">
                {order.quantity}x {order.mealSlot[0].toUpperCase() + order.mealSlot.slice(1)} ({order.customizations.dietVariant})
              </p>
              <p className="text-stone-500 text-[11px]">
                {order.customizations.spiceLevel} • {order.customizations.oilLevel} • 4+ Rotis & Rice
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Paid</span>
              <p className="text-lg font-black text-stone-900 font-mono">
                ₹{order.total}
              </p>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                {order.paymentMethod}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-stone-200/80 flex items-start gap-2 text-stone-600">
            <MapPin className="w-4 h-4 text-[#0D6E44] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-stone-900">{order.address.fullName} ({order.address.label})</span>
              <p className="text-[11px] text-stone-500">{order.address.addressLine || order.address.addressLine1 || order.address.street}, {order.address.area}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onTrackOrder}
            className="py-3 px-5 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Truck className="w-4 h-4" />
            <span>Track Live Delivery</span>
          </button>

          <button
            type="button"
            onClick={onOrderAnother}
            className="py-3 px-5 rounded-2xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 font-bold text-xs sm:text-sm border border-stone-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Order Another Meal</span>
          </button>
        </div>
      </div>

      {/* CONTEXTUAL JUST-IN-TIME NOTIFICATION CARD */}
      {!Capacitor.isNativePlatform() && !notificationCardDismissed && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-md">
          {notificationPermission === 'granted' ? (
            <div className="flex items-center gap-3 text-emerald-800">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-emerald-700 stroke-[3]" />
              </div>
              <div>
                <h4 className="text-xs font-black text-stone-900">
                  Live Notifications Active
                </h4>
                <p className="text-[11px] text-stone-600">
                  We'll send you punctual alerts when Chef begins packing and when your delivery partner arrives.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-stone-900">
                      Want live doorstep delivery alerts?
                    </h4>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Get real-time browser alerts without opening the app:
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {[
                  { title: 'Order Confirmed', icon: '✓' },
                  { title: 'Being Cooked', icon: '🔥' },
                  { title: 'Out for Delivery', icon: '🛵' },
                  { title: 'Doorstep Arrival', icon: '📍' }
                ].map((step, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-stone-50 border border-stone-200/80 text-center">
                    <span className="text-xs block">{step.icon}</span>
                    <span className="text-[10px] font-bold text-stone-700 block mt-0.5">{step.title}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-150">
                <button
                  type="button"
                  onClick={() => setNotificationCardDismissed(true)}
                  className="py-2 px-3.5 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  Not Now
                </button>
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  disabled={isEnablingNotifications}
                  className="py-2 px-4 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{isEnablingNotifications ? 'Enabling...' : 'Enable Notifications'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Subtle Subscription Upgrade Suggestion */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-900 to-stone-900 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
              Smart Savings
            </span>
          </div>
          <h4 className="text-base font-black">
            Ordering Thalimitra regularly?
          </h4>
          <p className="text-xs text-stone-300 max-w-sm">
            Save up to ₹35 per meal, get free pause/resume, and zero daily ordering hassle with a 15-day or 30-day meal plan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveTab('meal_plans');
            setIsSubscribeModalOpen(true);
          }}
          className="py-2.5 px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs shadow-md shrink-0 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
        >
          <span>View Meal Plans</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
