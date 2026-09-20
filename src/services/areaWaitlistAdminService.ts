import { getSupabaseClient } from './supabaseClient';

export interface AdminWaitlistEntry {
  id: string;
  name: string;
  contact: string;
  area: string;
  city: string;
  pincode: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string | null;
  createdAt: string;
}

export interface AdminWaitlistDocument {
  generatedAt: string;
  total: number;
  entries: AdminWaitlistEntry[];
}

export const parseAdminWaitlist = (value: unknown): AdminWaitlistDocument => {
  if (!value || typeof value !== 'object') throw new Error('Invalid waitlist response.');
  const document = value as Record<string, unknown>;
  if (!Array.isArray(document.entries)) throw new Error('Invalid waitlist response.');
  const entries = document.entries.map(raw => {
    const entry = raw as Record<string, unknown>;
    if (typeof entry.id !== 'string' || typeof entry.name !== 'string'
      || typeof entry.contact !== 'string' || typeof entry.area !== 'string'
      || typeof entry.city !== 'string' || typeof entry.created_at !== 'string') {
      throw new Error('Invalid waitlist entry.');
    }
    const latitude = entry.latitude == null ? null : Number(entry.latitude);
    const longitude = entry.longitude == null ? null : Number(entry.longitude);
    return {
      id: entry.id,
      name: entry.name,
      contact: entry.contact,
      area: entry.area,
      city: entry.city,
      pincode: typeof entry.pincode === 'string' ? entry.pincode : null,
      formattedAddress: typeof entry.formatted_address === 'string' ? entry.formatted_address : null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      source: typeof entry.source === 'string' ? entry.source : null,
      createdAt: entry.created_at,
    } satisfies AdminWaitlistEntry;
  });
  return {
    generatedAt: typeof document.generated_at === 'string' ? document.generated_at : new Date().toISOString(),
    total: Number(document.total || entries.length),
    entries,
  };
};

export async function getAdminAreaWaitlist(): Promise<AdminWaitlistDocument> {
  const { data, error } = await getSupabaseClient().rpc('get_area_waitlist');
  if (error) {
    if (error.code === '42501') throw new Error(error.message.includes('Multi-factor') ? 'Complete security verification to view Customer requests.' : 'Admin access is required.');
    throw error;
  }
  return parseAdminWaitlist(data);
}
