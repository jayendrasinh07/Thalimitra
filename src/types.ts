export type UserRole = 'guest' | 'customer' | 'admin' | 'kitchen_lead' | 'corporate_manager' | 'delivery_fleet' | 'corporate_lead';

export type CustomerSegment = 'student' | 'worker' | 'corporate' | 'family' | 'individual';

export type PlanDuration = 'daily' | 'weekly_7' | 'half_month_15' | 'monthly_30' | 'corporate_custom';

export type ServiceMealType = 'breakfast' | 'lunch' | 'dinner';
export type MealSlot = ServiceMealType | 'both';

export type DietType = 'standard_gujarati' | 'jain_satvik' | 'kathiyawadi' | 'low_oil_fit' | 'north_indian';

export type PortionSize = 'regular' | 'mini' | 'jumbo';

export type SubscriptionStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface NutritionalInfo {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  oilLevel: 'Very Low (Cold-Pressed)' | 'Controlled' | 'Standard Home-Style';
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'sabji' | 'dal_kadhi' | 'roti_bread' | 'rice_khichdi' | 'salad_kachumber' | 'beverage' | 'sweet';
  description: string;
  isJainAvailable: boolean;
  highlight?: string;
}

export interface DayMenu {
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  dateLabel?: string;
  lunch: {
    title: string;
    items: MenuItem[];
    nutrition: NutritionalInfo;
    chefNote: string;
  };
  dinner: {
    title: string;
    items: MenuItem[];
    nutrition: NutritionalInfo;
    chefNote: string;
  };
}

export interface MealPlan {
  id: PlanDuration;
  name: string;
  tagline: string;
  idealFor: string;
  pricePerMeal: number;
  totalMeals: number;
  totalPrice: number;
  savingsPercentage: number;
  isPopular?: boolean;
  features: string[];
  flexibility: {
    pauseAllowedDays: number;
    skipNoticeHours: number;
    freeWeekendCancellation: boolean;
  };
}

export interface UserSubscription {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  userSegment: CustomerSegment;
  planId: PlanDuration;
  planName: string;
  slot: MealSlot;
  dietType: DietType;
  portionSize: PortionSize;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate: string;
  totalDays: number;
  daysRemaining: number;
  mealsDeliveredCount: number;
  pausedDates: string[]; // YYYY-MM-DD
  skippedDates: string[]; // YYYY-MM-DD
  deliveryAddress: {
    street: string;
    area: string;
    sector: string;
    pincode: string;
    landmark?: string;
    clusterId: string;
    deliveryTimeSlot: string;
  };
  addons: {
    extraRoti: boolean;
    chaasDaily: boolean;
    sweetSunday: boolean;
  };
  specialInstructions?: string;
}

export interface MealTraceabilityInfo {
  mealId: string;
  subscriptionId: string;
  customerName: string;
  menuSummary: string[];
  preparedTime: string;
  packedTime: string;
  dispatchTime: string;
  deliveredTime?: string;
  currentStatus: 'preparing' | 'packed' | 'in_transit' | 'delivered';
  kitchenLocation: string;
  cookInCharge: string;
  hygieneInspector: string;
  temperatureAtPacking: string;
  clusterId: string;
  clusterName: string;
  deliveryPartnerName: string;
  deliveryPartnerPhone: string;
  estimatedDeliveryWindow: string;
}

export interface DeliveryCluster {
  id: string;
  name: string;
  hubZone: string;
  targetAudience: string;
  pincodes: string[];
  keySectors: string[];
  totalActiveSubscribers: number;
  assignedVans: number;
  lunchDispatchTime: string;
  dinnerDispatchTime: string;
  averageDeliveryDurationMinutes: number;
  status: 'optimal' | 'busy' | 'scheduled';
}

export interface KitchenBatch {
  id: string;
  slot: MealSlot;
  date: string;
  menuTitle: string;
  targetCount: number;
  preparedCount: number;
  packedCount: number;
  dispatchedCount: number;
  status: 'in_prep' | 'packing' | 'dispatching' | 'completed';
  headChef: string;
  startedAt: string;
  qualityPassed: boolean;
  oilUsageLog: string;
}

export interface CorporateAccount {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  location: string;
  employeeCount: number;
  activeDailyMeals: number;
  mealSlot: MealSlot;
  dietMix: {
    standardGujarati: number;
    jainSatvik: number;
    lowOilFit: number;
  };
  billingCycle: 'monthly' | 'biweekly';
  monthlySpend: number;
  contractStartDate: string;
  averageRating: number;
  status: 'active' | 'trial' | 'renewal_due';
}

