import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { notificationService } from '../../services/notificationService';

export const NotificationBell = ({ compact = false }: { compact?: boolean }) => {
  const { currentUser, setActiveTab } = useApp();
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    if (!currentUser) return setCount(0);
    try { setCount((await notificationService.getCenter()).unreadCount); } catch { setCount(0); }
  }, [currentUser]);
  useEffect(() => {
    void refresh();
    if (!currentUser) return;
    return notificationService.subscribe(currentUser.id, () => void refresh());
  }, [currentUser, refresh]);
  if (!currentUser) return null;
  return <button type="button" aria-label={count ? `${count} unread notifications` : 'Notifications'} onClick={() => setActiveTab('notifications')}
    className={`relative grid shrink-0 place-items-center rounded-2xl border border-stone-200 bg-white text-stone-700 ${compact ? 'h-10 w-10' : 'h-11 w-11'}`}>
    <Bell className="h-5 w-5" />
    {count > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-black leading-5 text-white">{count > 99 ? '99+' : count}</span>}
  </button>;
};
