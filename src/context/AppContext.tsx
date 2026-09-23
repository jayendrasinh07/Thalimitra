import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { User } from '@supabase/supabase-js';
import { 
  UserRole, 
  CustomerSegment, 
  PlanDuration, 
  MealSlot, 
  DietType, 
  PortionSize,
  UserSubscription,
  MealTraceabilityInfo,
  CustomerFeedback,
  KitchenBatch,
  CorporateAccount,
  CancellationReason,
  OneTimeOrder,
  OrderStatus,
  LocationState,
  NotificationPermissionState,
  DeliveryAddress,
  DetectedLocation,
  ServiceabilityResult,
  CentralLocationState,
  AddressLabel
} from '../types';
import { 
  INITIAL_USER_SUBSCRIPTION, 
  MOCK_TRACEABILITY_MEAL, 
  CUSTOMER_FEEDBACKS, 
  MOCK_KITCHEN_BATCHES,
  MOCK_CORPORATE_ACCOUNTS,
  MEAL_PLANS
} from '../data/config';
import { INITIAL_ONE_TIME_ORDERS } from '../data/orders';
import { SUBSCRIPTIONS_ENABLED } from '../config/featureFlags';
import { checkMealAvailability, istDate } from '../services/availabilityEngine';
import { permissionManager } from '../services/permissionService';
import { 
  reverseGeocodeCoordinates,
  getCachedLocation,
  setCachedLocation, 
  getSavedAddresses, 
  saveAddressesToStorage, 
  DEFAULT_SAVED_ADDRESSES,
  EMPTY_DELIVERY_ADDRESS,
  checkAreaServiceability,
  getInitialCentralLocationState,
  validateOrderPayload,
  getDefaultAddressId
} from '../services/locationService';
import { authService, AuthProfile } from '../services/authService';
import { addressService } from '../services/addressService';
import { orderService } from '../services/orderService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { rememberOrderOrigin } from '../services/orderNavigation';
import { UserRoleType, CustomerSegmentType } from '../types/database.types';

export type ActiveTab = 
  // Public
  | 'home' 
  | 'how_it_works' 
  | 'meal_plans' 
  | 'todays_menu' 
  | 'order_once'
  | 'students' 
  | 'workers' 
  | 'corporate' 
  | 'about_us' 
  | 'quality_hygiene' 
  | 'quality_standards'
  | 'why_us'
  | 'coverage'
  | 'faq' 
  | 'contact'
  // Customer
  | 'customer_dashboard'
  | 'my_subscription'
  | 'meal_preferences'
  | 'delivery_tracking'
  | 'order_history'
  | 'profile'
  | 'traceability'
  | 'password_recovery'
  // Business / Admin
  | 'admin_dashboard'
  | 'kitchen_dashboard'
  | 'delivery_dashboard'
  | 'corporate_admin_dashboard'
  | 'customer_management'
  | 'subscription_management'
  | 'meal_planning'
  | 'kitchen_operations'
  | 'delivery_clusters'
  | 'corporate_accounts'
  | 'feedback_analytics'
  | 'revenue_overview';

export type LegalTab = 'privacy' | 'terms' | 'refund' | 'delivery' | 'faq';

interface ToastState {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

interface AppContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  subscription: UserSubscription;
  setSubscription: React.Dispatch<React.SetStateAction<UserSubscription>>;
  
  // One-Time Ordering System
  oneTimeOrders: OneTimeOrder[];
  activeTrackingOrder: OneTimeOrder | null;
  setActiveTrackingOrder: (order: OneTimeOrder | null) => void;
  isOrderOnceModalOpen: boolean;
  setIsOrderOnceModalOpen: (open: boolean) => void;
  createOneTimeOrder: (orderData: Omit<OneTimeOrder, 'id' | 'createdAt' | 'traceabilityMealId'>) => Promise<OneTimeOrder>;
  reorderMeal: (orderId: string) => void;
  cancelOneTimeOrder: (orderId: string, reason: CancellationReason, note?: string) => Promise<boolean>;
  advanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;

  // Interactive Operations
  pauseSubscription: (daysCount?: number) => void;
  resumeSubscription: () => void;
  skipTomorrowMeal: (slot?: MealSlot) => void;
  unskipMeal: (date: string) => void;
  updatePreferences: (diet: DietType, portion: PortionSize, addons: UserSubscription['addons'], notes?: string) => void;
  updateDeliveryAddress: (address: UserSubscription['deliveryAddress']) => void;
  createNewSubscription: (planId: PlanDuration, segment: CustomerSegment, slot: MealSlot, diet: DietType, portion: PortionSize, address: UserSubscription['deliveryAddress'], addons: UserSubscription['addons']) => void;
  
