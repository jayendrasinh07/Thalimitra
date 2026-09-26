import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { 
  UserRole, 
  CustomerPlanCode,
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
  MOCK_TRACEABILITY_MEAL, 
  CUSTOMER_FEEDBACKS, 
  MOCK_KITCHEN_BATCHES,
  MOCK_CORPORATE_ACCOUNTS,
} from '../data/config';
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
  | 'delivery_addresses'
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
  selectedPlanForCheckout: CustomerPlanCode | null;
  setSelectedPlanForCheckout: (plan: CustomerPlanCode | null) => void;
  openCheckoutForPlan: (planId: CustomerPlanCode) => void;

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
  isCustomerDataLoading: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isSupabaseConnected: boolean;
  signInUser: (email: string, password: string) => Promise<{ error: Error | null }>;
  verifySignUpOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  signUpUser: (email: string, password: string, fullName: string, phone: string, segment?: CustomerSegmentType) => Promise<{ error: Error | null; needsEmailConfirmation: boolean; alreadyRegistered: boolean }>;
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
    : currentPath() === '/plans' && SUBSCRIPTIONS_ENABLED
      ? 'meal_plans'
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
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<CustomerPlanCode | null>(null);
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
  const [userRolesList, setUserRolesList] = useState<UserRoleType[]>([]);
  const [isCustomerDataLoading, setIsCustomerDataLoading] = useState(false);
  const isSupabaseConnected = isSupabaseConfigured();


  const authGeneration = useRef(0);
  const authIdentity = useRef<string|null>(null);
  const clearCustomerData = useCallback(() => {
    setOneTimeOrders([]);
    setActiveTrackingOrder(null);
    setSavedAddresses([]);
    setActiveDeliveryAddress(EMPTY_DELIVERY_ADDRESS);
    setDefaultAddressIdState('');
    setCentralLocation(getInitialCentralLocationState());setDetectedLocation(null);setUserProfile(null);setUserRolesList([]);setUserRole('guest');
    for(const key of ['teffein_user_role','teffein_onetime_orders','teffein_saved_customer_orders','teffein_saved_addresses','teffein_mock_auth_session','teffein_sub'])localStorage.removeItem(key);
    sessionStorage.removeItem('teffein_active_delivery_location');
  },[]);
  const refreshUserProfile = useCallback(async () => {
    const generation=++authGeneration.current;
    let user: User | null;
    try { user=await authService.getCurrentUser(); }
    catch(error) { console.warn('Unable to refresh the signed-in account', error); return; }
    if(generation!==authGeneration.current)return;
    if(authIdentity.current!==user?.id){clearCustomerData();authIdentity.current=user?.id??null;}
    setCurrentUser(user);
    if(!user){setIsCustomerDataLoading(false);return;}
    setIsCustomerDataLoading(true);
    try {
      const roles = await authService.getUserRoles(user.id);
      if (generation !== authGeneration.current) return;
      const hasOperationsRole = roles.some(role => ['admin', 'kitchen', 'delivery', 'corporate'].includes(role));
      const surfaceAllowed = isOpsBuild
        ? roles.some(role => role === 'admin' || role === 'kitchen')
        : roles.includes('customer') && !hasOperationsRole;
      if (!surfaceAllowed) {
        await authService.signOut();
        if (generation === authGeneration.current) {
          authIdentity.current = null;
          setCurrentUser(null);
          clearCustomerData();
        }
        return;
      }
      const [profileResult, addressesResult, ordersResult] = await Promise.allSettled([
        authService.getProfile(user.id),
        addressService.getUserAddresses(user.id),
        orderService.getUserOrders(user.id)
      ]);
      if (generation !== authGeneration.current) return;
      setUserRolesList(roles);setUserRole(roles.includes('admin')?'admin':roles.includes('kitchen')?'kitchen_lead':roles.includes('delivery')?'delivery_fleet':roles.includes('corporate')?'corporate_lead':'customer');
      if(profileResult.status==='fulfilled')setUserProfile(profileResult.value);else console.warn('Unable to load profile',profileResult.reason);
      if(ordersResult.status==='fulfilled'){
        const orders=ordersResult.value;setOneTimeOrders(orders);setActiveTrackingOrder(prev=>prev?orders.find(o=>o.id===prev.id)??null:null);
      }else console.warn('Unable to load orders',ordersResult.reason);
      if(addressesResult.status==='fulfilled'){
        const addresses=addressesResult.value;setSavedAddresses(addresses);
        const address=addresses.find(a=>a.isDefault)||addresses[0]||EMPTY_DELIVERY_ADDRESS;
        setActiveDeliveryAddress(address);setDefaultAddressIdState(address.id);
        if(address.id)setCentralLocation(prev=>({...prev,isAddressConfirmed:true,confirmedAddress:address,selectedAddressId:address.id,source:address.source||'saved',latitude:address.latitude??prev.latitude,longitude:address.longitude??prev.longitude,accuracy:address.accuracy??prev.accuracy,city:address.city||'Gandhinagar',area:address.area,sector:address.sector||address.area,pincode:address.pincode,formattedAddress:address.addressLine1||address.addressLine||`${address.area}, ${address.city||'Gandhinagar'}`,deliveryZoneId:(address.zoneId||'zone_a_core') as any,deliveryFee:Number(address.deliveryFee||0),serviceable:address.isServiceable}));
      }else console.warn('Unable to load saved addresses',addressesResult.reason);
    } catch(error) { if(generation===authGeneration.current){setCurrentUser(user);console.error('Unable to load account data',error);} }
    finally { if(generation===authGeneration.current)setIsCustomerDataLoading(false); }
  },[clearCustomerData]);

  useEffect(() => {
    if(!currentUser)return;
    const owner=currentUser.id;let alive=true;
    const refresh=async()=>{try{const orders=await orderService.getUserOrders(owner);if(alive&&authIdentity.current===owner){setOneTimeOrders(orders);setActiveTrackingOrder(prev=>prev?orders.find(o=>o.id===prev.id)??null:null);}}catch{/* Keep the last confirmed server state during a temporary connection failure. */}};
    let unsubscribe=()=>{};try{unsubscribe=orderService.subscribe(owner,()=>{void refresh();});}catch{/* The 15-second refresh remains active if realtime cannot connect. */}
    const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);
    return()=>{alive=false;unsubscribe();clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[currentUser?.id]);

  useEffect(() => {
    if(!currentUser)return;
    const refreshAccount=()=>{void refreshUserProfile();};
    window.addEventListener('online',refreshAccount);
    return()=>window.removeEventListener('online',refreshAccount);
  },[currentUser?.id,refreshUserProfile]);

  // Auth Lifecycle Initializer
  useEffect(() => {
    refreshUserProfile();

    const { data: { subscription: authSub } } = authService.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        authService.notePasswordRecovery(session);
        setActiveTab('password_recovery');
      }
      if (event === 'SIGNED_OUT') authService.notePasswordRecovery(null);
      if (session?.user) {
        setIsCustomerDataLoading(true);
        if(authIdentity.current!==session.user.id){++authGeneration.current;clearCustomerData();authIdentity.current=session.user.id;}
        setCurrentUser(session.user);
        setTimeout(() => { void refreshUserProfile(); }, 0);
      } else {
        setIsCustomerDataLoading(false);
        ++authGeneration.current;authIdentity.current=null;setCurrentUser(null);clearCustomerData();
      }
    });

    return () => {
      authSub?.unsubscribe();
    };
  }, [refreshUserProfile]);

  const finishCustomerAuth = async (res: Awaited<ReturnType<typeof authService.signIn>>) => {
    if (!res.error && res.user) {
      const roles = await authService.getUserRoles(res.user.id);
      const hasOperationsRole = roles.some(role => ['admin', 'kitchen', 'delivery', 'corporate'].includes(role));
      const surfaceAllowed = isOpsBuild
        ? roles.some(role => role === 'admin' || role === 'kitchen')
        : roles.includes('customer') && !hasOperationsRole;
      if (!surfaceAllowed) {
        await authService.signOut();
        clearCustomerData();
        setCurrentUser(null);
        return {
          ...res,
          user: null,
          session: null,
          error: new Error(isOpsBuild
            ? 'Use an authorized Operations account.'
            : 'This Operations account can sign in only at ops.thalimitra.com.')
        };
      }
      await refreshUserProfile();
    }
    return res;
  };

  const signInUser = async (email: string, password: string) =>
    finishCustomerAuth(await authService.signIn(email, password));

  const verifySignUpOtp = async (email: string, token: string) =>
    finishCustomerAuth(await authService.verifySignupEmailOtp(email, token));

  const signUpUser = async (email: string, password: string, fullName: string, phone: string, segment: CustomerSegmentType = 'individual') => {
    const res = await authService.signUp(email, password, fullName, phone, segment);
    if (!res.error && !res.needsEmailConfirmation && res.user) {
      const checked = await finishCustomerAuth({ user: res.user, session: null, error: null });
      return { error: checked.error, needsEmailConfirmation: false, alreadyRegistered: false };
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
        : activeTab === 'meal_plans'
          ? (path === '/plans' ? null : '/plans')
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
    setCentralLocation(prev=>({...prev,isAddressConfirmed:true,confirmedAddress:saved,selectedAddressId:saved.id,source:saved.source||'saved',latitude:saved.latitude??prev.latitude,longitude:saved.longitude??prev.longitude,accuracy:saved.accuracy??prev.accuracy,city:saved.city||'Gandhinagar',area:saved.area,sector:saved.sector||saved.area,pincode:saved.pincode,formattedAddress:saved.addressLine1||saved.addressLine||`${saved.area}, ${saved.city||'Gandhinagar'}`,deliveryZoneId:(saved.zoneId||'zone_a_core') as any,deliveryFee:Number(saved.deliveryFee||0),serviceable:saved.isServiceable}));
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

  const openCheckoutForPlan = (planId: CustomerPlanCode) => {
    if (!SUBSCRIPTIONS_ENABLED) {
      setActiveTab('order_once');
      return;
    }
    setSelectedPlanForCheckout(planId);
    setIsSubscribeModalOpen(true);
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
      customerName: userProfile?.fullName || currentUser?.email || 'Customer',
      customerRole: 'Subscriber, Gandhinagar',
      sectorOrArea: `${activeDeliveryAddress.area || 'Gandhinagar'}, Gandhinagar`,
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
        oneTimeOrders,
        activeTrackingOrder,
        setActiveTrackingOrder,
        isOrderOnceModalOpen,
        setIsOrderOnceModalOpen,
        createOneTimeOrder,
        reorderMeal,
        cancelOneTimeOrder,
        advanceOrderStatus,
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
        isCustomerDataLoading,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isSupabaseConnected,
        signInUser,
        verifySignUpOtp,
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

