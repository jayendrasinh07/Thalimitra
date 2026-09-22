/**
 * Thalimitra - Centralized Permission Manager
 * Strictly enforces Just-In-Time and Privacy-First permission policies.
 * 
 * Policy:
 * - Location: YES (Just-in-time, only when user clicks 'Use My Location' or starts ordering)
 * - Notifications: OPTIONAL (Contextual, post-order confirmation)
 * - Camera, Microphone, Contacts, Bluetooth, Files, Background GPS: DISALLOWED
 */

import { LocationState, NotificationPermissionState } from '../types';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface GeolocationResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  errorType?: 'permission-denied' | 'unavailable' | 'timeout' | 'insecure-context' | 'unsupported';
  errorMessage?: string;
}

class PermissionManager {
  private static instance: PermissionManager;

  private constructor() {}

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  /**
   * Check current Location permission status without prompting the user.
   */
  public async checkLocationPermission(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
    if (Capacitor.isNativePlatform()) {
      try {
        const state = (await Geolocation.checkPermissions()).location;
        return state === 'prompt-with-rationale' ? 'prompt' : state;
      } catch {
        return 'prompt';
      }
    }
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return 'unsupported';
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return result.state; // 'granted' | 'prompt' | 'denied'
      } catch (err) {
        // Fallback for browsers that don't support geolocation permission query
        return 'prompt';
      }
    }

    return 'prompt';
  }

  /**
   * Request GPS Coordinates with high accuracy, clean timeouts, and friendly error handling.
   * Only triggers when user explicitly taps "Use My Location".
   */
  public async requestLocationPosition(
    options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0 // Do NOT allow stale cached location to be silently reused
    }
  ): Promise<GeolocationResult> {
    if (Capacitor.isNativePlatform()) {
      try {
        const position = await Geolocation.getCurrentPosition(options);
        return { success: true, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
      } catch (error: any) {
        const detail = String(error?.message || '').toLowerCase();
        const errorType = detail.includes('permission') || detail.includes('denied') ? 'permission-denied'
          : detail.includes('timeout') ? 'timeout' : 'unavailable';
        return { success: false, errorType, errorMessage: errorType === 'permission-denied'
          ? 'Location permission is off. Enable it in Android settings or search your address manually.'
          : 'Could not detect your location. Please search your address or move the map pin.' };
      }
    }
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return {
        success: false,
        errorType: 'unsupported',
        errorMessage: 'Geolocation is not supported by your browser. Please enter your address manually.'
      };
    }

    // Check secure context (HTTPS)
    if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return {
        success: false,
        errorType: 'insecure-context',
        errorMessage: 'Location detection requires a secure HTTPS connection. Please enter your area manually.'
      };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          resolve({
            success: true,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error: GeolocationPositionError) => {
          let errorType: 'permission-denied' | 'unavailable' | 'timeout' = 'unavailable';
          let errorMessage = "We couldn't detect your location. You can enter your address manually.";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorType = 'permission-denied';
              errorMessage = 'Location access was denied. You can enter your address manually or enable location in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorType = 'unavailable';
              errorMessage = 'GPS signal is currently unavailable. Please enter your area or sector manually.';
              break;
            case error.TIMEOUT:
              errorType = 'timeout';
              errorMessage = 'Location request took too long. Please select your sector manually.';
              break;
            default:
              errorType = 'unavailable';
              errorMessage = "We couldn't detect your location. You can enter your address manually.";
              break;
          }

          resolve({
            success: false,
            errorType,
            errorMessage
          });
        },
        options
      );
    });
  }

  /**
   * Check Notification permission status.
   */
  public checkNotificationPermission(): NotificationPermissionState {
    if (Capacitor.isNativePlatform()) return 'unsupported';
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    return Notification.permission as NotificationPermissionState;
  }

  /**
   * Request Notification permission contextually (only post-order confirmation).
   */
  public async requestNotificationPermission(): Promise<NotificationPermissionState> {
    if (Capacitor.isNativePlatform()) return 'unsupported';
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    try {
      const permission = await Notification.requestPermission();
      return permission as NotificationPermissionState;
    } catch (error) {
      console.warn('Notification permission request failed:', error);
      return 'denied';
    }
  }

  /**
   * Send a contextual native order update notification if permission granted.
   */
  public sendOrderNotification(title: string, options?: NotificationOptions): boolean {
    if (Capacitor.isNativePlatform()) return false;
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options
        });
        return true;
      } catch (e) {
        console.warn('Failed to display native notification:', e);
        return false;
      }
    }

    return false;
  }
}

export const permissionManager = PermissionManager.getInstance();
