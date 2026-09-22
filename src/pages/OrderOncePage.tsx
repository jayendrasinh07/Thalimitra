import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../context/AppContext';
import { 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Utensils,
  Calendar,
  MapPin,
  Clock,
  RotateCcw
} from 'lucide-react';
import { 
  StepProgressIndicator, 
  ORDER_STEPS 
} from '../components/order/StepProgressIndicator';
import { Step1DateMealSlot } from '../components/order/Step1DateMealSlot';
import { Step2DailyMenu } from '../components/order/Step2DailyMenu';
import { Step3Customization } from '../components/order/Step3Customization';
import { Step4Address } from '../components/order/Step4Address';
import { Step5DeliverySlot } from '../components/order/Step5DeliverySlot';
import { Step6OrderReview } from '../components/order/Step6OrderReview';
import { OrderSuccessView } from '../components/order/OrderSuccessView';
import { OrderTrackingView } from '../components/order/OrderTrackingView';

import { 
  menuService, 
  DatabaseMeal, 
  DatabaseMealCustomization, 
  DatabaseDeliverySlot 
} from '../services/menuService';
import { 
  checkMealAvailability, 
  getOrderableDates, 
  SAVED_CUSTOMER_ADDRESSES 
} from '../services/availabilityEngine';
import { CustomerAddress, DeliverySlot, OneTimeOrder, ServiceMealType } from '../types';
import { EMPTY_DELIVERY_ADDRESS } from '../services/locationService';
import { addressService } from '../services/addressService';
import { dietLabel } from '../services/menuService';
import { promotionService, type PromotionQuote } from '../services/promotionService';
import { IMAGES } from '../data/images';

type LandingOrderIntent = { date: string; slot: ServiceMealType; mealId: string };

const readLandingOrderIntent = (orderableDates: ReturnType<typeof getOrderableDates>): LandingOrderIntent | null => {
  if (window.location.pathname.replace(/\/+$/, '') !== '/order') return null;
  const params = new URLSearchParams(window.location.search);
  const date = params.get('date') ?? '';
  const slot = params.get('slot');
  const mealId = params.get('meal') ?? '';
  if (!orderableDates.some(item => item.dateStr === date) || !['breakfast', 'lunch', 'dinner'].includes(slot ?? '') || !mealId) return null;
  return { date, slot: slot as ServiceMealType, mealId };
};

