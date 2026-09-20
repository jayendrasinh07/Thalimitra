import { getSupabaseClient } from './supabaseClient';

export interface PublicDeliveryArea {
  id: string;
  name: string;
  tagline: string | null;
  deliveryFee: number;
  minOrderAmount: number;
  estimatedDurationMinutes: number;
  services: { breakfast: boolean; lunch: boolean; dinner: boolean };
  latitude: number;
  longitude: number;
}

export interface WaitlistSubmission {
  name: string;
  contact: string;
  area: string;
  city: string;
  pincode?: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  source: 'map' | 'gps' | 'search' | 'saved' | 'manual';
}

const parsePublicArea = (value: unknown): PublicDeliveryArea | null => {
  if (!value || typeof value !== 'object') return null;
  const area = value as Record<string, unknown>;
  const services = area.services as Record<string, unknown> | undefined;
  const latitude = Number(area.latitude);
  const longitude = Number(area.longitude);
  if (typeof area.id !== 'string' || typeof area.name !== 'string'
    || !services || typeof services.breakfast !== 'boolean'
    || typeof services.lunch !== 'boolean' || typeof services.dinner !== 'boolean'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id: area.id,
    name: area.name,
    tagline: typeof area.tagline === 'string' ? area.tagline : null,
    deliveryFee: Number(area.deliveryFee || 0),
    minOrderAmount: Number(area.minOrderAmount || 0),
    estimatedDurationMinutes: Number(area.estimatedDurationMinutes || 0),
    services: { breakfast: services.breakfast, lunch: services.lunch, dinner: services.dinner },
    latitude,
    longitude,
  };
};

export async function listPublicDeliveryAreas(): Promise<PublicDeliveryArea[]> {
  const { data, error } = await getSupabaseClient().rpc('list_public_delivery_areas');
  if (error) throw error;
  return Array.isArray(data) ? data.map(parsePublicArea).filter((area): area is PublicDeliveryArea => Boolean(area)) : [];
}

export async function joinAreaWaitlist(entry: WaitlistSubmission): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('join_area_waitlist', {
    p_name: entry.name,
    p_contact: entry.contact,
    p_area: entry.area,
    p_city: entry.city,
    p_pincode: entry.pincode || null,
    p_formatted_address: entry.formattedAddress,
    p_latitude: entry.latitude,
    p_longitude: entry.longitude,
    p_source: entry.source,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Waitlist registration was not confirmed.');
  return data;
}
