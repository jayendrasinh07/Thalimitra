import { getSupabaseClient } from './supabaseClient';
import type { DeliveryDayPlanCode, ServiceMealType } from '../types';

export type DeliveryDayPlanStatus = 'requested' | 'quoted' | 'accepted' | 'payment_pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'rejected';
export type DeliveryDayPlanPaymentStatus = 'pending' | 'paid' | 'refunded' | 'partially_refunded';
export type DeliveryDayPlanQuoteStatus = 'draft' | 'offered' | 'accepted' | 'declined' | 'expired' | 'superseded';
export type DeliveryDayPlanQuoteItemType = 'service' | 'delivery' | 'discount' | 'tax' | 'adjustment';
export type DeliveryDayPlanOccurrenceStatus = 'planned' | 'order_created' | 'fulfilled' | 'customer_skipped' | 'kitchen_cancelled' | 'cancelled';

export interface DeliveryDayPlanOccurrence {
  id: string;
  meal_type: ServiceMealType;
  service_date: string;
  status: DeliveryDayPlanOccurrenceStatus;
  can_move: boolean;
}

export interface DeliveryDayPlanServiceProgress {
  entitled: number;
  remaining: number;
  fulfilled: number;
  upcoming: number;
}

export interface DeliveryDayPlanDecision {
  decision_type: 'cancelled_no_payment' | 'refund_due' | 'no_refund' | 'refund_completed';
  amount: number;
  customer_message: string;
  created_at: string;
}

export interface DeliveryDayPlanQuoteItem {
  id: string;
  item_type: DeliveryDayPlanQuoteItemType;
  meal_type: ServiceMealType | null;
  label: string;
  quantity: number;
  unit_amount: number;
  line_amount: number;
}

export interface DeliveryDayPlanQuote {
  id: string;
  version: number;
  status: DeliveryDayPlanQuoteStatus;
  currency: 'INR';
  subtotal_amount: number;
  discount_amount: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  valid_until: string | null;
  offered_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  items: DeliveryDayPlanQuoteItem[];
}

export interface DeliveryDayPlanTemplate {
  code: DeliveryDayPlanCode;
  name: string;
  description: string;
  delivery_days: 7 | 15 | 30;
}

export interface DeliveryDayPlanPreview {
  template_code: DeliveryDayPlanCode;
  plan_name: string;
  delivery_days: 7 | 15 | 30;
  meal_types: ServiceMealType[];
  weekdays: number[];
  meals_per_delivery_day: number;
  total_meal_occurrences: number;
  first_delivery_date: string;
  expected_completion_date: string;
  currency: 'INR';
  estimated_subtotal_min: number;
  estimated_subtotal_max: number;
  estimated_delivery_fee: number;
  estimated_total_min: number;
  estimated_total_max: number;
  estimate_basis: 'current_active_menu_range';
  final_quote_required: true;
}

export interface DeliveryDayPlan {
  id: string;
  template_code: DeliveryDayPlanCode;
  plan_name: string;
  delivery_days: 7 | 15 | 30;
  status: DeliveryDayPlanStatus;
  payment_status: DeliveryDayPlanPaymentStatus;
  preferred_start_date: string;
  expected_completion_date: string | null;
  customer_note: string | null;
  meal_types: ServiceMealType[];
  weekdays_by_service: Partial<Record<ServiceMealType, number[]>>;
  meals_per_delivery_day: number;
  total_meal_occurrences: number;
  resume_on_date: string | null;
  service_progress: Partial<Record<ServiceMealType, DeliveryDayPlanServiceProgress>>;
  occurrences: DeliveryDayPlanOccurrence[];
  latest_decision: DeliveryDayPlanDecision | null;
  commercial_policy: { cancellation_summary: string } | null;
  current_quote: DeliveryDayPlanQuote | null;
  accepted_quote: DeliveryDayPlanQuote | null;
  created_at: string;
  updated_at: string;
}