export interface CustomerFeedback {
  id: string;
  customerName: string;
  customerRole: string;
  sectorOrArea: string;
  mealId: string;
  date: string;
  rating: number; // 1 to 5
  comment: string;
  positiveTags: string[];
  isFeaturedTestimonial?: boolean;
}

export type OrderType = 'ONE_TIME' | 'SUBSCRIPTION' | 'CORPORATE';

export type OrderStatus = 
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'PACKED'
  | 'DISPATCHED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'PAYMENT_FAILED';

export type PaymentStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

export type PaymentMethod = 'UPI' | 'Card' | 'NetBanking' | 'CashOnDelivery';

export interface CustomerAddress {
  id: string;
  label: 'Home' | 'Office' | 'PG' | 'College' | 'Other';
  fullName: string;
  name?: string;
  phone: string;
  houseNumber?: string;
  building?: string;
  floor?: string;
  street?: string;
  addressLine?: string;
  addressLine1?: string;
  area: string;
  sector?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode: string;
  clusterId: string;
  clusterName?: string;
  zoneId?: string;
  deliveryFee?: number;
  latitude?: number;
  longitude?: number;
  instructions?: string;
  instructionPreset?: string;
  isDefault?: boolean;
  isServiceable: boolean;
}

export interface DeliverySlot {
  id: string;
  mealSlot: ServiceMealType;
  windowLabel: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bookedCount: number;
  isASAP?: boolean;
}

export interface MealAddOn {
  id: string;
  name: string;
  price: number;
  category: 'drink' | 'extra_food' | 'sweet';
  description: string;
  isPopular?: boolean;
}

export type CancellationReason = 'changed_mind' | 'ordered_by_mistake' | 'schedule_changed' | 'address_issue' | 'other';

export interface OneTimeOrder {
  orderNumber?: string;
  notes?: string;
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  orderType: 'ONE_TIME';
  mealId: string;
  mealName: string;
  mealImage: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledDateLabel: string;
  mealSlot: ServiceMealType;
  deliverySlotId: string;
  deliverySlotLabel: string;
  quantity: number;
  customizations: {
    spiceLevel: 'Regular' | 'Less Spicy';
    oilLevel: 'Standard' | 'Less Oil (Fit)';
    dietVariant: string;
    rotiCount?: number;
    ricePortion?: string;
    extraDal?: boolean;
    hasChaas?: boolean;
  };
  mealCustomizations?: {
    mealIndex: number;
    label: string;
    rotiCount: number;
    ricePortion: string;
    sabjiPortion: string;
    dalPortion: string;
    saladIncluded: boolean;
    extraSalad: boolean;
    hasChaas: boolean;
    dietVariant: string;
    spiceLevel: string;
    oilLevel: string;
    specialNote?: string;
  }[];
  customizationSummary?: string[];
  addOns: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  address: CustomerAddress;
  deliveryAddressSnapshot?: DeliveryAddress;
  deliveryZoneId?: string;
  subtotal: number;
  addOnsTotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  estimatedDeliveryTime: string;
  createdAt: string;
  traceabilityMealId: string;
  cancellationReason?: CancellationReason;
  cancellationNote?: string;
  cancelledAt?: string;
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  reason?: 'CUTOFF_PASSED' | 'SLOT_FULL' | 'AREA_UNSERVICEABLE' | 'KITCHEN_CLOSED' | 'DATE_OUT_OF_BOUNDS';
  message: string;
  mealSlot: ServiceMealType;
  date: string;
  dateLabel: string;
  availableSlots: DeliverySlot[];
  nextAvailable?: {
    date: string;
    dateLabel: string;
    mealSlot: ServiceMealType;
    timeWindow: string;
    actionLabel: string;
  };
}

export interface AreaAvailabilityResult {
  isAvailable: boolean;
  areaName: string;
  sectorOrZone: string;
  pincode: string;
  clusterName: string;
  estimatedLunchSlot: string;
  estimatedDinnerSlot: string;
  activeSubscribersInArea: number;
  message: string;
}

// ----------------------------------------------------
// PERMISSIONS, LOCATION & ADDRESS INTELLIGENCE TYPES
// ----------------------------------------------------

