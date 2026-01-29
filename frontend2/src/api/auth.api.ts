import api from './axios';
import type {
  ApiResponse,
  UserSignupRequest,
  UserSignupResponse,
  UserLoginRequest,
  UserLoginResponse,
  UserMeResponse,
} from '@/types/api.types';

export const authApi = {
  // 회원가입 - 현재 백엔드: POST /auth/signup
  signup: (data: UserSignupRequest) =>
    api.post<ApiResponse<UserSignupResponse>>('/auth/signup', data),

  // 로그인 - API 스펙: POST /api/v1/auth/login (미구현)
  login: (data: UserLoginRequest) =>
    api.post<ApiResponse<UserLoginResponse>>('/auth/login', data),

  // 내 정보 조회 - API 스펙: GET /api/v1/users/me (미구현)
  getMe: () =>
    api.get<ApiResponse<UserMeResponse>>('/users/me'),
};
