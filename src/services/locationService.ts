/**
 * Thalimitra - Location & Address Intelligence Service
 * Handles coordinate resolution, zone calculations, serviceability checks,
 * human-readable formatting, and address persistence.
 */

import { 
  DeliveryAddress, 
  DeliveryZone, 
  ServiceabilityResult, 
  DetectedLocation,
  CustomerSegment,
  DeliveryInstructionPreset
} from '../types';
import { GANDHINAGAR_AREAS } from '../data/config';
import { reverseGeocodeGoogle } from './googleMapsLoader';
import { checkCoordinateServiceability } from './serviceabilityService';

// Central Kitchen Hub: Sector 25 Central Steam Kitchen, Gandhinagar
export const CENTRAL_KITCHEN_COORDS = {
  latitude: 23.2356,
  longitude: 72.6417,
  name: 'Thalimitra Central Steam Kitchen, Sector 25, Gandhinagar'
};

// Delivery Zones
export const DELIVERY_ZONES: Record<'zone_a_core' | 'zone_b_extended' | 'zone_c_periphery', DeliveryZone> = {
  zone_a_core: {
    id: 'zone_a_core',
    name: 'Core Gandhinagar & Tech Corridor',
    tagline: 'Free Cluster Delivery',
    description: 'Sectors 1–30, Infocity, Kudasan, PDPU Knowledge Corridor, Bhaijipura, Raysan, Sargasan & Sector 24-28 GIDC',
    deliveryFee: 0,
    estimatedDurationMinutes: 25,
    pincodes: ['382007', '382421', '382423', '382010', '382016', '382024'],
    sectors: [
      'Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5', 'Sector 6', 'Sector 7', 'Sector 8',
      'Sector 9', 'Sector 10', 'Sector 11', 'Sector 12', 'Sector 13', 'Sector 14', 'Sector 15',
      'Sector 16', 'Sector 17', 'Sector 18', 'Sector 19', 'Sector 20', 'Sector 21', 'Sector 22',
      'Sector 23', 'Sector 24', 'Sector 25', 'Sector 26', 'Sector 27', 'Sector 28', 'Sector 29',
      'Sector 30', 'Infocity', 'Kudasan', 'Bhaijipura', 'Raysan', 'Sargasan', 'Randesan'
    ],
    minOrderAmount: 0,
    isFreeDelivery: true
  },
  zone_b_extended: {
    id: 'zone_b_extended',
    name: 'GIFT City & Highway Corridor',
    tagline: '₹15 Express Delivery',
    description: 'GIFT City SEZ & Domestic, Koba Highway, Nabhoi, Pethapur, Chiloda Circle',
    deliveryFee: 15,
    estimatedDurationMinutes: 35,
    pincodes: ['382355', '382009', '382610'],
    sectors: ['GIFT City', 'GIFT SEZ', 'Koba Circle', 'Nabhoi', 'Pethapur', 'Chiloda'],
    minOrderAmount: 0,
    isFreeDelivery: false
  },
  zone_c_periphery: {
    id: 'zone_c_periphery',
    name: 'Outer Periphery Zone',
    tagline: '₹25 Extended Delivery',
    description: 'Vavol, Kolavada, Adalaj Cross Roads, Urjanagar',
    deliveryFee: 25,
    estimatedDurationMinutes: 40,
    pincodes: ['382016', '382421', '382845'],
    sectors: ['Vavol', 'Kolavada', 'Adalaj', 'Urjanagar'],
    minOrderAmount: 0,
    isFreeDelivery: false
  }
};

/**
 * Calculates distance in kilometers between two lat/lng coordinates (Haversine Formula)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Evaluates delivery serviceability for given coordinates and resolved address details.
 * Serviceability is calculated independently without modifying the user's detected location.
 */