  // Location & Address Intelligence System
  centralLocation: CentralLocationState;
  locationState: LocationState;
  setLocationState: (state: LocationState) => void;
  detectedLocation: DetectedLocation | null;
  setDetectedLocation: (loc: DetectedLocation | null) => void;
  activeDeliveryAddress: DeliveryAddress;
  setActiveDeliveryAddress: (address: DeliveryAddress) => void;
  defaultAddressId: string;
  savedAddresses: DeliveryAddress[];
  detectUserLocation: () => Promise<DetectedLocation | null>;
  simulateLocationCoordinates: (latitude: number, longitude: number, accuracy?: number) => Promise<DetectedLocation>;
  confirmDetectedAddress: (options?: { label?: AddressLabel; fullName?: string; phone?: string; addressLine1?: string }) => DeliveryAddress;
  selectDeliveryAddress: (address: DeliveryAddress) => void;
  saveDeliveryAddress: (address: DeliveryAddress) => Promise<DeliveryAddress>;
  deleteDeliveryAddress: (id: string) => void;
  setDefaultDeliveryAddress: (id: string) => void;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
  locationErrorMessage: string | null;
  setLocationErrorMessage: (msg: string | null) => void;
  
  // Notification Management
  notificationPermission: NotificationPermissionState;
  requestNotificationPermission: () => Promise<boolean>;
  sendOrderLiveNotification: (title: string, body: string) => void;

  // Modals & Triggers
  isSubscribeModalOpen: boolean;
  setIsSubscribeModalOpen: (open: boolean) => void;
  selectedPlanForCheckout: PlanDuration | null;
  setSelectedPlanForCheckout: (plan: PlanDuration | null) => void;
  openCheckoutForPlan: (planId: PlanDuration) => void;

  isTraceabilityModalOpen: boolean;
  setIsTraceabilityModalOpen: (open: boolean) => void;
  activeTraceabilityMeal: MealTraceabilityInfo;
  lookupMealTraceability: (mealId: string) => void;

  isCorporateModalOpen: boolean;
  setIsCorporateModalOpen: (open: boolean) => void;

  isFeedbackModalOpen: boolean;
  setIsFeedbackModalOpen: (open: boolean) => void;
  submitCustomerFeedback: (rating: number, comment: string, tags: string[]) => void;

  isAreaCheckerOpen: boolean;
  setIsAreaCheckerOpen: (open: boolean) => void;

  // Legal & Help Modal
  isLegalModalOpen: boolean;
  setIsLegalModalOpen: (open: boolean) => void;
  legalModalTab: LegalTab;
  setLegalModalTab: (tab: LegalTab) => void;
  openLegalModal: (tab: LegalTab) => void;

  // Supabase Authentication & User Profile
  currentUser: User | null;
  userProfile: AuthProfile | null;
  userRolesList: UserRoleType[];
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isSupabaseConnected: boolean;
  signInUser: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpUser: (email: string, password: string, fullName: string, phone: string, segment?: CustomerSegmentType) => Promise<{ error: Error | null }>;
  signOutUser: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;

  // Live Data
  feedbacks: CustomerFeedback[];
  kitchenBatches: KitchenBatch[];
  advanceKitchenBatch: (batchId: string) => void;
  corporateAccounts: CorporateAccount[];
  
  // Toasts
  toasts: ToastState[];
  showToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const currentPath = () => window.location.pathname.replace(/\/+$/, '') || '/';
const isOpsBuild = (import.meta as any).env?.VITE_APP_TARGET === 'ops';
const LEGAL_PATH_BY_TAB: Record<LegalTab, string> = {
  privacy: '/privacy-policy',
  terms: '/terms-and-conditions',
  refund: '/cancellation-and-refunds',
  delivery: '/shipping-and-delivery',
  faq: '/faqs'
};
const legalTabForPath = (): LegalTab | null => {
  const path = currentPath();
  return (Object.entries(LEGAL_PATH_BY_TAB).find(([, value]) => value === path)?.[0] as LegalTab | undefined) ?? null;
};
const tabForPath = (): ActiveTab => isOpsBuild
  ? currentPath() === '/reset-password' ? 'password_recovery' : 'kitchen_dashboard'
  : currentPath() === '/reset-password'
    ? 'password_recovery'
    : currentPath() === '/order'
      ? 'order_once'
    : currentPath() === '/contact'
      ? 'contact'
      : currentPath() === '/pricing'
        ? 'todays_menu'
        : 'home';

const scrollToPublishedMenu = (attempt = 0) => {
  window.requestAnimationFrame(() => {
    const menuSection = document.getElementById('todays-menu-section');
    if (menuSection) {
      menuSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (attempt < 20) window.setTimeout(() => scrollToPublishedMenu(attempt + 1), 50);
  });
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialLegalTab = legalTabForPath();
  const [activeTab, setActiveTabState] = useState<ActiveTab>(tabForPath);
  const setActiveTab = useCallback((tab: ActiveTab) => {
    const safeTab = !SUBSCRIPTIONS_ENABLED && (
      tab === 'meal_plans' || tab === 'my_subscription' || tab === 'subscription_management'
    ) ? 'order_once' : tab;
    if (safeTab === 'order_once' && activeTab !== 'order_once') rememberOrderOrigin(activeTab);
    setActiveTabState(safeTab);
    if (safeTab === 'todays_menu' && activeTab === 'todays_menu') scrollToPublishedMenu();
  }, [activeTab]);
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [subscription, setSubscription] = useState<UserSubscription>(INITIAL_USER_SUBSCRIPTION);

  const [oneTimeOrders, setOneTimeOrders] = useState<OneTimeOrder[]>([]);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<OneTimeOrder|null>(null);
  const [isOrderOnceModalOpen, setIsOrderOnceModalOpen] = useState<boolean>(false);

  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>(CUSTOMER_FEEDBACKS);
  const [kitchenBatches, setKitchenBatches] = useState<KitchenBatch[]>(MOCK_KITCHEN_BATCHES);
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateAccount[]>(MOCK_CORPORATE_ACCOUNTS);
  const [activeTraceabilityMeal, setActiveTraceabilityMeal] = useState<MealTraceabilityInfo>(MOCK_TRACEABILITY_MEAL);

  // Location & Address Intelligence State
  const [centralLocation, setCentralLocation] = useState<CentralLocationState>(() => getInitialCentralLocationState());
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(() => getCachedLocation());
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>(() => getSavedAddresses());
  const [defaultAddressId, setDefaultAddressIdState] = useState<string>(() => getDefaultAddressId());
  const [activeDeliveryAddress, setActiveDeliveryAddress] = useState<DeliveryAddress>(() => {
    const addresses = getSavedAddresses();
    const defaultAddr = addresses.find((a) => a.isDefault);
    return defaultAddr || addresses[0] || EMPTY_DELIVERY_ADDRESS;
  });
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);

  // Notification State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(() => 
    permissionManager.checkNotificationPermission()
  );