export type LocationState = 
  | 'idle'
  | 'requesting'
  | 'detecting'
  | 'detected'
  | 'permission-denied'
  | 'unavailable'
  | 'timeout'
  | 'manual'
  | 'serviceable'
  | 'not-serviceable';

export type NotificationPermissionState = 
  | 'unsupported'
  | 'default'
  | 'requesting'
  | 'granted'
  | 'denied';

export type AddressLabel = 'Home' | 'Office' | 'College' | 'PG' | 'Other';

export type DeliveryInstructionPreset = 
  | 'call_on_reach'
  | 'leave_at_security'
  | 'ring_bell'
  | 'deliver_at_reception'
  | 'custom';

export type LocationSource = 'gps' | 'search' | 'map' | 'saved' | 'manual';

export interface DeliveryAddress {
  id: string;
  userId?: string;
  label: AddressLabel;
  customLabel?: string;
  name: string;
  fullName: string; // for backward compatibility with CustomerAddress
  phone: string;
  addressLine1: string;
  addressLine?: string; // for backward compatibility
  addressLine2?: string;
  houseNumber?: string;
  building?: string;
  floor?: string;
  street?: string;
  landmark?: string;
  area: string;
  sector?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  placeId?: string;
  source?: LocationSource;
  instructions?: string;
  instructionPreset?: DeliveryInstructionPreset;
  isDefault: boolean;
  clusterId: string;
  clusterName?: string;
  zoneId?: string;
  deliveryFee?: number;
  isServiceable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  tagline: string;
  description: string;
  deliveryFee: number;
  estimatedDurationMinutes: number;
  pincodes: string[];
  sectors: string[];
  minOrderAmount: number;
  isFreeDelivery: boolean;
}

export interface ServiceabilityResult {
  isServiceable: boolean;
  zone?: DeliveryZone;
  zoneId?: string;
  status?: 'available' | 'coming_soon' | 'unavailable';
  services?: { breakfast: boolean; lunch: boolean; dinner: boolean };
  minOrderAmount?: number;
  estimatedDurationMinutes?: number | null;
  waitlistEnabled?: boolean;
  areaName: string;
  sectorOrZone: string;
  city: string;
  pincode: string;
  clusterId: string;
  clusterName: string;
  deliveryFee: number;
  message: string;
  estimatedLunchSlot: string;
  estimatedDinnerSlot: string;
  isExactSectorMatch?: boolean;
}

export interface DetectedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  placeId?: string;
  displayName: string;
  formattedAddress?: string;
  houseNumber?: string;
  building?: string;
  floor?: string;
  street?: string;
  landmark?: string;
  sector?: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  timestamp: number;
  isServiceable: boolean;
  serviceability?: ServiceabilityResult;
  source?: LocationSource;
  confirmed?: boolean;
  rawGeocode?: any;
}

export interface AreaWaitlistEntry {
  id: string;
  name: string;
  contact: string; // phone or email
  area: string;
  city: string;
  pincode?: string;
  createdAt: string;
  segment?: CustomerSegment;
}

export interface PermissionPolicy {
  location: 'REQUIRED_JUST_IN_TIME';
  notifications: 'OPTIONAL_POST_ORDER';
  camera: 'DISALLOWED_FUTURE_ONLY';
  microphone: 'DISALLOWED';
  contacts: 'DISALLOWED';
  bluetooth: 'DISALLOWED';
  backgroundGPS: 'DISALLOWED';
  fileAccess: 'DISALLOWED';
}

export type PermissionStatusType = 'prompt' | 'granted' | 'denied' | 'unsupported';
export type DetectionStatusType = 'idle' | 'requesting' | 'detecting' | 'detected' | 'failed' | 'manual';

export interface CentralLocationState {
  permissionStatus: PermissionStatusType;
  detectionStatus: DetectionStatusType;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  placeId?: string;
  detectedAt: number | null;
  source: LocationSource;
  city: string;
  state?: string;
  area: string;
  sector: string;
  pincode: string;
  houseNumber?: string;
  building?: string;
  floor?: string;
  street?: string;
  landmark?: string;
  formattedAddress: string;
  serviceable: boolean;
  deliveryZoneId: string;
  deliveryFee: number;
  isAddressConfirmed: boolean;
  confirmed?: boolean;
  selectedAddressId: string | null;
  confirmedAddress: DeliveryAddress | null;
}


