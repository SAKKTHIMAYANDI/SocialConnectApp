/**
 * apiService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All business API calls to the Odoo 18 custom module.
 * All requests are automatically authenticated via oauth2.api (Bearer token).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { oauth2, OAuthUserInfo } from './oauth2Service';
import { Config } from '../constants';
import * as SecureStore from 'expo-secure-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  password: string;
}

export interface UserProfile {
  id: number;
  name: string;
  phone: string;
  email: string;
  avatar_url?: string;
}

export interface SocialProfile {
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'linkedin';
  found: boolean;
  handle?: string;
  url?: string;
  profile_name?: string;
  last_seen?: string;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
  error_code?: string;
}

// ─── API Service ──────────────────────────────────────────────────────────────

class ApiService {
  // ─── Register new user (public endpoint, no token needed) ────────────────

  async register(payload: RegisterPayload): Promise<UserProfile> {
    // Registration is a PUBLIC endpoint — no auth header needed
    const { default: axios } = await import('axios');
    const response = await axios.post<ApiResponse<UserProfile>>(
      `${Config.ODOO_BASE_URL}${Config.REGISTER_URL}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Odoo-DB': Config.ODOO_DB,
        },
      }
    );

    if (response.data.status !== 'success' || !response.data.data) {
      throw new Error(response.data.error || 'Registration failed');
    }

    return response.data.data;
  }

  // ─── Fetch current user profile (authenticated) ───────────────────────────

  async fetchProfile(): Promise<UserProfile> {
    const response = await oauth2.api.get<ApiResponse<UserProfile>>(
      Config.USER_PROFILE_URL
    );
    if (response.data.status !== 'success' || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch profile');
    }
    const profile = response.data.data;
    await SecureStore.setItemAsync(Config.KEYS.USER, JSON.stringify(profile));
    return profile;
  }

  // ─── Build profile from OAuth2 userinfo (after OAuth login) ──────────────

  async buildProfileFromOAuth(userInfo: OAuthUserInfo): Promise<UserProfile> {
    const profile: UserProfile = {
      id: parseInt(userInfo.sub, 10),
      name: userInfo.name,
      phone: userInfo.phone || '',
      email: userInfo.email || '',
      avatar_url: userInfo.picture,
    };
    await SecureStore.setItemAsync(Config.KEYS.USER, JSON.stringify(profile));
    return profile;
  }

  // ─── Social profile lookup ────────────────────────────────────────────────

  async lookupSocialProfiles(
    phone: string,
    email: string
  ): Promise<SocialProfile[]> {
    const response = await oauth2.api.post<ApiResponse<SocialProfile[]>>(
      Config.SOCIAL_LOOKUP_URL,
      { phone, email }
    );
    if (response.data.status !== 'success' || !response.data.data) {
      throw new Error(response.data.error || 'Social lookup failed');
    }
    return response.data.data;
  }

  // ─── Get stored user (from SecureStore) ───────────────────────────────────

  async getStoredUser(): Promise<UserProfile | null> {
    try {
      const raw = await SecureStore.getItemAsync(Config.KEYS.USER);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  }

  async clearUser(): Promise<void> {
    await SecureStore.deleteItemAsync(Config.KEYS.USER);
  }
}

export const apiService = new ApiService();
