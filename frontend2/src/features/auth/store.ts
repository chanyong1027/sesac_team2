import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import type { UserMeResponse } from '@/types/api.types';

// 순환 참조 방지를 위한 별도 axios 인스턴스
const logoutAxios = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface AuthState {
  user: UserMeResponse | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserMeResponse, token: string, refreshToken: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, token, refreshToken) => {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, token, refreshToken, isAuthenticated: true });
      },
      setTokens: (token, refreshToken) => {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', refreshToken);
        set({ token, refreshToken });
      },
      logout: () => {
        // 백엔드 API 호출 (토큰 블랙리스트 처리) - fire-and-forget
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
          logoutAxios.post('/auth/logout', null, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).catch((error) => {
            console.error('Logout API failed:', error);
          });
        }
        // 클라이언트 상태는 즉시 초기화
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
