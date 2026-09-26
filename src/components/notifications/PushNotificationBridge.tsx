import { useEffect } from 'react';
import { useApp, type ActiveTab } from '../../context/AppContext';
import { notificationService, type NotificationTarget } from '../../services/notificationService';

const customerTargets: Partial<Record<NotificationTarget, ActiveTab>> = {
  home: 'home', order_history: 'order_history', meal_plans: 'meal_plans', customer_dashboard: 'customer_dashboard', coverage: 'coverage',
};

export const PushNotificationBridge = () => {
  const { currentUser, setActiveTab, showToast } = useApp();
  useEffect(() => {
    if (!currentUser) return;
    let cleanup = () => undefined;
    void notificationService.initializeNativePush({
      onForeground: notification => {
        showToast(notification.title || 'Thalimitra update', notification.body || 'Open Notifications for details.', 'info');
        window.dispatchEvent(new Event('thalimitra:notification-received'));
      },
      onAction: action => {
        const target = action.notification.data?.targetKey as NotificationTarget | undefined;
        setActiveTab((target && customerTargets[target]) || 'notifications');
      },
      onError: () => undefined,
    }).then(dispose => { cleanup = dispose; });
    return () => cleanup();
  }, [currentUser, setActiveTab, showToast]);
  return null;
};
