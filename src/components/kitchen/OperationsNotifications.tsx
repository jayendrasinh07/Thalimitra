import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { notificationService, type NotificationItem } from '../../services/notificationService';

export const OperationsNotifications = ({ onNavigate }: { onNavigate: (target: string) => void }) => {
  const { currentUser } = useApp();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try { const center = await notificationService.getCenter(); setItems(center.notifications.slice(0, 12)); setUnread(center.unreadCount); } catch { /* Existing operational views remain usable. */ }
  }, [currentUser]);
  useEffect(() => { void refresh(); if (!currentUser) return; return notificationService.subscribe(currentUser.id, () => void refresh()); }, [currentUser, refresh]);
  return <div className="relative print:hidden">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={unread ? `Operations alerts, ${unread} unread` : 'Operations alerts'} className={`group relative grid h-11 w-11 place-items-center rounded-full border outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:scale-95 ${open || unread > 0 ? 'border-emerald-800 bg-emerald-800 text-white shadow-[0_6px_16px_rgba(6,95,70,0.2)]' : 'border-transparent bg-stone-100 text-stone-700 hover:bg-emerald-100 hover:text-emerald-800'}`}>
      <Bell className="h-[21px] w-[21px] transition-transform duration-200 group-hover:-rotate-6" strokeWidth={2.15} aria-hidden="true" />{unread > 0 && <span aria-hidden="true" className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-rose-600 px-1 text-[9px] font-black leading-none text-white shadow-sm">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-13 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3"><div><p className="text-sm font-black">Operations alerts</p><p className="text-xs text-stone-500">Orders, capacity and plan requests</p></div><div className="flex items-center gap-1">{unread > 0 && <button aria-label="Mark all read" onClick={async () => { await notificationService.markRead(undefined, true); await refresh(); }} className="rounded-lg p-2 text-emerald-700"><CheckCheck className="h-4 w-4" /></button>}<button aria-label="Close" onClick={() => setOpen(false)} className="rounded-lg p-2 text-stone-500"><X className="h-4 w-4" /></button></div></div>
      <div className="max-h-96 overflow-y-auto">{items.length === 0 ? <p className="p-6 text-center text-sm text-stone-500">No new operational alerts.</p> : items.map(item => <button key={item.id} onClick={async () => { if (!item.readAt) await notificationService.markRead(item.id); setOpen(false); onNavigate(item.targetKey); }} className={`block w-full border-b border-stone-100 px-4 py-3 text-left last:border-0 ${item.readAt ? 'bg-white' : 'bg-emerald-50/70'}`}><span className="block text-sm font-black text-stone-900">{item.title}</span><span className="mt-1 block text-xs text-stone-600">{item.body}</span></button>)}</div>
    </div>}
  </div>;
};
