import { getSupabaseClient } from './supabaseClient';

export type ServiceabilityStatus = 'available' | 'coming_soon' | 'unavailable';

export interface CoordinateServiceability {
  status: ServiceabilityStatus;
  isServiceable: boolean;
  areaId: string | null;
  areaName: string;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDurationMinutes: number | null;
  waitlistEnabled: boolean;
  services: { breakfast: boolean; lunch: boolean; dinner: boolean };
  message: string;
}

export async function checkCoordinateServiceability(input: {
  latitude: number;
  longitude: number;
  pincode?: string;
  area?: string;
  sector?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner';
}): Promise<CoordinateServiceability> {
  const { data, error } = await getSupabaseClient().rpc('check_delivery_serviceability', {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_pincode: input.pincode || null,
    p_area: input.area || null,
    p_sector: input.sector || null,
    p_meal_type: input.mealType || null,
  } as never);
  if (error) throw error;
  const result = data as unknown as CoordinateServiceability;
  if (!result || !['available', 'coming_soon', 'unavailable'].includes(result.status)
    || typeof result.isServiceable !== 'boolean' || typeof result.areaName !== 'string'
    || !result.services || typeof result.services.breakfast !== 'boolean'
    || typeof result.services.lunch !== 'boolean' || typeof result.services.dinner !== 'boolean') {
    throw new Error('Invalid delivery availability response.');
  }
  return { ...result, deliveryFee: Number(result.deliveryFee || 0),
    minOrderAmount: Number(result.minOrderAmount || 0),
    estimatedDurationMinutes: result.estimatedDurationMinutes == null ? null : Number(result.estimatedDurationMinutes) };
}
