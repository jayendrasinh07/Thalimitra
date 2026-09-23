import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  MapPin,
  RotateCcw,
  Utensils,
  XCircle,
  Plus,
  ShoppingBag,
  MessageCircle
} from 'lucide-react';
import { CancellationReason, OneTimeOrder } from '../types';
import { supportService } from '../services/supportService';

const cancellationOptions: Array<{ value: CancellationReason; label: string }> = [
  { value: 'ordered_by_mistake', label: 'Ordered by mistake' },
  { value: 'schedule_changed', label: 'My schedule changed' },
  { value: 'address_issue', label: 'Delivery address issue' },
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'other', label: 'Other reason' },
];

export const OrderHistoryPage: React.FC = () => {
  const {
    setActiveTab,
    oneTimeOrders,
    reorderMeal,
    cancelOneTimeOrder,
    setIsOrderOnceModalOpen,
    setIsAuthModalOpen,
    currentUser,
    showToast
  } = useApp();

  const [filterType, setFilterType] = useState<'all' | 'one_time'>('all');
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<CancellationReason>('ordered_by_mistake');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [supportOrderId, setSupportOrderId] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const startOrder = () => isNative ? setActiveTab('todays_menu') : setIsOrderOnceModalOpen(true);

  const confirmCancellation = async () => {
    if (!cancelOrderId || cancelBusy) return;
    setCancelBusy(true);
    const saved = await cancelOneTimeOrder(cancelOrderId, cancelReason, cancelNote);
    setCancelBusy(false);
    if (saved) { setCancelOrderId(null); setCancelNote(''); }
  };

  const sendOrderSupport = async () => {
    if (!supportOrderId || supportBusy) return;
    setSupportBusy(true);
    try {
      const request = await supportService.create('order_help', supportMessage, supportOrderId);
      setSupportOrderId(null); setSupportMessage('');
      showToast('Support request saved', `Ticket ${request.id.slice(0, 8).toUpperCase()} is now in the admin queue.`, 'success');
    } catch (error) {
      showToast('Support unavailable', error instanceof Error ? error.message : 'Support request could not be saved.', 'error');
    } finally {
      setSupportBusy(false);
    }
  };

  if (isNative && !currentUser) return <div className="mx-auto max-w-2xl px-5 py-10 text-center">
    <ShoppingBag className="mx-auto h-11 w-11 text-[#0D6E44]" />
    <h1 className="mt-4 text-2xl font-black text-stone-900">Your orders, all in one place</h1>
    <p className="mt-2 text-sm text-stone-600">Sign in to see your order status and past meals.</p>
    <button type="button" onClick={() => setIsAuthModalOpen(true)} className="mt-6 min-h-12 w-full rounded-2xl bg-[#0D6E44] font-bold text-white">Sign in</button>
    <button type="button" onClick={() => setActiveTab('todays_menu')} className="mt-3 min-h-11 w-full font-bold text-[#0D6E44]">Browse menu</button>
  </div>;

  return (
    <div className={`${isNative ? 'py-4' : 'py-10'} bg-[#FAF8F5] min-h-[85vh]`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Header */}
        {!isNative && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => setActiveTab('customer_dashboard')}
            className="text-xs font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Customer Portal</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={startOrder}
              className="px-4 py-2 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Order Single Meal</span>
            </button>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
              Your account orders
            </span>
          </div>
        </div>}

        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200 shadow-md space-y-8">
          <div className="border-b border-stone-100 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              {!isNative && <span className="text-xs font-extrabold uppercase tracking-widest text-[#0D6E44] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Receipts & Traceability Logs
              </span>}
              <h1 className="text-2xl sm:text-3xl font-black text-stone-900 mt-2">
                {isNative ? 'My orders' : 'Order & Meal History'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 mt-1">
                Track your single-meal orders, status and support requests.
              </p>
            </div>

            {/* Filter Pills */}
            {!isNative && <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-2xl shrink-0">
              {[
                { id: 'all', label: 'All' },
                { id: 'one_time', label: `Single Orders (${oneTimeOrders.length})` }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterType === tab.id
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>}
          </div>

          {/* ================= ONE-TIME ORDERS SECTION ================= */}
          {(filterType === 'all' || filterType === 'one_time') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#0D6E44]" />
                  <span>One-Time Fresh Meal Orders</span>
                </h2>
                <span className="text-xs text-stone-500 font-semibold">{oneTimeOrders.length} placed</span>
              </div>

              {oneTimeOrders.length === 0 ? (
                <div className="p-8 rounded-2xl bg-stone-50 border border-dashed border-stone-300 text-center space-y-3">
                  <Utensils className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="text-xs text-stone-600 font-medium">No one-time meal orders yet.</p>
                  <button
                    onClick={startOrder}
                    className="px-4 py-2 rounded-xl bg-[#0D6E44] text-white text-xs font-bold"
                  >
                    Place Your First Single Order
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {oneTimeOrders.map((order: OneTimeOrder) => {
                    const isCancellable = order.orderStatus === 'CONFIRMED' && order.paymentStatus === 'PENDING';
                    return (
                      <div
                        key={order.id}
                        className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[#0D6E44] bg-emerald-100 px-2 py-0.5 rounded">
                              #{order.orderNumber || order.id}
                            </span>
                            <span className="text-xs text-stone-500 font-semibold">
                              {order.scheduledDateLabel} ({order.mealSlot.toUpperCase()})
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              order.orderStatus === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.orderStatus === 'CANCELLED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-blue-100 text-blue-900 animate-pulse'
                            }`}>
                              {(order.orderStatus || '').replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] font-bold text-stone-500 bg-stone-200 px-2 py-0.5 rounded">
                              {order.paymentMethod} • {order.paymentStatus}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-sm text-stone-900">
                              {order.mealName} (x{order.quantity})
                            </h3>
                            <span className="text-xs font-bold text-[#0D6E44]">• ₹{order.total}</span>
                          </div>

                          <div className="text-xs text-stone-600 space-y-0.5">
                            <p>
                              Spice: {order.customizations.spiceLevel} • Oil: {order.customizations.oilLevel}
                              {order.addOns.length > 0 && ` • Sides: ${order.addOns.map((a) => a.name).join(', ')}`}
                            </p>
                            <p className="text-[11px] text-stone-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#0D6E44]" />
                              <span>{order.address.addressLine}, {order.address.area}</span>
                            </p>
                          </div>
                          {order.orderStatus === 'CANCELLED' && order.cancellationReason && <p className="text-[11px] font-bold text-rose-700">Cancelled · {cancellationOptions.find(option => option.value === order.cancellationReason)?.label ?? 'Reason saved'}</p>}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto shrink-0">
                          {isCancellable && (
                            <button
                              onClick={() => { setCancelOrderId(order.id); setCancelReason('ordered_by_mistake'); setCancelNote(''); }}
                              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          )}

                          <button
                            onClick={() => { setSupportOrderId(order.id); setSupportMessage(''); }}
                            className="px-3 py-2 rounded-xl bg-white hover:bg-stone-100 border border-stone-300 text-xs font-bold text-stone-700 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Support</span>
                          </button>

                          <button
                            onClick={() => reorderMeal(order.id)}
                            className="px-3.5 py-2 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Order Again</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {cancelOrderId && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
        <div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
          <h2 id="cancel-order-title" className="text-xl font-black text-stone-900">Cancel this order?</h2>
          <p className="mt-2 text-sm text-stone-600">Cancellation is available before the Kitchen cutoff. Your reason is saved for operations review.</p>
          <label className="mt-5 block text-xs font-bold text-stone-700">Reason<select value={cancelReason} onChange={event => setCancelReason(event.target.value as CancellationReason)} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm">{cancellationOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="mt-4 block text-xs font-bold text-stone-700">Note {cancelReason === 'other' ? '(required)' : '(optional)'}<textarea rows={3} maxLength={500} value={cancelNote} onChange={event => setCancelNote(event.target.value)} placeholder="Add helpful details" className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" /></label>
          <p className="mt-2 text-xs text-stone-500">Payment is still pending, so this action does not create a refund.</p>
          <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={cancelBusy} onClick={() => setCancelOrderId(null)} className="min-h-11 rounded-xl border border-stone-300 text-sm font-bold text-stone-700">Keep order</button><button type="button" disabled={cancelBusy || (cancelReason === 'other' && cancelNote.trim().length < 5)} onClick={() => void confirmCancellation()} className="min-h-11 rounded-xl bg-rose-700 text-sm font-bold text-white disabled:opacity-40">{cancelBusy ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
        </div>
      </div>}

      {supportOrderId && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="order-support-title">
        <div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
          <h2 id="order-support-title" className="text-xl font-black text-stone-900">Request order support</h2>
          <p className="mt-2 text-sm text-stone-600">The admin team will see this request with the selected order number.</p>
          <label className="mt-5 block text-xs font-bold text-stone-700">How can we help?<textarea autoFocus rows={5} minLength={10} maxLength={2000} value={supportMessage} onChange={event => setSupportMessage(event.target.value)} placeholder="Describe the issue in at least 10 characters" className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" /></label>
          <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={supportBusy} onClick={() => setSupportOrderId(null)} className="min-h-11 rounded-xl border border-stone-300 text-sm font-bold text-stone-700">Close</button><button type="button" disabled={supportBusy || supportMessage.trim().length < 10} onClick={() => void sendOrderSupport()} className="min-h-11 rounded-xl bg-emerald-700 text-sm font-bold text-white disabled:opacity-40">{supportBusy ? 'Sending…' : 'Send request'}</button></div>
        </div>
      </div>}
    </div>
  );
};