export class DeliveryDayPlanError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(code === '42501' ? 'Sign in with a customer account.'
      : code === '23505' ? 'You already have an open delivery-day plan request.'
      : code === 'P0002' ? 'This delivery-day plan request was not found.'
      : code === '22023' ? message || 'Check your plan choices and try again.'
      : message || 'Delivery-day plans could not be reached. Try again.');
    this.code = code;
  }
}

const planCodes: DeliveryDayPlanCode[] = ['starter_7_days', 'regular_15_days', 'monthly_30_days'];
const mealTypes: ServiceMealType[] = ['breakfast', 'lunch', 'dinner'];
const statuses: DeliveryDayPlanStatus[] = ['requested', 'quoted', 'accepted', 'payment_pending', 'active', 'paused', 'completed', 'cancelled', 'rejected'];
const paymentStatuses: DeliveryDayPlanPaymentStatus[] = ['pending', 'paid', 'refunded', 'partially_refunded'];
const quoteStatuses: DeliveryDayPlanQuoteStatus[] = ['draft', 'offered', 'accepted', 'declined', 'expired', 'superseded'];
const quoteItemTypes: DeliveryDayPlanQuoteItemType[] = ['service', 'delivery', 'discount', 'tax', 'adjustment'];

const rpc = async (name: string, args?: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await getSupabaseClient().rpc(name as never, args as never);
  if (error) throw new DeliveryDayPlanError(error.code, error.message);
  return data;
};

const parseTemplate = (value: any): DeliveryDayPlanTemplate => {
  if (!value || !planCodes.includes(value.code) || typeof value.name !== 'string'
    || typeof value.description !== 'string' || ![7, 15, 30].includes(Number(value.delivery_days))) {
    throw new DeliveryDayPlanError('INVALID_RESPONSE');
  }
  return { ...value, delivery_days: Number(value.delivery_days) } as DeliveryDayPlanTemplate;
};

const parseQuote = (value: any): DeliveryDayPlanQuote | null => {
  if (value == null) return null;
  if (typeof value.id !== 'string' || !Number.isInteger(Number(value.version))
    || !quoteStatuses.includes(value.status) || value.currency !== 'INR'
    || !Array.isArray(value.items)) throw new DeliveryDayPlanError('INVALID_RESPONSE');
  const amountFields = ['subtotal_amount', 'discount_amount', 'delivery_fee', 'tax_amount', 'total_amount'] as const;
  if (amountFields.some(field => !Number.isFinite(Number(value[field])) || Number(value[field]) < 0)) {
    throw new DeliveryDayPlanError('INVALID_RESPONSE');
  }
  const items = value.items.map((item: any): DeliveryDayPlanQuoteItem => {
    if (!item || typeof item.id !== 'string' || !quoteItemTypes.includes(item.item_type)
      || (item.meal_type != null && !mealTypes.includes(item.meal_type))
      || typeof item.label !== 'string' || !Number.isInteger(Number(item.quantity))
      || !Number.isFinite(Number(item.unit_amount)) || !Number.isFinite(Number(item.line_amount))) {
      throw new DeliveryDayPlanError('INVALID_RESPONSE');
    }
    return { ...item, quantity: Number(item.quantity), unit_amount: Number(item.unit_amount), line_amount: Number(item.line_amount) };
  });
  return {
    ...value,
    version: Number(value.version),
    subtotal_amount: Number(value.subtotal_amount),
    discount_amount: Number(value.discount_amount),
    delivery_fee: Number(value.delivery_fee),
    tax_amount: Number(value.tax_amount),
    total_amount: Number(value.total_amount),
    items,
  } as DeliveryDayPlanQuote;
};

