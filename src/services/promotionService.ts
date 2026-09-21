import { getSupabaseClient } from './supabaseClient';
import type { ServiceMealType } from '../types';

export type PromotionDiscountType = 'fixed' | 'percentage';

export interface PromotionCampaign {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_type: PromotionDiscountType;
  discount_value: number;
  minimum_subtotal: number;
  maximum_discount: number | null;
  total_budget: number | null;
  starts_at: string;
  ends_at: string;
  service_date_start: string | null;
  service_date_end: string | null;
  is_active: boolean;
  first_order_only: boolean;
  per_user_limit: number;
  eligible_meal_types: ServiceMealType[];
  eligible_meal_ids: string[];
  eligible_zone_ids: string[];
  redemption_count: number;
  spent: number;
}

export interface PromotionManagementDocument {
  campaigns: PromotionCampaign[];
  meals: { id: string; name: string; meal_type: string; is_active: boolean }[];
  areas: { id: string; name: string; status: string }[];
}

export interface PromotionOffer {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_amount: number;
  minimum_subtotal: number;
  ends_at: string;
}

export interface PromotionQuote {
  mealsSubtotal: number;
  addonsTotal: number;
  deliveryFee: number;
  discount: number;
  grandTotal: number;
  appliedOffer: PromotionOffer | null;
  availableOffers: PromotionOffer[];
}

export interface PromotionDraft {
  id?: string;
  code: string;
  name: string;
  description: string;
  discountType: PromotionDiscountType;
  discountValue: number;
  minimumSubtotal: number;
  maximumDiscount: number | null;
  totalBudget: number | null;
  startsAt: string;
  endsAt: string;
  serviceDateStart: string | null;
  serviceDateEnd: string | null;
  isActive: boolean;
  firstOrderOnly: boolean;
  perUserLimit: number;
  eligibleMealTypes: ServiceMealType[];
  eligibleMealIds: string[];
  eligibleZoneIds: string[];
}

export interface PromotionQuoteInput {
  orderDate: string;
  mealType: ServiceMealType;
  addressId: string;
  mealId: string;
  quantity: number;
  selectedAddons: Record<string, number>;
  code?: string | null;
}

export class PromotionError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(code === '42501' ? 'Admin access is required for Pricing & Offers.'
      : code === '23505' ? 'That offer code already exists.'
      : code === '23503' ? 'This used offer must be paused instead of deleted.'
      : code === '23514' ? 'The campaign budget cannot be lower than discount already spent.'
      : code === '22023' ? 'Check the offer values and try again.'
      : message || 'Pricing & Offers could not be updated. Try again.');
    this.code = code;
  }
}

const number = (value: unknown) => Number(value);
const parseOffer = (value: any): PromotionOffer => {
  if (!value || typeof value.id !== 'string' || typeof value.code !== 'string' || typeof value.name !== 'string') {
    throw new PromotionError('INVALID_RESPONSE');
  }
  return {
    id: value.id,
    code: value.code,
    name: value.name,
    description: typeof value.description === 'string' ? value.description : '',
    discount_amount: number(value.discount_amount),
    minimum_subtotal: number(value.minimum_subtotal),
    ends_at: String(value.ends_at),
  };
};

export const parsePromotionQuote = (value: any): PromotionQuote => {
  if (!value || !Array.isArray(value.available_offers)) throw new PromotionError('INVALID_RESPONSE');
  const result = {
    mealsSubtotal: number(value.meals_subtotal),
    addonsTotal: number(value.addons_total),
    deliveryFee: number(value.delivery_fee),
    discount: number(value.discount),
    grandTotal: number(value.grand_total),
    appliedOffer: value.applied_offer ? parseOffer(value.applied_offer) : null,
    availableOffers: value.available_offers.map(parseOffer),
  };
  if (Object.values(result).slice(0, 5).some(item => typeof item === 'number' && (!Number.isFinite(item) || item < 0))) {
    throw new PromotionError('INVALID_RESPONSE');
  }
  return result;
};

export const parsePromotionManagement = (value: any): PromotionManagementDocument => {
  if (!value || !Array.isArray(value.campaigns) || !Array.isArray(value.meals) || !Array.isArray(value.areas)) {
    throw new PromotionError('INVALID_RESPONSE');
  }
  const campaigns = value.campaigns.map((campaign: any) => {
    if (!campaign || typeof campaign.id !== 'string' || typeof campaign.code !== 'string'
      || !['fixed', 'percentage'].includes(campaign.discount_type)
      || !Array.isArray(campaign.eligible_meal_types) || !Array.isArray(campaign.eligible_meal_ids)
      || !Array.isArray(campaign.eligible_zone_ids)) throw new PromotionError('INVALID_RESPONSE');
    return {
      ...campaign,
      discount_value: number(campaign.discount_value),
      minimum_subtotal: number(campaign.minimum_subtotal),
      maximum_discount: campaign.maximum_discount == null ? null : number(campaign.maximum_discount),
      total_budget: campaign.total_budget == null ? null : number(campaign.total_budget),
      per_user_limit: number(campaign.per_user_limit),
      redemption_count: number(campaign.redemption_count),
      spent: number(campaign.spent),
    } as PromotionCampaign;
  });
  return { campaigns, meals: value.meals, areas: value.areas };
};

const managementRpc = async (name: string, args?: Record<string, unknown>) => {
  const { data, error } = await getSupabaseClient().rpc(name as never, args as never);
  if (error) throw new PromotionError(error.code, error.message);
  return parsePromotionManagement(data);
};

export const promotionService = {
  async quote(input: PromotionQuoteInput): Promise<PromotionQuote> {
    const customizations = Object.entries(input.selectedAddons)
      .filter(([, quantity]) => quantity > 0)
      .map(([customization_id, quantity]) => ({ customization_id, quantity }));
    const { data, error } = await getSupabaseClient().rpc('get_order_promotion_quote' as never, {
      p_order_date: input.orderDate,
      p_meal_type: input.mealType,
      p_address_id: input.addressId,
      p_meal_id: input.mealId,
      p_quantity: input.quantity,
      p_customizations: customizations,
      p_promotion_code: input.code?.trim() || null,
    } as never);
    if (error) throw new PromotionError(error.code, error.message);
    return parsePromotionQuote(data);
  },
  getManagement: () => managementRpc('get_promotion_management'),
  save(draft: PromotionDraft) {
    return managementRpc('save_promotion_campaign', {
      p_id: draft.id || null,
      p_code: draft.code,
      p_name: draft.name,
      p_description: draft.description,
      p_discount_type: draft.discountType,
      p_discount_value: draft.discountValue,
      p_minimum_subtotal: draft.minimumSubtotal,
      p_maximum_discount: draft.maximumDiscount,
      p_total_budget: draft.totalBudget,
      p_starts_at: new Date(draft.startsAt).toISOString(),
      p_ends_at: new Date(draft.endsAt).toISOString(),
      p_service_date_start: draft.serviceDateStart || null,
      p_service_date_end: draft.serviceDateEnd || null,
      p_is_active: draft.isActive,
      p_first_order_only: draft.firstOrderOnly,
      p_per_user_limit: draft.perUserLimit,
      p_eligible_meal_types: draft.eligibleMealTypes,
      p_eligible_meal_ids: draft.eligibleMealIds,
      p_eligible_zone_ids: draft.eligibleZoneIds,
    });
  },
  setActive(id: string, active: boolean) {
    return managementRpc('set_promotion_campaign_active', { p_id: id, p_is_active: active });
  },
  deleteUnused(id: string) {
    return managementRpc('delete_unused_promotion_campaign', { p_id: id });
  },
};