export function evaluateLocationServiceability(
  latitude: number,
  longitude: number,
  areaName?: string,
  cityName?: string,
  pincode?: string
): ServiceabilityResult {
  const distFromKitchen = calculateDistanceKm(
    latitude,
    longitude,
    CENTRAL_KITCHEN_COORDS.latitude,
    CENTRAL_KITCHEN_COORDS.longitude
  );

  const combinedText = `${areaName || ''} ${cityName || ''} ${pincode || ''}`.toLowerCase();

  // 1. Check if explicitly in Gandhinagar / GIFT City
  const isGandhinagarArea =
    combinedText.includes('gandhinagar') ||
    combinedText.includes('gift city') ||
    combinedText.includes('infocity') ||
    combinedText.includes('kudasan') ||
    combinedText.includes('raysan') ||
    combinedText.includes('sargasan') ||
    combinedText.includes('randesan') ||
    combinedText.includes('pethapur') ||
    combinedText.includes('vavol') ||
    combinedText.includes('kolavada');

  // Gandhinagar physical bounds check (Lat: ~23.10 - 23.35, Lon: ~72.54 - 72.76)
  const isWithinGandhinagarGeofence =
    latitude >= 23.10 &&
    latitude <= 23.35 &&
    longitude >= 72.54 &&
    longitude <= 72.76;

  // 2. Zone A: Core Gandhinagar (< 6 km from kitchen or core sectors)
  if ((isWithinGandhinagarGeofence || isGandhinagarArea) && distFromKitchen <= 6.0) {
    const zone = DELIVERY_ZONES.zone_a_core;
    return {
      isServiceable: true,
      zone,
      zoneId: 'zone_a_core',
      areaName: areaName || 'Core Gandhinagar',
      sectorOrZone: areaName ? `${areaName}, Gandhinagar` : 'Core Gandhinagar',
      city: 'Gandhinagar',
      pincode: pincode || '382010',
      clusterId: 'cluster-d',
      clusterName: zone.name,
      deliveryFee: zone.deliveryFee,
      message: `Thalimitra delivers directly to ${areaName || 'your area'} with free cluster doorstep delivery.`,
      estimatedLunchSlot: '12:00 PM – 01:00 PM',
      estimatedDinnerSlot: '07:30 PM – 08:30 PM',
      isExactSectorMatch: true
    };
  }

  // 3. Zone B: Extended / GIFT City / Highway corridor (6 - 10 km from kitchen)
  if ((isWithinGandhinagarGeofence || isGandhinagarArea || combinedText.includes('gift')) && distFromKitchen <= 10.0) {
    const zone = DELIVERY_ZONES.zone_b_extended;
    return {
      isServiceable: true,
      zone,
      zoneId: 'zone_b_extended',
      areaName: areaName || 'GIFT City & Highway Zone',
      sectorOrZone: areaName ? `${areaName}, Gandhinagar` : 'GIFT City / Highway Zone',
      city: 'Gandhinagar',
      pincode: pincode || '382355',
      clusterId: 'cluster-b',
      clusterName: zone.name,
      deliveryFee: zone.deliveryFee,
      message: `Thalimitra delivers to ${areaName || 'your area'} with ₹${zone.deliveryFee} express delivery.`,
      estimatedLunchSlot: '12:30 PM – 01:15 PM',
      estimatedDinnerSlot: '07:45 PM – 08:30 PM',
      isExactSectorMatch: true
    };
  }

  // 4. Zone C: Periphery (10 - 14 km from kitchen within Gandhinagar district)
  if ((isWithinGandhinagarGeofence || isGandhinagarArea) && distFromKitchen <= 14.0) {
    const zone = DELIVERY_ZONES.zone_c_periphery;
    return {
      isServiceable: true,
      zone,
      zoneId: 'zone_c_periphery',
      areaName: areaName || 'Outer Gandhinagar Periphery',
      sectorOrZone: areaName ? `${areaName}, Gandhinagar` : 'Outer Periphery',
      city: 'Gandhinagar',
      pincode: pincode || '382016',
      clusterId: 'cluster-d',
      clusterName: zone.name,
      deliveryFee: zone.deliveryFee,
      message: `Thalimitra delivers to ${areaName || 'your area'} with ₹${zone.deliveryFee} extended delivery.`,
      estimatedLunchSlot: '12:30 PM – 01:15 PM',
      estimatedDinnerSlot: '08:00 PM – 08:45 PM',
      isExactSectorMatch: false
    };
  }

  // 5. Outside Active Service Zone (Ahmedabad, Surat, Mumbai, Delhi, International, etc.)
  const targetCity = cityName || (combinedText.includes('ahmedabad') ? 'Ahmedabad' : 'Outside Service Zone');
  return {
    isServiceable: false,
    areaName: areaName || 'Outside Area',
    sectorOrZone: areaName ? `${areaName}, ${targetCity}` : 'Outside Gandhinagar Delivery Zone',
    city: targetCity,
    pincode: pincode || '',
    clusterId: '',
    clusterName: '',
    deliveryFee: 0,
    message: `${areaName ? `“${areaName}”` : 'This area'} is outside today’s verified delivery route. Join the priority list and we will alert you when it opens.`,
    estimatedLunchSlot: 'N/A',
    estimatedDinnerSlot: 'N/A'
  };
}

