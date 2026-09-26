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
  decisions: Array<{
    id: string;
    decision_type: 'cancelled_no_payment' | 'refund_due' | 'no_refund' | 'refund_completed';
    amount: number;
    customer_message: string;
    internal_note: string | null;
    external_reference: string | null;
    created_at: string;
  }>;
}

export interface DeliveryDayPlanManagementDocument {
  subscriptions: ManagedDeliveryDayPlan[];
  templates: Array<{
    code: string; name: string; description: string; delivery_days: 7 | 15 | 30;
    is_active: boolean; display_order: number;
  }>;
  policy: {
    max_discount_percent: number;
    max_delivery_fee: number;
    tax_collection_enabled: boolean;
    customer_cancellation_summary: string;
    updated_at: string;
  };
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
    decisions: Array.isArray(value.decisions) ? value.decisions.map((decision: any) => ({
      ...decision, amount: Number(decision.amount),
    })) : [],
  };
};

export const deliveryDayPlanManagementService = {
  async getManagement(): Promise<DeliveryDayPlanManagementDocument> {
    const data = await rpc('get_delivery_day_plan_management');
    if (!data || !Array.isArray(data.subscriptions) || !Array.isArray(data.templates) || !data.policy) {
      throw new DeliveryDayPlanError('INVALID_RESPONSE');
    }
    return {
      subscriptions: data.subscriptions.map(parseManagedPlan),
      templates: data.templates.map((template: any) => ({ ...template,
        delivery_days: Number(template.delivery_days), display_order: Number(template.display_order),
      })),
      policy: { ...data.policy,
        max_discount_percent: Number(data.policy.max_discount_percent),
        max_delivery_fee: Number(data.policy.max_delivery_fee),
      },
    };
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
  async updateTemplate(input: { code: string; name: string; description: string; isActive: boolean }) {
    return rpc('update_delivery_day_plan_template', {
      p_code: input.code, p_name: input.name, p_description: input.description,
      p_is_active: input.isActive,
    });
  },
  async updatePolicy(input: { maxDiscountPercent: number; maxDeliveryFee: number; cancellationSummary: string }) {
    return rpc('update_delivery_day_plan_policy', {
      p_max_discount_percent: input.maxDiscountPercent,
      p_max_delivery_fee: input.maxDeliveryFee,
      p_customer_cancellation_summary: input.cancellationSummary,
    });
  },
  async recordDecision(input: {
    subscriptionId: string;
    decisionType: 'cancelled_no_payment' | 'refund_due' | 'no_refund' | 'refund_completed';
    amount: number;
    customerMessage: string;
    internalNote?: string;
    externalReference?: string;
  }): Promise<ManagedDeliveryDayPlan> {
    return parseManagedPlan(await rpc('record_delivery_day_plan_decision', {
      p_subscription_id: input.subscriptionId, p_decision_type: input.decisionType,
      p_amount: input.amount, p_customer_message: input.customerMessage,
      p_internal_note: input.internalNote?.trim() || null,
      p_external_reference: input.externalReference?.trim() || null,
    }));
  },
};
