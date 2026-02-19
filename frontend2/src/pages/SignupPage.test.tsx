import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SignupPage } from './SignupPage';
import { authApi } from '@/api/auth.api';
import type { ApiResponse, UserSignupResponse } from '@/types/api.types';

const authState = {
  isAuthenticated: false,
};

vi.mock('@/features/auth/store', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/api/auth.api', () => ({
  authApi: {
    signup: vi.fn(),
  },
}));

const mockedAuthApi = vi.mocked(authApi);

const mockAxiosResponse = <T,>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} } as InternalAxiosRequestConfig,
});

const createApiResponse = <T,>(data: T): ApiResponse<T> => ({
  code: 'COMMON_SUCCESS',
  message: 'ok',
  data,
});

function CurrentLocation() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/signup']}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<CurrentLocation />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SignupPage pending invitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    authState.isAuthenticated = false;

    mockedAuthApi.signup.mockResolvedValue(
      mockAxiosResponse(
        createApiResponse<UserSignupResponse>({
          id: 1,
          email: 'new-user@lumina.ai',
          name: '신규 사용자',
        })
      )
    );
  });

  it('회원가입 성공 후 로그인으로 이동하고 pendingInvitation은 유지한다', async () => {
    sessionStorage.setItem('pendingInvitation', 'invite-token');

    renderPage();

    fireEvent.change(screen.getByPlaceholderText('홍길동'), {
      target: { value: '신규 사용자' },
    });
    fireEvent.change(screen.getByPlaceholderText('email@company.com'), {
      target: { value: 'new-user@lumina.ai' },
    });

    const passwordInputs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.change(passwordInputs[0], {
      target: { value: 'password123!' },
    });
    fireEvent.change(passwordInputs[1], {
      target: { value: 'password123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /계정 만들기/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
    expect(sessionStorage.getItem('pendingInvitation')).toBe('invite-token');
  });
});