  // Modals
  const [isSubscribeModalOpen, setIsSubscribeModalOpenState] = useState<boolean>(false);
  const setIsSubscribeModalOpen = useCallback((open: boolean) => {
    setIsSubscribeModalOpenState(SUBSCRIPTIONS_ENABLED && open);
  }, []);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PlanDuration | null>(null);
  const [isTraceabilityModalOpen, setIsTraceabilityModalOpen] = useState<boolean>(false);
  const [isCorporateModalOpen, setIsCorporateModalOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [isAreaCheckerOpen, setIsAreaCheckerOpen] = useState<boolean>(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(() => !isOpsBuild && initialLegalTab !== null);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab>(initialLegalTab ?? 'privacy');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Supabase Auth & Profile State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<AuthProfile | null>(null);
  const [userRolesList, setUserRolesList] = useState<UserRoleType[]>(['customer']);
  const isSupabaseConnected = isSupabaseConfigured();


  const authGeneration = useRef(0);
  const authIdentity = useRef<string|null>(null);
  const clearCustomerData = useCallback(() => {
    setSubscription(INITIAL_USER_SUBSCRIPTION);setOneTimeOrders([]);setActiveTrackingOrder(null);setSavedAddresses([]);setActiveDeliveryAddress(EMPTY_DELIVERY_ADDRESS);setDefaultAddressIdState('');
    setCentralLocation(getInitialCentralLocationState());setDetectedLocation(null);setUserProfile(null);setUserRolesList([]);setUserRole('guest');
    for(const key of ['teffein_user_role','teffein_onetime_orders','teffein_saved_customer_orders','teffein_saved_addresses','teffein_mock_auth_session','teffein_sub'])localStorage.removeItem(key);
    sessionStorage.removeItem('teffein_active_delivery_location');
  },[]);
  const refreshUserProfile = useCallback(async () => {
    const generation=++authGeneration.current;
    const user=await authService.getCurrentUser();
    if(generation!==authGeneration.current)return;
    if(authIdentity.current!==user?.id){clearCustomerData();authIdentity.current=user?.id??null;}
    setCurrentUser(user);
    if(!user)return;
    try {
      const [profile,roles,addresses,orders]=await Promise.all([authService.getProfile(user.id),authService.getUserRoles(user.id),addressService.getUserAddresses(user.id),orderService.getUserOrders(user.id)]);
      if(generation!==authGeneration.current)return;
      setUserProfile(profile);setUserRolesList(roles);setUserRole(roles.includes('admin')?'admin':roles.includes('kitchen')?'kitchen_lead':roles.includes('delivery')?'delivery_fleet':roles.includes('corporate')?'corporate_lead':'customer');
      setSavedAddresses(addresses);setOneTimeOrders(orders);
      const address=addresses.find(a=>a.isDefault)||addresses[0]||EMPTY_DELIVERY_ADDRESS;
      setActiveDeliveryAddress(address);setDefaultAddressIdState(address.id);
      setActiveTrackingOrder(prev=>prev?orders.find(o=>o.id===prev.id)??null:null);
    } catch(error) { if(generation===authGeneration.current){clearCustomerData();setCurrentUser(user);console.error('Unable to load account data',error);} }
  },[clearCustomerData]);

  useEffect(() => {
    if(!currentUser)return;
    const owner=currentUser.id;let alive=true;
    const refresh=async()=>{try{const orders=await orderService.getUserOrders(owner);if(alive&&authIdentity.current===owner){setOneTimeOrders(orders);setActiveTrackingOrder(prev=>prev?orders.find(o=>o.id===prev.id)??null:null);}}catch{/* Keep the last confirmed server state during a temporary connection failure. */}};
    let unsubscribe=()=>{};try{unsubscribe=orderService.subscribe(owner,()=>{void refresh();});}catch{/* The 15-second refresh remains active if realtime cannot connect. */}
    const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);
    return()=>{alive=false;unsubscribe();clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[currentUser?.id]);

  // Auth Lifecycle Initializer
  useEffect(() => {
    refreshUserProfile();

    const { data: { subscription: authSub } } = authService.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setActiveTab('password_recovery');
      if (session?.user) {
        if(authIdentity.current!==session.user.id){++authGeneration.current;clearCustomerData();authIdentity.current=session.user.id;}
        setCurrentUser(session.user);
        setTimeout(() => { void refreshUserProfile(); }, 0);
      } else {
        ++authGeneration.current;authIdentity.current=null;setCurrentUser(null);clearCustomerData();
      }
    });

    return () => {
      authSub?.unsubscribe();
    };
  }, [refreshUserProfile]);

  const signInUser = async (email: string, password: string) => {
    const res = await authService.signIn(email, password);
    if (!res.error) {
      await refreshUserProfile();
    }
    return res;
  };

  const signUpUser = async (email: string, password: string, fullName: string, phone: string, segment: CustomerSegmentType = 'individual') => {
    const res = await authService.signUp(email, password, fullName, phone, segment);
    if (!res.error) {
      await refreshUserProfile();
    }
    return res;
  };

  const signOutUser = async () => {
    const result=await authService.signOut();
    if(result.error){showToast('Sign out failed',result.error.message,'error');return;}
    ++authGeneration.current;authIdentity.current=null;clearCustomerData();setActiveTab(isOpsBuild ? 'kitchen_dashboard' : 'home');
    setCurrentUser(null);
    setUserProfile(null);
    setUserRolesList([]);
    setUserRole('guest');
    showToast('Signed Out', 'You have been safely signed out.', 'info');
  };

  const openLegalModal = useCallback((tab: LegalTab = 'privacy') => {
    setLegalModalTab(tab);
    setIsLegalModalOpen(true);
    if (!isOpsBuild && currentPath() !== LEGAL_PATH_BY_TAB[tab]) {
      window.history.pushState(null, '', LEGAL_PATH_BY_TAB[tab]);
    }
  }, []);

  // Toasts
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => { for(const key of ['teffein_user_role','teffein_onetime_orders','teffein_saved_customer_orders','teffein_saved_addresses','teffein_mock_auth_session','teffein_sub'])localStorage.removeItem(key); }, []);

