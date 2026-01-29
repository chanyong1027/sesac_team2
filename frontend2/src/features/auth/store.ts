import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserMeResponse } from '@/types/api.types';

interface AuthState {
  user: UserMeResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserMeResponse, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('accessToken', token);
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
