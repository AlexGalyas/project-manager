'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser, LoginResponse } from '@workforce/shared';
import { apiFetch, TOKEN_STORAGE_KEY } from '@/lib/api-client';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,
      error: null,

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const res = await apiFetch<LoginResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            auth: false,
          });
          set({ token: res.token, user: res.user, loading: false });
          return res.user;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ loading: false, error: message });
          throw err;
        }
      },

      logout: () => {
        set({ token: null, user: null, error: null });
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      },

      fetchMe: async () => {
        if (!get().token) return;
        try {
          const user = await apiFetch<AuthUser>('/auth/me');
          set({ user });
        } catch {
          set({ token: null, user: null });
        }
      },
    }),
    {
      name: 'workforce.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        // Mirror the token to the key the api-client reads (it doesn't share
        // Zustand state with this client component layer).
        if (state?.token && typeof window !== 'undefined') {
          window.localStorage.setItem(TOKEN_STORAGE_KEY, state.token);
        }
      },
    },
  ),
);

useAuthStore.subscribe((state) => {
  if (typeof window === 'undefined') return;
  if (state.token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, state.token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
});
