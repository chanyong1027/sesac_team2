import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { authApi } from '@/api/auth.api';
import { workspaceApi } from '@/api/workspace.api';
import type {
  ApiResponse,
  ErrorResponse,
  UserLoginResponse,
  UserMeResponse,
  WorkspaceInviteAcceptResponse,
  WorkspaceInvitePreviewResponse,
} from '@/types/api.types';

const authState = {
  isAuthenticated: false,
  setAuth: vi.fn(),
};

vi.mock('@/features/auth/store', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/api/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
  },
}));

vi.mock('@/api/workspace.api', () => ({
  workspaceApi: {
    acceptInvitation: vi.fn(),
    previewInvitation: vi.fn(),
  },
}));

const mockedAuthApi = vi.mocked(authApi);
const mockedWorkspaceApi = vi.mocked(workspaceApi);

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

const createAxiosApiError = (status: number, code: string, message: string): AxiosError<ErrorResponse> => ({
  name: 'AxiosError',
  message,
  isAxiosError: true,
  toJSON: () => ({}),
  config: { headers: {} } as InternalAxiosRequestConfig,
  response: {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
    data: {
      code,
      message,
      timestamp: '2026-02-18T00:00:00',
      fieldErrors: null,
    },
  },
} as AxiosError<ErrorResponse>);

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
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<CurrentLocation />} />
          <Route path="/invitations/accept" element={<CurrentLocation />} />
          <Route path="/workspaces/:workspaceId" element={<CurrentLocation />} />
          <Route path="/orgs/:orgId/workspaces/:workspaceId" element={<CurrentLocation />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function submitLoginForm() {
  fireEvent.change(screen.getByPlaceholderText('email@company.com'), {
    target: { value: 'tester@lumina.ai' },
  });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: 'password123!' },
  });

  fireEvent.click(screen.getByRole('button', { name: /로그인/ }));
}

describe('LoginPage pending invitation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    authState.isAuthenticated = false;
    authState.setAuth.mockReset();

    mockedAuthApi.login.mockResolvedValue(
      mockAxiosResponse(
        createApiResponse<UserLoginResponse>({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          expiresInSec: 3600,
          refreshExpiresInSec: 86400,
        })
      )
    );
    mockedAuthApi.getMe.mockResolvedValue(
      mockAxiosResponse(
        createApiResponse<UserMeResponse>({
          id: 1,
          email: 'tester@lumina.ai',
          name: 'Tester',
          status: 'ACTIVE',
        })
      )
    );
  });

  it('수락 성공 시 pendingInvitation을 제거하고 워크스페이스로 이동한다', async () => {
    sessionStorage.setItem('pendingInvitation', 'invite-token');
    mockedWorkspaceApi.acceptInvitation.mockResolvedValue(
      mockAxiosResponse<WorkspaceInviteAcceptResponse>({
        organizationId: 9,
        workspaceId: 42,
      })
    );

    renderPage();
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/orgs/9/workspaces/42');
    });
    expect(sessionStorage.getItem('pendingInvitation')).toBeNull();
  });

  it('이미 멤버 충돌 시 프리뷰 기반으로 워크스페이스로 이동한다', async () => {
    sessionStorage.setItem('pendingInvitation', 'invite-token');
    mockedWorkspaceApi.acceptInvitation.mockRejectedValue(
      createAxiosApiError(409, 'C409', '이미 워크스페이스 멤버입니다.')
    );
    mockedWorkspaceApi.previewInvitation.mockResolvedValue(
      mockAxiosResponse<WorkspaceInvitePreviewResponse>({
        organizationId: 5,
        organizationName: '조직',
        workspaceId: 15,
        workspaceName: '워크스페이스',
        role: 'MEMBER',
        inviterName: '초대자',
        expiresAt: '2026-02-25T00:00:00',
        status: 'VALID',
        invitationMessage: null,
      })
    );

    renderPage();
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/orgs/5/workspaces/15');
    });
    expect(sessionStorage.getItem('pendingInvitation')).toBe('invite-token');
  });

  it('이미 멤버 충돌 후 프리뷰도 실패하면 초대 페이지로 복귀한다', async () => {
    sessionStorage.setItem('pendingInvitation', 'invite-token');
    mockedWorkspaceApi.acceptInvitation.mockRejectedValue(
      createAxiosApiError(409, 'C409', '이미 워크스페이스 멤버입니다.')
    );
    mockedWorkspaceApi.previewInvitation.mockRejectedValue(
      createAxiosApiError(404, 'C404', '초대 링크를 찾을 수 없습니다.')
    );

    renderPage();
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/invitations/accept?token=invite-token');
    });
    expect(sessionStorage.getItem('pendingInvitation')).toBe('invite-token');
  });

  it('만료/잘못된 링크면 초대 페이지로 복귀한다', async () => {
    sessionStorage.setItem('pendingInvitation', 'expired-token');
    mockedWorkspaceApi.acceptInvitation.mockRejectedValue(
      createAxiosApiError(400, 'C400', '만료된 초대 링크입니다.')
    );

    renderPage();
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/invitations/accept?token=expired-token');
    });
    expect(sessionStorage.getItem('pendingInvitation')).toBe('expired-token');
  });

  it('초대 수락 중 일반 오류가 발생하면 대시보드로 이동한다', async () => {
    sessionStorage.setItem('pendingInvitation', 'invite-token');
    mockedWorkspaceApi.acceptInvitation.mockRejectedValue(
      createAxiosApiError(500, 'C500', '서버 오류')
    );

    renderPage();
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
    });
    expect(sessionStorage.getItem('pendingInvitation')).toBe('invite-token');
  });
});
