import { getSupabaseClient } from './supabaseClient';

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