  useEffect(() => {
    const handlePopState = () => {
      const legalTab = legalTabForPath();
      setActiveTab(tabForPath());
      setLegalModalTab(legalTab ?? 'privacy');
      setIsLegalModalOpen(!isOpsBuild && legalTab !== null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const path = currentPath();
    if (isOpsBuild) {
      const destination = activeTab === 'password_recovery'
        ? (path === '/reset-password' ? null : '/reset-password')
        : path === '/' || path === '/management' || path === '/reports' ? null : '/';
      if (destination && destination !== path) window.history.pushState(null, '', destination);
      return;
    }
    const destination = activeTab === 'password_recovery'
        ? '/reset-password'
        : activeTab === 'order_once'
          ? (path === '/order' ? null : '/order')
        : activeTab === 'contact'
          ? (path === '/contact' ? null : '/contact')
        : activeTab === 'todays_menu' && path === '/pricing'
          ? null
        : legalTabForPath() && isLegalModalOpen
          ? null
        : path !== '/' ? '/' : null;
    if (destination && destination !== path) window.history.pushState(null, '', destination);
  }, [activeTab, isLegalModalOpen]);

  // Move every menu CTA to the actual published choices, including lazy-loaded first visits.
  useEffect(() => {
    if (activeTab === 'todays_menu') {
      scrollToPublishedMenu();
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const showToast = (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ----------------------------------------------------
  // LOCATION & ADDRESS INTELLIGENCE ACTIONS
  // ----------------------------------------------------
  const processResolvedLocation = useCallback((resolved: DetectedLocation) => {
    setDetectedLocation(resolved);
    setCachedLocation(resolved);

    const zoneId = (resolved.serviceability?.zoneId || (resolved.isServiceable ? 'zone_a_core' : 'unserviceable')) as 'zone_a_core' | 'zone_b_extended' | 'zone_c_periphery' | 'unserviceable';
    const fee = Number(resolved.serviceability?.deliveryFee || 0);

    setCentralLocation((prev) => ({
      ...prev,
      detectionStatus: 'detected',
      permissionStatus: 'granted',
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      accuracy: resolved.accuracy ?? null,
      detectedAt: resolved.timestamp,
      source: 'gps',
      city: resolved.city,
      area: resolved.area,
      sector: resolved.sector || resolved.area,
      pincode: resolved.pincode,
      formattedAddress: resolved.displayName,
      serviceable: resolved.isServiceable,
      deliveryZoneId: zoneId,
      deliveryFee: fee,
      isAddressConfirmed: false
    }));

    if (resolved.isServiceable) {
      setLocationState('serviceable');
      showToast('GPS Location Detected', `${resolved.displayName}. Confirm your address to activate cluster delivery.`, 'success');
    } else {
      setLocationState('not-serviceable');
      showToast(resolved.serviceability?.status === 'coming_soon' ? 'Your area is coming soon' : 'Your area could be next', resolved.serviceability?.status === 'coming_soon' ? resolved.serviceability.message : 'Join the priority list and we will alert you when verified delivery opens here.', 'warning');
    }
  }, []);

  const detectUserLocation = useCallback(async (): Promise<DetectedLocation | null> => {
    setLocationState('requesting');
    setLocationErrorMessage(null);
    setDetectedLocation(null); // Clear stale location before new GPS request
    setCentralLocation((prev) => ({
      ...prev,
      detectionStatus: 'detecting',
      permissionStatus: 'granted'
    }));

    const geoResult = await permissionManager.requestLocationPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0 // Strictly fresh GPS coordinates
    });

    if (!geoResult.success || geoResult.latitude === undefined || geoResult.longitude === undefined) {
      const errType = geoResult.errorType || 'unavailable';
      const locationErrorState: LocationState =
        errType === 'permission-denied' || errType === 'timeout' ? errType : 'unavailable';
      setLocationState(locationErrorState);
      setLocationErrorMessage(geoResult.errorMessage || 'Unable to detect GPS location.');
      setCentralLocation((prev) => ({
        ...prev,
        detectionStatus: 'failed',
        permissionStatus: errType === 'permission-denied' ? 'denied' : prev.permissionStatus
      }));
      showToast('Location Detection', geoResult.errorMessage || 'Unable to detect GPS location. You can enter or select your area manually.', 'warning');
      return null;
    }

    console.log(
      'GPS RESULT\n' +
      `latitude: ${geoResult.latitude}\n` +
      `longitude: ${geoResult.longitude}\n` +
      `accuracy: ${geoResult.accuracy !== undefined ? `${geoResult.accuracy.toFixed(1)} meters` : 'N/A'}\n` +
      `timestamp: ${new Date().toISOString()}`
    );

    setLocationState('detecting');
    
    // Real Reverse Geocode coordinates without mock/hardcoded snapping
    const resolved = await reverseGeocodeCoordinates(geoResult.latitude, geoResult.longitude, geoResult.accuracy);
    console.log('Reverse geocoded address:', resolved.formattedAddress || resolved.displayName);
    console.log('Serviceability result:', resolved.serviceability);

    processResolvedLocation(resolved);
    return resolved;
  }, [processResolvedLocation, showToast]);

  const simulateLocationCoordinates = useCallback(async (latitude: number, longitude: number, accuracy?: number): Promise<DetectedLocation> => {
    setLocationState('detecting');
    setCentralLocation((prev) => ({
      ...prev,
      detectionStatus: 'detecting',
      permissionStatus: 'granted'
    }));

    const resolved = await reverseGeocodeCoordinates(latitude, longitude, accuracy);
    processResolvedLocation(resolved);
    return resolved;
  }, [processResolvedLocation]);

  const selectDeliveryAddress = useCallback((address: DeliveryAddress) => {
    setActiveDeliveryAddress(address);
    const fee = Number(address.deliveryFee || 0);
    
    setCentralLocation((prev) => ({
      ...prev,
      isAddressConfirmed: true,
      confirmedAddress: address,
      selectedAddressId: address.id,
      source: address.source || 'saved',
      latitude: address.latitude ?? prev.latitude,
      longitude: address.longitude ?? prev.longitude,
      accuracy: address.accuracy ?? prev.accuracy,
      city: address.city || 'Gandhinagar',
      area: address.area,
      sector: address.sector || address.area,
      pincode: address.pincode,
      formattedAddress: address.addressLine1 || address.addressLine || `${address.area}, Gandhinagar`,
      deliveryZoneId: (address.zoneId || 'zone_a_core') as any,
      deliveryFee: fee,
      serviceable: address.isServiceable
    }));

    // Sync to subscription address
    setSubscription((prev) => ({
      ...prev,
      deliveryAddress: {
        street: address.addressLine1 || address.addressLine || '',
        area: address.area,
        sector: address.sector || address.area,
        pincode: address.pincode,
        landmark: address.landmark || '',
        clusterId: address.clusterId || 'cluster-a',
        deliveryTimeSlot: prev.deliveryAddress.deliveryTimeSlot
      }
    }));

    showToast('Delivery Location Selected', `${address.label}: ${address.area} (${address.pincode})`, 'info');
  }, []);

  const confirmDetectedAddress = useCallback((options?: { label?: AddressLabel; fullName?: string; phone?: string; addressLine1?: string }): DeliveryAddress => {
    const loc = detectedLocation;
    const nowIso = new Date().toISOString();

    if (!loc) {
      const fallback = activeDeliveryAddress;
      setCentralLocation((prev) => ({ ...prev, isAddressConfirmed: true, confirmedAddress: fallback }));
      return fallback;
    }

    const serviceCheck: ServiceabilityResult = loc.serviceability || {
      isServiceable: false,
      status: 'unavailable',
      services: { breakfast: false, lunch: false, dinner: false },
      areaName: loc.area || 'Selected location',
      sectorOrZone: loc.sector || loc.area || 'Selected location',
      city: loc.city || 'Gandhinagar',
      pincode: loc.pincode || '',
      clusterId: '',
      clusterName: '',
      deliveryFee: 0,
      message: 'Delivery availability could not be confirmed. Please try again.',
      estimatedLunchSlot: 'N/A',
      estimatedDinnerSlot: 'N/A',
    };
    const zoneId = (serviceCheck.zoneId || (loc.isServiceable ? 'zone_a_core' : 'unserviceable')) as 'zone_a_core' | 'zone_b_extended' | 'zone_c_periphery';
    const fee = Number(serviceCheck.deliveryFee || 0);

    const newAddr: DeliveryAddress = {
      id: `addr-gps-${Date.now()}`,
      label: options?.label || 'Home',
      name: options?.fullName || activeDeliveryAddress.name || '',
      fullName: options?.fullName || activeDeliveryAddress.fullName || '',
      phone: options?.phone || activeDeliveryAddress.phone || '',
      addressLine1: options?.addressLine1 || loc.displayName || `${loc.sector || loc.area}`,
      addressLine: options?.addressLine1 || loc.displayName || `${loc.sector || loc.area}`,
      area: loc.area || 'Gandhinagar',
      sector: loc.sector || loc.area || 'Gandhinagar',
      city: loc.city || 'Gandhinagar',
      state: loc.state || 'Gujarat',
      pincode: loc.pincode || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      source: 'gps',
      createdAt: nowIso,
      updatedAt: nowIso,
      isDefault: true,
      clusterId: serviceCheck.clusterId || 'cluster-a',
      clusterName: serviceCheck.clusterName || 'Gandhinagar Delivery Cluster',
      zoneId: zoneId as any,
      deliveryFee: fee,
      isServiceable: serviceCheck.isServiceable
    };

    setActiveDeliveryAddress(newAddr);
    setCentralLocation(prev=>({...prev,isAddressConfirmed:false,confirmedAddress:null,selectedAddressId:null}));
    showToast('Location detected','Complete and save the delivery address before ordering.','info');
    return newAddr;
  }, [detectedLocation, activeDeliveryAddress]);


  const saveDeliveryAddress = useCallback(async (address: DeliveryAddress):Promise<DeliveryAddress> => {
    if(!currentUser){setIsAuthModalOpen(true);throw new Error('Please sign in to save this address.');}
    const owner=currentUser.id;
    let saved:DeliveryAddress;
    if(/^[0-9a-f]{8}-/i.test(address.id)){
      await addressService.updateAddress(address.id,address,owner);
      const refreshed=await addressService.getUserAddresses(owner);saved=refreshed.find(a=>a.id===address.id)!;
    }else saved=await addressService.createAddress(owner,address);
    if(authIdentity.current!==owner)throw new Error('Your account changed. Please retry.');
    const addresses=await addressService.getUserAddresses(owner);
    if(authIdentity.current!==owner)throw new Error('Your account changed. Please retry.');
    setSavedAddresses(addresses);setActiveDeliveryAddress(saved);setDefaultAddressIdState(addresses.find(a=>a.isDefault)?.id??'');
    showToast('Address Saved',saved.isServiceable?'Delivery coverage verified.':'This address is outside current delivery coverage.','info');return saved;
  },[currentUser]);
  const deleteDeliveryAddress = useCallback(async (id:string) => {
    try{await addressService.deleteAddress(id,currentUser?.id);await refreshUserProfile();showToast('Address Removed','Delivery address removed.','info');}
    catch(error){showToast('Address not removed',(error as Error).message,'error');}
  },[currentUser,refreshUserProfile]);
  const setDefaultDeliveryAddress = useCallback(async (id:string) => {
    try{await addressService.updateAddress(id,{isDefault:true},currentUser?.id);await refreshUserProfile();showToast('Default Address Set','Your default address has been saved.','success');}
    catch(error){showToast('Address not updated',(error as Error).message,'error');}
  },[currentUser,refreshUserProfile]);

  // ----------------------------------------------------
  // NOTIFICATION ACTIONS
  // ----------------------------------------------------
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    const state = await permissionManager.requestNotificationPermission();
    setNotificationPermission(state);
    if (state === 'granted') {
      showToast('Notifications Enabled', 'You will receive live updates when your meal is prepared, dispatched, and delivered.', 'success');
      permissionManager.sendOrderNotification('Thalimitra Delivery Updates Active 🍲', {
        body: 'You will receive punctual status alerts for your lunch and dinner orders.'
      });
      return true;
    } else if (state === 'denied') {
      showToast('Notifications Blocked', 'You can still view live order tracking anytime on your dashboard.', 'info');
      return false;
    }
    return false;
  }, []);

  const sendOrderLiveNotification = useCallback((title: string, body: string) => {
    if (notificationPermission === 'granted') {
      permissionManager.sendOrderNotification(title, { body });
    }
  }, [notificationPermission]);


  const createOneTimeOrder = async (orderData:Omit<OneTimeOrder,'id'|'createdAt'|'traceabilityMealId'>):Promise<OneTimeOrder> => {
    if(!currentUser)throw new Error('Please sign in to place your order.');
    const owner=currentUser.id;
    const result=await orderService.createOrder({userId:owner,addressId:orderData.address.id,orderDate:orderData.scheduledDate,mealType:orderData.mealSlot,deliverySlotId:orderData.deliverySlotId,mealId:orderData.mealId,quantity:orderData.quantity,selectedAddons:Object.fromEntries(orderData.addOns.map(a=>[a.id,a.quantity])),notes:orderData.notes,promotionCode:orderData.promotionCode,preferences:{spiceLevel:orderData.customizations.spiceLevel,oilLevel:orderData.customizations.oilLevel}});
    if(result.error||!result.order)throw result.error??new Error('The server did not confirm this order.');
    if(authIdentity.current!==owner)throw new Error('Your account changed. Check the original account order history.');
    const order=result.order;setOneTimeOrders(prev=>[order,...prev.filter(o=>o.id!==order.id)]);setActiveTrackingOrder(order);
    showToast('Order Confirmed',`Order ${order.orderNumber} was saved. Payment is pending.`,'success');return order;
  };
  const reorderMeal = (_orderId:string) => {
    setActiveTab('order_once');showToast('Review your next order','Choose a published menu, delivery date and current prices.','info');
  };
  const cancelOneTimeOrder = async (id:string,reason:CancellationReason,note='') => {
    const owner=currentUser?.id;
    try{const order=await orderService.cancelOrder(id,reason,note);if(authIdentity.current!==owner)return false;setOneTimeOrders(prev=>prev.map(o=>o.id===id?order:o));setActiveTrackingOrder(prev=>prev?.id===id?order:prev);showToast('Order Cancelled','Kitchen capacity was released. No payment or refund was processed.','info');return true;}
    catch(error){showToast('Cancellation unavailable',(error as Error).message,'error');return false;}
  };
  const advanceOrderStatus = (_orderId:string,_nextStatus:OrderStatus) => {showToast('Status not changed','Use the kitchen workflow to update preparation status.','info');};

  const pauseSubscription = (daysCount = 3) => {
    const today = new Date().toISOString().split('T')[0];
    setSubscription((prev) => ({
      ...prev,
      status: 'paused',
      pausedDates: [...prev.pausedDates, today]
    }));
    showToast(
      'Subscription Paused',
      `Your subscription is safely paused. Your remaining ${subscription.daysRemaining} days are protected and will resume whenever you are ready.`,
      'info'
    );
  };

  const resumeSubscription = () => {
    setSubscription((prev) => ({
      ...prev,
      status: 'active'
    }));
    showToast(
      'Welcome Back!',
      'Your meal routine has resumed. Tomorrow’s fresh home meal will be dispatched on schedule.',
      'success'
    );
  };

  const skipTomorrowMeal = (slot: MealSlot = 'lunch') => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    setSubscription((prev) => {
      const alreadySkipped = prev.skippedDates.includes(tomorrowStr);
      if (alreadySkipped) return prev;
      return {
        ...prev,
        skippedDates: [...prev.skippedDates, tomorrowStr],
        daysRemaining: prev.daysRemaining + 1 // rollover credit day!
      };
    });

    showToast(
      'Tomorrow’s Meal Skipped',
      `Meal for ${tomorrowStr} (${slot}) skipped. We added +1 day credit to your subscription balance!`,
      'warning'
    );
  };

  const unskipMeal = (dateStr: string) => {
    setSubscription((prev) => ({
      ...prev,
      skippedDates: prev.skippedDates.filter((d) => d !== dateStr),
      daysRemaining: Math.max(1, prev.daysRemaining - 1)
    }));
    showToast('Meal Restored', `Meal on ${dateStr} is back on your active delivery schedule.`, 'success');
  };

  const updatePreferences = (diet: DietType, portion: PortionSize, addons: UserSubscription['addons'], notes?: string) => {
    setSubscription((prev) => ({
      ...prev,
      dietType: diet,
      portionSize: portion,
      addons,
      specialInstructions: notes !== undefined ? notes : prev.specialInstructions
    }));
    showToast('Preferences Saved', 'Your kitchen kitchen profile and spice preferences have been updated.', 'success');
  };

  const updateDeliveryAddress = (address: UserSubscription['deliveryAddress']) => {
    setSubscription((prev) => ({
      ...prev,
      deliveryAddress: address
    }));
    showToast('Address Updated', `Delivery cluster assigned: ${address.clusterId}. Delivery window updated.`, 'success');
  };

  const openCheckoutForPlan = (planId: PlanDuration) => {
    if (!SUBSCRIPTIONS_ENABLED) {
      setActiveTab('order_once');
      return;
    }
    setSelectedPlanForCheckout(planId);
    setIsSubscribeModalOpen(true);
  };

  const createNewSubscription = (
    planId: PlanDuration,
    segment: CustomerSegment,
    slot: MealSlot,
    diet: DietType,
    portion: PortionSize,
    address: UserSubscription['deliveryAddress'],
    addons: UserSubscription['addons']
  ) => {
    const planObj = MEAL_PLANS.find((p) => p.id === planId) || MEAL_PLANS[2];
    const newSub: UserSubscription = {
      id: `SUB-GJ-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: 'USR-892',
      userName: 'Aarav Patel',
      userPhone: '+91 98254 99120',
      userEmail: 'aarav.patel.pdpu@gmail.com',
      userSegment: segment,
      planId: planId,
      planName: planObj.name,
      slot: slot,
      dietType: diet,
      portionSize: portion,
      status: 'active',
      startDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + planObj.totalMeals * 86400000).toISOString().split('T')[0],
      totalDays: planObj.totalMeals,
      daysRemaining: planObj.totalMeals,
      mealsDeliveredCount: 0,
      pausedDates: [],
      skippedDates: [],
      deliveryAddress: address,
      addons: addons
    };

    setSubscription(newSub);
    setIsSubscribeModalOpen(false);

    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // ignore
    }

    showToast(
      'Meal Plan Activated!',
      `Congratulations! Your ${planObj.name} is active. Your first hot meal arrives tomorrow between ${address.deliveryTimeSlot}.`,
      'success'
    );

    setActiveTab('customer_dashboard');
  };

  const lookupMealTraceability = (mealId: string) => {
    if (mealId.toUpperCase() === 'GDM-2841' || !mealId) {
      setActiveTraceabilityMeal(MOCK_TRACEABILITY_MEAL);
    } else {
      setActiveTraceabilityMeal({
        ...MOCK_TRACEABILITY_MEAL,
        mealId: mealId.toUpperCase(),
        preparedTime: '10:15 AM',
        packedTime: '10:48 AM',
        dispatchTime: '11:10 AM',
        deliveredTime: '12:05 PM',
        currentStatus: 'delivered'
      });
    }
    setIsTraceabilityModalOpen(true);
  };

  const submitCustomerFeedback = (rating: number, comment: string, tags: string[]) => {
    const newFb: CustomerFeedback = {
      id: `FB-${Math.random().toString(36).substring(2, 6)}`,
      customerName: subscription.userName || 'Aarav Patel',
      customerRole: 'Subscriber, Gandhinagar',
      sectorOrArea: `${subscription.deliveryAddress.area}, Gandhinagar`,
      mealId: 'GDM-2841',
      date: 'Just now',
      rating,
      comment,
      positiveTags: tags,
      isFeaturedTestimonial: true
    };
    setFeedbacks((prev) => [newFb, ...prev]);
    setIsFeedbackModalOpen(false);
    showToast('Feedback Received!', 'Thank you! Your feedback goes straight to the head chef for tomorrow’s preparation.', 'success');
  };

  const advanceKitchenBatch = (batchId: string) => {
    setKitchenBatches((prev) =>
      prev.map((b) => {
        if (b.id !== batchId) return b;
        if (b.status === 'in_prep') {
          return { ...b, status: 'packing', preparedCount: b.targetCount };
        } else if (b.status === 'packing') {
          return { ...b, status: 'dispatching', packedCount: b.preparedCount };
        } else if (b.status === 'dispatching') {
          return { ...b, status: 'completed', dispatchedCount: b.packedCount };
        }
        return b;
      })
    );
    showToast('Kitchen Batch Advanced', `Batch ${batchId} status successfully updated.`, 'info');
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        userRole,
        setUserRole,
        subscription,
        setSubscription,
        oneTimeOrders,
        activeTrackingOrder,
        setActiveTrackingOrder,
        isOrderOnceModalOpen,
        setIsOrderOnceModalOpen,
        createOneTimeOrder,
        reorderMeal,
        cancelOneTimeOrder,
        advanceOrderStatus,
        pauseSubscription,
        resumeSubscription,
        skipTomorrowMeal,
        unskipMeal,
        updatePreferences,
        updateDeliveryAddress,
        createNewSubscription,
        isSubscribeModalOpen,
        setIsSubscribeModalOpen,
        selectedPlanForCheckout,
        setSelectedPlanForCheckout,
        openCheckoutForPlan,
        isTraceabilityModalOpen,
        setIsTraceabilityModalOpen,
        activeTraceabilityMeal,
        lookupMealTraceability,
        isCorporateModalOpen,
        setIsCorporateModalOpen,
        isFeedbackModalOpen,
        setIsFeedbackModalOpen,
        submitCustomerFeedback,
        isAreaCheckerOpen,
        setIsAreaCheckerOpen,
        isLegalModalOpen,
        setIsLegalModalOpen,
        legalModalTab,
        setLegalModalTab,
        openLegalModal,
        feedbacks,
        kitchenBatches,
        advanceKitchenBatch,
        corporateAccounts,
        toasts,
        showToast,
        removeToast,
        // Auth & Supabase
        currentUser,
        userProfile,
        userRolesList,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isSupabaseConnected,
        signInUser,
        signUpUser,
        signOutUser,
        refreshUserProfile,
        // Location & Address Intelligence
        centralLocation,
        locationState,
        setLocationState,
        detectedLocation,
        setDetectedLocation,
        activeDeliveryAddress,
        setActiveDeliveryAddress,
        defaultAddressId,
        savedAddresses,
        detectUserLocation,
        simulateLocationCoordinates,
        confirmDetectedAddress,
        selectDeliveryAddress,
        saveDeliveryAddress,
        deleteDeliveryAddress,
        setDefaultDeliveryAddress,
        isLocationModalOpen,
        setIsLocationModalOpen,
        locationErrorMessage,
        setLocationErrorMessage,
        // Notifications
        notificationPermission,
        requestNotificationPermission,
        sendOrderLiveNotification
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

