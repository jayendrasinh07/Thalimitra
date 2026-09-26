import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { notificationService } from '../../services/notificationService';

export const NotificationBell = ({ compact = false }: { compact?: boolean }) => {
  const { activeTab, currentUser, setActiveTab } = useApp();
  const [count, setCount] = useState(0);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const hasLoaded = useRef(false);
  const previousCount = useRef(0);
  const refresh = useCallback(async () => {
    if (!currentUser) return setCount(0);
    try {
      const nextCount = (await notificationService.getCenter()).unreadCount;
      if (hasLoaded.current && nextCount > previousCount.current) setHasNewActivity(true);
      previousCount.current = nextCount;
      hasLoaded.current = true;
      setCount(nextCount);
    } catch { setCount(0); }
  }, [currentUser]);
  useEffect(() => {
    previousCount.current = 0;
    hasLoaded.current = false;
    setHasNewActivity(false);
    void refresh();
    if (!currentUser) return;
    return notificationService.subscribe(currentUser.id, () => void refresh());
  }, [currentUser, refresh]);
  useEffect(() => {
    if (!hasNewActivity) return;
    const timer = window.setTimeout(() => setHasNewActivity(false), 650);
    return () => window.clearTimeout(timer);
  }, [hasNewActivity]);
  if (!currentUser || activeTab === 'notifications') return null;
  const hasUnread = count > 0;
  return <button type="button" aria-label={hasUnread ? `Notifications, ${count} unread` : 'Notifications'} onClick={() => setActiveTab('notifications')}
    className={`group relative grid shrink-0 place-items-center rounded-full border shadow-sm outline-none transition duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[#0D6E44] focus-visible:ring-offset-2 active:scale-95 ${compact ? 'h-11 w-11' : 'h-12 w-12'} ${hasUnread ? 'border-emerald-200 bg-emerald-50 text-[#0D6E44] hover:bg-emerald-100' : 'border-stone-200/90 bg-white text-stone-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0D6E44]'} ${hasNewActivity ? 'motion-safe:scale-110' : ''}`}>
    <Bell className="h-[21px] w-[21px] transition-transform duration-200 group-hover:-rotate-6" strokeWidth={2.15} aria-hidden="true" />
    {hasUnread && <span aria-hidden="true" className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-rose-600 px-1 text-[9px] font-black leading-none text-white shadow-sm">{count > 9 ? '9+' : count}</span>}
    <span className="sr-only" aria-live="polite">{hasUnread ? `${count} unread notifications` : 'No unread notifications'}</span>
  </button>;
};