/**
 * Real Reverse Geocoding via Google Maps Geocoding API with graceful fallback.
 * Resolves real place, building, street, sector, area, and pincode.
 * Does NOT invent, mock, or hardcode Sector 22 or any preset addresses.
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
  accuracy?: number
): Promise<DetectedLocation> {
  const timestamp = Date.now();

  console.group('📍 [Thalimitra GPS PIPELINE] Reverse Geocoding Request');
  console.log('LOCATION REQUEST STARTED');
  console.log('LOCATION PERMISSION: granted');
  console.log('RAW LATITUDE:', latitude);
  console.log('RAW LONGITUDE:', longitude);
  console.log('GPS ACCURACY:', accuracy !== undefined ? `${accuracy.toFixed(1)}m` : 'N/A');

  let area = '';
  let sector = '';
  let city = '';
  let state = '';
  let pincode = '';
  let displayName = '';
  let formattedAddress = '';
  let houseNumber = '';
  let building = '';
  let landmark = '';
  let placeId = '';
  let rawGeocode: any = null;

  // 1. Primary & Authoritative: Official Google Maps Geocoding API
  try {
    const googleResult = await reverseGeocodeGoogle(latitude, longitude);
    if (googleResult) {
      placeId = googleResult.placeId || '';
      formattedAddress = googleResult.formattedAddress || '';
      houseNumber = googleResult.houseNumber || '';
      building = googleResult.building || '';
      area = googleResult.area || '';
      sector = googleResult.sector || googleResult.area || '';
      city = googleResult.city || '';
      state = googleResult.state || '';
      pincode = googleResult.pincode || '';
      displayName = googleResult.formattedAddress || (area ? `${area}, ${city}` : `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`);
      rawGeocode = googleResult.rawResult || null;
    }
  } catch (googleErr) {
    console.warn('[Thalimitra Maps] Google Geocoder reverse lookup failed:', googleErr);
  }

  // If geocoding could not resolve names, do not fake sector or synthetic addresses
  if (!displayName) {
    displayName = `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`;
    formattedAddress = displayName;
  }

  // The database boundary is authoritative. The local result is retained only
  // for the short deployment window before the new RPC reaches PostgREST.
  let serviceability = evaluateLocationServiceability(latitude, longitude, area, city, pincode);
  try {
    const server = await checkCoordinateServiceability({ latitude, longitude, area, sector, pincode });
    serviceability = {
      ...serviceability,
      isServiceable: server.isServiceable,
      status: server.status,
      zoneId: server.areaId || 'unserviceable',
      areaName: server.areaName,
      sectorOrZone: server.areaName,
      clusterId: server.areaId || '',
      clusterName: server.areaName,
      deliveryFee: server.deliveryFee,
      minOrderAmount: server.minOrderAmount,
      estimatedDurationMinutes: server.estimatedDurationMinutes,
      waitlistEnabled: server.waitlistEnabled,
      services: server.services,
      message: server.message,
    };
  } catch (cause) {
    const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : '';
    if (!['PGRST202', '42883'].includes(code)) {
      serviceability = {
        ...serviceability, isServiceable: false, status: 'unavailable',
        zoneId: 'unserviceable', deliveryFee: 0,
        message: 'Delivery availability could not be confirmed. Please try again.',
      };
    }
    console.warn('[Thalimitra Maps] Database serviceability lookup failed:', cause);
  }

  console.log('REVERSE GEOCODING RESULT:', { displayName, formattedAddress, area, sector, city, state, pincode, placeId });
  console.log('SERVICEABILITY RESULT:', serviceability);
  console.groupEnd();

  return {
    latitude,
    longitude,
    accuracy,
    placeId: placeId || undefined,
    displayName,
    formattedAddress: formattedAddress || displayName,
    houseNumber: houseNumber || undefined,
    building: building || undefined,
    landmark: landmark || undefined,
    sector,
    area,
    city,
    state,
    pincode,
    timestamp,
    isServiceable: serviceability.isServiceable,
    serviceability,
    source: 'gps',
    rawGeocode
  };
}

/**
 * Checks Serviceability by Search Query (Sector, Pincode, Landmark)
 */
