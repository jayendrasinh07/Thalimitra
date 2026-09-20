import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Crosshair,
  MapPin,
  Building2,
  Home,
  GraduationCap,
  Clock,
  Truck,
  ShieldCheck,
  ChevronRight,
  Bell,
  ArrowRight,
  Loader2,
  CheckCircle2,
  X,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  DeliveryAddress,
  AddressLabel,
  DeliveryInstructionPreset,
  DetectedLocation,
  LocationSource
} from '../../types';
import {
  evaluateLocationServiceability,
  CENTRAL_KITCHEN_COORDS
} from '../../services/locationService';
import {
  getGoogleMapsApiKey,
  loadGoogleMapsApi,
  reverseGeocodeGoogle,
  searchGooglePlaces,
  getGooglePlaceDetails,
  ParsedGoogleAddress,
  UnifiedPrediction
} from '../../services/googleMapsLoader';
import { OpenStreetMapCanvas } from './OpenStreetMapCanvas';
import { checkCoordinateServiceability, type CoordinateServiceability } from '../../services/serviceabilityService';
import { joinAreaWaitlist, listPublicDeliveryAreas, type PublicDeliveryArea } from '../../services/publicDeliveryAreaService';

interface GoogleMapDeliverySelectorProps {
  onClose: () => void;
  onAddressConfirmed?: (addr: DeliveryAddress) => void;
  initialCoords?: { lat: number; lng: number } | null;
}

