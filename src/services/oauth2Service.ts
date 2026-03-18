/**
 * oauth2Service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Full OAuth2 Authorization Code + PKCE flow for Odoo 18 Enterprise.
 *
 * Flow:
 *   1. Generate code_verifier + code_challenge (PKCE S256)
 *   2. Open Odoo 18 /oauth2/authorize in browser
 *   3. Odoo redirects to socialconnect://oauth2/callback?code=xxx
 *   4. Exchange code → access_token + refresh_token
 *   5. Store tokens securely in expo-secure-store
 *   6. Auto-refresh when access_token is near expiry
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosInstance } from 'axios';
import { Config } from '../constants';

// Required for expo-auth-session on Android
WebBrowser.maybeCompleteAuthSession();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;       // seconds
  token_type: string;
  scope: string;
  id_token?: string;        // OpenID Connect
}

export interface OAuthUserInfo {
  sub: string;              // Odoo partner id as string
  name: string;
  email?: string;
  phone?: string;
  picture?: string;
}

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;       // Unix timestamp ms
}

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────

async function generateCodeVerifier(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── OAuth2 Service ───────────────────────────────────────────────────────────

class OAuth2Service {
  private httpClient: AxiosInstance;
  private refreshPromise: Promise<StoredTokens> | null = null;

  constructor() {
    this.httpClient = axios.create({
      baseURL: Config.ODOO_BASE_URL,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 30000,
    });

    // Auto-attach Bearer token to every request
    this.httpClient.interceptors.request.use(async (config) => {
      const tokens = await this.getValidTokens();
      if (tokens) {
        config.headers.Authorization = `Bearer ${tokens.access_token}`;
      }
      return config;
    });

    // Auto-refresh on 401
    this.httpClient.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const tokens = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
            return this.httpClient(originalRequest);
          } catch {
            await this.clearTokens();
            throw error;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ─── Step 1 + 2 + 3: Authorization Code + PKCE ───────────────────────────

  async startAuthorizationFlow(): Promise<TokenSet> {
    // Generate PKCE pair
    const codeVerifier = await generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Persist verifier for exchange step
    await SecureStore.setItemAsync(Config.KEYS.CODE_VERIFIER, codeVerifier);

    // Build authorization URL for Odoo 18
    const authUrl =
      `${Config.OAUTH2_AUTHORIZE_URL}` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(Config.OAUTH2_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(Config.OAUTH2_REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(Config.OAUTH2_SCOPES.join(' '))}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256` +
      `&state=${await this.generateState()}`;

    // Open Odoo 18 login/consent in system browser
    const result = await AuthSession.startAsync({
      authUrl,
      returnUrl: Config.OAUTH2_REDIRECT_URI,
    });

    if (result.type !== 'success') {
      throw new Error(
        result.type === 'cancel'
          ? 'Authentication was cancelled.'
          : 'Authentication failed. Please try again.'
      );
    }

    const { code, error } = result.params as { code?: string; error?: string };
    if (error || !code) {
      throw new Error(error || 'No authorization code received from Odoo.');
    }

    // Step 4: Exchange code for tokens
    return this.exchangeCodeForTokens(code, codeVerifier);
  }

  // ─── Step 4: Token Exchange ───────────────────────────────────────────────

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string
  ): Promise<TokenSet> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: Config.OAUTH2_REDIRECT_URI,
      client_id: Config.OAUTH2_CLIENT_ID,
      code_verifier: codeVerifier,
    });

    // Include client_secret only for confidential clients
    if (Config.OAUTH2_CLIENT_SECRET) {
      params.append('client_secret', Config.OAUTH2_CLIENT_SECRET);
    }

    const response = await axios.post<TokenSet>(
      Config.OAUTH2_TOKEN_URL,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    await this.storeTokens(response.data);
    await SecureStore.deleteItemAsync(Config.KEYS.CODE_VERIFIER);
    return response.data;
  }

  // ─── Refresh Access Token ─────────────────────────────────────────────────

  async refreshAccessToken(): Promise<StoredTokens> {
    // Deduplicate concurrent refresh calls
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const stored = await this.getStoredTokens();
      if (!stored?.refresh_token) {
        throw new Error('No refresh token available. Please sign in again.');
      }

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: stored.refresh_token,
        client_id: Config.OAUTH2_CLIENT_ID,
      });
      if (Config.OAUTH2_CLIENT_SECRET) {
        params.append('client_secret', Config.OAUTH2_CLIENT_SECRET);
      }

      const response = await axios.post<TokenSet>(
        Config.OAUTH2_TOKEN_URL,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const newTokens = await this.storeTokens(response.data);
      return newTokens;
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  // ─── Token Storage ────────────────────────────────────────────────────────

  private async storeTokens(tokenSet: TokenSet): Promise<StoredTokens> {
    const stored: StoredTokens = {
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
      expires_at: Date.now() + tokenSet.expires_in * 1000,
    };
    await SecureStore.setItemAsync(Config.KEYS.ACCESS_TOKEN, stored.access_token);
    await SecureStore.setItemAsync(Config.KEYS.REFRESH_TOKEN, stored.refresh_token);
    await SecureStore.setItemAsync(
      Config.KEYS.TOKEN_EXPIRY,
      stored.expires_at.toString()
    );
    return stored;
  }

  async getStoredTokens(): Promise<StoredTokens | null> {
    try {
      const [access_token, refresh_token, expiryStr] = await Promise.all([
        SecureStore.getItemAsync(Config.KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(Config.KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(Config.KEYS.TOKEN_EXPIRY),
      ]);
      if (!access_token || !refresh_token || !expiryStr) return null;
      return {
        access_token,
        refresh_token,
        expires_at: parseInt(expiryStr, 10),
      };
    } catch {
      return null;
    }
  }

  async getValidTokens(): Promise<StoredTokens | null> {
    const stored = await this.getStoredTokens();
    if (!stored) return null;

    const bufferMs = Config.TOKEN_REFRESH_BUFFER_SECONDS * 1000;
    const isExpiringSoon = Date.now() >= stored.expires_at - bufferMs;

    if (isExpiringSoon) {
      try {
        return await this.refreshAccessToken();
      } catch {
        return null;
      }
    }
    return stored;
  }

  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getStoredTokens();
    if (!tokens) return false;
    // Has a refresh_token = still valid (can refresh)
    return !!tokens.refresh_token;
  }

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(Config.KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(Config.KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(Config.KEYS.TOKEN_EXPIRY),
      SecureStore.deleteItemAsync(Config.KEYS.USER),
      SecureStore.deleteItemAsync(Config.KEYS.CODE_VERIFIER),
    ]);
  }

  // ─── Revoke + Logout ──────────────────────────────────────────────────────

  async logout(): Promise<void> {
    try {
      const tokens = await this.getStoredTokens();
      if (tokens?.access_token) {
        await axios.post(
          Config.OAUTH2_REVOKE_URL,
          new URLSearchParams({
            token: tokens.access_token,
            client_id: Config.OAUTH2_CLIENT_ID,
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
      }
    } catch {
      // Ignore revocation errors — clear locally anyway
    } finally {
      await this.clearTokens();
    }
  }

  // ─── Fetch Odoo user info ─────────────────────────────────────────────────

  async fetchUserInfo(): Promise<OAuthUserInfo> {
    const response = await this.httpClient.get<OAuthUserInfo>(
      Config.OAUTH2_USERINFO_URL
    );
    return response.data;
  }

  // ─── Resource API calls (auto-auth) ──────────────────────────────────────

  get api() {
    return this.httpClient;
  }

  // ─── State anti-CSRF ─────────────────────────────────────────────────────

  private async generateState(): Promise<string> {
    const bytes = await Crypto.getRandomBytesAsync(16);
    return Buffer.from(bytes).toString('hex');
  }
}

export const oauth2 = new OAuth2Service();