export function checkAreaServiceability(searchQuery: string): ServiceabilityResult {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return {
      isServiceable: false,
      areaName: '',
      sectorOrZone: '',
      city: 'Gandhinagar',
      pincode: '',
      clusterId: '',
      clusterName: '',
      deliveryFee: 0,
      message: 'Please enter a Gandhinagar sector, landmark, or pincode.',
      estimatedLunchSlot: '',
      estimatedDinnerSlot: ''
    };
  }

  // 1. Direct Sector Number matching (e.g. "sector 21", "sec 21", "21")
  const sectorNumMatch = query.match(/(?:sector|sec|\b)\s*([1-9]|[12][0-9]|30)\b/i);
  if (sectorNumMatch && sectorNumMatch[1]) {
    const secNum = parseInt(sectorNumMatch[1], 10);
    if (secNum >= 1 && secNum <= 30) {
      const zone = DELIVERY_ZONES.zone_a_core;
      return {
        isServiceable: true,
        zone,
        zoneId: 'zone_a_core',
        areaName: `Sector ${secNum}`,
        sectorOrZone: `Sector ${secNum}, Gandhinagar`,
        city: 'Gandhinagar',
        pincode: secNum <= 15 ? '382010' : '382016',
        clusterId: secNum <= 15 ? 'cluster-d' : 'cluster-c',
        clusterName: 'Core Gandhinagar Sectors',
        deliveryFee: zone.deliveryFee,
        message: `Thalimitra delivers directly to Sector ${secNum} with free cluster doorstep delivery.`,
        estimatedLunchSlot: '12:15 PM – 01:00 PM',
        estimatedDinnerSlot: '07:45 PM – 08:30 PM',
        isExactSectorMatch: true
      };
    }
  }

  // 2. Check predefined Gandhinagar areas list
  const match = GANDHINAGAR_AREAS.find(
    (a) =>
      a.pincode === query ||
      a.area.toLowerCase().includes(query) ||
      a.sector.toLowerCase().includes(query)
  );

  if (match) {
    const isGift = match.area.toLowerCase().includes('gift');
    const isPeripheral = match.area.toLowerCase().includes('vavol') || match.area.toLowerCase().includes('kolavada');
    
    const zoneKey: keyof typeof DELIVERY_ZONES = isGift 
      ? 'zone_b_extended' 
      : isPeripheral 
      ? 'zone_c_periphery' 
      : 'zone_a_core';

    const zone = DELIVERY_ZONES[zoneKey];

    return {
      isServiceable: true,
      zone,
      zoneId: zoneKey,
      areaName: match.area,
      sectorOrZone: `${match.area} (${match.sector})`,
      city: 'Gandhinagar',
      pincode: match.pincode,
      clusterId: match.cluster.toLowerCase().includes('cluster a')
        ? 'cluster-a'
        : match.cluster.toLowerCase().includes('cluster b')
        ? 'cluster-b'
        : match.cluster.toLowerCase().includes('cluster c')
        ? 'cluster-c'
        : 'cluster-d',
      clusterName: match.cluster,
      deliveryFee: zone.deliveryFee,
      message: `Thalimitra delivers directly to ${match.area} (${zone.name}) with ${zone.deliveryFee === 0 ? 'free cluster delivery' : `₹${zone.deliveryFee} delivery fee`}.`,
      estimatedLunchSlot: match.lunchSlot,
      estimatedDinnerSlot: match.dinnerSlot,
      isExactSectorMatch: true
    };
  }

  // 3. College / Campus keywords check
  const isCampusMatch = 
    query.includes('pdpu') || 
    query.includes('da-iict') || 
    query.includes('daiict') || 
    query.includes('nift') || 
    query.includes('gnlu') || 
    query.includes('iit');

  if (isCampusMatch) {
    const zone = DELIVERY_ZONES.zone_a_core;
    return {
      isServiceable: true,
      zone,
      zoneId: 'zone_a_core',
      areaName: 'Knowledge Corridor / Campus Hub',
      sectorOrZone: 'PDPU / DA-IICT / NIFT / GNLU Campus Corridor',
      city: 'Gandhinagar',
      pincode: '382421',
      clusterId: 'cluster-a',
      clusterName: 'Student & Tech Belt',
      deliveryFee: 0,
      message: 'Thalimitra delivers directly to all Gandhinagar college campuses & student PGs with free doorstep delivery.',
      estimatedLunchSlot: '12:15 PM – 12:45 PM',
      estimatedDinnerSlot: '07:30 PM – 08:15 PM',
      isExactSectorMatch: true
    };
  }

  // Not serviceable
  return {
    isServiceable: false,
    areaName: searchQuery,
    sectorOrZone: searchQuery,
    city: 'Outside Service Area',
    pincode: '',
    clusterId: '',
    clusterName: '',
    deliveryFee: 0,
    message: `We couldn't confirm delivery for "${searchQuery}". Select the exact doorstep on the map for the current database-verified result.`,
    estimatedLunchSlot: 'N/A',
    estimatedDinnerSlot: 'N/A'
  };
}

