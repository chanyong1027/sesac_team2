import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios, { type AxiosError } from 'axios';
import { authApi } from '@/api/auth.api';
import { workspaceApi } from '@/api/workspace.api';
import { useAuthStore } from '@/features/auth/store';
import type { ErrorResponse, WorkspaceInviteAcceptResponse, WorkspaceInvitePreviewResponse } from '@/types/api.types';

const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface ParsedApiError {
  code: string | null;
  status: number | null;
  message: string;
}

const DEFAULT_INVITATION_ERROR_MESSAGE = '초대 처리 중 오류가 발생했습니다.';
const INVITATION_ERROR_ALREADY_MEMBER = '이미 워크스페이스 멤버';
const INVITATION_ERROR_EXPIRED = '만료된 초대 링크';

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function parseApiError(error: unknown): ParsedApiError {
  if (!axios.isAxiosError(error)) {
    return {
      code: null,
      status: null,
      message: DEFAULT_INVITATION_ERROR_MESSAGE,
    };
  }

  const axiosError = error as AxiosError<ErrorResponse>;
  return {
    code: axiosError.response?.data?.code ?? null,
    status: axiosError.response?.status ?? null,
    message: axiosError.response?.data?.message ?? axiosError.message ?? DEFAULT_INVITATION_ERROR_MESSAGE,
  };
}

function isAlreadyMemberInvitationError(error: ParsedApiError): boolean {
  return error.code === 'C409' && error.message.includes(INVITATION_ERROR_ALREADY_MEMBER);
}

function isExpiredInvitationError(error: ParsedApiError): boolean {
  return error.code === 'C400' && error.message.includes(INVITATION_ERROR_EXPIRED);
}

