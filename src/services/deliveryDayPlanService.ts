import { getSupabaseClient } from './supabaseClient';
import type { DeliveryDayPlanCode, ServiceMealType } from '../types';

export type DeliveryDayPlanStatus = 'requested' | 'quoted' | 'accepted' | 'payment_pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'rejected';
export type DeliveryDayPlanPaymentStatus = 'pending' | 'paid' | 'refunded' | 'partially_refunded';

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
  accepted_quote: null | {
    id: string;
    version: number;
    status: string;
    currency: 'INR';
    total_amount: number;
    accepted_at: string | null;
  };
  created_at: string;
  updated_at: string;
}

export class DeliveryDayPlanError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(code === '42501' ? 'Sign in with a customer account.'
      : code === '23505' ? 'You already have an open delivery-day plan request.'
      : code === '22023' ? message || 'Check your plan choices and try again.'
      : message || 'Delivery-day plans could not be reached. Try again.');
    this.code = code;
  }
}

const planCodes: DeliveryDayPlanCode[] = ['starter_7_days', 'regular_15_days', 'monthly_30_days'];
const mealTypes: ServiceMealType[] = ['breakfast', 'lunch', 'dinner'];
const statuses: DeliveryDayPlanStatus[] = ['requested', 'quoted', 'accepted', 'payment_pending', 'active', 'paused', 'completed', 'cancelled', 'rejected'];
const paymentStatuses: DeliveryDayPlanPaymentStatus[] = ['pending', 'paid', 'refunded', 'partially_refunded'];

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

const parsePlan = (value: any): DeliveryDayPlan => {
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
  return {
    ...value,
    delivery_days: Number(value.delivery_days),
    meals_per_delivery_day: Number(value.meals_per_delivery_day),
    total_meal_occurrences: Number(value.total_meal_occurrences),
    accepted_quote: value.accepted_quote ? {
      ...value.accepted_quote,
      version: Number(value.accepted_quote.version),
      total_amount: Number(value.accepted_quote.total_amount),
    } : null,
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
    return rows.map(parsePlan);
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
    return parsePlan(await rpc('request_delivery_day_plan', {
      p_template_code: input.templateCode,
      p_meal_types: input.mealTypes,
      p_weekdays: input.weekdays,
      p_address_id: input.addressId,
      p_preferred_start_date: input.preferredStartDate,
      p_request_idempotency_key: input.requestIdempotencyKey,
      p_customer_note: input.note?.trim() || null,
    }));
  },
};
