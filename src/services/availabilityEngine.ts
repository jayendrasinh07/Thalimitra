import { 
  DeliverySlot,
  AvailabilityCheckResult,
  CustomerAddress,
  MealAddOn,
  ServiceMealType,
} from '../types';
import { GANDHINAGAR_AREAS } from '../data/config';
import { IMAGES } from '../data/images';

export interface ThalimitraConfig {
  breakfast: {
    startTime: string;
    endTime: string;
    cutoffTimeHours: number;
    cutoffTimeMinutes: number;
    cutoffLabel: string;
  };
  lunch: {
    startTime: string; // e.g. "12:00 PM"
    endTime: string;   // e.g. "1:30 PM"
    cutoffTimeHours: number; // 10
    cutoffTimeMinutes: number; // 30
    cutoffLabel: string; // "10:30 AM"
  };
  dinner: {
    startTime: string;
    endTime: string;
    cutoffTimeHours: number; // 16
    cutoffTimeMinutes: number; // 30
    cutoffLabel: string; // "04:30 PM"
  };
  maxAdvanceBookingDays: number;
  closedDates: string[]; // YYYY-MM-DD
  baseOneTimeMealPrice: number;
  freeDeliveryThreshold: number;
  standardDeliveryFee: number;
  defaultSlots: {
    breakfast: Omit<DeliverySlot, 'mealSlot'>[];
    lunch: Omit<DeliverySlot, 'mealSlot'>[];
    dinner: Omit<DeliverySlot, 'mealSlot'>[];
  };
}

export const THALIMITRA_OPERATIONAL_CONFIG: ThalimitraConfig = {
  breakfast: {
    startTime: '7:30 AM',
    endTime: '9:00 AM',
    cutoffTimeHours: 22,
    cutoffTimeMinutes: 0,
    cutoffLabel: 'Previous night, 10:00 PM'
  },
  lunch: {
    startTime: '12:00 PM',
    endTime: '1:30 PM',
    cutoffTimeHours: 10,
    cutoffTimeMinutes: 30,
    cutoffLabel: '10:30 AM'
  },
  dinner: {
    startTime: '7:30 PM',
    endTime: '9:00 PM',
    cutoffTimeHours: 17,
    cutoffTimeMinutes: 30,
    cutoffLabel: '5:30 PM'
  },
  maxAdvanceBookingDays: 6,
  closedDates: [],
  baseOneTimeMealPrice: 119,
  freeDeliveryThreshold: 0, // Free cluster delivery in Gandhinagar
  standardDeliveryFee: 0,
  defaultSlots: {breakfast: [], lunch: [], dinner: []}
};

export const AVAILABLE_ADDONS: MealAddOn[] = [
  {
    id: 'addon-chaas',
    name: 'Chilled Masala Chaas (250ml)',
    price: 20,
    category: 'drink',
    description: 'Fresh earthen-churned buttermilk with roasted cumin & fresh mint',
    isPopular: true
  },
  {
    id: 'addon-roti',
    name: '2 Extra Soft Phulka Rotis',
    price: 25,
    category: 'extra_food',
    description: '100% MP Sharbati whole wheat with pure desi ghee brush',
    isPopular: true
  },
  {
    id: 'addon-sweet',
    name: 'Gujarati Sweet Treat (Mohanthal / Shrikhand)',
    price: 35,
    category: 'sweet',
    description: 'Freshly made traditional dessert of the day',
    isPopular: false
  },
  {
    id: 'addon-sabji',
    name: 'Extra Seasonal Sabji Bowl (200g)',
    price: 45,
    category: 'extra_food',
    description: 'Extra portion of hot homestyle dry/gravy vegetable preparation',
    isPopular: false
  },
  {
    id: 'addon-khichdi-kadhi',
    name: 'Extra Gujarati Kadhi Bowl (200ml)',
    price: 30,
    category: 'extra_food',
    description: 'Sweet-sour authentic kadhi with curry leaves and mustard tadka',
    isPopular: false
  }
];

export const SAVED_CUSTOMER_ADDRESSES: CustomerAddress[] = [];

/**
 * Checks if a given pincode or area name in Gandhinagar is serviceable
 */