function resolveWorkspacePath(organizationId: number | null | undefined, workspaceId: number | null | undefined): string {
  const resolvedWorkspaceId = Number(workspaceId);
  if (!Number.isFinite(resolvedWorkspaceId) || resolvedWorkspaceId <= 0) {
    return '/dashboard';
  }

  const resolvedOrganizationId = Number(organizationId);
  if (Number.isFinite(resolvedOrganizationId) && resolvedOrganizationId > 0) {
    return `/orgs/${resolvedOrganizationId}/workspaces/${resolvedWorkspaceId}`;
  }

  return `/workspaces/${resolvedWorkspaceId}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AURORA BACKGROUND COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function AuroraBackground() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTime(t => t + 0.015), 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep ocean base */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(135deg,
              oklch(0.06 0.03 220) 0%,
              oklch(0.04 0.025 200) 50%,
              oklch(0.03 0.02 180) 100%
            )
          `
        }}
      />

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Primary aurora glow */}
      <div
        className="absolute w-[150%] h-[120%] -top-[20%] -right-[25%]"
        style={{
          background: `
            radial-gradient(ellipse 50% 70% at ${60 + Math.sin(time) * 8}% ${40 + Math.cos(time * 0.7) * 10}%,
              oklch(0.45 0.18 175 / 0.35) 0%,
              transparent 55%
            ),
            radial-gradient(ellipse 40% 55% at ${70 + Math.cos(time * 0.8) * 6}% ${55 + Math.sin(time * 0.5) * 8}%,
              oklch(0.4 0.15 195 / 0.3) 0%,
              transparent 50%
            ),
            radial-gradient(ellipse 35% 50% at ${50 + Math.sin(time * 1.1) * 5}% ${70 + Math.cos(time) * 6}%,
              oklch(0.5 0.2 160 / 0.25) 0%,
              transparent 45%
            )
          `,
          filter: 'blur(50px)',
          transform: `translateY(${Math.sin(time * 0.4) * 15}px)`,
          transition: 'transform 0.4s ease-out',
        }}
      />

      {/* Aurora SVG streaks */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="login-aurora-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.65 0.18 175 / 0)" />
            <stop offset="30%" stopColor="oklch(0.65 0.18 175 / 0.5)" />
            <stop offset="70%" stopColor="oklch(0.55 0.15 190 / 0.4)" />
            <stop offset="100%" stopColor="oklch(0.55 0.15 190 / 0)" />
          </linearGradient>
          <filter id="login-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <path
          d={`M${-50 + Math.sin(time) * 20},${200 + Math.cos(time * 0.6) * 30}
              Q${200 + Math.cos(time * 0.7) * 40},${150 + Math.sin(time * 0.5) * 25}
              ${450 + Math.sin(time * 0.4) * 30},${180 + Math.cos(time * 0.8) * 20}
              T${800 + Math.cos(time * 0.5) * 25},${120 + Math.sin(time * 0.7) * 15}`}
          fill="none"
          stroke="url(#login-aurora-1)"
          strokeWidth="3"
          filter="url(#login-glow)"
          opacity="0.6"
        />
      </svg>

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(oklch(1 0 0 / 0.1) 1px, transparent 1px),
            linear-gradient(90deg, oklch(1 0 0 / 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const state = (location.state ?? null) as null | {
    from?: { pathname?: string };
    signupSuccess?: boolean;
    signupName?: string;
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (response) => {
      const { accessToken, refreshToken } = response.data.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      const userResponse = await authApi.getMe();
      setAuth(userResponse.data.data, accessToken, refreshToken);

      const pendingToken = sessionStorage.getItem('pendingInvitation');
      if (pendingToken) {
        try {
          const acceptResponse = await workspaceApi.acceptInvitation({
            token: pendingToken,
          });
          const acceptPayload = unwrapData<WorkspaceInviteAcceptResponse>(acceptResponse.data);
          sessionStorage.removeItem('pendingInvitation');
          navigate(resolveWorkspacePath(acceptPayload.organizationId, acceptPayload.workspaceId));
          return;
        } catch (error) {
          const parsedError = parseApiError(error);

          if (isAlreadyMemberInvitationError(parsedError)) {
            try {
              const previewResponse = await workspaceApi.previewInvitation(pendingToken);
              const previewPayload = unwrapData<WorkspaceInvitePreviewResponse>(previewResponse.data);
              sessionStorage.removeItem('pendingInvitation');
              navigate(resolveWorkspacePath(previewPayload.organizationId, previewPayload.workspaceId));
              return;
            } catch {
              sessionStorage.removeItem('pendingInvitation');
              navigate(`/invitations/accept?token=${encodeURIComponent(pendingToken)}`);
              return;
            }
          }

          const isInvalidInvitation =
            parsedError.code === 'C404'
            || isExpiredInvitationError(parsedError);

          if (isInvalidInvitation) {
            navigate(`/invitations/accept?token=${encodeURIComponent(pendingToken)}`);
            return;
          }

          if (parsedError.code === 'C401' || parsedError.status === 401) {
            navigate('/login');
            return;
          }

          navigate('/dashboard');
          return;
        }
      }

      const from = state?.from?.pathname || '/dashboard';
      navigate(from);
    },
  });

  // 이미 로그인된 사용자는 대시보드로 리다이렉트
  // 로그인 성공 직후 초대 처리 중일 때는 mutation이 pending 상태여서 자동 리다이렉트를 막는다.
  useEffect(() => {
    if (isAuthenticated && !loginMutation.isPending) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loginMutation.isPending, navigate]);

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'oklch(0.03 0.02 200)' }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;500&family=JetBrains+Mono:wght@300;400;500&display=swap');
      `}</style>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* LEFT SIDE - Form area */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between p-8 lg:p-16 relative z-10">
        {/* Header */}
        <div>
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-emerald-500 opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-sm font-semibold"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: 'oklch(0.03 0.02 200)' }}
                >
                  L
                </span>
              </div>
            </div>
            <span
              className="text-lg tracking-tight"
              style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 400 }}
            >
              <span className="text-white/90">Lumina</span>
              <span className="text-cyan-400">Ops</span>
            </span>
          </Link>

          {state?.signupSuccess ? (
            <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm text-emerald-200">
                {state?.signupName ? `${state.signupName}님, ` : ''}
                회원가입이 완료되었습니다. 로그인 해주세요.
              </p>
            </div>
          ) : null}
        </div>

        {/* Form section - vertically centered */}
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-md">
            {/* Headline */}
            <div className="mb-12">
              <span
                className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/70"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Welcome back
              </span>
              <h1
                className="mt-3 text-4xl lg:text-5xl font-light tracking-tight text-white/95"
                style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
              >
                로그인
              </h1>
              <p className="mt-4 text-white/40 leading-relaxed">
                LuminaOps 계정으로 로그인하세요
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Email field */}
              <div className="relative">
                <label
                  className="block text-[11px] uppercase tracking-[0.15em] text-white/50 mb-3"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  이메일
                </label>
                <div className="relative">
                  <input
                    {...register('email')}
                    type="email"
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full px-0 py-4 bg-transparent border-0 border-b text-white placeholder-white/20 focus:outline-none transition-colors text-lg"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      borderColor: focusedField === 'email' ? 'oklch(0.7 0.15 180)' : 'oklch(1 0 0 / 0.1)',
                    }}
                    placeholder="email@company.com"
                  />
                  {/* Focus indicator line */}
                  <div
                    className="absolute bottom-0 left-0 h-px transition-all duration-300"
                    style={{
                      width: focusedField === 'email' ? '100%' : '0%',
                      background: 'linear-gradient(to right, oklch(0.7 0.15 175), oklch(0.65 0.18 195))',
                    }}
                  />
                </div>
                {errors.email && (
                  <p
                    className="mt-2 text-[12px] text-red-400"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div className="relative">
                <label
                  className="block text-[11px] uppercase tracking-[0.15em] text-white/50 mb-3"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type="password"
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full px-0 py-4 bg-transparent border-0 border-b text-white placeholder-white/20 focus:outline-none transition-colors text-lg"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      borderColor: focusedField === 'password' ? 'oklch(0.7 0.15 180)' : 'oklch(1 0 0 / 0.1)',
                    }}
                    placeholder="••••••••"
                  />
                  <div
                    className="absolute bottom-0 left-0 h-px transition-all duration-300"
                    style={{
                      width: focusedField === 'password' ? '100%' : '0%',
                      background: 'linear-gradient(to right, oklch(0.7 0.15 175), oklch(0.65 0.18 195))',
                    }}
                  />
                </div>
                {errors.password && (
                  <p
                    className="mt-2 text-[12px] text-red-400"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="group relative w-full py-5 overflow-hidden transition-all duration-300 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.7 0.15 180), oklch(0.6 0.18 160))',
                  }}
                >
                  {/* Hover overlay */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.75 0.17 175), oklch(0.65 0.2 155))',
                    }}
                  />
                  <span
                    className="relative flex items-center justify-center gap-3 text-slate-950 font-medium tracking-wide"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                        로그인 중...
                      </>
                    ) : (
                      <>
                        로그인
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </>
                    )}
                  </span>
                </button>
              </div>

              {/* Error message */}
              {loginMutation.isError && (
                <div
                  className="p-4 border border-red-500/20 bg-red-500/5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <p className="text-[12px] text-red-400">
                    로그인에 실패했습니다. 이메일과 비밀번호를 확인하세요.
                  </p>
                </div>
              )}
            </form>

            {/* Signup link */}
            <p className="mt-10 text-white/40 text-sm">
              계정이 없으신가요?{' '}
              <Link
                to="/signup"
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                회원가입
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-white/30">
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            © 2024 LuminaOps
          </span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white/50 transition-colors">이용약관</a>
            <a href="#" className="hover:text-white/50 transition-colors">개인정보처리방침</a>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* RIGHT SIDE - Aurora visual */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block lg:w-[55%] relative overflow-hidden">
        <AuroraBackground />

        {/* Content overlay */}
        <div className="absolute inset-0 flex items-center justify-center p-16">
          <div className="text-center max-w-lg">
            {/* Decorative element */}
            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-8"
                    style={{
                      background: `oklch(${0.5 + i * 0.08} 0.15 ${175 + i * 5})`,
                      opacity: 0.4 + i * 0.1,
                      transform: `scaleY(${0.5 + i * 0.15})`,
                    }}
                  />
                ))}
              </div>
            </div>

            <h2
              className="text-3xl lg:text-4xl font-light tracking-tight text-white/80"
              style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
            >
              LLM 운영의
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                새로운 기준
              </span>
            </h2>

            <p className="mt-6 text-white/40 leading-relaxed">
              문서 업로드부터 API 배포까지,
              <br />
              하나의 플랫폼에서 모든 것을 관리하세요.
            </p>

            {/* Stats */}
            <div className="mt-12 grid grid-cols-3 gap-8">
              {[
                { value: '99%', label: 'Uptime' },
                { value: '47ms', label: 'Latency' },
                { value: '256bit', label: 'Encryption' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div
                    className="text-2xl text-white/90"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="mt-1 text-[10px] uppercase tracking-[0.15em] text-white/40"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Edge accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-px"
          style={{
            background: 'linear-gradient(to bottom, transparent, oklch(0.6 0.15 180 / 0.3), transparent)',
          }}
        />
      </div>
    </div>
  );
}