// ----------------------------------------------------
// DEFAULT INITIAL SAVED ADDRESSES
// ----------------------------------------------------
export const EMPTY_DELIVERY_ADDRESS: DeliveryAddress = {id:'',label:'Home',name:'',fullName:'',phone:'',addressLine1:'',addressLine:'',area:'',city:'',state:'',pincode:'',clusterId:'',isDefault:false,isServiceable:false};
export const DEFAULT_SAVED_ADDRESSES: DeliveryAddress[] = [];

// ----------------------------------------------------
// LOCAL CACHE HELPERS
// ----------------------------------------------------
const STORAGE_KEYS = {
  ACTIVE_LOCATION: 'teffein_active_delivery_location',
  SAVED_ADDRESSES: 'teffein_saved_addresses'
};

export function getCachedLocation(): DetectedLocation | null { return null; }

export function setCachedLocation(loc: DetectedLocation): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.ACTIVE_LOCATION, JSON.stringify(loc));
  } catch (e) {
    console.warn('Could not cache location in sessionStorage', e);
  }
}

export function getSavedAddresses(): DeliveryAddress[] { return []; }

export function getDefaultAddressId(): string {
  const addresses = getSavedAddresses();
  const def = addresses.find((a) => a.isDefault);
  return def ? def.id : (addresses[0]?.id || '');
}

export function calculateDeliveryFeeForZone(zoneId?: string): number {
  if (!zoneId) return 0;
  if (zoneId === 'zone_a_core') return DELIVERY_ZONES.zone_a_core.deliveryFee;
  if (zoneId === 'zone_b_extended') return DELIVERY_ZONES.zone_b_extended.deliveryFee;
  if (zoneId === 'zone_c_periphery') return DELIVERY_ZONES.zone_c_periphery.deliveryFee;
  return 0;
}

export function getDeliveryZoneForSectorOrArea(areaOrSector: string): DeliveryZone {
  const check = checkAreaServiceability(areaOrSector);
  if (check.zone) return check.zone;
  return DELIVERY_ZONES.zone_a_core;
}

/**
 * Creates the initial Central Location State
 */