export const parseDeliveryDayPlan = (value: any): DeliveryDayPlan => {
  if (!value || typeof value.id !== 'string' || !planCodes.includes(value.template_code)
    || typeof value.plan_name !== 'string' || ![7, 15, 30].includes(Number(value.delivery_days))
    || !statuses.includes(value.status) || !paymentStatuses.includes(value.payment_status)
    || !Array.isArray(value.meal_types) || value.meal_types.length < 1
    || value.meal_types.some((type: unknown) => !mealTypes.includes(type as ServiceMealType))
    || typeof value.weekdays_by_service !== 'object' || value.weekdays_by_service === null
    || !Number.isInteger(Number(value.meals_per_delivery_day))
    || !Number.isInteger(Number(value.total_meal_occurrences))
    || typeof value.preferred_start_date !== 'string' || typeof value.created_at !== 'string'
    || typeof value.updated_at !== 'string') throw new DeliveryDayPlanError('INVALID_RESPONSE');
  const progress = value.service_progress ?? {};
  const occurrences = value.occurrences ?? [];
  if (typeof progress !== 'object' || progress === null || !Array.isArray(occurrences)) {
    throw new DeliveryDayPlanError('INVALID_RESPONSE');
  }
  for (const [type, entry] of Object.entries(progress) as [ServiceMealType, any][]) {
    if (!mealTypes.includes(type) || !entry || ['entitled', 'remaining', 'fulfilled', 'upcoming']
      .some(field => !Number.isInteger(Number(entry[field])) || Number(entry[field]) < 0)) {
      throw new DeliveryDayPlanError('INVALID_RESPONSE');
    }
  }
  const parsedOccurrences = occurrences.map((entry: any): DeliveryDayPlanOccurrence => {
    if (!entry || typeof entry.id !== 'string' || !mealTypes.includes(entry.meal_type)
      || typeof entry.service_date !== 'string'
      || !['planned', 'order_created', 'fulfilled', 'customer_skipped', 'kitchen_cancelled', 'cancelled'].includes(entry.status)
      || typeof entry.can_move !== 'boolean') throw new DeliveryDayPlanError('INVALID_RESPONSE');
    return entry;
  });
  return {
    ...value,
    delivery_days: Number(value.delivery_days),
    meals_per_delivery_day: Number(value.meals_per_delivery_day),
    total_meal_occurrences: Number(value.total_meal_occurrences),
    resume_on_date: value.resume_on_date ?? null,
    service_progress: Object.fromEntries(Object.entries(progress).map(([type, entry]: [string, any]) => [type, {
      entitled: Number(entry.entitled), remaining: Number(entry.remaining),
      fulfilled: Number(entry.fulfilled), upcoming: Number(entry.upcoming),
    }])),
    occurrences: parsedOccurrences,
    latest_decision: value.latest_decision ? { ...value.latest_decision, amount: Number(value.latest_decision.amount) } : null,
    commercial_policy: value.commercial_policy ?? null,
    current_quote: parseQuote(value.current_quote),
    accepted_quote: parseQuote(value.accepted_quote),
  } as DeliveryDayPlan;
};

const parsePreview = (value: any): DeliveryDayPlanPreview => {
  if (!value || !planCodes.includes(value.template_code) || typeof value.plan_name !== 'string'
    || ![7, 15, 30].includes(Number(value.delivery_days)) || !Array.isArray(value.meal_types)
    || value.meal_types.some((type: unknown) => !mealTypes.includes(type as ServiceMealType))
    || !Array.isArray(value.weekdays) || value.weekdays.some((day: unknown) => !Number.isInteger(Number(day)) || Number(day) < 1 || Number(day) > 7)
    || !Number.isInteger(Number(value.meals_per_delivery_day)) || !Number.isInteger(Number(value.total_meal_occurrences))
    || typeof value.first_delivery_date !== 'string' || typeof value.expected_completion_date !== 'string'
    || value.currency !== 'INR' || value.estimate_basis !== 'current_active_menu_range'
    || value.final_quote_required !== true) throw new DeliveryDayPlanError('INVALID_RESPONSE');
  const amounts = ['estimated_subtotal_min', 'estimated_subtotal_max', 'estimated_delivery_fee', 'estimated_total_min', 'estimated_total_max'] as const;
  if (amounts.some(field => !Number.isFinite(Number(value[field])) || Number(value[field]) < 0)) {
    throw new DeliveryDayPlanError('INVALID_RESPONSE');
  }
  return {
    ...value,
    delivery_days: Number(value.delivery_days),
    weekdays: value.weekdays.map(Number),
    meals_per_delivery_day: Number(value.meals_per_delivery_day),
    total_meal_occurrences: Number(value.total_meal_occurrences),
    estimated_subtotal_min: Number(value.estimated_subtotal_min),
    estimated_subtotal_max: Number(value.estimated_subtotal_max),
    estimated_delivery_fee: Number(value.estimated_delivery_fee),
    estimated_total_min: Number(value.estimated_total_min),
    estimated_total_max: Number(value.estimated_total_max),
  } as DeliveryDayPlanPreview;
};

