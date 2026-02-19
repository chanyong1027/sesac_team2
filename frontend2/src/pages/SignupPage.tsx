import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/features/auth/store';

const signupEmailSchema = z.string().email('유효한 이메일을 입력하세요');

const signupSchema = z
  .object({
    email: signupEmailSchema,
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
    confirmPassword: z.string(),
    name: z.string().min(2, '이름을 입력하세요'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;
type EmailCheckStatus = 'idle' | 'checking' | 'available' | 'duplicate' | 'error';
type ToastTone = 'success' | 'error' | 'info';

function resolveApiError(
  error: unknown,
  fallbackMessage = '회원가입에 실패했습니다. 다시 시도해주세요.',
): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  if (!axios.isAxiosError(error)) {
    return {
      message: fallbackMessage,
      fieldErrors: {},
    };
  }

  const payload = error.response?.data as
    | {
        message?: string;
        fieldErrors?: unknown;
      }
    | undefined;

  const fieldErrors: Record<string, string> = {};
  const rawFieldErrors = payload?.fieldErrors;

  if (Array.isArray(rawFieldErrors)) {
    rawFieldErrors.forEach((item) => {
      if (
        item &&
        typeof item === 'object' &&
        'field' in item &&
        'message' in item &&
        typeof item.field === 'string' &&
        typeof item.message === 'string'
      ) {
        fieldErrors[item.field] = item.message;
      }
    });
  } else if (rawFieldErrors && typeof rawFieldErrors === 'object') {
    Object.entries(rawFieldErrors as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === 'string') {
        fieldErrors[key] = value;
      }
    });
  }

  return {
    message: payload?.message ?? fallbackMessage,
    fieldErrors,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AURORA BACKGROUND COMPONENT - Emerald variant for signup
// ═══════════════════════════════════════════════════════════════════════════════

function EmeraldAuroraBackground() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTime(t => t + 0.012), 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep ocean base with emerald tint */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(155deg,
              oklch(0.05 0.025 180) 0%,
              oklch(0.04 0.03 160) 50%,
              oklch(0.03 0.02 175) 100%
            )
          `
        }}
      />

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Primary aurora glow - emerald focused */}
      <div
        className="absolute w-[160%] h-[130%] -top-[30%] -left-[30%]"
        style={{
          background: `
            radial-gradient(ellipse 45% 60% at ${35 + Math.sin(time) * 6}% ${45 + Math.cos(time * 0.6) * 8}%,
              oklch(0.5 0.2 160 / 0.35) 0%,
              transparent 50%
            ),
            radial-gradient(ellipse 35% 50% at ${25 + Math.cos(time * 0.7) * 5}% ${60 + Math.sin(time * 0.4) * 7}%,
              oklch(0.45 0.18 175 / 0.3) 0%,
              transparent 45%
            ),
            radial-gradient(ellipse 40% 45% at ${50 + Math.sin(time * 0.9) * 4}% ${35 + Math.cos(time * 0.8) * 5}%,
              oklch(0.55 0.22 150 / 0.25) 0%,
              transparent 40%
            )
          `,
          filter: 'blur(55px)',
          transform: `translateX(${Math.cos(time * 0.3) * 12}px)`,
          transition: 'transform 0.5s ease-out',
        }}
      />

      {/* Aurora SVG streaks */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="signup-aurora-1" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.6 0.2 160 / 0)" />
            <stop offset="25%" stopColor="oklch(0.6 0.2 160 / 0.45)" />
            <stop offset="60%" stopColor="oklch(0.55 0.18 175 / 0.35)" />
            <stop offset="100%" stopColor="oklch(0.55 0.18 175 / 0)" />
          </linearGradient>
          <linearGradient id="signup-aurora-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.55 0.15 180 / 0)" />
            <stop offset="40%" stopColor="oklch(0.55 0.15 180 / 0.35)" />
            <stop offset="100%" stopColor="oklch(0.5 0.18 165 / 0)" />
          </linearGradient>
          <filter id="signup-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <path
          d={`M${50 + Math.cos(time) * 15},${500 + Math.sin(time * 0.5) * 25}
              Q${250 + Math.sin(time * 0.6) * 35},${400 + Math.cos(time * 0.4) * 30}
              ${500 + Math.cos(time * 0.5) * 25},${300 + Math.sin(time * 0.7) * 20}
              T${850 + Math.sin(time * 0.4) * 20},${150 + Math.cos(time * 0.6) * 15}`}
          fill="none"
          stroke="url(#signup-aurora-1)"
          strokeWidth="2.5"
          filter="url(#signup-glow)"
          opacity="0.7"
        />
        <path
          d={`M${-30 + Math.sin(time * 0.8) * 18},${350 + Math.cos(time * 0.5) * 20}
              Q${180 + Math.cos(time * 0.6) * 30},${280 + Math.sin(time * 0.7) * 25}
              ${400 + Math.sin(time * 0.4) * 20},${220 + Math.cos(time * 0.5) * 18}
              T${750 + Math.cos(time * 0.6) * 15},${100 + Math.sin(time * 0.8) * 12}`}
          fill="none"
          stroke="url(#signup-aurora-2)"
          strokeWidth="2"
          filter="url(#signup-glow)"
          opacity="0.5"
        />
      </svg>

      {/* Geometric accent - floating shapes */}
      <div
        className="absolute top-[15%] left-[10%] w-32 h-32 opacity-10"
        style={{
          background: 'linear-gradient(135deg, oklch(0.6 0.2 160), transparent)',
          transform: `rotate(${45 + Math.sin(time * 0.3) * 5}deg)`,
          transition: 'transform 0.5s ease-out',
        }}
      />
      <div
        className="absolute bottom-[20%] left-[15%] w-20 h-20 opacity-8"
        style={{
          background: 'linear-gradient(45deg, oklch(0.55 0.18 175), transparent)',
          borderRadius: '50%',
          filter: 'blur(20px)',
        }}
      />

      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `radial-gradient(oklch(1 0 0) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT FIELD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface FormInputProps {
  label: string;
  type: string;
  placeholder: string;
  error?: string;
  helperText?: string;
  helperTone?: 'default' | 'success' | 'error' | 'info';
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onValueBlur?: (value: string) => void;
  onValueChange?: (value: string) => void;
  inputProps: UseFormRegisterReturn;
}

function FormInput({
  label,
  type,
  placeholder,
  error,
  helperText,
  helperTone = 'default',
  isFocused,
  onFocus,
  onBlur,
  onValueBlur,
  onValueChange,
  inputProps,
}: FormInputProps) {
  const helperTextClassName = {
    default: 'text-white/50',
    success: 'text-emerald-400',
    error: 'text-red-400',
    info: 'text-cyan-300',
  }[helperTone];

  return (
    <div className="relative">
      <label
        className="block text-[11px] uppercase tracking-[0.15em] text-white/50 mb-3"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          {...inputProps}
          type={type}
          onFocus={onFocus}
          onBlur={(event) => {
            inputProps.onBlur(event);
            onBlur();
            onValueBlur?.(event.target.value);
          }}
          onChange={(event) => {
            inputProps.onChange(event);
            onValueChange?.(event.target.value);
          }}
          className="w-full px-0 py-3.5 bg-transparent border-0 border-b text-white placeholder-white/20 focus:outline-none transition-colors"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            borderColor: isFocused ? 'oklch(0.65 0.18 160)' : 'oklch(1 0 0 / 0.1)',
          }}
          placeholder={placeholder}
        />
        {/* Focus indicator line */}
        <div
          className="absolute bottom-0 left-0 h-px transition-all duration-300"
          style={{
            width: isFocused ? '100%' : '0%',
            background: 'linear-gradient(to right, oklch(0.65 0.2 160), oklch(0.6 0.18 180))',
          }}
        />
      </div>
      {error && (
        <p
          className="mt-2 text-[12px] text-red-400"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {error}
        </p>
      )}
      {!error && helperText && (
        <p
          className={`mt-2 text-[12px] ${helperTextClassName}`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          aria-live="polite"
          aria-atomic="true"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SignupPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState('');
  const [emailCheckStatus, setEmailCheckStatus] = useState<EmailCheckStatus>('idle');
  const [emailCheckMessage, setEmailCheckMessage] = useState<string | null>(null);
  const [lastCheckedEmail, setLastCheckedEmail] = useState<string | null>(null);
  const [signupErrorMessage, setSignupErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<ToastTone>('info');
  const toastTimerRef = useRef<number | null>(null);
  const navTimerRef = useRef<number | null>(null);
  const emailCheckAbortRef = useRef<AbortController | null>(null);

  // 이미 로그인된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });
  const normalizedWatchedEmail = currentEmail.trim();
  const isEmailCheckPassed =
    normalizedWatchedEmail.length > 0 &&
    emailCheckStatus === 'available' &&
    lastCheckedEmail === normalizedWatchedEmail;

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
      }
      emailCheckAbortRef.current?.abort();
    };
  }, []);

  const showToast = (message: string, tone: ToastTone) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastTone(tone);
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2500);
  };

  const handleEmailChange = (value: string) => {
    setCurrentEmail(value);
    const normalizedEmail = value.trim();
    setSignupErrorMessage(null);

    if (normalizedEmail !== lastCheckedEmail) {
      emailCheckAbortRef.current?.abort();
      emailCheckAbortRef.current = null;
      setEmailCheckStatus('idle');
      setEmailCheckMessage(null);
      setLastCheckedEmail(null);
      if (errors.email?.type === 'manual') {
        clearErrors('email');
      }
    }
  };

  const handleEmailBlur = async (value: string) => {
    setCurrentEmail(value);
    const normalizedEmail = value.trim();

    if (!normalizedEmail || !signupEmailSchema.safeParse(normalizedEmail).success) {
      emailCheckAbortRef.current?.abort();
      emailCheckAbortRef.current = null;
      setEmailCheckStatus('idle');
      setEmailCheckMessage(null);
      setLastCheckedEmail(null);
      return;
    }

    if (lastCheckedEmail === normalizedEmail && emailCheckStatus !== 'error') {
      return;
    }

    setEmailCheckStatus('checking');
    setEmailCheckMessage('이메일 중복 확인 중입니다...');
    emailCheckAbortRef.current?.abort();

    const controller = new AbortController();
    emailCheckAbortRef.current = controller;

    try {
      const response = await authApi.checkEmailAvailability(normalizedEmail, {
        signal: controller.signal,
      });
      const availability = response.data.data;

      if (emailCheckAbortRef.current !== controller) {
        return;
      }

      setLastCheckedEmail(normalizedEmail);
      setEmailCheckStatus(availability.available ? 'available' : 'duplicate');
      setEmailCheckMessage(availability.message);

      if (availability.available) {
        clearErrors('email');
      } else {
        setError('email', {
          type: 'manual',
          message: availability.message,
        });
      }
    } catch (error) {
      if ((axios.isAxiosError(error) && error.code === 'ERR_CANCELED')
        || (error instanceof DOMException && error.name === 'AbortError')) {
        return;
      }

      const resolved = resolveApiError(error, '이메일 중복 확인 중 오류가 발생했습니다. 다시 시도해주세요.');
      setEmailCheckStatus('error');
      setEmailCheckMessage(resolved.message);
      setLastCheckedEmail(null);
    } finally {
      if (emailCheckAbortRef.current === controller) {
        emailCheckAbortRef.current = null;
      }
    }
  };

  const signupMutation = useMutation({
    mutationFn: (data: SignupFormData) =>
      authApi.signup({
        email: data.email.trim(),
        password: data.password,
        name: data.name,
      }),
    onSuccess: () => {
      setSignupErrorMessage(null);
      showToast('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.', 'success');
      if (navTimerRef.current !== null) {
        window.clearTimeout(navTimerRef.current);
      }
      navTimerRef.current = window.setTimeout(() => {
        navTimerRef.current = null;
        navigate('/login');
      }, 900);
    },
    onError: (error) => {
      const resolved = resolveApiError(error);
      setSignupErrorMessage(resolved.message);

      Object.entries(resolved.fieldErrors).forEach(([field, message]) => {
        if (field === 'email' || field === 'password' || field === 'name' || field === 'confirmPassword') {
          setError(field, { type: 'manual', message });
        }
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    setSignupErrorMessage(null);

    if (!isEmailCheckPassed) {
      const message =
        emailCheckStatus === 'checking'
          ? '이메일 중복 확인이 완료될 때까지 기다려주세요.'
          : '이메일 중복 확인을 완료해주세요.';
      setEmailCheckStatus('error');
      setEmailCheckMessage(message);
      setError('email', { type: 'manual', message });
      return;
    }

    signupMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'oklch(0.03 0.02 180)' }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;500&family=JetBrains+Mono:wght@300;400;500&display=swap');
      `}</style>

      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 border backdrop-blur-sm ${
            toastTone === 'success'
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
              : toastTone === 'error'
                ? 'border-red-400/40 bg-red-500/10 text-red-200'
                : 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
          }`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          role={toastTone === 'error' ? 'alert' : 'status'}
          aria-live={toastTone === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          <p className="text-[12px]">{toastMessage}</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* LEFT SIDE - Aurora visual (reversed from login) */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block lg:w-[50%] relative overflow-hidden">
        <EmeraldAuroraBackground />

        {/* Content overlay */}
        <div className="absolute inset-0 flex items-center p-16">
          <div className="max-w-lg">
            {/* Large decorative number */}
            <div
              className="text-[180px] font-extralight leading-none text-white/[0.03] select-none"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              01
            </div>

            {/* Headline - left aligned for editorial feel */}
            <div className="relative -mt-24">
              <h2
                className="text-4xl lg:text-5xl font-light tracking-tight text-white/85"
                style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
              >
                AI 도입의
                <br />
                <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  첫 걸음
                </span>
              </h2>

              <p className="mt-8 text-white/40 leading-relaxed max-w-sm">
                LuminaOps와 함께라면 복잡한 LLM 인프라 구축 없이
                바로 AI 서비스를 시작할 수 있습니다.
              </p>

              {/* Feature list */}
              <ul className="mt-12 space-y-4">
                {[
                  '신용카드 없이 무료 시작',
                  '5분 만에 첫 API 호출',
                  '엔터프라이즈급 보안',
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-4">
                    <span
                      className="flex items-center justify-center w-6 h-6 text-[10px]"
                      style={{
                        background: 'linear-gradient(135deg, oklch(0.6 0.18 160 / 0.2), transparent)',
                        border: '1px solid oklch(0.6 0.18 160 / 0.3)',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: 'oklch(0.7 0.15 160)',
                      }}
                    >
                      ✓
                    </span>
                    <span className="text-white/50 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Decorative bar */}
              <div className="mt-16 flex items-center gap-3">
                <div
                  className="w-16 h-1"
                  style={{ background: 'linear-gradient(to right, oklch(0.6 0.18 160), transparent)' }}
                />
                <span
                  className="text-[10px] uppercase tracking-[0.2em] text-white/30"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Join 2,000+ teams
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edge accent */}
        <div
          className="absolute right-0 top-0 bottom-0 w-px"
          style={{
            background: 'linear-gradient(to bottom, transparent, oklch(0.55 0.18 165 / 0.3), transparent)',
          }}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* RIGHT SIDE - Form area */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[50%] flex flex-col justify-between p-8 lg:p-12 xl:p-16 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-500 opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-sm font-semibold"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: 'oklch(0.03 0.02 180)' }}
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
              <span className="text-emerald-400">Ops</span>
            </span>
          </Link>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-emerald-400/80" />
            <div className="w-8 h-1 bg-white/10" />
            <div className="w-8 h-1 bg-white/10" />
          </div>
        </div>

        {/* Form section - vertically centered */}
        <div className="flex-1 flex items-center py-8">
          <div className="w-full max-w-md mx-auto lg:mx-0">
            {/* Headline */}
            <div className="mb-10">
              <span
                className="text-[11px] uppercase tracking-[0.2em] text-emerald-400/70"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Create account
              </span>
              <h1
                className="mt-3 text-4xl lg:text-5xl font-light tracking-tight text-white/95"
                style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
              >
                회원가입
              </h1>
              <p className="mt-4 text-white/40 leading-relaxed">
                무료로 시작하고, 필요할 때 업그레이드하세요
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <FormInput
                label="이름"
                type="text"
                placeholder="홍길동"
                error={errors.name?.message}
                isFocused={focusedField === 'name'}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                inputProps={register('name')}
              />

              <FormInput
                label="이메일"
                type="email"
                placeholder="email@company.com"
                error={errors.email?.message}
                helperText={
                  errors.email?.message
                    ? undefined
                    : emailCheckMessage ?? '이메일 입력 후 포커스를 이동하면 중복 확인이 진행됩니다.'
                }
                helperTone={
                  emailCheckStatus === 'available'
                    ? 'success'
                    : emailCheckStatus === 'duplicate' || emailCheckStatus === 'error'
                      ? 'error'
                      : emailCheckStatus === 'checking'
                        ? 'info'
                        : 'default'
                }
                isFocused={focusedField === 'email'}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                onValueBlur={(value) => {
                  void handleEmailBlur(value);
                }}
                onValueChange={handleEmailChange}
                inputProps={register('email')}
              />

              <FormInput
                label="비밀번호"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                isFocused={focusedField === 'password'}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                inputProps={register('password')}
              />

              <FormInput
                label="비밀번호 확인"
                type="password"
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                isFocused={focusedField === 'confirmPassword'}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
                inputProps={register('confirmPassword')}
              />

              {/* Submit button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={signupMutation.isPending || !isEmailCheckPassed}
                  className="group relative w-full py-5 overflow-hidden transition-all duration-300 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.65 0.18 160), oklch(0.55 0.15 180))',
                  }}
                >
                  {/* Hover overlay */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.7 0.2 155), oklch(0.6 0.17 175))',
                    }}
                  />
                  <span
                    className="relative flex items-center justify-center gap-3 text-slate-950 font-medium tracking-wide"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {signupMutation.isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                        가입 중...
                      </>
                    ) : (
                      <>
                        계정 만들기
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </>
                    )}
                  </span>
                </button>
              </div>

              {/* Error message */}
              {signupErrorMessage && (
                <div
                  className="p-4 border border-red-500/20 bg-red-500/5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <p className="text-[12px] text-red-400">
                    {signupErrorMessage}
                  </p>
                </div>
              )}

              {/* Terms notice */}
              <p className="text-[11px] text-white/30 leading-relaxed">
                가입 시{' '}
                <a href="#" className="text-white/50 hover:text-white/70 underline">이용약관</a>
                {' '}및{' '}
                <a href="#" className="text-white/50 hover:text-white/70 underline">개인정보처리방침</a>
                에 동의하는 것으로 간주됩니다.
              </p>
            </form>

            {/* Login link */}
            <div className="mt-8 pt-8 border-t border-white/5">
              <p className="text-white/40 text-sm">
                이미 계정이 있으신가요?{' '}
                <Link
                  to="/login"
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  로그인
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-white/30">
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            © 2024 LuminaOps
          </span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white/50 transition-colors">도움말</a>
            <a href="#" className="hover:text-white/50 transition-colors">문의하기</a>
          </div>
        </div>
      </div>
    </div>
  );
}
