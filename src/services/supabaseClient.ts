import type { Database } from '../types/database.generated';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = (env.VITE_SUPABASE_URL as string | undefined)?.trim();
// Support both legacy ANON key and modern Publishable Key conventions
const supabaseKey = (
  (env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (env.VITE_SUPABASE_ANON_KEY as string | undefined)
)?.trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl && 
    supabaseKey && 
    supabaseUrl.startsWith('https://') && 
    supabaseKey.length > 20 &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('example')
  );
};

export const getSupabaseConfigDetails = () => {
  const configured = isSupabaseConfigured();
  return {
    isConfigured: configured,
    hasUrl: Boolean(supabaseUrl),
    hasKey: Boolean(supabaseKey),
    keyType: env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'VITE_SUPABASE_PUBLISHABLE_KEY' : env.VITE_SUPABASE_ANON_KEY ? 'VITE_SUPABASE_ANON_KEY' : 'NONE',
    urlHost: supabaseUrl ? (supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] + '...') : null,
  };
};

// Singleton Supabase Client
let _supabaseInstance: SupabaseClient<Database> | null = null;

export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (_supabaseInstance) {
    return _supabaseInstance;
  }

  if (isSupabaseConfigured()) {
    _supabaseInstance = createClient<Database>(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
    return _supabaseInstance;
  }

  throw new Error('Ordering is unavailable because the database connection is not configured.');
};

export const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;

/**
 * Diagnostic Verification Test for Supabase Connection & Table Existence
 */
export async function verifySupabaseDatabaseStatus(): Promise<{
  connected: boolean;
  isConfigured: boolean;
  phase1Tables: {
    profiles: boolean;
    user_roles: boolean;
    delivery_zones: boolean;
    addresses: boolean;
    area_waitlist: boolean;
  };
  phase2Tables: {
    meals: boolean;
    menu_days: boolean;
    menu_items: boolean;
    meal_customizations: boolean;
    delivery_slots: boolean;
    orders: boolean;
    order_items: boolean;
    order_customizations: boolean;
  };
  details: string;
}> {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return {
      connected: false,
      isConfigured: false,
      phase1Tables: {
        profiles: false,
        user_roles: false,
        delivery_zones: false,
        addresses: false,
        area_waitlist: false,
      },
      phase2Tables: {
        meals: false,
        menu_days: false,
        menu_items: false,
        meal_customizations: false,
        delivery_slots: false,
        orders: false,
        order_items: false,
        order_customizations: false,
      },
      details: 'Supabase URL / Key environment variables are missing or unconfigured.'
    };
  }

  const client = getSupabaseClient();
  const results = {
    connected: false,
    isConfigured: true,
    phase1Tables: {
      profiles: false,
      user_roles: false,
      delivery_zones: false,
      addresses: false,
      area_waitlist: false,
    },
    phase2Tables: {
      meals: false,
      menu_days: false,
      menu_items: false,
      meal_customizations: false,
      delivery_slots: false,
      orders: false,
      order_items: false,
      order_customizations: false,
    },
    details: ''
  };

  try {
    // Use the public-safe RPC; delivery area rows and admin metadata are private.
    const { error: zonesErr } = await client.rpc('check_delivery_serviceability', {
      p_latitude: 23.2156, p_longitude: 72.6369,
      p_pincode: null, p_area: null, p_sector: null, p_meal_type: null,
    });
    if (!zonesErr) {
      results.connected = true;
      results.phase1Tables.delivery_zones = true;
    }

    // Check profiles
    const { error: profErr } = await client.from('profiles').select('id').limit(1);
    if (!profErr) results.phase1Tables.profiles = true;

    // Check user_roles
    const { error: rolesErr } = await client.from('user_roles').select('id').limit(1);
    if (!rolesErr) results.phase1Tables.user_roles = true;

    // Check addresses
    const { error: addrErr } = await client.from('addresses').select('id').limit(1);
    if (!addrErr) results.phase1Tables.addresses = true;

    // Check area_waitlist
    const { error: waitErr } = await client.from('area_waitlist').select('id').limit(1);
    if (!waitErr) results.phase1Tables.area_waitlist = true;

    // Check meals
    const { error: mealsErr } = await client.from('meals').select('id').limit(1);
    if (!mealsErr) results.phase2Tables.meals = true;

    // Check menu_days
    const { error: menuDaysErr } = await client.from('menu_days').select('id').limit(1);
    if (!menuDaysErr) results.phase2Tables.menu_days = true;

    // Check menu_items
    const { error: menuItemsErr } = await client.from('menu_items').select('id').limit(1);
    if (!menuItemsErr) results.phase2Tables.menu_items = true;

    // Check meal_customizations
    const { error: custErr } = await client.from('meal_customizations').select('id').limit(1);
    if (!custErr) results.phase2Tables.meal_customizations = true;

    // Check delivery_slots
    const { error: slotsErr } = await client.from('delivery_slots').select('id').limit(1);
    if (!slotsErr) results.phase2Tables.delivery_slots = true;

    // Check orders
    const { error: ordersErr } = await client.from('orders').select('id').limit(1);
    if (!ordersErr) results.phase2Tables.orders = true;

    // Check order_items
    const { error: ordItemsErr } = await client.from('order_items').select('id').limit(1);
    if (!ordItemsErr) results.phase2Tables.order_items = true;

    // Check order_customizations
    const { error: ordCustErr } = await client.from('order_customizations').select('id').limit(1);
    if (!ordCustErr) results.phase2Tables.order_customizations = true;

    results.details = results.connected 
      ? 'Successfully queried Supabase PostgreSQL database.' 
      : 'Supabase client initialized, but tables returned error (migrations may need to be applied in Supabase SQL Editor).';
  } catch (err: any) {
    results.details = `Connection check caught error: ${err?.message || err}`;
  }

  return results;
}
