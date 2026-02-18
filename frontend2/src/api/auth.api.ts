import axios from 'axios';
import api from './axios';
import type {
  ApiResponse,
  EmailAvailabilityResponse,
  UserSignupRequest,
  UserSignupResponse,
  UserLoginRequest,
  UserLoginResponse,
  UserMeResponse,
  TokenRefreshRequest,
  TokenRefreshResponse,
} from '@/types/api.types';

// refresh 요청용 별도 axios 인스턴스 (인터셉터 무한루프 방지)
const authAxios = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authApi = {
  // 이메일 중복 체크 - GET /api/v1/auth/check-email
  checkEmailAvailability: (email: string, options?: { signal?: AbortSignal }) =>
    api.get<ApiResponse<EmailAvailabilityResponse>>('/auth/check-email', {
      params: { email },
      signal: options?.signal,
    }),

  // 회원가입 - POST /api/v1/auth/signup
  signup: (data: UserSignupRequest) =>
    api.post<ApiResponse<UserSignupResponse>>('/auth/signup', data),

  // 로그인 - POST /api/v1/auth/login
  login: (data: UserLoginRequest) =>
    api.post<ApiResponse<UserLoginResponse>>('/auth/login', data),

  // 로그아웃 - POST /api/v1/auth/logout
  logout: () =>
    api.post<ApiResponse<void>>('/auth/logout'),

  // 토큰 갱신 - POST /api/v1/auth/refresh (별도 인스턴스 사용)
  refresh: (data: TokenRefreshRequest) =>
    authAxios.post<ApiResponse<TokenRefreshResponse>>('/auth/refresh', data),

  // 내 정보 조회 - GET /api/v1/users/me
  getMe: () =>
    api.get<ApiResponse<UserMeResponse>>('/users/me'),
};
