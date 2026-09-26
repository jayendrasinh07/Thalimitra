import { getSupabaseClient } from './supabaseClient';
import {
  DeliveryDayPlanError,
  parseDeliveryDayPlan,
  type DeliveryDayPlan,
} from './deliveryDayPlanService';
import type { ServiceMealType } from '../types';

export interface ManagedDeliveryDayPlan extends DeliveryDayPlan {
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string;
  };
  payment: null | {
    id: string;
    amount: number;
    currency: 'INR';
    payment_method: 'manual_upi' | 'manual_bank' | 'cash';
    status: 'verified';
    verified_at: string;
  };
}

export interface DeliveryDayPlanManagementDocument {
  subscriptions: ManagedDeliveryDayPlan[];
}

const rpc = async (name: string, args?: Record<string, unknown>): Promise<any> => {
  const { data, error } = await getSupabaseClient().rpc(name as never, args as never);
  if (error) throw new DeliveryDayPlanError(error.code, error.message);
  return data;
};

const parseManagedPlan = (value: any): ManagedDeliveryDayPlan => {
  const plan = parseDeliveryDayPlan(value);
  if (!value.customer || typeof value.customer.name !== 'string'
    || typeof value.customer.address !== 'string'
    || (value.customer.email != null && typeof value.customer.email !== 'string')
    || (value.customer.phone != null && typeof value.customer.phone !== 'string')) {
    throw new DeliveryDayPlanError('INVALID_RESPONSE');
  }
  if (value.payment != null && (typeof value.payment.id !== 'string'
    || !Number.isFinite(Number(value.payment.amount)) || value.payment.currency !== 'INR'
    || !['manual_upi', 'manual_bank', 'cash'].includes(value.payment.payment_method)
    || value.payment.status !== 'verified' || typeof value.payment.verified_at !== 'string')) {
    throw new DeliveryDayPlanError('INVALID_RESPONSE');
  }
  return {
    ...plan,
    customer: value.customer,
    payment: value.payment ? { ...value.payment, amount: Number(value.payment.amount) } : null,
  };
};

export const deliveryDayPlanManagementService = {
  async getManagement(): Promise<DeliveryDayPlanManagementDocument> {
    const data = await rpc('get_delivery_day_plan_management');
    if (!data || !Array.isArray(data.subscriptions)) throw new DeliveryDayPlanError('INVALID_RESPONSE');
    return { subscriptions: data.subscriptions.map(parseManagedPlan) };
  },

  async offerQuote(input: {
    subscriptionId: string;
    serviceUnitPrices: Partial<Record<ServiceMealType, number>>;
    deliveryFee: number;
    discountAmount: number;
    taxAmount: number;
    validUntil: string;
  }): Promise<DeliveryDayPlan> {
    return parseDeliveryDayPlan(await rpc('offer_delivery_day_plan_quote', {
      p_subscription_id: input.subscriptionId,
      p_service_unit_prices: input.serviceUnitPrices,
      p_delivery_fee: input.deliveryFee,
      p_discount_amount: input.discountAmount,
      p_tax_amount: input.taxAmount,
      p_valid_until: input.validUntil,
    }));
  },

  async verifyAndActivate(input: {
    subscriptionId: string;
    paymentReference: string;
    paymentMethod: 'manual_upi' | 'manual_bank' | 'cash';
  }): Promise<ManagedDeliveryDayPlan> {
    return parseManagedPlan(await rpc('verify_and_activate_delivery_day_plan', {
      p_subscription_id: input.subscriptionId,
      p_payment_reference: input.paymentReference.trim(),
      p_payment_method: input.paymentMethod,
    }));
  },
};
