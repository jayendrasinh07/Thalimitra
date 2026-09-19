import { getSupabaseClient } from './supabaseClient';

export type DeliveryAreaStatus = 'draft' | 'available' | 'coming_soon' | 'paused';
export type BoundaryGeometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };

export interface ManagedDeliveryArea {
  id: string;
  name: string;
  status: DeliveryAreaStatus;
  boundary: BoundaryGeometry | null;
  breakfast_enabled: boolean;
  lunch_enabled: boolean;
  dinner_enabled: boolean;
  waitlist_enabled: boolean;
  delivery_fee: number;
  min_order_amount: number;
  estimated_duration_minutes: number;
  priority: number;
  version: number;
  published_at: string | null;
  updated_at: string;
}

export interface DeliveryAreaDocument {
  areas: ManagedDeliveryArea[];
  generated_at: string;
}

export interface DeliveryAreaDraft {
  id?: string;
  name: string;
  status: DeliveryAreaStatus;
  boundary: BoundaryGeometry | null;
  breakfastEnabled: boolean;
  lunchEnabled: boolean;
  dinnerEnabled: boolean;
  waitlistEnabled: boolean;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDurationMinutes: number;
  priority: number;
}

export class DeliveryAreaError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || (code === '42501' ? 'Admin access with security verification is required.'
      : code === '23514' ? 'Draw a boundary before publishing this area.'
      : code === 'P0002' ? 'Delivery area was not found.'
      : code === '22023' ? 'Check the area details and boundary.'
      : 'Delivery Areas could not be updated. Try again.'));
    this.code = code;
  }
}

export function parseDeliveryAreaDocument(value: unknown): DeliveryAreaDocument {
  const document = value as DeliveryAreaDocument;
  if (!document || !Array.isArray(document.areas) || typeof document.generated_at !== 'string') {
    throw new DeliveryAreaError('INVALID_RESPONSE');
  }
  const areas = document.areas.map(area => {
    if (!area || typeof area.id !== 'string' || typeof area.name !== 'string'
      || !['draft', 'available', 'coming_soon', 'paused'].includes(area.status)
      || typeof area.breakfast_enabled !== 'boolean' || typeof area.lunch_enabled !== 'boolean'
      || typeof area.dinner_enabled !== 'boolean' || typeof area.waitlist_enabled !== 'boolean') {
      throw new DeliveryAreaError('INVALID_RESPONSE');
    }
    const deliveryFee = Number(area.delivery_fee);
    const minimum = Number(area.min_order_amount);
    const eta = Number(area.estimated_duration_minutes);
    const priority = Number(area.priority);
    const version = Number(area.version);
    if (![deliveryFee, minimum, eta, priority, version].every(Number.isFinite)) {
      throw new DeliveryAreaError('INVALID_RESPONSE');
    }
    return { ...area, delivery_fee: deliveryFee, min_order_amount: minimum,
      estimated_duration_minutes: eta, priority, version };
  });
  return { ...document, areas };
}

const rpc = async (name: 'get_delivery_areas' | 'save_delivery_area', args?: Record<string, unknown>) => {
  const { data, error } = await getSupabaseClient().rpc(name, args as never);
  if (error) throw new DeliveryAreaError(error.code, error.message);
  return parseDeliveryAreaDocument(data);
};

export const deliveryAreaService = {
  get: () => rpc('get_delivery_areas'),
  save(area: DeliveryAreaDraft) {
    if (!area.name.trim() || !Number.isFinite(area.deliveryFee)
      || !Number.isFinite(area.minOrderAmount) || !Number.isInteger(area.estimatedDurationMinutes)
      || !Number.isInteger(area.priority)) {
      throw new DeliveryAreaError('22023');
    }
    return rpc('save_delivery_area', {
      p_area_id: area.id || null,
      p_name: area.name.trim(),
      p_status: area.status,
      p_boundary: area.boundary,
      p_breakfast_enabled: area.breakfastEnabled,
      p_lunch_enabled: area.lunchEnabled,
      p_dinner_enabled: area.dinnerEnabled,
      p_delivery_fee: area.deliveryFee,
      p_min_order_amount: area.minOrderAmount,
      p_estimated_duration_minutes: area.estimatedDurationMinutes,
      p_waitlist_enabled: area.waitlistEnabled,
      p_priority: area.priority,
    });
  },
};