export const OrderOncePage: React.FC = () => {
  const { 
    createOneTimeOrder, 
    activeDeliveryAddress, 
    savedAddresses, 
    currentUser,
    oneTimeOrders,
    userProfile,
    setActiveTab,
    setActiveTrackingOrder,
    activeTrackingOrder,
    setIsAuthModalOpen
  } = useApp();

  const orderableDates = useMemo(() => getOrderableDates(), []);
  const landingIntent = useRef<LandingOrderIntent | null>(readLandingOrderIntent(orderableDates));

  // 1. Step Navigation State (1 to 6)
  const [currentStep, setCurrentStep] = useState<number>(landingIntent.current ? 2 : 1);
  const [maxCompletedStep, setMaxCompletedStep] = useState<number>(landingIntent.current ? 2 : 1);

  // 2. Centralized Order Draft State
  const [selectedDate, setSelectedDate] = useState<string>(landingIntent.current?.date || orderableDates[0]?.dateStr || '');
  const [selectedMealSlot, setSelectedMealSlot] = useState<ServiceMealType>(landingIntent.current?.slot || 'lunch');

  // Supabase Data State
  const [dbMeals, setDbMeals] = useState<DatabaseMeal[]>([]);
  const [dbCustomizations, setDbCustomizations] = useState<DatabaseMealCustomization[]>([]);
  const [dbBreakfastSlots, setDbBreakfastSlots] = useState<DeliverySlot[]>([]);
  const [dbLunchSlots, setDbLunchSlots] = useState<DeliverySlot[]>([]);
  const [dbDinnerSlots, setDbDinnerSlots] = useState<DeliverySlot[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(true);

  // Step 2: Selected Meal
  const emptyMeal: DatabaseMeal = {id:'',name:'Choose a meal',description:'',mealType:selectedMealSlot,dietType:'',basePrice:0,isActive:false};
  const [selectedMeal, setSelectedMeal] = useState<DatabaseMeal>(emptyMeal);

  // Step 3: Customization & Quantity
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [spiceLevel, setSpiceLevel] = useState<'Regular' | 'Less Spicy'>('Regular');
  const [oilLevel, setOilLevel] = useState<'Standard' | 'Less Oil (Fit)'>('Standard');
  const [dietVariant, setDietVariant] = useState<string>('Standard Gujarati');

  // Step 4: Address
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress>(() => {
    return (activeDeliveryAddress as CustomerAddress) || (savedAddresses && savedAddresses[0]) || EMPTY_DELIVERY_ADDRESS;
  });
  const [addressEntryRequest, setAddressEntryRequest] = useState(0);

  // Step 5: Delivery Slot
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');

  // Step 6: Order Notes & Submission
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Success & Tracking Views
  const [confirmedOrder, setConfirmedOrder] = useState<OneTimeOrder | null>(null);
  const [isTrackingMode, setIsTrackingMode] = useState<boolean>(false);

  // Keep address updated if user selected active delivery address
  useEffect(() => {
    if (activeDeliveryAddress) {
      setSelectedAddress(activeDeliveryAddress as CustomerAddress);
    }
  }, [activeDeliveryAddress]);

  const submitLock = useRef(false);
  const [clock, setClock] = useState(() => new Date());
  const [menuError, setMenuError] = useState('');
  const [quote, setQuote] = useState<{deliveryFee:number;minOrderAmount:number}|null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const [promotionQuote, setPromotionQuote] = useState<PromotionQuote | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionError, setPromotionError] = useState('');
  useEffect(() => {const timer=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(timer);},[]);
  useEffect(() => {setConfirmedOrder(null);setIsTrackingMode(false);setSelectedAddress(EMPTY_DELIVERY_ADDRESS);},[currentUser?.id]);
  useEffect(() => {if(confirmedOrder){const latest=oneTimeOrders.find(o=>o.id===confirmedOrder.id);if(latest)setConfirmedOrder(latest);}},[oneTimeOrders]);
  useEffect(() => {
    let alive=true;
    setIsLoadingMenu(true);setMenuError('');setDbMeals([]);setSelectedMeal(emptyMeal);setSelectedAddons({});setSelectedSlotId('');
    setDbBreakfastSlots([]);setDbLunchSlots([]);setDbDinnerSlots([]);setMaxCompletedStep(1);
    Promise.all([menuService.getMenuForDate(selectedDate),menuService.getDeliverySlots('breakfast',selectedDate),menuService.getDeliverySlots('lunch',selectedDate),menuService.getDeliverySlots('dinner',selectedDate)])
      .then(([menu,breakfast,lunch,dinner])=>{if(alive){
        const availableMeals=(menu?.meals??[]).filter(m=>m.mealType===selectedMealSlot||(selectedMealSlot!=='breakfast'&&m.mealType==='both'));
        setDbMeals(availableMeals);setDbBreakfastSlots(breakfast);setDbLunchSlots(lunch);setDbDinnerSlots(dinner);
        const intent=landingIntent.current;
        if(intent){
          const requestedMeal=availableMeals.find(meal=>meal.id===intent.mealId);
          if(requestedMeal){setSelectedMeal(requestedMeal);setCurrentStep(3);setMaxCompletedStep(3);}
          else{setCurrentStep(2);setSubmissionError('That meal is no longer available. Choose another published meal.');}
          landingIntent.current=null;
        }
      }})
      .catch(error=>{if(alive)setMenuError(error.message||'Unable to load the menu. Please try again.');})
      .finally(()=>{if(alive)setIsLoadingMenu(false);});
    return()=>{alive=false;};
  },[selectedDate,selectedMealSlot]);
  useEffect(() => {
    let alive=true;setDbCustomizations([]);setSelectedAddons({});setDietVariant(dietLabel(selectedMeal.dietType));
    menuService.getMealCustomizations(selectedMeal.id).then(rows=>{if(alive)setDbCustomizations(rows);}).catch(error=>{if(alive)setSubmissionError(error.message);});
    return()=>{alive=false;};
  },[selectedMeal.id]);
  useEffect(() => {
    let alive=true;setQuote(null);setQuoteError('');
    if(currentUser&&selectedAddress.id&&savedAddresses.some(a=>a.id===selectedAddress.id)){
      addressService.quoteAddress(selectedAddress.id).then(value=>{if(alive)setQuote(value);}).catch(error=>{if(alive)setQuoteError(error.message);});
    }
    return()=>{alive=false;};
  },[currentUser?.id,selectedAddress,savedAddresses]);

  const promotionInput = useMemo(() => ({
    orderDate: selectedDate,
    mealType: selectedMealSlot,
    addressId: selectedAddress.id,
    mealId: selectedMeal.id,
    quantity,
    selectedAddons,
  }), [selectedDate, selectedMealSlot, selectedAddress.id, selectedMeal.id, quantity, selectedAddons]);

  useEffect(() => {
    let alive = true;
    setPromotionCode(''); setPromotionQuote(null); setPromotionError('');
    if (currentStep !== 6 || !currentUser || !quote || !selectedMeal.id || !selectedAddress.id) return () => { alive = false; };
    setPromotionLoading(true);
    promotionService.quote(promotionInput)
      .then(value => { if (alive) setPromotionQuote(value); })
      .catch(error => { if (alive) setPromotionError(error.message || 'Offers could not be checked.'); })
      .finally(() => { if (alive) setPromotionLoading(false); });
    return () => { alive = false; };
  }, [currentStep, currentUser?.id, quote, promotionInput]);

  const applyPromotion = async (code: string) => {
    if (!currentUser) { setIsAuthModalOpen(true); return; }
    const normalized = code.trim().toUpperCase();
    if (!normalized) { setPromotionError('Enter an offer code.'); return; }
    setPromotionLoading(true); setPromotionError('');
    try {
      const value = await promotionService.quote({ ...promotionInput, code: normalized });
      setPromotionQuote(value); setPromotionCode(value.appliedOffer?.code ?? normalized);
    } catch (error) {
      setPromotionCode(normalized); setPromotionQuote(previous => previous ? { ...previous, discount: 0, appliedOffer: null, grandTotal: previous.mealsSubtotal + previous.addonsTotal + previous.deliveryFee } : null);
      setPromotionError(error instanceof Error ? error.message : 'This offer could not be applied.');
    } finally { setPromotionLoading(false); }
  };

  const removePromotion = () => {
    setPromotionCode(''); setPromotionError('');
    setPromotionQuote(previous => previous ? { ...previous, discount: 0, appliedOffer: null, grandTotal: previous.mealsSubtotal + previous.addonsTotal + previous.deliveryFee } : null);
  };

  // Check Availability for selected Date & Meal Slot
  const availability = useMemo(() => {
    return checkMealAvailability({
      date: selectedDate,
      mealSlot: selectedMealSlot, currentTime: clock
    });
  }, [selectedDate, selectedMealSlot, clock]);

  // Current active slots based on mealSlot
  const currentAvailableSlots: DeliverySlot[] = useMemo(() => {
    const dbSlots = selectedMealSlot === 'breakfast' ? dbBreakfastSlots : selectedMealSlot === 'lunch' ? dbLunchSlots : dbDinnerSlots;
    if (dbSlots && dbSlots.length > 0) return dbSlots;
    return availability.availableSlots;
  }, [selectedMealSlot, dbBreakfastSlots, dbLunchSlots, dbDinnerSlots, availability.availableSlots]);

  // Set default slot if none selected
  useEffect(() => {
    if (currentAvailableSlots.length > 0) {
      if (!selectedSlotId || !currentAvailableSlots.some((s) => s.id === selectedSlotId)) {
        setSelectedSlotId(currentAvailableSlots[0].id);
      }
    }
  }, [currentAvailableSlots, selectedSlotId]);

  // Selected DeliverySlot object
  const activeSlotObj = useMemo(() => {
    return currentAvailableSlots.find((s) => s.id === selectedSlotId) || currentAvailableSlots[0];
  }, [currentAvailableSlots, selectedSlotId]);

  // Price calculations for Live Sticky Summary
  const livePricing = useMemo(() => {
    let mealsSubtotal = selectedMeal.basePrice * quantity;
    let addonsTotal = 0;
    const addonLineItems: { name: string; qty: number; total: number }[] = [];

    Object.entries(selectedAddons).forEach(([addonId, qty]: [string, number]) => {
      if (qty > 0) {
        const addon = dbCustomizations.find((c) => c.id === addonId);
        const price = Number(addon?.price ?? 0);
        const lineTotal = price * qty;
        addonsTotal += lineTotal;
        addonLineItems.push({
          name: addon?.name || addonId,
          qty,
          total: lineTotal
        });
      }
    });

    let deliveryFee = quote?.deliveryFee ?? 0;
    if (promotionQuote) {
      mealsSubtotal = promotionQuote.mealsSubtotal;
      addonsTotal = promotionQuote.addonsTotal;
      deliveryFee = promotionQuote.deliveryFee;
    }
    const discount = promotionQuote?.discount ?? 0;
    const total = Math.max(0, mealsSubtotal + addonsTotal + deliveryFee - discount);

    return {
      mealsSubtotal,
      addonsTotal,
      addonLineItems,
      deliveryFee,
      discount,
      total
    };
  }, [selectedMeal, quantity, selectedAddons, dbCustomizations, quote, promotionQuote]);

  // Navigation handlers
  const handleNextStep = () => {
    setSubmissionError(null);
    if(currentStep===1&&!checkMealAvailability({date:selectedDate,mealSlot:selectedMealSlot}).isAvailable){setSubmissionError('Ordering has closed. Please select another date or meal.');return;}
    if(currentStep>=2&&!selectedMeal.id){setSubmissionError('Choose a meal from the published menu.');return;}
    if(currentStep>=4&&(!quote||!savedAddresses.some(a=>a.id===selectedAddress.id))){
      if(currentStep===4&&!currentUser){setIsAuthModalOpen(true);return;}
      if(currentStep===4&&!savedAddresses.some(a=>a.id===selectedAddress.id)){
        if(savedAddresses.length===0)setAddressEntryRequest(value=>value+1);
        document.getElementById('order-address-panel')?.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      if(currentStep===4&&!quoteError)return;
      setSubmissionError(quoteError||'Choose a delivery address available for this order.');return;
    }
    if(currentStep===5&&(!activeSlotObj||activeSlotObj.maxCapacity-activeSlotObj.bookedCount<quantity)){setSubmissionError('Choose a slot with enough remaining portions.');return;}
    if (currentStep < 6) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setMaxCompletedStep((prev) => Math.max(prev, next));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setSubmissionError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const onBack = () => {
      if (confirmedOrder) setActiveTab('order_history');
      else if (currentStep > 1) handlePrevStep();
      else setActiveTab('todays_menu');
    };
    window.addEventListener('thalimitra:native-back', onBack);
    return () => window.removeEventListener('thalimitra:native-back', onBack);
  }, [confirmedOrder, currentStep, setActiveTab]);

  const handleStepClick = (stepId: number) => {
    if (stepId <= maxCompletedStep) {
      setCurrentStep(stepId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAddonQuantityChange = (addonId: string, newQty: number) => {
    setSelectedAddons((prev) => {
      const updated = { ...prev };
      if (newQty <= 0) {
        delete updated[addonId];
      } else {
        updated[addonId] = newQty;
      }
      return updated;
    });
  };

  // Next Available Slot One-Click Action
  const handleSelectNextAvailable = (nextDate: string, nextSlot: ServiceMealType) => {
    setSelectedDate(nextDate);
    setSelectedMealSlot(nextSlot);
  };

  // Order Submission
  const handleConfirmOrder = async () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    if(submitLock.current)return;
    submitLock.current=true;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      if(!checkMealAvailability({date:selectedDate,mealSlot:selectedMealSlot}).isAvailable)throw new Error('Ordering has closed. Choose another date or meal.');
      if(!selectedMeal.id||!dbMeals.some(m=>m.id===selectedMeal.id))throw new Error('Choose a meal from the published menu.');
      if(!savedAddresses.some(a=>a.id===selectedAddress.id)||!quote)throw new Error(quoteError||'Save a serviceable delivery address first.');
      if(!activeSlotObj||activeSlotObj.maxCapacity-activeSlotObj.bookedCount<quantity)throw new Error('This slot has insufficient portions remaining. Choose another slot.');
      if(livePricing.mealsSubtotal+livePricing.addonsTotal<quote.minOrderAmount)throw new Error(`This delivery zone requires a minimum food order of ₹${quote.minOrderAmount}.`);
      // Map Add-ons for order record
      const mappedAddOns = Object.entries(selectedAddons)
        .filter(([_, qty]: [string, number]) => qty > 0)
        .map(([addonId, qty]: [string, number]) => {
          const addon = dbCustomizations.find((c) => c.id === addonId);
          return {
            id: addonId,
            name: addon?.name || 'Extra Side Item',
            price: Number(addon?.price ?? 0),
            quantity: qty
          };
        });

      // Format human-readable date label
      const dateObj = new Date(selectedDate + 'T00:00:00');
      const isToday = selectedDate === orderableDates[0]?.dateStr;
      const isTomorrow = selectedDate === orderableDates[1]?.dateStr;
      const scheduledDateLabel = isToday 
        ? 'Today' 
        : isTomorrow 
        ? 'Tomorrow' 
        : dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

      const newOrder = await createOneTimeOrder({
        userId: currentUser.id,
        userName: userProfile?.fullName || currentUser.email || selectedAddress.fullName || 'Customer',
        userPhone: userProfile?.phone || selectedAddress.phone || '',
        orderType: 'ONE_TIME',
        mealId: selectedMeal.id,
        mealName: selectedMeal.name,
        mealImage: selectedMeal.imageUrl || IMAGES.hero.mainThali,
        scheduledDate: selectedDate,
        scheduledDateLabel,
        mealSlot: selectedMealSlot,
        deliverySlotId: selectedSlotId,
        deliverySlotLabel: activeSlotObj?.windowLabel || '',
        quantity,
        notes,
        customizations: {
          spiceLevel,
          oilLevel,
          dietVariant: dietVariant as any,
          rotiCount: 4,
          ricePortion: 'standard',
          extraDal: false,
          hasChaas: false
        },
        addOns: mappedAddOns,
        address: selectedAddress,
        subtotal: livePricing.mealsSubtotal,
        addOnsTotal: livePricing.addonsTotal,
        deliveryFee: livePricing.deliveryFee,
        discount: livePricing.discount,
        promotionCode: promotionQuote?.appliedOffer?.code,
        promotionName: promotionQuote?.appliedOffer?.name,
        total: livePricing.total,
        paymentMethod: 'CashOnDelivery',
        paymentStatus: 'PENDING',
        orderStatus: 'CONFIRMED',
        estimatedDeliveryTime: activeSlotObj?.windowLabel || ''
      });

      setConfirmedOrder(newOrder);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('[Thalimitra Order] Submission failed:', err);
      setSubmissionError(err?.message || 'Order verification failed. Please check your delivery slot and retry.');
    } finally {
      submitLock.current=false;
      setIsSubmitting(false);
    }
  };

  // 1. Render Order Tracking View if active
  if (isTrackingMode && confirmedOrder) {
    return (
      <div className="py-8 bg-[#FAF8F5] min-h-[85vh]">
        <OrderTrackingView
          order={confirmedOrder}
          onBackToMenu={() => {
            setIsTrackingMode(false);
            setConfirmedOrder(null);
            setCurrentStep(1);
          }}
        />
      </div>
    );
  }

  // 2. Render Order Success View if confirmed
  if (confirmedOrder) {
    return (
      <div className="py-8 bg-[#FAF8F5] min-h-[85vh] px-4 sm:px-6">
        <OrderSuccessView
          order={confirmedOrder}
          onTrackOrder={() => setIsTrackingMode(true)}
          onOrderAnother={() => {
            setConfirmedOrder(null);
            setCurrentStep(1);
            setMaxCompletedStep(1);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`${Capacitor.isNativePlatform() ? 'py-4' : 'py-6 sm:py-10'} bg-[#FAF8F5] min-h-[90vh]`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Page Top Branding Bar */}
        {!Capacitor.isNativePlatform() && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0D6E44] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Single Meal Order
              </span>
              <span className="text-xs font-semibold text-stone-500">
                No subscription required
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 mt-1 tracking-tight">
              Order a Hot Home-Style Meal
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#0D6E44]" />
            <span>Kitchen-published menu • Price verified at checkout</span>
          </div>
        </div>}

        {/* Multi-Step Visual Progress Indicator */}
        <StepProgressIndicator
          currentStep={currentStep}
          onStepClick={handleStepClick}
          maxCompletedStep={maxCompletedStep}
        />

        {(menuError || (submissionError && currentStep !== 6) || quoteError) && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{menuError || submissionError || quoteError}</p>}
        {/* Main 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Active Step Component (8 Cols on LG) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Step 1: Date & Meal Type */}
            {currentStep === 1 && (
              <Step1DateMealSlot
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                selectedMealSlot={selectedMealSlot}
                onMealSlotChange={setSelectedMealSlot}
                availability={availability}
                onSelectNextAvailable={handleSelectNextAvailable}
                breakfastSlots={dbBreakfastSlots}
                lunchSlots={dbLunchSlots}
                dinnerSlots={dbDinnerSlots}
              />
            )}

            {/* Step 2: Daily Menu Selection */}
            {currentStep === 2 && (
              <Step2DailyMenu
                meals={dbMeals}
                selectedMealId={selectedMeal.id}
                onSelectMeal={(meal) => {
                  setSelectedMeal(meal);
                  setCurrentStep(3);setMaxCompletedStep(prev=>Math.max(prev,3));
                }}
                selectedDate={selectedDate}
                mealSlot={selectedMealSlot}
                isLoading={isLoadingMenu}
              />
            )}

            {/* Step 3: Customization & Quantity */}
            {currentStep === 3 && (
              <Step3Customization
                meal={selectedMeal}
                quantity={quantity}
                onQuantityChange={setQuantity}
                selectedAddons={selectedAddons}
                onAddonQuantityChange={handleAddonQuantityChange}
                customizationCatalog={dbCustomizations}
                spiceLevel={spiceLevel}
                onSpiceLevelChange={setSpiceLevel}
                oilLevel={oilLevel}
                onOilLevelChange={setOilLevel}
                dietVariant={dietVariant}
                onDietVariantChange={setDietVariant}
              />
            )}

            {/* Step 4: Delivery Address & Serviceability */}
            {currentStep === 4 && (
              <Step4Address
                selectedAddress={selectedAddress}
                onSelectAddress={(address) => { setSubmissionError(null); setSelectedAddress(address); }}
                savedAddresses={savedAddresses}
                addressEntryRequest={addressEntryRequest}
              />
            )}

            {/* Step 5: Delivery Slot */}
            {currentStep === 5 && (
              <Step5DeliverySlot
                quantity={quantity}
                slots={currentAvailableSlots}
                selectedSlotId={selectedSlotId}
                onSelectSlot={setSelectedSlotId}
                mealSlot={selectedMealSlot}
              />
            )}

            {/* Step 6: Final Review & Confirmation */}
            {currentStep === 6 && (
              <Step6OrderReview
                meal={selectedMeal}
                quantity={quantity}
                selectedAddons={selectedAddons}
                customizationCatalog={dbCustomizations}
                spiceLevel={spiceLevel}
                oilLevel={oilLevel}
                dietVariant={dietVariant}
                selectedDate={selectedDate}
                mealSlot={selectedMealSlot}
                selectedSlot={activeSlotObj}
                selectedAddress={selectedAddress}
                notes={notes}
                onNotesChange={setNotes}
                onConfirmOrder={handleConfirmOrder}
                isSubmitting={isSubmitting}
                deliveryFee={quote?.deliveryFee ?? 0}
                promotionQuote={promotionQuote}
                promotionCode={promotionCode}
                promotionLoading={promotionLoading}
                promotionError={promotionError}
                onPromotionCodeChange={setPromotionCode}
                onApplyPromotion={applyPromotion}
                onRemovePromotion={removePromotion}
                errorMessage={submissionError || quoteError}
              />
            )}

            {/* Step Bottom Controls (Back & Next) */}
            <div className="flex items-center justify-between pt-4 border-t border-stone-200">
              {currentStep > 1 ? (
                <button
                  type="button"
                  id="order-step-back-btn"
                  onClick={handlePrevStep}
                  className="px-5 py-3 rounded-2xl bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to {ORDER_STEPS[currentStep - 2]?.shortLabel || 'Previous'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('home');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-3 rounded-2xl bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Cancel
                </button>
              )}

              {currentStep < 6 && (
                <button
                  type="button"
                  id="order-step-continue-btn"
                  disabled={(currentStep === 1 && !availability.isAvailable) || (currentStep === 4 && !!currentUser && savedAddresses.some(a=>a.id===selectedAddress.id) && !quote && !quoteError)}
                  onClick={handleNextStep}
                  className="px-7 py-3.5 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs sm:text-sm font-black shadow-md shadow-emerald-950/15 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{currentStep === 4 && !currentUser
                    ? 'Sign in & continue'
                    : currentStep === 4 && !savedAddresses.some(a=>a.id===selectedAddress.id)
                      ? savedAddresses.length === 0 ? 'Add address to continue' : 'Choose address to continue'
                      : currentStep === 4 && !quote && !quoteError
                        ? 'Checking delivery…'
                        : `Continue to ${ORDER_STEPS[currentStep]?.shortLabel || 'Next'}`}</span>
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Desktop Sticky Live Order Summary (4 Cols on LG) */}
          <div className="hidden lg:block lg:col-span-4">
            <aside aria-label="Live Order Summary" className="sticky top-24 bg-white rounded-3xl p-6 border border-stone-200 shadow-md space-y-5">
              <div className="border-b border-stone-150 pb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0D6E44] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Live Order Summary
                </span>
                <h3 className="text-base font-black text-stone-900 mt-2">
                  {quantity}x {selectedMeal.name}
                </h3>
                <span className="text-xs text-stone-500 font-medium">
                  {selectedDate === orderableDates[0]?.dateStr ? 'Today' : selectedDate} • {selectedMealSlot[0].toUpperCase() + selectedMealSlot.slice(1)}
                </span>
              </div>

              {/* Itemized Lines */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-stone-800 font-bold">
                  <span>{quantity}x Meal (₹{selectedMeal.basePrice}/meal)</span>
                  <span className="font-mono">₹{livePricing.mealsSubtotal}</span>
                </div>

                {livePricing.addonLineItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-stone-600 pl-2 border-l-2 border-emerald-300">
                    <span>{item.name} (×{item.qty})</span>
                    <span className="font-mono">+₹{item.total}</span>
                  </div>
                ))}

                <div className="flex items-center justify-between text-stone-600 pt-2 border-t border-stone-100">
                  <span className="flex items-center gap-1">
                    <span>Cluster Delivery</span>
                    <span className="text-[9px]">{quote ? (quote.deliveryFee===0?'FREE':'') : 'Select address'}</span>
                  </span>
                  <span className="font-black text-[#0D6E44]">{quote ? `₹${livePricing.deliveryFee}` : "—"}</span>
                </div>

                {livePricing.discount > 0 && <div className="flex items-center justify-between font-bold text-emerald-700"><span>{promotionQuote?.appliedOffer?.code || 'Offer'} savings</span><span className="font-mono">−₹{livePricing.discount}</span></div>}

                <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-sm font-black text-stone-900">
                  <span>Estimated Total</span>
                  <span className="text-lg font-mono text-[#0D6E44]">₹{livePricing.total}</span>
                </div>
              </div>

              {/* Selected Delivery Snapshot */}
              {selectedAddress && (
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-stone-200/80 text-[11px] text-stone-600 space-y-1">
                  <div className="flex items-center gap-1 font-black text-stone-900">
                    <MapPin className="w-3.5 h-3.5 text-[#0D6E44]" />
                    <span>Delivering to {selectedAddress.area || 'Gandhinagar'}</span>
                  </div>
                  <p className="line-clamp-1 text-stone-500">
                    {selectedAddress.addressLine || 'Gandhinagar'}
                  </p>
                </div>
              )}

              {/* Step Context CTA */}
              {currentStep < 6 ? (
                <button
                  type="button"
                  disabled={currentStep === 1 && !availability.isAvailable}
                  onClick={handleNextStep}
                  className="w-full py-3.5 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>Proceed to {ORDER_STEPS[currentStep]?.shortLabel || 'Next'}</span>
                  <ArrowRight className="w-4 h-4 text-amber-300" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmOrder}
                  className="w-full py-3.5 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-xs font-black shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>Confirm Order • ₹{livePricing.total}</span>
                </button>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};
