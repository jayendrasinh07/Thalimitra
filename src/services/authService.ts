import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { CustomerSegmentType, UserRoleType } from '../types/database.types';
import { Capacitor } from '@capacitor/core';

export interface AuthProfile {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  segment: CustomerSegmentType;
  dietPreference?: string;
  defaultPortion?: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  profile: AuthProfile | null;
  roles: UserRoleType[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Authentication always uses Supabase.


export const authService = {
  /**
   * Registers a new user with Supabase Auth and metadata for automatic profile creation
   */
  async signUp(
    email: string,
    password: string,
    fullName: string,
    phone: string,
    segment: CustomerSegmentType = 'individual'
  ): Promise<{ user: User | null; error: Error | null }> {
    if (!isSupabaseConfigured()) { return {user:null,error:new Error('Sign-in is currently unavailable.')} ; }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            segment
          }
        }
      });

      if (error) throw error;
      return { user: data.user, error: null };
    } catch (err: any) {
      console.error('[Thalimitra Auth] Sign up error:', err);
      return { user: null, error: err };
    }
  },

  /**
   * Signs in user with Email and Password
   */
  async signIn(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
    if (!isSupabaseConfigured()) { return {user:null,session:null,error:new Error('Sign-in is currently unavailable.')} ; }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return { user: data.user, session: data.session, error: null };
    } catch (err: any) {
      console.error('[Thalimitra Auth] Sign in error:', err);
      return { user: null, session: null, error: err };
    }
  },

  async requestPasswordReset(email: string, scope: 'customer' | 'operations' = 'customer'): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured()) return { error: new Error('Password recovery is currently unavailable.') };

    try {
      const client = getSupabaseClient();
      const redirectTo = scope === 'operations'
        ? 'https://ops.thalimitra.com/reset-password'
        : 'https://thalimitra.com/reset-password';
      const { error } = scope === 'operations'
        ? await client.auth.resetPasswordForEmail(email, { redirectTo })
        : await client.functions.invoke('request-customer-password-reset', { body: { email } });
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      console.error('[Thalimitra Auth] Password recovery request failed:', err);
      const message = String(err?.message || '').toLowerCase();
      if (message.includes('email rate limit')) {
        return {
          error: new Error('Too many reset emails were requested. Please wait about one hour, then request one fresh link.')
        };
      }
      return { error: err };
    }
  },

  async consumeMobileRecoveryLink(link: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    let url: URL;
    try { url = new URL(link); } catch { return false; }
    if (url.protocol !== 'https:' || url.hostname !== 'thalimitra.com' || url.pathname !== '/reset-password') return false;

    try {
      const client = getSupabaseClient();
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      const code = url.searchParams.get('code');
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (accessToken && refreshToken) {
        const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
      } else {
        throw new Error('The link has no recovery session.');
      }
      window.history.replaceState(null, '', '/reset-password');
    } catch {
      window.history.replaceState(null, '', '/reset-password?error_description=This%20reset%20link%20is%20invalid%20or%20expired');
    }
    return true;
  },

  async preparePasswordRecovery(): Promise<{ ready: boolean; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { ready: false, error: new Error('Password recovery is currently unavailable.') };
    }

    try {
      const client = getSupabaseClient();
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
      const authError = url.searchParams.get('error_description') || hash.get('error_description');
      if (authError) throw new Error(decodeURIComponent(authError.replace(/\+/g, ' ')));

      let { data: { session }, error } = await client.auth.getSession();
      if (error) throw error;

      const code = url.searchParams.get('code');
      if (!session && code) {
        const exchanged = await client.auth.exchangeCodeForSession(code);
        if (exchanged.error) throw exchanged.error;
        session = exchanged.data.session;
      }

      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      if (!session && accessToken && refreshToken) {
        const restored = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (restored.error) throw restored.error;
        session = restored.data.session;
      }

      if (!session) {
        return { ready: false, error: new Error('This reset link is invalid, expired, or already used. Request a new link from sign in.') };
      }

      window.history.replaceState(null, '', '/reset-password');
      return { ready: true, error: null };
    } catch (err: any) {
      console.error('[Thalimitra Auth] Password recovery session failed:', err);
      return { ready: false, error: new Error('This reset link is invalid, expired, or already used. Request a new link from sign in.') };
    }
  },

  async getPasswordRecoveryMfa(): Promise<{ required: boolean; factorId: string | null; error: Error | null }> {
    try {
      const client = getSupabaseClient();
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      if (assurance.data.currentLevel === 'aal2' || assurance.data.nextLevel !== 'aal2') {
        return { required: false, factorId: null, error: null };
      }

      const factors = await client.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const verified = factors.data.all.find(
        factor => factor.factor_type === 'totp' && factor.status === 'verified'
      );
      if (!verified) throw new Error('Verified authenticator factor not found.');
      return { required: true, factorId: verified.id, error: null };
    } catch (err: any) {
      console.error('[Thalimitra Auth] Recovery MFA inspection failed:', err);
      return { required: false, factorId: null, error: new Error('Kitchen security verification could not start. Request a new reset link and try again.') };
    }
  },

  async verifyPasswordRecoveryMfa(factorId: string, code: string): Promise<{ error: Error | null }> {
    try {
      const client = getSupabaseClient();
      const verification = await client.auth.mfa.challengeAndVerify({ factorId, code });
      if (verification.error) throw verification.error;
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== 'aal2') {
        throw assurance.error ?? new Error('MFA verification incomplete.');
      }
      return { error: null };
    } catch (err: any) {
      console.error('[Thalimitra Auth] Recovery MFA verification failed:', err);
      return { error: new Error('That security code was not accepted. Use the latest 6-digit code and try again.') };
    }
  },

  async updatePassword(password: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured()) return { error: new Error('Password recovery is currently unavailable.') };

    try {
      const client = getSupabaseClient();
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError || !session) {
        return { error: new Error('This reset link is invalid, expired, or already used. Request a new link from sign in.') };
      }
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      console.error('[Thalimitra Auth] Password update failed:', err);
      return { error: err };
    }
  },

  /**
   * Signs out current user
   */
  async signOut(): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured()) { return {error:null}; }

    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      console.error('[Thalimitra Auth] Sign out error:', err);
      return { error: err };
    }
  },

  /**
   * Gets current active auth user
   */
  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured()) { return null; }

    try {
      const client = getSupabaseClient();
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) return null;
      return user;
    } catch (err) {
      console.warn('[Thalimitra Auth] Failed to fetch current user:', err);
      return null;
    }
  },

  /**
   * Fetches public profile for a user
   */
  async getProfile(userId: string): Promise<AuthProfile | null> {
    if (!isSupabaseConfigured()) { return null; }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) return null;

      const row = data as any;
      return {
        id: row.id,
        fullName: row.full_name,
        phone: row.phone || '',
        email: row.email || '',
        segment: (row.segment as CustomerSegmentType) || 'individual',
        dietPreference: row.diet_preference || undefined,
        defaultPortion: row.default_portion || undefined,
        avatarUrl: row.avatar_url || undefined
      };
    } catch (err) {
      console.warn('[Thalimitra Auth] Failed to fetch profile from Supabase:', err);
      return null;
    }
  },

  /**
   * Fetches roles assigned to user
   */
  async getUserRoles(userId: string): Promise<UserRoleType[]> {
    if (!isSupabaseConfigured()) { return []; }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error || !data || data.length === 0) {
        return [];
      }

      return (data as any[]).map((r) => r.role as UserRoleType);
    } catch (err) {
      console.warn('[Thalimitra Auth] Failed to fetch roles:', err);
      return [];
    }
  },

  /**
   * Updates profile fields in Supabase
   */
  async updateProfile(userId: string, updates: Partial<AuthProfile>): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured()) { return {success:false,error:new Error('Profile updates are currently unavailable.')}; }

    try {
      const client = getSupabaseClient();
      const payload: any = {};
      if (updates.fullName !== undefined) payload.full_name = updates.fullName;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.segment !== undefined) payload.segment = updates.segment;
      if (updates.dietPreference !== undefined) payload.diet_preference = updates.dietPreference;
      if (updates.defaultPortion !== undefined) payload.default_portion = updates.defaultPortion;

      const { error } = await client
        .from('profiles')
        .update(payload)
        .eq('id', userId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[Thalimitra Auth] Profile update failed:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Subscribes to auth state changes
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    if (!isSupabaseConfigured()) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    const client = getSupabaseClient();
    return client.auth.onAuthStateChange(callback);
  }
};
