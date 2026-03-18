/**
 * authStore.ts
 * Zustand store — handles OAuth2 login, registration, and session state.
 */
import { create } from 'zustand';
import { oauth2 } from '../services/oauth2Service';
import { apiService, UserProfile, RegisterPayload } from '../services/apiService';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeSession: () => Promise<void>;
  loginWithOAuth: () => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUser: (user: UserProfile) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Called on app start — restores session from SecureStore
  initializeSession: async () => {
    set({ isLoading: true });
    try {
      const [isAuth, storedUser] = await Promise.all([
        oauth2.isAuthenticated(),
        apiService.getStoredUser(),
      ]);
      if (isAuth && storedUser) {
        set({ isAuthenticated: true, user: storedUser });
      } else {
        set({ isAuthenticated: false, user: null });
      }
    } catch {
      set({ isAuthenticated: false, user: null });
    } finally {
      set({ isLoading: false });
    }
  },

  // OAuth2 PKCE login — opens Odoo 18 login page in browser
  loginWithOAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      await oauth2.startAuthorizationFlow();
      const userInfo = await oauth2.fetchUserInfo();
      const profile = await apiService.buildProfileFromOAuth(userInfo);
      set({ user: profile, isAuthenticated: true });
    } catch (e: any) {
      const msg = e.message || 'Login failed. Please try again.';
      set({ error: msg });
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // Register new user — public endpoint, then auto-login via OAuth
  register: async (payload: RegisterPayload) => {
    set({ isLoading: true, error: null });
    try {
      await apiService.register(payload);
      // After successful registration, start OAuth login flow
      await oauth2.startAuthorizationFlow();
      const userInfo = await oauth2.fetchUserInfo();
      const profile = await apiService.buildProfileFromOAuth(userInfo);
      set({ user: profile, isAuthenticated: true });
    } catch (e: any) {
      const msg = e.message || 'Registration failed. Please try again.';
      set({ error: msg });
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await oauth2.logout();
      await apiService.clearUser();
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  clearError: () => set({ error: null }),
  setUser: (user) => set({ user }),
}));