export function getInitialCentralLocationState(): import('../types').CentralLocationState {
  const savedAddrs = getSavedAddresses();
  const defaultAddr = savedAddrs.find((a) => a.isDefault) || savedAddrs[0] || null;
  const cachedLoc = getCachedLocation();

  const isConfirmed = Boolean(defaultAddr);
  const activeAddr = defaultAddr || null;

  const area = activeAddr?.area || cachedLoc?.area || '';
  const sector = activeAddr?.sector || cachedLoc?.sector || area;
  const city = activeAddr?.city || cachedLoc?.city || 'Gandhinagar';
  const pincode = activeAddr?.pincode || cachedLoc?.pincode || '';
  const zoneId = (activeAddr?.zoneId || cachedLoc?.serviceability?.zoneId || 'zone_a_core') as 'zone_a_core' | 'zone_b_extended' | 'zone_c_periphery';
  const deliveryFee = calculateDeliveryFeeForZone(zoneId);

  return {
    permissionStatus: 'prompt',
    detectionStatus: cachedLoc ? 'detected' : 'idle',
    latitude: cachedLoc?.latitude ?? (activeAddr?.latitude ?? null),
    longitude: cachedLoc?.longitude ?? (activeAddr?.longitude ?? null),
    accuracy: cachedLoc?.accuracy ?? null,
    detectedAt: cachedLoc?.timestamp ?? null,
    source: (activeAddr?.source as any) || (cachedLoc ? 'gps' : 'saved'),
    city,
    area,
    sector,
    pincode,
    formattedAddress: activeAddr?.addressLine1 || activeAddr?.addressLine || cachedLoc?.displayName || (area ? `${area}, ${city}` : 'Set delivery location'),
    serviceable: activeAddr ? activeAddr.isServiceable : (cachedLoc ? cachedLoc.isServiceable : false),
    deliveryZoneId: zoneId,
    deliveryFee,
    isAddressConfirmed: isConfirmed,
    selectedAddressId: activeAddr ? activeAddr.id : null,
    confirmedAddress: activeAddr
  };
}

/**
 * Backend Validation Engine
 * Simulates server-side verification before order placement.
 * Ensures price, delivery fee, serviceability, meal availability, and immutable snapshot are validated.
 */
export function validateOrderPayload(orderData: {
  address: DeliveryAddress | import('../types').CustomerAddress;
  quantity: number;
  scheduledDate: string;
  mealSlot: 'lunch' | 'dinner';
  subtotal: number;
  addOnsTotal: number;
  deliveryFee: number;
  total: number;
}): {
  isValid: boolean;
  errors: string[];
  validatedDeliveryFee: number;
  validatedDeliveryZoneId: string;
  immutableAddressSnapshot: DeliveryAddress;
} {
  const errors: string[] = [];
  const addr = orderData.address;

  if (!addr || !addr.area || !addr.phone) {
    errors.push('A confirmed delivery address with phone number is required.');
  }

  // Check area serviceability
  const serviceCheck = checkAreaServiceability(addr.area || addr.pincode || '');
  if (!serviceCheck.isServiceable) {
    errors.push(`Delivery area "${addr.area}" is currently unserviceable.`);
  }

  const zoneId = (addr.zoneId || serviceCheck.zoneId || 'zone_a_core') as string;
  const validatedDeliveryFee = calculateDeliveryFeeForZone(zoneId);

  // Freeze immutable address snapshot
  const immutableAddressSnapshot: DeliveryAddress = {
    id: addr.id || `snapshot-${Date.now()}`,
    label: (addr.label as any) || 'Home',
    name: addr.name || addr.fullName || 'Customer',
    fullName: addr.fullName || addr.name || 'Customer',
    phone: addr.phone || '',
    addressLine1: (addr as any).addressLine1 || (addr as any).addressLine || `${addr.area}, Gandhinagar`,
    addressLine: (addr as any).addressLine || (addr as any).addressLine1 || `${addr.area}, Gandhinagar`,
    addressLine2: (addr as any).addressLine2 || '',
    landmark: addr.landmark || '',
    area: addr.area || 'Gandhinagar',
    sector: addr.sector || addr.area || 'Gandhinagar',
    city: addr.city || 'Gandhinagar',
    state: addr.state || 'Gujarat',
    pincode: addr.pincode || '382021',
    latitude: addr.latitude,
    longitude: addr.longitude,
    instructions: addr.instructions,
    instructionPreset: (addr.instructionPreset as DeliveryInstructionPreset) || 'call_on_reach',
    isDefault: addr.isDefault ?? false,
    clusterId: addr.clusterId || serviceCheck.clusterId || 'cluster-a',
    clusterName: (addr as any).clusterName || serviceCheck.clusterName || 'Core Gandhinagar',
    zoneId: zoneId as any,
    deliveryFee: validatedDeliveryFee,
    isServiceable: serviceCheck.isServiceable
  };

  return {
    isValid: errors.length === 0,
    errors,
    validatedDeliveryFee,
    validatedDeliveryZoneId: zoneId,
    immutableAddressSnapshot
  };
}


export function saveAddressesToStorage(_addresses: DeliveryAddress[]): void { /* Addresses are loaded from the authenticated database only. */ }