export function checkServiceability(pincodeOrArea: string): {
  isServiceable: boolean;
  areaName: string;
  clusterId: string;
  clusterName: string;
  pincode: string;
  message: string;
} {
  const query = pincodeOrArea.trim().toLowerCase();
  if (!query) {
    return {
      isServiceable: false,
      areaName: '',
      clusterId: '',
      clusterName: '',
      pincode: '',
      message: 'Please provide a pincode or area name in Gandhinagar.'
    };
  }

  const match = GANDHINAGAR_AREAS.find(
    (a) =>
      a.pincode === query ||
      a.area.toLowerCase().includes(query) ||
      a.sector.toLowerCase().includes(query)
  );

  if (match) {
    const clusterId = match.cluster.toLowerCase().includes('cluster a')
      ? 'cluster-a'
      : match.cluster.toLowerCase().includes('cluster b')
      ? 'cluster-b'
      : match.cluster.toLowerCase().includes('cluster c')
      ? 'cluster-c'
      : 'cluster-d';

    return {
      isServiceable: true,
      areaName: match.area,
      clusterId,
      clusterName: match.cluster,
      pincode: match.pincode,
      message: `Thalimitra delivers directly to ${match.area} (${match.cluster}) with free cluster doorstep delivery.`
    };
  }

  return {
    isServiceable: false,
    areaName: pincodeOrArea,
    clusterId: '',
    clusterName: '',
    pincode: '',
    message: `We're currently expanding! ${pincodeOrArea} is not yet in our active cluster zone. Leave your number to be notified when delivery launches.`
  };
}

/**
 * Checks availability for a specific Date & Meal Slot with intelligent "Next Available" computation
 */

export function istDate(now:Date=new Date()):string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addCalendarDays(date:string,days:number):string { const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10); }
const SERVICE_ORDER: ServiceMealType[] = ['breakfast', 'lunch', 'dinner'];
const cutoffFor = (mealSlot: ServiceMealType) => mealSlot === 'breakfast' ? '22:00:00' : mealSlot === 'lunch' ? '10:30:00' : '17:30:00';
const cutoffPassed = (date: string, mealSlot: ServiceMealType, today: string, clock: string) => {
  const cutoffDate = mealSlot === 'breakfast' ? addCalendarDays(date, -1) : date;
  return today > cutoffDate || (today === cutoffDate && clock >= cutoffFor(mealSlot));
};
const serviceLabel = (mealSlot: ServiceMealType) => mealSlot[0].toUpperCase() + mealSlot.slice(1);

export function checkMealAvailability(params:{date:string;mealSlot:ServiceMealType;currentTime?:Date}):AvailabilityCheckResult {
 const {date,mealSlot}=params;const now=params.currentTime??new Date();const today=istDate(now);const tomorrow=addCalendarDays(today,1);
 const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now);
 const dateLabel=date===today?'Today':date===tomorrow?'Tomorrow':date;
 const inBounds=/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=today&&date<=addCalendarDays(today,6);
 const closed=THALIMITRA_OPERATIONAL_CONFIG.closedDates.includes(date);
 const pastCutoff=inBounds&&cutoffPassed(date,mealSlot,today,clock);
 const available=inBounds&&!closed&&!pastCutoff;
 const next = !available ? Array.from({length:7},(_,day)=>addCalendarDays(today,day))
   .flatMap(candidateDate=>SERVICE_ORDER.map(candidateSlot=>({date:candidateDate,mealSlot:candidateSlot})))
   .find(candidate=>candidate.date<=addCalendarDays(today,6)
     && !THALIMITRA_OPERATIONAL_CONFIG.closedDates.includes(candidate.date)
     && !cutoffPassed(candidate.date,candidate.mealSlot,today,clock)) : undefined;
 return {date,mealSlot,dateLabel,isAvailable:available,availableSlots:[],reason:!inBounds?'DATE_OUT_OF_BOUNDS':closed?'KITCHEN_CLOSED':pastCutoff?'CUTOFF_PASSED':undefined,
 message:available?'Select a published menu and an available delivery window.':!inBounds?'Choose a date within the next seven days.':closed?'The kitchen is closed for this date.':mealSlot==='breakfast'?'Breakfast ordering closed at 10:00 PM on the previous night.':`Ordering closed at ${mealSlot==='lunch'?'10:30 AM':'5:30 PM'} IST.`,
 nextAvailable:next?{date:next.date,dateLabel:next.date===today?'Today':next.date===tomorrow?'Tomorrow':next.date,mealSlot:next.mealSlot,timeWindow:'Select a published menu',actionLabel:`Check ${serviceLabel(next.mealSlot)}`} : undefined};
}
export function getOrderableDates(){const today=istDate();return Array.from({length:7},(_,i)=>{const dateStr=addCalendarDays(today,i);return{dateStr,label:i===0?'Today':i===1?'Tomorrow':dateStr,subLabel:dateStr,isToday:i===0};});}
