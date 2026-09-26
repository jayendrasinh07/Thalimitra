import { Capacitor } from '@capacitor/core';
import { PushNotifications, type Token, type ActionPerformed, type PushNotificationSchema } from '@capacitor/push-notifications';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export type NotificationTarget = 'home' | 'order_history' | 'meal_plans' | 'customer_dashboard' | 'coverage' | 'kitchen_dashboard' | 'kitchen_management' | 'kitchen_alerts';
export type NotificationItem = {
  id: string; audience: 'customer' | 'kitchen' | 'admin'; category: 'operational' | 'reminder' | 'offer' | 'area';
  eventType: string; title: string; body: string; targetKey: NotificationTarget; entityType?: string | null;
  entityId?: string | null; readAt?: string | null; createdAt: string;
};
export type NotificationPreferences = { remindersEnabled: boolean; offersEnabled: boolean; areaUpdatesEnabled: boolean; timezone: string };
export type NotificationCenter = { unreadCount: number; notifications: NotificationItem[]; preferences: NotificationPreferences };

const INSTALLATION_KEY = 'thalimitra_installation_id';
const installationId = () => {
  const existing = localStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const value = globalThis.crypto?.randomUUID?.() || `install-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(INSTALLATION_KEY, value);
  return value;
};

const client = () => getSupabaseClient() as any;
const emptyCenter: NotificationCenter = {
  unreadCount: 0, notifications: [],
  preferences: { remindersEnabled: true, offersEnabled: false, areaUpdatesEnabled: true, timezone: 'Asia/Kolkata' },
};

export const notificationService = {
  isNativePushAvailable: () => Capacitor.isNativePlatform(),

  async getCenter(): Promise<NotificationCenter> {
    if (!isSupabaseConfigured()) return emptyCenter;
    const { data, error } = await client().rpc('get_notification_center', { p_limit: 60, p_offset: 0 });
    if (error) throw error;
    return { ...emptyCenter, ...(data || {}) } as NotificationCenter;
  },

  async markRead(id?: string, markAll = false) {
    const { error } = await client().rpc('mark_notification_read', { p_notification_id: id || null, p_mark_all: markAll });
    if (error) throw error;
  },

  async updatePreferences(preferences: Pick<NotificationPreferences, 'remindersEnabled' | 'offersEnabled' | 'areaUpdatesEnabled'>) {
    const { data, error } = await client().rpc('update_notification_preferences', {
      p_reminders_enabled: preferences.remindersEnabled,
      p_offers_enabled: preferences.offersEnabled,
      p_area_updates_enabled: preferences.areaUpdatesEnabled,
    });
    if (error) throw error;
    return data as NotificationPreferences;
  },

  subscribe(userId: string, onChange: () => void) {
    if (!isSupabaseConfigured()) return () => undefined;
    const supabase = client();
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onChange)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  },

  async checkNativePermission() {
    if (!Capacitor.isNativePlatform()) return 'unsupported' as const;
    const state = await PushNotifications.checkPermissions();
    return state.receive;
  },

  async registerToken(token: string) {
    const { error } = await client().rpc('register_push_device', {
      p_installation_id: installationId(), p_push_token: token, p_platform: 'android',
      p_app_id: 'com.thalimitra.customer', p_app_version: '1.22',
    });
    if (error) throw error;
  },

  async unregisterCurrentDevice() {
    if (!isSupabaseConfigured() || !localStorage.getItem(INSTALLATION_KEY)) return;
    await client().rpc('unregister_push_device', { p_installation_id: installationId() });
  },

  async initializeNativePush(handlers: {
    onRegistered?: () => void;
    onForeground?: (notification: PushNotificationSchema) => void;
    onAction?: (action: ActionPerformed) => void;
    onError?: (message: string) => void;
  }) {
    if (!Capacitor.isNativePlatform()) return () => undefined;
    await PushNotifications.removeAllListeners();
    await PushNotifications.createChannel({
      id: 'thalimitra_orders', name: 'Orders and meal plans', description: 'Delivery and meal-plan updates',
      importance: 5, visibility: 1, vibration: true,
    });
    await PushNotifications.addListener('registration', async (token: Token) => {
      try { await this.registerToken(token.value); handlers.onRegistered?.(); }
      catch (error) { handlers.onError?.(error instanceof Error ? error.message : 'Device registration failed'); }
    });
    await PushNotifications.addListener('registrationError', error => handlers.onError?.(error.error || 'Push registration failed'));
    await PushNotifications.addListener('pushNotificationReceived', notification => handlers.onForeground?.(notification));
    await PushNotifications.addListener('pushNotificationActionPerformed', action => handlers.onAction?.(action));
    const state = await PushNotifications.checkPermissions();
    if (state.receive === 'granted') await PushNotifications.register();
    return () => { void PushNotifications.removeAllListeners(); };
  },

  async requestNativePermission() {
    if (!Capacitor.isNativePlatform()) return false;
    let state = await PushNotifications.checkPermissions();
    if (state.receive === 'prompt' || state.receive === 'prompt-with-rationale') state = await PushNotifications.requestPermissions();
    if (state.receive !== 'granted') return false;
    await PushNotifications.register();
    return true;
  },
};