export const GoogleMapDeliverySelector: React.FC<GoogleMapDeliverySelectorProps> = ({
  onClose,
  onAddressConfirmed,
  initialCoords
}) => {
  const {
    centralLocation,
    activeDeliveryAddress,
    savedAddresses,
    detectUserLocation,
    selectDeliveryAddress,
    saveDeliveryAddress,
    showToast
  } = useApp();

  // Container ref for the real Google Maps canvas element
  const mapElementRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null);
  const isMapMovingRef = useRef<boolean>(false);

  // Map Loading State
  const [isMapApiLoaded, setIsMapApiLoaded] = useState<boolean>(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [isInitializingMap, setIsInitializingMap] = useState<boolean>(true);
  const [mapProvider, setMapProvider] = useState<'google' | 'openstreetmap'>('google');

  // 1. Initial Map Center (separate from user GPS location)
  const initialMapCenterRef = useRef<{ lat: number; lng: number }>(
    initialCoords && initialCoords.lat && initialCoords.lng
      ? initialCoords
      : centralLocation?.latitude && centralLocation?.longitude
      ? { lat: centralLocation.latitude, lng: centralLocation.longitude }
      : activeDeliveryAddress?.latitude && activeDeliveryAddress?.longitude
      ? { lat: activeDeliveryAddress.latitude, lng: activeDeliveryAddress.longitude }
      : { lat: 23.2156, lng: 72.6369 }
  );

  // 2. Current dynamic Map Center
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(initialMapCenterRef.current);

  // 3. Exact User GPS coordinates (null until GPS detected)
  const [userGpsLocation, setUserGpsLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // 4. Location Detection Lifecycle Status
  const [locationStatus, setLocationStatus] = useState<'idle' | 'detecting' | 'detected' | 'error'>('idle');
  const [gpsAccuracyWarning, setGpsAccuracyWarning] = useState<string | null>(null);
  const [gpsPermissionError, setGpsPermissionError] = useState<string | null>(null);

  const [isDraggingMap, setIsDraggingMap] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isGpsLocating, setIsGpsLocating] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>('map');

  // 5. Address resolved from Geocoder
  const [resolvedAddress, setResolvedAddress] = useState<ParsedGoogleAddress | null>(null);
  const [serverAvailability, setServerAvailability] = useState<CoordinateServiceability | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  // Search input & Google Places autocomplete
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [placesPredictions, setPlacesPredictions] = useState<UnifiedPrediction[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState<boolean>(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);

  // Modal Step: 'map_selection' | 'serviceability_result' | 'conflict_warning'
  const [currentStep, setCurrentStep] = useState<'map_selection' | 'serviceability_result' | 'conflict_warning'>('map_selection');

  // Manual Doorstep Details Form
  const [selectedLabel, setSelectedLabel] = useState<AddressLabel>('Home');
  const [houseNumber, setHouseNumber] = useState<string>('');
  const [building, setBuilding] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [contactName, setContactName] = useState<string>(activeDeliveryAddress?.fullName || '');
  const [contactPhone, setContactPhone] = useState<string>(activeDeliveryAddress?.phone || '');
  const [instructionPreset, setInstructionPreset] = useState<DeliveryInstructionPreset>('call_on_reach');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [shouldSaveAddress, setShouldSaveAddress] = useState<boolean>(true);

  // Waitlist form (if unserviceable)
  const [waitlistName, setWaitlistName] = useState<string>(contactName);
  const [waitlistContact, setWaitlistContact] = useState<string>(contactPhone);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState<boolean>(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState<boolean>(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [availableAreas, setAvailableAreas] = useState<PublicDeliveryArea[]>([]);

  // Saved address conflict state
  const [conflictingSavedAddress, setConflictingSavedAddress] = useState<DeliveryAddress | null>(null);

  // Request ID sequence counter to prevent race conditions
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    let active = true;
    void listPublicDeliveryAreas().then(areas => { if (active) setAvailableAreas(areas); }).catch(() => { if (active) setAvailableAreas([]); });
    return () => { active = false; };
  }, []);

  // Debounce timers
  const geocodeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshServiceability = useCallback(async (lat: number, lng: number, address: ParsedGoogleAddress, reqId: number) => {
    setIsCheckingAvailability(true);
    setAvailabilityError(null);
    try {
      const result = await checkCoordinateServiceability({
        latitude: lat, longitude: lng, pincode: address.pincode,
        area: address.area, sector: address.sector,
      });
      if (reqId !== requestIdRef.current) return;
      setServerAvailability(result);
    } catch (cause) {
      if (reqId !== requestIdRef.current) return;
      const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : '';
      if (['PGRST202', '42883'].includes(code)) {
        const legacy = evaluateLocationServiceability(lat, lng, address.area, address.city, address.pincode);
        setServerAvailability({
          status: legacy.isServiceable ? 'available' : 'unavailable',
          isServiceable: legacy.isServiceable, areaId: legacy.zoneId || null,
          areaName: legacy.areaName, deliveryFee: legacy.deliveryFee,
          minOrderAmount: legacy.zone?.minOrderAmount || 0,
          estimatedDurationMinutes: legacy.zone?.estimatedDurationMinutes || null,
          waitlistEnabled: true,
          services: { breakfast: legacy.isServiceable, lunch: legacy.isServiceable, dinner: legacy.isServiceable },
          message: legacy.message,
        });
      } else {
        setServerAvailability(null);
        setAvailabilityError('Delivery availability could not be confirmed. Please try again.');
      }
      console.error('[Thalimitra Maps] Serviceability check failed:', cause);
    } finally {
      if (reqId === requestIdRef.current) setIsCheckingAvailability(false);
    }
  }, []);

  // ----------------------------------------------------
  // 1. REVERSE GEOCODING (SAFE SEQUENCE TRACKED)
  // ----------------------------------------------------
  const executeReverseGeocode = useCallback(async (lat: number, lng: number) => {
    const reqId = ++requestIdRef.current;
    setIsGeocoding(true);
    setServerAvailability(null);
    setAvailabilityError(null);
    try {
      const parsed = await reverseGeocodeGoogle(lat, lng);
      // Discard stale out-of-order responses
      if (reqId !== requestIdRef.current) return;
      if (!parsed) throw new Error('Unable to resolve this location');

      setResolvedAddress(parsed);
      await refreshServiceability(lat, lng, parsed, reqId);

      // If Google provides house number / building, autofill only if user hasn't edited
      if (parsed.houseNumber && !houseNumber) {
        setHouseNumber(parsed.houseNumber);
      }
      if (parsed.building && !building) {
        setBuilding(parsed.building);
      }
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      console.error('[Thalimitra Maps] Reverse geocoding error:', err);
      // Clean fallback object without inventing fake locations
      const fallback: ParsedGoogleAddress = {
        formattedAddress: `${lat.toFixed(5)}Â° N, ${lng.toFixed(5)}Â° E`,
        houseNumber: '',
        building: '',
        street: '',
        area: 'Gandhinagar Area',
        sector: 'Gandhinagar',
        city: 'Gandhinagar',
        state: 'Gujarat',
        pincode: '',
        latitude: lat,
        longitude: lng
      };
      setResolvedAddress(fallback);
      await refreshServiceability(lat, lng, fallback, reqId);
    } finally {
      if (reqId === requestIdRef.current) {
        setIsGeocoding(false);
      }
    }
  }, [houseNumber, building, refreshServiceability]);

  // ----------------------------------------------------
  // 2. INITIALIZE REAL GOOGLE MAP
  // ----------------------------------------------------
  const initGoogleMap = useCallback(async () => {
    setIsInitializingMap(true);
    setMapLoadError(null);

    try {
      if (!getGoogleMapsApiKey()) {
        setMapProvider('openstreetmap');
        setIsMapApiLoaded(true);
        void executeReverseGeocode(mapCenter.lat, mapCenter.lng);
        return;
      }
      const maps = await loadGoogleMapsApi();
      setMapProvider('google');
      setIsMapApiLoaded(true);

      if (!mapElementRef.current) return;

      // Clean modern Google Maps styling tailored for Thalimitra
      const mapOptions: google.maps.MapOptions & { internalUsageAttributionIds?: string[] } = {
        center: mapCenter,
        zoom: 16,
        mapTypeId: maps.MapTypeId.ROADMAP,
        disableDefaultUI: true, // We use custom floating buttons
        zoomControl: true,
        zoomControlOptions: {
          position: maps.ControlPosition.RIGHT_CENTER
        },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy', // Smooth pinch and scroll on mobile/desktop
        clickableIcons: false, // Prevent distracting POI popups
        internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'simplified' }]
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ lightness: 10 }]
          },
          {
            featureType: 'water',
            elementType: 'geometry.fill',
            stylers: [{ color: '#cbe6f7' }]
          }
        ]
      };

      const map = new maps.Map(mapElementRef.current, mapOptions);
      googleMapInstanceRef.current = map;

      // Add idle and drag events
      map.addListener('dragstart', () => {
        isMapMovingRef.current = true;
        setIsDraggingMap(true);
      });

      map.addListener('center_changed', () => {
        const center = map.getCenter();
        if (center) {
          const lat = center.lat();
          const lng = center.lng();
          setMapCenter({ lat, lng });
        }
      });

      map.addListener('idle', () => {
        setIsDraggingMap(false);
        isMapMovingRef.current = false;
        const center = map.getCenter();
        if (center) {
          const lat = center.lat();
          const lng = center.lng();
          setMapCenter({ lat, lng });

          // Debounced reverse geocoding on idle to reduce API usage
          if (geocodeDebounceTimerRef.current) {
            clearTimeout(geocodeDebounceTimerRef.current);
          }
          geocodeDebounceTimerRef.current = setTimeout(() => {
            executeReverseGeocode(lat, lng);
          }, 350);
        }
      });

      // Initial reverse geocode for starting center
      executeReverseGeocode(mapCenter.lat, mapCenter.lng);
    } catch (err: any) {
      console.warn('[Thalimitra Maps] Google Maps unavailable; using OpenStreetMap.', err);
      setMapProvider('openstreetmap');
      setIsMapApiLoaded(true);
      setMapLoadError(null);
      void executeReverseGeocode(mapCenter.lat, mapCenter.lng);
    } finally {
      setIsInitializingMap(false);
    }
  }, [mapCenter.lat, mapCenter.lng, executeReverseGeocode]);

  useEffect(() => {
    initGoogleMap();

    return () => {
      if (geocodeDebounceTimerRef.current) clearTimeout(geocodeDebounceTimerRef.current);
      if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current);
    };
  }, []);

  // ----------------------------------------------------
  // 3. USE MY CURRENT LOCATION (REAL BROWSER GPS SOURCE OF TRUTH)
  // ----------------------------------------------------
  const handleUseCurrentLocation = async () => {
    const reqId = ++requestIdRef.current;
    setIsGpsLocating(true);
    setLocationStatus('detecting');
    setLocationSource('gps');
    setGpsPermissionError(null);
    setGpsAccuracyWarning(null);
    setResolvedAddress(null); // Clear stale address immediately before GPS request

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setIsGpsLocating(false);
      setLocationStatus('error');
      setGpsPermissionError('Location detection is not supported by your browser.');
      showToast('Geolocation Unsupported', 'Your browser does not support GPS location detection.', 'warning');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (reqId !== requestIdRef.current) return;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        const timestamp = pos.timestamp || Date.now();

        // 1. Log GPS RESULT
        console.log(
          'GPS RESULT\n' +
          `latitude: ${lat}\n` +
          `longitude: ${lng}\n` +
          `accuracy: ${acc !== undefined ? `${acc.toFixed(1)} meters` : 'N/A'}\n` +
          `timestamp: ${new Date(timestamp).toISOString()}`
        );

        setUserGpsLocation({ lat, lng, accuracy: acc });
        setGpsAccuracy(acc);
        setMapCenter({ lat, lng });

        // Accuracy check: if poor accuracy (>500m), show non-blocking warning
        if (acc && acc > 500) {
          setGpsAccuracyWarning('Location accuracy is low. Please try again or adjust the map.');
        } else {
          setGpsAccuracyWarning(null);
        }

        // 2. Move Google Map to exact GPS coordinates
        if (googleMapInstanceRef.current) {
          googleMapInstanceRef.current.panTo({ lat, lng });
          googleMapInstanceRef.current.setZoom(17);

          const center = googleMapInstanceRef.current.getCenter();
          if (center) {
            console.log(
              'MAP CENTER\n' +
              `center.lat(): ${center.lat()}\n` +
              `center.lng(): ${center.lng()}`
            );
          }
        }

        // 3. Reverse Geocode exact GPS coordinates
        try {
          setIsGeocoding(true);
          const parsed = await reverseGeocodeGoogle(lat, lng);
          if (reqId !== requestIdRef.current) return;
          if (!parsed) throw new Error('Unable to resolve this location');

          setResolvedAddress(parsed);
          await refreshServiceability(lat, lng, parsed, reqId);
          console.log('Reverse geocoded address:', parsed.formattedAddress || `${parsed.area}, ${parsed.city}`);

          const serviceability = evaluateLocationServiceability(
            lat,
            lng,
            parsed.area,
            parsed.city,
            parsed.pincode
          );
          console.log('Serviceability result:', serviceability);

          if (parsed.houseNumber && !houseNumber) {
            setHouseNumber(parsed.houseNumber);
          }
          if (parsed.building && !building) {
            setBuilding(parsed.building);
          }

          setLocationStatus('detected');
        } catch (geocodeErr) {
          console.error('[Thalimitra Maps] Reverse geocoding error:', geocodeErr);
        } finally {
          setIsGeocoding(false);
          setIsGpsLocating(false);
        }

        // Check if there is an existing saved Home address that diverges from current GPS
        const savedHome = savedAddresses.find((a) => a.label === 'Home');
        if (savedHome && savedHome.latitude && savedHome.longitude) {
          const distKm = Math.sqrt(
            Math.pow(savedHome.latitude - lat, 2) + Math.pow(savedHome.longitude - lng, 2)
          ) * 111;

          if (distKm > 1.2) {
            setConflictingSavedAddress(savedHome);
            setCurrentStep('conflict_warning');
          }
        }
      },
      (error) => {
        if (reqId !== requestIdRef.current) return;
        setIsGpsLocating(false);
        setLocationStatus('error');

        let msg = "Couldn't detect your location. Please search your address.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission is disabled.';
          setGpsPermissionError('Location permission is disabled.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'GPS signal unavailable. Please use the search bar or pan the map.';
          setGpsPermissionError(msg);
        } else if (error.code === error.TIMEOUT) {
          msg = 'GPS location request timed out. Please try again or search.';
          setGpsPermissionError(msg);
        } else {
          setGpsPermissionError(msg);
        }
        showToast('GPS Detection', msg, 'warning');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0 // Do not allow stale cached locations
      }
    );
  };

  // ----------------------------------------------------
  // 4. REAL GOOGLE PLACES SEARCH AUTOCOMPLETE
  // ----------------------------------------------------
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);

    if (!val.trim()) {
      setPlacesPredictions([]);
      setShowSearchDropdown(false);
      return;
    }

    setShowSearchDropdown(true);
    setIsSearchingPlaces(true);

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    searchDebounceTimerRef.current = setTimeout(async () => {
      try {
        const predictions = await searchGooglePlaces(val, mapCenter);
        setPlacesPredictions(predictions);
      } catch (err) {
        console.error('[Thalimitra Maps] Places autocomplete error:', err);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 280);
  };

  const handleSelectPrediction = async (prediction: UnifiedPrediction) => {
    setSearchQuery(prediction.mainText || prediction.description);
    setShowSearchDropdown(false);
    setLocationSource('search');

    try {
      const details = await getGooglePlaceDetails(prediction.placeId, prediction);
      setMapCenter({ lat: details.latitude, lng: details.longitude });
      setResolvedAddress(details);
      const reqId = ++requestIdRef.current;
      setServerAvailability(null);
      await refreshServiceability(details.latitude, details.longitude, details, reqId);

      // Move real Google Map to place coordinates
      if (googleMapInstanceRef.current) {
        googleMapInstanceRef.current.panTo({ lat: details.latitude, lng: details.longitude });
        googleMapInstanceRef.current.setZoom(17);
      }
    } catch (err) {
      console.warn('[Thalimitra Maps] Could not resolve place details:', err);
    }
  };

  // ----------------------------------------------------
  // 5. SAVED ADDRESS SELECTION
  // ----------------------------------------------------
  const handleSelectSavedAddress = (addr: DeliveryAddress) => {
    if (addr.latitude && addr.longitude) {
      const coords = { lat: addr.latitude, lng: addr.longitude };
      setMapCenter(coords);
      setLocationSource('saved');

      if (googleMapInstanceRef.current) {
        googleMapInstanceRef.current.panTo(coords);
        googleMapInstanceRef.current.setZoom(17);
      }

      executeReverseGeocode(addr.latitude, addr.longitude);
    }
  };

  // ----------------------------------------------------
  // 6. SERVICEABILITY & FINAL CONFIRMATION
  // ----------------------------------------------------
  const localFallback = evaluateLocationServiceability(mapCenter.lat, mapCenter.lng, resolvedAddress?.area, resolvedAddress?.city, resolvedAddress?.pincode);
  const serviceabilityResult = serverAvailability ? {
    ...localFallback,
    isServiceable: serverAvailability.isServiceable,
    status: serverAvailability.status,
    zoneId: serverAvailability.areaId || 'unserviceable',
    areaName: serverAvailability.areaName,
    sectorOrZone: serverAvailability.areaName,
    clusterId: serverAvailability.areaId || '',
    clusterName: serverAvailability.areaName,
    deliveryFee: serverAvailability.deliveryFee,
    minOrderAmount: serverAvailability.minOrderAmount,
    estimatedDurationMinutes: serverAvailability.estimatedDurationMinutes,
    waitlistEnabled: serverAvailability.waitlistEnabled,
    services: serverAvailability.services,
    message: serverAvailability.message,
  } : { ...localFallback, isServiceable: false, status: 'unavailable' as const,
    zoneId: 'unserviceable', deliveryFee: 0,
    message: availabilityError || 'Checking the exact delivery boundaryâ€¦' };

  const handleInitiateConfirmLocation = () => {
    if (!resolvedAddress || isCheckingAvailability || availabilityError) return;
    setCurrentStep('serviceability_result');
  };

  const handleFinalConfirmAndSave = async () => {
    if (!resolvedAddress) return;

    if (!contactPhone.trim()) {
      showToast('Phone Number Required', 'Please provide a contact phone number for meal delivery coordination.', 'warning');
      return;
    }

    const serviceability = serviceabilityResult;

    // Assemble detailed address line with doorstep inputs
    const lineParts = [
      houseNumber.trim(),
      building.trim(),
      landmark.trim() ? `Near ${landmark.trim()}` : '',
      resolvedAddress.formattedAddress
    ].filter(Boolean);

    const fullAddress = lineParts.join(', ');

    const finalInstructions = instructionPreset === 'call_on_reach'
      ? 'Call on arrival.'
      : instructionPreset === 'leave_at_security'
      ? 'Leave at security desk.'
      : instructionPreset === 'ring_bell'
      ? 'Ring doorbell.'
      : instructionPreset === 'deliver_at_reception'
      ? 'Deliver to front desk reception.'
      : customInstructions || 'Standard doorstep delivery.';

    const newDeliveryAddress: DeliveryAddress = {
      id: `addr-${Date.now()}`,
      label: selectedLabel,
      name: contactName.trim() || 'Customer',
      fullName: contactName.trim() || 'Customer',
      phone: contactPhone.trim(),
      addressLine1: fullAddress,
      addressLine: fullAddress,
      houseNumber: houseNumber.trim() || undefined,
      building: building.trim() || undefined,
      landmark: landmark.trim() || undefined,
      area: resolvedAddress.area || 'Gandhinagar',
      sector: resolvedAddress.sector || resolvedAddress.area || 'Gandhinagar',
      city: resolvedAddress.city || 'Gandhinagar',
      state: resolvedAddress.state || 'Gujarat',
      pincode: resolvedAddress.pincode || '',
      latitude: mapCenter.lat,
      longitude: mapCenter.lng,
      accuracy: gpsAccuracy ?? undefined,
      placeId: resolvedAddress.placeId,
      source: locationSource,
      instructions: finalInstructions,
      instructionPreset,
      isDefault: true,
      clusterId: serviceability.clusterId || 'cluster-a',
      clusterName: serviceability.clusterName || 'Gandhinagar Delivery Hub',
      zoneId: serviceability.zoneId as any,
      deliveryFee: serviceability.deliveryFee,
      isServiceable: serviceability.isServiceable,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const saved=await saveDeliveryAddress(newDeliveryAddress);
      if(onAddressConfirmed)onAddressConfirmed(saved);
    }catch(error){showToast('Address not saved',(error as Error).message,'error');return;}
    onClose();
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistName.trim() || !waitlistContact.trim() || !resolvedAddress || waitlistSubmitting) return;
    setWaitlistSubmitting(true); setWaitlistError(null);
    try {
      await joinAreaWaitlist({
        name: waitlistName.trim(), contact: waitlistContact.trim(),
        area: resolvedAddress.area || resolvedAddress.formattedAddress,
        city: resolvedAddress.city || 'Outside Service Zone', pincode: resolvedAddress.pincode,
        formattedAddress: resolvedAddress.formattedAddress,
        latitude: mapCenter.lat, longitude: mapCenter.lng, source: locationSource,
      });
      setWaitlistSubmitted(true);
      showToast('Priority alert is on', `We will notify you when delivery opens in ${resolvedAddress.area || 'this area'}.`, 'info');
    } catch (cause) {
      setWaitlistError(cause instanceof Error ? cause.message : 'Your request could not be saved. Please try again.');
    } finally { setWaitlistSubmitting(false); }
  };

  const showAvailableArea = (area: PublicDeliveryArea) => {
    setCurrentStep('map_selection');
    setSearchQuery(area.name);
    setMapCenter({ lat: area.latitude, lng: area.longitude });
    setLocationSource('search');
    void executeReverseGeocode(area.latitude, area.longitude);
    googleMapInstanceRef.current?.panTo({ lat: area.latitude, lng: area.longitude });
    googleMapInstanceRef.current?.setZoom(15);
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5] text-stone-900 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl relative select-none">

      {/* ----------------------------------------------------
          MODAL HEADER
      ---------------------------------------------------- */}
      <div className="px-5 py-4 bg-white border-b border-stone-200 flex items-center justify-between z-20 shrink-0">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <span>Where should we deliver?</span>
            {locationSource === 'gps' && gpsAccuracy && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                GPS Verified
              </span>
            )}
          </h2>
          <p className="text-xs text-stone-500 font-medium">
            Move the map to set your doorstep, or search your address.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close location selector"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ----------------------------------------------------
          STEP 1: REAL GOOGLE MAP & PLACES AUTOCOMPLETE
      ---------------------------------------------------- */}
      {currentStep === 'map_selection' && (
        <div className="flex-1 flex flex-col relative overflow-hidden">

          {/* SEARCH OVERLAY */}
          <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-20 max-w-xl mx-auto">
            <div className="relative">
              <div className="flex items-center bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-stone-200 px-3.5 py-2.5 gap-2.5 transition-all focus-within:ring-2 focus-within:ring-[#0D6E44] focus-within:border-transparent">
                <Search className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
                  placeholder="Search address, area, landmark, PG or college..."
                  className="w-full bg-transparent text-sm text-stone-900 placeholder:text-stone-400 outline-none font-medium"
                />
                {isSearchingPlaces && <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />}
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); }}
                    className="text-stone-400 hover:text-stone-600 text-xs p-1 cursor-pointer"
                  >
                    âœ•
                  </button>
                )}
              </div>

              {/* GOOGLE PLACES / GANDHINAGAR PREDICTIONS DROPDOWN */}
              {showSearchDropdown && placesPredictions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-stone-200 max-h-64 overflow-y-auto z-30 divide-y divide-stone-100 animate-in fade-in slide-in-from-top-1">
                  {placesPredictions.map((item) => (
                    <button
                      key={item.placeId}
                      onClick={() => handleSelectPrediction(item)}
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50/70 flex items-center justify-between group transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-stone-100 group-hover:bg-emerald-100 text-stone-600 group-hover:text-[#0D6E44] flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-stone-900 group-hover:text-[#0D6E44] truncate">
                            {item.mainText}
                          </div>
                          <div className="text-[11px] text-stone-500 truncate">
                            {item.secondaryText}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-[#0D6E44] shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* INTERACTIVE MAP CONTAINER */}
          <div className="flex-1 w-full bg-[#E5E3DF] relative overflow-hidden flex items-center justify-center">

            {mapProvider === 'google' ? (
              <div
                ref={mapElementRef}
                className="w-full h-full"
                style={{ minHeight: '320px' }}
              />
            ) : (
              <OpenStreetMapCanvas
                center={mapCenter}
                onMoveStart={() => {
                  isMapMovingRef.current = true;
                  setIsDraggingMap(true);
                }}
                onMoveEnd={coordinates => {
                  isMapMovingRef.current = false;
                  setIsDraggingMap(false);
                  setMapCenter(coordinates);

                  if (geocodeDebounceTimerRef.current) {
                    clearTimeout(geocodeDebounceTimerRef.current);
                  }
                  geocodeDebounceTimerRef.current = setTimeout(() => {
                    void executeReverseGeocode(coordinates.lat, coordinates.lng);
                  }, 350);
                }}
              />
            )}

            {/* ERROR UI IF GOOGLE MAPS FAILS TO LOAD */}
            {mapLoadError && (
              <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center text-white">
                <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
                <h3 className="text-lg font-black">Map couldn't load.</h3>
                <p className="text-xs text-stone-300 max-w-sm mt-1 mb-4 leading-relaxed">
                  {mapLoadError}
                </p>
                <button
                  onClick={initGoogleMap}
                  className="px-5 py-2.5 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* INITIAL LOADING STATE */}
            {isInitializingMap && !mapLoadError && (
              <div className="absolute inset-0 bg-[#E8ECE9] z-20 flex flex-col items-center justify-center text-stone-600 gap-3">
                <Loader2 className="w-8 h-8 text-[#0D6E44] animate-spin" />
                <span className="text-xs font-bold tracking-wide">Loading delivery map...</span>
              </div>
            )}

            {/* ----------------------------------------------------
                CENTER PIN UX (STAYS FIXED IN THE CENTER)
            ---------------------------------------------------- */}
            {!mapLoadError && (
              <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 flex flex-col items-center">

                {/* Tooltip banner above pin */}
                <div className={`mb-2 px-3 py-1.5 rounded-full bg-stone-900/90 text-white text-[11px] font-bold shadow-xl border border-stone-700 flex items-center gap-1.5 transition-all duration-150 ${
                  isDraggingMap ? 'opacity-90 scale-105 -translate-y-1' : 'opacity-100 scale-100'
                }`}>
                  {isGeocoding ? (
                    <>
                      <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                      <span>Resolving address...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3 h-3 text-amber-300 shrink-0" />
                      <span>Move map to adjust doorstep</span>
                    </>
                  )}
                </div>

                {/* Center Pin SVG Marker with Drop & Lift Animation */}
                <div className={`relative transition-transform duration-150 ${
                  isDraggingMap ? '-translate-y-4 scale-110' : 'translate-y-0 scale-100'
                }`}>
                  <div className="w-10 h-12 flex items-center justify-center filter drop-shadow-xl">
                    <svg width="38" height="46" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 0C8.50659 0 0 8.50659 0 19C0 31.5 19 46 19 46C19 46 38 31.5 38 19C38 8.50659 29.4934 0 19 0Z" fill="#0D6E44"/>
                      <circle cx="19" cy="18" r="8" fill="#FAF8F5"/>
                      <circle cx="19" cy="18" r="4.5" fill="#F59E0B"/>
                    </svg>
                  </div>
                </div>

                {/* Ground Shadow */}
                <div className={`w-4 h-1.5 rounded-full bg-stone-900/40 blur-xs transition-all duration-150 ${
                  isDraggingMap ? 'scale-50 opacity-20' : 'scale-100 opacity-60'
                }`} />
              </div>
            )}

            {/* LOW ACCURACY WARNING BANNER */}
            {gpsAccuracyWarning && (
              <div className="absolute top-18 left-4 right-4 z-20 max-w-lg mx-auto p-3 bg-amber-50/95 backdrop-blur-md border border-amber-300 rounded-2xl shadow-lg text-amber-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-medium">
                    {gpsAccuracyWarning} {gpsAccuracy ? `(Â±${Math.round(gpsAccuracy)}m)` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={handleUseCurrentLocation}
                    className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-lg font-bold text-[11px] cursor-pointer transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setGpsAccuracyWarning(null)}
                    className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-lg font-bold text-[11px] border border-amber-300 cursor-pointer transition-colors"
                  >
                    Adjust on Map
                  </button>
                </div>
              </div>
            )}

            {/* PERMISSION ERROR BANNER */}
            {gpsPermissionError && (
              <div className="absolute top-18 left-4 right-4 z-20 max-w-lg mx-auto p-3.5 bg-rose-50/95 backdrop-blur-md border border-rose-300 rounded-2xl shadow-lg text-rose-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-bold">{gpsPermissionError}</div>
                    <div className="text-[11px] text-rose-700 mt-0.5">Please allow location in browser settings or search your address.</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={handleUseCurrentLocation}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-[#0D6E44] text-white rounded-xl font-bold text-xs hover:bg-[#08482C] cursor-pointer transition-colors"
                  >
                    Allow Location
                  </button>
                  <button
                    onClick={() => {
                      setGpsPermissionError(null);
                      setShowSearchDropdown(true);
                      const input = document.querySelector('input[placeholder*="Search address"]') as HTMLInputElement;
                      if (input) input.focus();
                    }}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-white text-stone-800 rounded-xl font-bold text-xs border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                    Search Address Instead
                  </button>
                </div>
              </div>
            )}

            {/* FLOATING "USE MY CURRENT LOCATION" BUTTON */}
            <button
              onClick={handleUseCurrentLocation}
              disabled={isGpsLocating}
              className="absolute bottom-4 right-4 z-10 px-4 py-2.5 rounded-2xl bg-white hover:bg-emerald-50 text-stone-900 hover:text-[#0D6E44] text-xs font-bold shadow-xl border border-stone-200 flex items-center gap-2 transition-all cursor-pointer group disabled:opacity-75"
              title="Detect real browser GPS position"
            >
              {isGpsLocating ? (
                <>
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  <span>Detecting your location...</span>
                </>
              ) : (
                <>
                  <Crosshair className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span>Use My Current Location</span>
                </>
              )}
            </button>
          </div>

          {/* ----------------------------------------------------
              SAVED ADDRESSES QUICK BAR (IF ANY)
          ---------------------------------------------------- */}
          {savedAddresses.length > 0 && (
            <div className="bg-stone-50 border-t border-stone-200/80 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0">
                Saved:
              </span>
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => handleSelectSavedAddress(addr)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white hover:bg-emerald-50 border border-stone-200 text-stone-700 hover:text-[#0D6E44] text-xs font-semibold shrink-0 shadow-2xs transition-colors cursor-pointer"
                >
                  {addr.label === 'Home' && <Home className="w-3 h-3 text-emerald-600" />}
                  {addr.label === 'Office' && <Building2 className="w-3 h-3 text-blue-600" />}
                  {addr.label === 'College' && <GraduationCap className="w-3 h-3 text-purple-600" />}
                  {addr.label === 'PG' && <Building2 className="w-3 h-3 text-amber-600" />}
                  <span>{addr.label}</span>
                  <span className="text-stone-400 font-normal">({addr.sector || addr.area})</span>
                </button>
              ))}
            </div>
          )}

          {/* ----------------------------------------------------
              BOTTOM ADDRESS CARD & CONFIRM BUTTON
          ---------------------------------------------------- */}
          <div className="p-4 sm:p-5 bg-white border-t border-stone-200 shadow-lg z-20 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              {/* Address Readout */}
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0D6E44] flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0D6E44] flex items-center gap-2">
                    <span>Deliver to this location</span>
                    {locationSource === 'gps' && gpsAccuracy !== null && gpsAccuracy < 500 && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                        GPS Verified (Â±{Math.round(gpsAccuracy)}m)
                      </span>
                    )}
                    {locationSource === 'gps' && gpsAccuracy !== null && gpsAccuracy >= 500 && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                        Approximate GPS (Â±{Math.round(gpsAccuracy)}m)
                      </span>
                    )}
                  </div>

                  <div className="text-sm sm:text-base font-black text-stone-900 truncate">
                    {locationStatus === 'detecting'
                      ? 'Detecting exact GPS doorstep...'
                      : resolvedAddress?.formattedAddress || `${mapCenter.lat.toFixed(5)}Â° N, ${mapCenter.lng.toFixed(5)}Â° E`}
                  </div>

                  <div className="text-xs text-stone-500 truncate mt-0.5">
                    {locationStatus === 'detecting'
                      ? 'Requesting high-accuracy browser coordinates...'
                      : resolvedAddress?.city
                      ? `${resolvedAddress.area || ''}${resolvedAddress.area ? ', ' : ''}${resolvedAddress.city} ${resolvedAddress.pincode || ''}`
                      : 'Doorstep location selected on Google Map'}
                  </div>
                </div>
              </div>

              {/* Primary CTA */}
              <div className="flex flex-col items-stretch sm:items-end shrink-0">
                <button
                  id="confirm-map-location-btn"
                  onClick={handleInitiateConfirmLocation}
                  disabled={isGeocoding || isGpsLocating || isCheckingAvailability || !!availabilityError}
                  className="px-7 py-3 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-sm sm:text-base font-black shadow-lg shadow-emerald-950/15 hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGeocoding || isGpsLocating || isCheckingAvailability ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>{isGpsLocating ? 'Locating...' : isCheckingAvailability ? 'Checking deliveryâ€¦' : 'Resolving...'}</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Location</span>
                      <ArrowRight className="w-4 h-4 text-amber-300" />
                    </>
                  )}
                </button>
                {availabilityError && <button type="button" onClick={() => resolvedAddress && void refreshServiceability(mapCenter.lat, mapCenter.lng, resolvedAddress, ++requestIdRef.current)} className="mt-2 text-xs font-bold text-red-700 underline underline-offset-4">Retry delivery check</button>}
                <span className="text-[11px] text-stone-400 mt-1 text-center sm:text-right">
                  Proceed to doorstep & service check
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          STEP 2: SERVICEABILITY EVALUATION & DOORSTEP DETAILS
      ---------------------------------------------------- */}
      {currentStep === 'serviceability_result' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Top Location Summary Card */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0D6E44] flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-500 uppercase tracking-wider">Selected Location</div>
                <div className="text-base font-black text-stone-900">{resolvedAddress?.formattedAddress}</div>
                <div className="text-xs text-stone-500">
                  {mapCenter.lat.toFixed(5)}Â° N, {mapCenter.lng.toFixed(5)}Â° E
                </div>
              </div>
            </div>

            <button
              onClick={() => setCurrentStep('map_selection')}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Change Map
            </button>
          </div>

          {/* SERVICEABLE FLOW */}
          {serviceabilityResult.isServiceable ? (
            <div className="space-y-6">

              {/* Delivery Availability Badge */}
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex items-start gap-3.5">
                <CheckCircle2 className="w-6 h-6 text-[#0D6E44] shrink-0 mt-0.5" />
                <div>
                  <div className="text-base font-black text-emerald-950 flex items-center gap-2">
                    <span>Thalimitra delivers here âœ“</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                      {serviceabilityResult.deliveryFee === 0 ? 'Free Delivery' : `â‚¹${serviceabilityResult.deliveryFee} Express`}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1">
                    {serviceabilityResult.message}
                  </p>
                </div>
              </div>

              {/* Area-level meal services. Date/menu/capacity are checked during ordering. */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#0D6E44]" />
                  <span>Meal services in this area</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['breakfast', 'lunch', 'dinner'] as const).map(service => {
                    const available = serviceabilityResult.services?.[service] ?? false;
                    return <div key={service} className={`rounded-xl border p-3 text-center ${available ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-stone-50'}`}><div className="text-[10px] font-bold uppercase text-stone-500">{service}</div><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${available ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'}`}>{available ? 'Area available' : 'Not served here'}</span></div>;
                  })}
                </div>
                <p className="text-[11px] text-stone-500">Exact date, published menu, cutoff and remaining capacity are confirmed when you order.</p>
              </div>

              {/* Doorstep Details Form */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Doorstep Details
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      House / Flat / Office No.
                    </label>
                    <input
                      type="text"
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                      placeholder="e.g. Flat 402, Block B"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-sm focus:bg-white focus:ring-2 focus:ring-[#0D6E44] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Building / Apartment / Complex
                    </label>
                    <input
                      type="text"
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      placeholder="e.g. Swagat Flamingo / Infocity Tower"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-sm focus:bg-white focus:ring-2 focus:ring-[#0D6E44] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g. Near Panchdev Temple"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-sm focus:bg-white focus:ring-2 focus:ring-[#0D6E44] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Delivery Instructions
                    </label>
                    <select
                      value={instructionPreset}
                      onChange={(e) => setInstructionPreset(e.target.value as DeliveryInstructionPreset)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-sm focus:bg-white focus:ring-2 focus:ring-[#0D6E44] outline-none"
                    >
                      <option value="call_on_reach">Call on arrival</option>
                      <option value="leave_at_security">Leave at security desk</option>
                      <option value="ring_bell">Ring doorbell</option>
                      <option value="deliver_at_reception">Deliver to reception</option>
                      <option value="custom">Custom note...</option>
                    </select>
                  </div>
                </div>

                {instructionPreset === 'custom' && (
                  <div>
                    <input
                      type="text"
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="e.g. Please leave on the side table"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-sm focus:bg-white focus:ring-2 focus:ring-[#0D6E44] outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-sm focus:bg-white focus:ring-2 focus:ring-[#0D6E44] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Phone Number (For Delivery Partner)
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-sm focus:bg-white focus:ring-2 focus:ring-[#0D6E44] outline-none"
                    />
                  </div>
                </div>

                {/* Save Location Tag */}
                <div className="pt-2">
                  <span className="block text-xs font-bold text-stone-700 mb-2">
                    Save this location as:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(['Home', 'Office', 'College', 'PG', 'Other'] as AddressLabel[]).map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setSelectedLabel(lbl)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedLabel === lbl
                            ? 'bg-[#0D6E44] text-white shadow-xs'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                        }`}
                      >
                        {lbl === 'Home' && <Home className="w-3.5 h-3.5" />}
                        {lbl === 'Office' && <Building2 className="w-3.5 h-3.5" />}
                        {lbl === 'College' && <GraduationCap className="w-3.5 h-3.5" />}
                        {lbl === 'PG' && <Building2 className="w-3.5 h-3.5" />}
                        <span>{lbl}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep('map_selection')}
                  className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-bold transition-colors cursor-pointer"
                >
                  Back to Map
                </button>
                <button
                  type="button"
                  onClick={handleFinalConfirmAndSave}
                  className="px-7 py-3 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-sm font-black shadow-lg shadow-emerald-950/15 hover:shadow-xl transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>Save & Confirm Location</span>
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </button>
              </div>
            </div>
          ) : (
            /* UNSERVICEABLE FLOW (DO NOT ALTER LOCATION) */
            <div className="space-y-6">
              <div className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-2.5 text-amber-700 shadow-sm"><MapPin className="h-5 w-5" /></div>
                  <div>
                    <h3 className="text-base font-black text-stone-900">
                      {serviceabilityResult.status === 'coming_soon' ? 'Your neighbourhood is next on our route.' : 'Not here yet — but your area could be next.'}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">
                      We open delivery only after a route is verified for reliable, on-time meals. Join the priority list and we will alert you as soon as your doorstep opens.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-emerald-950">Delivering now</p><p className="mt-0.5 text-xs text-emerald-800">Choose a verified area to view it on the map.</p></div><Truck className="h-5 w-5 text-emerald-700" /></div>
                {availableAreas.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{availableAreas.map(area => <button key={area.id} type="button" onClick={() => showAvailableArea(area)} className="flex min-h-10 items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 text-xs font-black text-emerald-900 shadow-sm transition hover:border-emerald-500"><MapPin className="h-3.5 w-3.5" />{area.name}<ChevronRight className="h-3.5 w-3.5" /></button>)}</div>
                  : <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-900">Verified areas will appear here as soon as Operations publishes them.</p>}
              </div>

              {/* Waitlist Form */}
              {serviceabilityResult.waitlistEnabled === false ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">Please choose another address. Waitlist registration is currently paused for this area.</div>
              ) : !waitlistSubmitted ? (
                <form onSubmit={handleJoinWaitlist} className="bg-white p-5 rounded-2xl border border-stone-200 space-y-4">
                  <div className="flex items-center gap-2 text-stone-900 font-black text-sm">
                    <Bell className="w-4 h-4 text-amber-600" />
                    <span>Put my area on the priority list</span>
                  </div>
                  <p className="text-xs leading-relaxed text-stone-500">We will save this searched location with your contact so the team can plan the next delivery route.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Your Name</label>
                      <input
                        type="text"
                        required
                        value={waitlistName}
                        onChange={(e) => setWaitlistName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-sm focus:bg-white focus:ring-2 focus:ring-[#0D6E44] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Phone Number or Email</label>
                      <input
                        type="text"
                        required
                        value={waitlistContact}
                        onChange={(e) => setWaitlistContact(e.target.value)}
                        placeholder="Mobile or email"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-300 text-sm focus:bg-white focus:ring-2 focus:ring-[#0D6E44] outline-none"
                      />
                    </div>
                  </div>

                  {waitlistError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800">{waitlistError}</p>}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep('map_selection')}
                      className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                    >
                      Pick Another Location
                    </button>
                    <button
                      type="submit"
                      disabled={waitlistSubmitting}
                      className="flex min-h-10 items-center gap-2 rounded-xl bg-stone-950 px-5 py-2.5 text-xs font-black text-white shadow-md disabled:opacity-50"
                    >
                      {waitlistSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}{waitlistSubmitting ? 'Saving…' : 'Notify me first'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <div className="text-sm font-black text-emerald-950">Your area is on our radar.</div>
                  <p className="text-xs text-emerald-800">
                    We saved your request and will contact you when verified delivery opens in {resolvedAddress?.area || 'this area'}.
                  </p>
                  <button
                    onClick={() => setCurrentStep('map_selection')}
                    className="mt-3 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold"
                  >
                    Select a Different Address
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          CONFLICT WARNING (SAVED HOME VS CURRENT GPS)
      ---------------------------------------------------- */}
      {currentStep === 'conflict_warning' && conflictingSavedAddress && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <Info className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-stone-900">
            Different from your saved {conflictingSavedAddress.label} address?
          </h3>
          <p className="text-xs text-stone-600 max-w-md leading-relaxed">
            Your current GPS location appears to be in <strong>{resolvedAddress?.area || 'a new area'}</strong>, but your saved {conflictingSavedAddress.label} address is in <strong>{conflictingSavedAddress.sector || conflictingSavedAddress.area}</strong>.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={() => {
                selectDeliveryAddress(conflictingSavedAddress);
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
            >
              Keep Saved {conflictingSavedAddress.label}
            </button>
            <button
              onClick={() => setCurrentStep('map_selection')}
              className="px-6 py-2.5 rounded-xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-bold shadow-md cursor-pointer"
            >
              Deliver to Current GPS Location
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          DEV GPS DIAGNOSTICS (DEV ONLY)
      ---------------------------------------------------- */}
      {process.env.NODE_ENV !== 'production' && (
        <details className="bg-stone-900 text-stone-300 text-[10px] px-4 py-2 border-t border-stone-800 shrink-0">
          <summary className="cursor-pointer font-mono font-bold text-amber-400">
            GPS & Google Maps Diagnostics (Dev Only)
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 font-mono">
            <div><strong>GPS Lat:</strong> {mapCenter.lat.toFixed(6)}</div>
            <div><strong>GPS Lng:</strong> {mapCenter.lng.toFixed(6)}</div>
            <div><strong>Accuracy:</strong> {gpsAccuracy ? `${gpsAccuracy.toFixed(1)}m` : 'N/A'}</div>
            <div><strong>Place ID:</strong> {resolvedAddress?.placeId || 'N/A'}</div>
            <div><strong>Source:</strong> {locationSource}</div>
            <div><strong>Serviceable:</strong> {String(serviceabilityResult.isServiceable)}</div>
            <div className="col-span-2 sm:col-span-3 truncate">
              <strong>Address:</strong> {resolvedAddress?.formattedAddress || 'Resolving...'}
            </div>
          </div>
        </details>
      )}

    </div>
  );
};
