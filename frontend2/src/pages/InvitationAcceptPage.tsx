import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { workspaceApi } from '@/api/workspace.api';
import { useAuthStore } from '@/features/auth/store';
import type { WorkspaceInviteAcceptResponse, WorkspaceInvitePreviewResponse, ErrorResponse } from '@/types/api.types';

type InvitationPageState =
  | 'loading-preview'
  | 'preview-ready'
  | 'accepting'
  | 'success-redirect'
  | 'error-invalid'
  | 'error-expired'
  | 'error-conflict-already-member'
  | 'error-conflict-other-org';

interface ParsedError {
  status: number | null;
  code: string | null;
  message: string;
}

const DEFAULT_ERROR_MESSAGE = '초대 링크 처리 중 오류가 발생했습니다.';
// TODO: 백엔드가 초대 관련 서브코드(예: INVITATION_EXPIRED)를 제공하면 메시지 매칭을 제거한다.
const INVITATION_ERROR_EXPIRED = '만료된 초대 링크';
const INVITATION_ERROR_ALREADY_MEMBER = '이미 워크스페이스 멤버';
const INVITATION_ERROR_OTHER_ORG = '이미 다른 조직에 속해';

export function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const [pageState, setPageState] = useState<InvitationPageState>('loading-preview');
  const [preview, setPreview] = useState<WorkspaceInvitePreviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>(DEFAULT_ERROR_MESSAGE);

  useEffect(() => {
    const loadPreview = async () => {
      if (!token) {
        setErrorMessage('유효하지 않은 초대 링크입니다.');
        setPageState('error-invalid');
        return;
      }

      setPageState('loading-preview');
      try {
        const response = await workspaceApi.previewInvitation(token);
        setPreview(unwrapData<WorkspaceInvitePreviewResponse>(response.data));
        setPageState('preview-ready');
      } catch (error) {
        const parsed = parseError(error);
        setErrorMessage(parsed.message);
        setPageState(mapPreviewErrorToState(parsed));
      }
    };

    loadPreview();
  }, [token]);

  const moveToWorkspace = (organizationId: number | null, workspaceId: number | null) => {
    const resolvedWorkspaceId = Number(workspaceId);
    if (!Number.isFinite(resolvedWorkspaceId) || resolvedWorkspaceId <= 0) {
      navigate('/dashboard');
      return;
    }

    if (organizationId && Number.isFinite(Number(organizationId))) {
      navigate(`/orgs/${organizationId}/workspaces/${resolvedWorkspaceId}`);
      return;
    }

    navigate(`/workspaces/${resolvedWorkspaceId}`);
  };

  const handleAccept = async () => {
    if (!token) {
      setErrorMessage('유효하지 않은 초대 링크입니다.');
      setPageState('error-invalid');
      return;
    }

    if (!isAuthenticated) {
      sessionStorage.setItem('pendingInvitation', token);
      setPageState('preview-ready');
      return;
    }

    setPageState('accepting');
    try {
      const response = await workspaceApi.acceptInvitation({ token });
      const payload = unwrapData<WorkspaceInviteAcceptResponse>(response.data);
      setPageState('success-redirect');
      moveToWorkspace(payload.organizationId ?? preview?.organizationId ?? null, payload.workspaceId ?? preview?.workspaceId ?? null);
    } catch (error) {
      const parsed = parseError(error);
      setErrorMessage(parsed.message);
      setPageState(mapAcceptErrorToState(parsed));
    }
  };

  const handleLogin = () => {
    if (token) {
      sessionStorage.setItem('pendingInvitation', token);
    }
    navigate('/login');
  };

  const handleSignup = () => {
    if (token) {
      sessionStorage.setItem('pendingInvitation', token);
    }
    navigate('/signup');
  };

  if (pageState === 'loading-preview' || pageState === 'accepting' || pageState === 'success-redirect') {
    return (
      <CenterPanel
        title={pageState === 'accepting' ? '초대를 수락하는 중...' : '초대 정보를 확인하는 중...'}
        description={pageState === 'accepting' ? '잠시만 기다려주세요.' : '팀 정보를 불러오고 있습니다.'}
        loading
      />
    );
  }

  if (pageState === 'preview-ready' && preview) {
    return (
      <CenterPanel
        title={`${preview.organizationName}에서 초대했습니다`}
        description="초대 정보를 확인하고 팀에 참여하세요."
      >
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-left text-sm text-[var(--foreground)]">
          <InfoRow label="조직" value={preview.organizationName} />
          <InfoRow label="워크스페이스" value={preview.workspaceName} />
          <InfoRow label="역할" value={preview.role} />
          <InfoRow label="초대한 사람" value={preview.inviterName} />
          <InfoRow label="만료 시각" value={formatDateTime(preview.expiresAt)} />
        </div>

        {isAuthenticated ? (
          <button
            onClick={handleAccept}
            className="mt-6 w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-medium text-white hover:bg-blue-600"
          >
            팀 참여하기
          </button>
        ) : (
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleLogin}
              className="flex-1 rounded-lg bg-blue-500 px-4 py-3 text-sm font-medium text-white hover:bg-blue-600"
            >
              로그인하고 참여
            </button>
            <button
              onClick={handleSignup}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"
            >
              회원가입
            </button>
          </div>
        )}
      </CenterPanel>
    );
  }

  if (pageState === 'error-conflict-already-member') {
    return (
      <CenterPanel
        title="이미 참여 중인 팀입니다"
        description={errorMessage}
      >
        <button
          onClick={() => moveToWorkspace(preview?.organizationId ?? null, preview?.workspaceId ?? null)}
          className="mt-6 w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-medium text-white hover:bg-blue-600"
        >
          워크스페이스로 이동
        </button>
      </CenterPanel>
    );
  }

  if (pageState === 'error-conflict-other-org') {
    return (
      <CenterPanel
        title="다른 조직에 이미 소속되어 있습니다"
        description={errorMessage}
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-medium text-white hover:bg-blue-600"
        >
          대시보드로 이동
        </button>
      </CenterPanel>
    );
  }

  if (pageState === 'error-expired') {
    return (
      <CenterPanel
        title="초대 링크가 만료되었습니다"
        description={`${errorMessage} 초대한 사용자에게 재초대를 요청해주세요.`}
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-medium text-white hover:bg-blue-600"
        >
          대시보드로 이동
        </button>
      </CenterPanel>
    );
  }

  return (
    <CenterPanel
      title="유효하지 않은 초대 링크입니다"
      description={errorMessage}
    >
      <button
        onClick={() => navigate('/dashboard')}
        className="mt-6 w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-medium text-white hover:bg-blue-600"
      >
        대시보드로 이동
      </button>
    </CenterPanel>
  );
}

