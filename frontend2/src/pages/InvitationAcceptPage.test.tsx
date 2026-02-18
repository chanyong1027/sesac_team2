import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { InvitationAcceptPage } from './InvitationAcceptPage';
import { workspaceApi } from '@/api/workspace.api';
import type { ErrorResponse, WorkspaceInviteAcceptResponse, WorkspaceInvitePreviewResponse } from '@/types/api.types';

const authState = {
  isAuthenticated: false,
};

vi.mock('@/features/auth/store', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/api/workspace.api', () => ({
  workspaceApi: {
    previewInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
  },
}));

const mockedWorkspaceApi = vi.mocked(workspaceApi);

const mockAxiosResponse = <T,>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} } as InternalAxiosRequestConfig,
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

function renderPage(initialEntry = '/invitations/accept?token=test-token') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/invitations/accept" element={<InvitationAcceptPage />} />
        <Route path="/login" element={<CurrentLocation />} />
        <Route path="/signup" element={<CurrentLocation />} />
        <Route path="/dashboard" element={<CurrentLocation />} />
        <Route path="/workspaces/:workspaceId" element={<CurrentLocation />} />
        <Route path="/orgs/:orgId/workspaces/:workspaceId" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InvitationAcceptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    authState.isAuthenticated = false;
  });

  it('비로그인 사용자는 로그인 이동 시 pendingInvitation을 저장한다', async () => {
    mockedWorkspaceApi.previewInvitation.mockResolvedValue(
      mockAxiosResponse<WorkspaceInvitePreviewResponse>({
        organizationId: 1,
        organizationName: '루미나 조직',
        workspaceId: 101,
        workspaceName: '콘텐츠팀',
        role: 'MEMBER',
        inviterName: '홍길동',
        expiresAt: '2026-02-25T00:00:00',
        status: 'VALID',
        invitationMessage: null,
      })
    );

    renderPage();

    expect(await screen.findByText('루미나 조직에서 초대했습니다')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '로그인하고 참여' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
    expect(sessionStorage.getItem('pendingInvitation')).toBe('test-token');
  });

  it('비로그인 사용자는 회원가입 이동 시 pendingInvitation을 저장한다', async () => {
    mockedWorkspaceApi.previewInvitation.mockResolvedValue(
      mockAxiosResponse<WorkspaceInvitePreviewResponse>({
        organizationId: 1,
        organizationName: '루미나 조직',
        workspaceId: 101,
        workspaceName: '콘텐츠팀',
        role: 'MEMBER',
        inviterName: '홍길동',
        expiresAt: '2026-02-25T00:00:00',
        status: 'VALID',
        invitationMessage: null,
      })
    );

    renderPage();

    expect(await screen.findByText('루미나 조직에서 초대했습니다')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/signup');
    });
    expect(sessionStorage.getItem('pendingInvitation')).toBe('test-token');
  });

  it('로그인 사용자가 수락 성공하면 워크스페이스로 이동한다', async () => {
    authState.isAuthenticated = true;

    mockedWorkspaceApi.previewInvitation.mockResolvedValue(
      mockAxiosResponse<WorkspaceInvitePreviewResponse>({
        organizationId: 2,
        organizationName: '운영조직',
        workspaceId: 30,
        workspaceName: 'ops-ws',
        role: 'ADMIN',
        inviterName: '관리자',
        expiresAt: '2026-02-25T00:00:00',
        status: 'VALID',
        invitationMessage: null,
      })
    );
    mockedWorkspaceApi.acceptInvitation.mockResolvedValue(
      mockAxiosResponse<WorkspaceInviteAcceptResponse>({
        organizationId: 2,
        workspaceId: 30,
      })
    );

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '팀 참여하기' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/orgs/2/workspaces/30');
    });
  });

  it('프리뷰 토큰이 유효하지 않으면 invalid 상태를 보여준다', async () => {
    mockedWorkspaceApi.previewInvitation.mockRejectedValue(
      createAxiosApiError(404, 'C404', '초대 링크를 찾을 수 없습니다.')
    );

    renderPage();

    expect(await screen.findByText('유효하지 않은 초대 링크입니다')).toBeInTheDocument();
  });

  it('프리뷰 토큰이 만료되면 만료 상태를 보여준다', async () => {
    mockedWorkspaceApi.previewInvitation.mockRejectedValue(
      createAxiosApiError(400, 'C400', '만료된 초대 링크입니다.')
    );

    renderPage();

    expect(await screen.findByText('초대 링크가 만료되었습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '대시보드로 이동' })).toBeInTheDocument();
  });

  it('토큰 없이 진입하면 invalid 상태를 보여준다', async () => {
    renderPage('/invitations/accept');

    expect(await screen.findByText('유효하지 않은 초대 링크입니다')).toBeInTheDocument();
    expect(mockedWorkspaceApi.previewInvitation).not.toHaveBeenCalled();
  });

  it('이미 멤버 충돌이면 워크스페이스 이동 버튼을 제공한다', async () => {
    authState.isAuthenticated = true;

    mockedWorkspaceApi.previewInvitation.mockResolvedValue(
      mockAxiosResponse<WorkspaceInvitePreviewResponse>({
        organizationId: 4,
        organizationName: '마케팅',
        workspaceId: 77,
        workspaceName: 'growth',
        role: 'MEMBER',
        inviterName: '초대자',
        expiresAt: '2026-02-25T00:00:00',
        status: 'VALID',
        invitationMessage: null,
      })
    );
    mockedWorkspaceApi.acceptInvitation.mockRejectedValue(
      createAxiosApiError(409, 'C409', '이미 워크스페이스 멤버입니다.')
    );

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '팀 참여하기' }));

    expect(await screen.findByText('이미 참여 중인 팀입니다')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '워크스페이스로 이동' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/orgs/4/workspaces/77');
    });
  });

  it('다른 조직 충돌이면 대시보드 이동 버튼을 제공한다', async () => {
    authState.isAuthenticated = true;

    mockedWorkspaceApi.previewInvitation.mockResolvedValue(
      mockAxiosResponse<WorkspaceInvitePreviewResponse>({
        organizationId: 4,
        organizationName: '마케팅',
        workspaceId: 77,
        workspaceName: 'growth',
        role: 'MEMBER',
        inviterName: '초대자',
        expiresAt: '2026-02-25T00:00:00',
        status: 'VALID',
        invitationMessage: null,
      })
    );
    mockedWorkspaceApi.acceptInvitation.mockRejectedValue(
      createAxiosApiError(409, 'C409', '이미 다른 조직에 속해 있어 초대를 수락할 수 없습니다.')
    );

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '팀 참여하기' }));

    expect(await screen.findByText('다른 조직에 이미 소속되어 있습니다')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '대시보드로 이동' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
    });
  });
});
