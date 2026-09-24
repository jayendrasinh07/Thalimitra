import { getSupabaseClient } from './supabaseClient';
import type { PlanDuration, ServiceMealType } from '../types';

export type SubscriptionPlanCode = Extract<PlanDuration, 'weekly_7' | 'half_month_15' | 'monthly_30'>;
export type SubscriptionStatus = 'requested' | 'payment_pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'rejected';
export type SubscriptionPaymentStatus = 'pending' | 'paid' | 'refunded';

export interface MealSubscription {
  id: string;
  plan_code: SubscriptionPlanCode;
  plan_name: string;
  total_meals: number;
  remaining_meals: number;
  meal_type: ServiceMealType;
  meal_types: ServiceMealType[];
  preferred_start_date: string;
  status: SubscriptionStatus;
  payment_status: SubscriptionPaymentStatus;
  quoted_total: number | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManagedMealSubscription extends MealSubscription {
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  address: string;
  admin_note: string | null;
  payment_reference: string | null;
}

export interface SubscriptionManagementDocument {
  subscriptions: ManagedMealSubscription[];
}

export class SubscriptionError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(code === '42501' ? 'Sign in with the required account access.'
      : code === '23505' ? 'You already have an open meal plan request.'
      : code === 'P0002' ? 'This meal plan request was not found.'
      : code === '22023' ? message || 'Check the meal plan details and try again.'
      : message || 'Meal plans could not be reached. Try again.');
    this.code = code;
  }
}

const statuses: SubscriptionStatus[] = ['requested', 'payment_pending', 'active', 'paused', 'completed', 'cancelled', 'rejected'];
const payments: SubscriptionPaymentStatus[] = ['pending', 'paid', 'refunded'];
const plans: SubscriptionPlanCode[] = ['weekly_7', 'half_month_15', 'monthly_30'];
const mealTypes: ServiceMealType[] = ['breakfast', 'lunch', 'dinner'];

const parseSubscription = (value: any, managed = false): MealSubscription | ManagedMealSubscription => {
  if (!value || typeof value.id !== 'string' || !plans.includes(value.plan_code)
    || typeof value.plan_name !== 'string' || !Number.isInteger(Number(value.total_meals))
    || !Number.isInteger(Number(value.remaining_meals)) || !mealTypes.includes(value.meal_type)
    || !Array.isArray(value.meal_types) || value.meal_types.length === 0
    || value.meal_types.some((mealType: unknown) => !mealTypes.includes(mealType as ServiceMealType))
    || !statuses.includes(value.status) || !payments.includes(value.payment_status)
    || typeof value.preferred_start_date !== 'string' || typeof value.created_at !== 'string'
    || typeof value.updated_at !== 'string' || (value.quoted_total != null && !Number.isFinite(Number(value.quoted_total)))
    || (managed && (typeof value.customer_name !== 'string' || typeof value.address !== 'string'))) {
    throw new SubscriptionError('INVALID_RESPONSE');
  }
  return {
    ...value,
    total_meals: Number(value.total_meals),
    remaining_meals: Number(value.remaining_meals),
    quoted_total: value.quoted_total == null ? null : Number(value.quoted_total),
  } as MealSubscription | ManagedMealSubscription;
};

const rpc = async (name: string, args?: Record<string, unknown>): Promise<any> => {
  const { data, error } = await getSupabaseClient().rpc(name as never, args as never);
  if (error) throw new SubscriptionError(error.code, error.message);
  return data;
};

export const subscriptionService = {
  async getMine(): Promise<MealSubscription[]> {
    const data = await rpc('get_my_meal_subscriptions');
    if (!Array.isArray(data)) throw new SubscriptionError('INVALID_RESPONSE');
    return data.map(value => parseSubscription(value) as MealSubscription);
  },
  async request(input: { planCode: SubscriptionPlanCode; mealTypes: ServiceMealType[]; addressId: string; preferredStartDate: string; note?: string; }) {
    const data = await rpc('request_meal_subscription', {
      p_plan_code: input.planCode,
      p_meal_types: input.mealTypes,
      p_address_id: input.addressId,
      p_preferred_start_date: input.preferredStartDate,
      p_customer_note: input.note?.trim() || null,
    });
    return parseSubscription(data) as MealSubscription;
  },
  async cancel(id: string) {
    return parseSubscription(await rpc('cancel_my_meal_subscription', { p_id: id })) as MealSubscription;
  },
  async getManagement(): Promise<SubscriptionManagementDocument> {
    const data = await rpc('get_subscription_management');
    if (!data || !Array.isArray(data.subscriptions)) throw new SubscriptionError('INVALID_RESPONSE');
    return { subscriptions: data.subscriptions.map((value: unknown) => parseSubscription(value, true) as ManagedMealSubscription) };
  },
  async manage(id: string, action: 'quote' | 'activate' | 'pause' | 'resume' | 'reject' | 'cancel' | 'complete', quote?: number | null, note?: string, paymentReference?: string) {
    const data = await rpc('manage_meal_subscription', {
      p_id: id,
      p_action: action,
      p_quoted_total: quote ?? null,
      p_admin_note: note?.trim() || null,
      p_payment_reference: paymentReference?.trim() || null,
    });
    if (!data || !Array.isArray(data.subscriptions)) throw new SubscriptionError('INVALID_RESPONSE');
    return { subscriptions: data.subscriptions.map((value: unknown) => parseSubscription(value, true) as ManagedMealSubscription) };
  },
};