export const deliveryDayPlanService = {
  async getCatalog(): Promise<DeliveryDayPlanTemplate[]> {
    const data = await rpc('get_delivery_day_plan_catalog');
    const rows = Array.isArray(data) ? data : null;
    if (!rows) throw new DeliveryDayPlanError('INVALID_RESPONSE');
    return rows.map(parseTemplate);
  },
  async getMine(): Promise<DeliveryDayPlan[]> {
    const data = await rpc('get_my_delivery_day_plans');
    const rows = Array.isArray(data) ? data : null;
    if (!rows) throw new DeliveryDayPlanError('INVALID_RESPONSE');
    return rows.map(parseDeliveryDayPlan);
  },
  async preview(input: {
    templateCode: DeliveryDayPlanCode;
    mealTypes: ServiceMealType[];
    weekdays: number[];
    addressId: string;
    preferredStartDate: string;
  }): Promise<DeliveryDayPlanPreview> {
    return parsePreview(await rpc('preview_delivery_day_plan', {
      p_template_code: input.templateCode,
      p_meal_types: input.mealTypes,
      p_weekdays: input.weekdays,
      p_address_id: input.addressId,
      p_preferred_start_date: input.preferredStartDate,
    }));
  },
  async request(input: {
    templateCode: DeliveryDayPlanCode;
    mealTypes: ServiceMealType[];
    weekdays: number[];
    addressId: string;
    preferredStartDate: string;
    requestIdempotencyKey: string;
    note?: string;
  }): Promise<DeliveryDayPlan> {
    return parseDeliveryDayPlan(await rpc('request_delivery_day_plan', {
      p_template_code: input.templateCode,
      p_meal_types: input.mealTypes,
      p_weekdays: input.weekdays,
      p_address_id: input.addressId,
      p_preferred_start_date: input.preferredStartDate,
      p_request_idempotency_key: input.requestIdempotencyKey,
      p_customer_note: input.note?.trim() || null,
    }));
  },
  async respondToQuote(subscriptionId: string, quoteId: string, decision: 'accept' | 'decline'): Promise<DeliveryDayPlan> {
    return parseDeliveryDayPlan(await rpc('respond_delivery_day_plan_quote', {
      p_subscription_id: subscriptionId,
      p_quote_id: quoteId,
      p_decision: decision,
    }));
  },
  async skip(subscriptionId: string, serviceDate: string, mealType?: ServiceMealType): Promise<void> {
    await rpc('skip_delivery_day_plan', {
      p_subscription_id: subscriptionId, p_service_date: serviceDate,
      p_meal_type: mealType ?? null, p_reason: 'Moved by customer',
      p_idempotency_key: crypto.randomUUID(),
    });
  },
  async pause(subscriptionId: string, pauseFrom: string, resumeOn: string): Promise<void> {
    await rpc('pause_delivery_day_plan', {
      p_subscription_id: subscriptionId, p_pause_from: pauseFrom, p_resume_on: resumeOn,
      p_reason: 'Paused by customer', p_idempotency_key: crypto.randomUUID(),
    });
  },
  async resume(subscriptionId: string): Promise<void> {
    await rpc('resume_delivery_day_plan', {
      p_subscription_id: subscriptionId, p_idempotency_key: crypto.randomUUID(),
    });
  },
};
