import { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, CheckCheck, ChevronRight, MapPin, Megaphone, PackageCheck } from 'lucide-react';
import { useApp, type ActiveTab } from '../context/AppContext';
import { notificationService, type NotificationCenter, type NotificationItem, type NotificationTarget } from '../services/notificationService';

const targetTabs: Partial<Record<NotificationTarget, ActiveTab>> = {
  home: 'home', order_history: 'order_history', meal_plans: 'meal_plans', customer_dashboard: 'customer_dashboard', coverage: 'coverage',
};
const iconFor = (item: NotificationItem) => item.category === 'area' ? MapPin : item.category === 'offer' ? Megaphone : item.category === 'reminder' ? BellRing : PackageCheck;

export const NotificationsPage = () => {
  const { currentUser, setActiveTab, setIsAuthModalOpen, showToast } = useApp();
  const [center, setCenter] = useState<NotificationCenter | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!currentUser) return setCenter(null);
    try { setCenter(await notificationService.getCenter()); } catch { showToast('Notifications unavailable', 'Please try again in a moment.', 'error'); }
  }, [currentUser, showToast]);
  useEffect(() => {
    void load();
    if (!currentUser) return;
    const unsubscribe = notificationService.subscribe(currentUser.id, () => void load());
    const foreground = () => void load();
    window.addEventListener('thalimitra:notification-received', foreground);
    return () => { unsubscribe(); window.removeEventListener('thalimitra:notification-received', foreground); };
  }, [currentUser, load]);
  const open = async (item: NotificationItem) => {
    if (!item.readAt) { await notificationService.markRead(item.id); }
    setActiveTab(targetTabs[item.targetKey] || 'customer_dashboard');
  };
  const toggle = async (key: 'remindersEnabled' | 'offersEnabled' | 'areaUpdatesEnabled') => {
    if (!center) return;
    const next = { ...center.preferences, [key]: !center.preferences[key] };
    setBusy(true);
    try { await notificationService.updatePreferences(next); setCenter({ ...center, preferences: next }); }
    catch { showToast('Preference not saved', 'Please try again.', 'error'); }
    finally { setBusy(false); }
  };
  if (!currentUser) return <div className="mx-auto max-w-2xl px-4 py-8"><section className="rounded-3xl border border-stone-200 bg-white p-7 text-center"><Bell className="mx-auto h-9 w-9 text-emerald-700" /><h1 className="mt-3 text-xl font-black">Your updates, in one place</h1><p className="mt-2 text-sm text-stone-600">Sign in to see order, plan and service-area updates.</p><button onClick={() => setIsAuthModalOpen(true)} className="mt-5 min-h-11 rounded-xl bg-[#0D6E44] px-6 font-bold text-white">Sign in</button></section></div>;
  return <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
    <section className="rounded-3xl bg-[#0D6E44] p-5 text-white"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Updates</p><h1 className="mt-1 text-2xl font-black">Notifications</h1><p className="mt-1 text-sm text-emerald-100">Orders, plans and delivery-area news.</p></div><BellRing className="h-9 w-9" /></div></section>
    {notificationService.isNativePushAvailable() && <button type="button" onClick={async () => { const ok = await notificationService.requestNativePermission(); showToast(ok ? 'Notifications enabled' : 'Notifications not enabled', ok ? 'Important updates can now reach this phone.' : 'You can still read every update here.', ok ? 'success' : 'info'); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 font-bold text-emerald-900"><Bell className="h-5 w-5" />Enable phone notifications</button>}
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3"><h2 className="font-black">Recent updates</h2>{(center?.unreadCount || 0) > 0 && <button onClick={async () => { await notificationService.markRead(undefined, true); await load(); }} className="flex items-center gap-1 text-xs font-bold text-emerald-800"><CheckCheck className="h-4 w-4" />Mark all read</button>}</div>
      {!center ? <div className="space-y-3 p-4">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-100" />)}</div> : center.notifications.length === 0 ? <div className="p-8 text-center text-sm text-stone-500">No updates yet. Order and meal-plan changes will appear here.</div> : center.notifications.map(item => { const Icon = iconFor(item); return <button key={item.id} onClick={() => void open(item)} className={`flex w-full items-start gap-3 border-b border-stone-100 px-4 py-4 text-left last:border-0 ${item.readAt ? 'bg-white' : 'bg-emerald-50/60'}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-stone-900">{item.title}</span><span className="mt-1 block text-sm text-stone-600">{item.body}</span><span className="mt-2 block text-[11px] font-semibold text-stone-400">{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(item.createdAt))}</span></span><ChevronRight className="mt-3 h-4 w-4 text-stone-400" /></button>; })}
    </section>
    {center && <section className="rounded-3xl border border-stone-200 bg-white p-4"><h2 className="font-black">What can notify you</h2><div className="mt-3 space-y-2"><Preference label="Upcoming meal reminders" checked={center.preferences.remindersEnabled} disabled={busy} onChange={() => void toggle('remindersEnabled')} /><Preference label="Offers and savings" checked={center.preferences.offersEnabled} disabled={busy} onChange={() => void toggle('offersEnabled')} /><Preference label="New delivery areas" checked={center.preferences.areaUpdatesEnabled} disabled={busy} onChange={() => void toggle('areaUpdatesEnabled')} /></div><p className="mt-3 text-xs text-stone-500">Order and payment updates stay on because they are essential service messages.</p></section>}
  </div>;
};

const Preference = ({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: () => void }) => <label className="flex min-h-12 items-center justify-between rounded-2xl bg-stone-50 px-4 text-sm font-bold text-stone-800"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={checked} disabled={disabled} onChange={onChange} /></label>;