function CenterPanel({
  title,
  description,
  loading = false,
  children,
}: {
  title: string;
  description: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-center shadow-sm">
        {loading ? (
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
        ) : null}
        <h1 className="text-xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-right text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function parseError(error: unknown): ParsedError {
  if (!axios.isAxiosError(error)) {
    return { status: null, code: null, message: DEFAULT_ERROR_MESSAGE };
  }

  const axiosError = error as AxiosError<ErrorResponse>;
  const message = axiosError.response?.data?.message ?? axiosError.message ?? DEFAULT_ERROR_MESSAGE;
  const code = axiosError.response?.data?.code ?? null;
  const status = axiosError.response?.status ?? null;

  return { status, code, message };
}

function mapPreviewErrorToState(error: ParsedError): InvitationPageState {
  if (error.code === 'C400' && error.message.includes(INVITATION_ERROR_EXPIRED)) {
    return 'error-expired';
  }
  return 'error-invalid';
}

function mapAcceptErrorToState(error: ParsedError): InvitationPageState {
  if (error.code === 'C409' && error.message.includes(INVITATION_ERROR_ALREADY_MEMBER)) {
    return 'error-conflict-already-member';
  }
  if (error.code === 'C409' && error.message.includes(INVITATION_ERROR_OTHER_ORG)) {
    return 'error-conflict-other-org';
  }
  if (error.code === 'C400' && error.message.includes(INVITATION_ERROR_EXPIRED)) {
    return 'error-expired';
  }
  if (error.code === 'C404') {
    return 'error-invalid';
  }
  if (error.code === 'C401' || error.status === 401) {
    return 'error-invalid';
  }
  return 'error-invalid';
}
