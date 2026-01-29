import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

function useCounter(end: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView(0.5);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end, duration]);

  return { count, ref };
}

function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return position;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function BioluminescentAurora() {
  const mouse = useMousePosition();
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTime(t => t + 0.02), 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep ocean base */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg,
              oklch(0.08 0.02 250) 0%,
              oklch(0.05 0.03 220) 50%,
              oklch(0.03 0.02 200) 100%
            )
          `
        }}
      />

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Primary aurora - large flowing shape */}
      <div
        className="absolute w-[200%] h-[80%] -bottom-[20%] -left-[50%]"
        style={{
          background: `
            radial-gradient(ellipse 40% 60% at ${30 + Math.sin(time) * 5}% ${70 + Math.cos(time * 0.7) * 10}%,
              oklch(0.55 0.2 175 / 0.4) 0%,
              transparent 60%
            ),
            radial-gradient(ellipse 35% 50% at ${60 + Math.cos(time * 0.8) * 8}% ${60 + Math.sin(time * 0.5) * 12}%,
              oklch(0.5 0.18 195 / 0.35) 0%,
              transparent 55%
            ),
            radial-gradient(ellipse 30% 45% at ${45 + Math.sin(time * 1.2) * 6}% ${80 + Math.cos(time) * 8}%,
              oklch(0.6 0.22 160 / 0.3) 0%,
              transparent 50%
            )
          `,
          filter: 'blur(60px)',
          transform: `translateY(${Math.sin(time * 0.3) * 20}px)`,
          transition: 'transform 0.5s ease-out',
        }}
      />

      {/* Secondary aurora streaks */}
      <svg
        className="absolute bottom-0 left-0 w-full h-[70%]"
        viewBox="0 0 1440 700"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="aurora-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.7 0.2 175 / 0)" />
            <stop offset="20%" stopColor="oklch(0.7 0.2 175 / 0.6)" />
            <stop offset="50%" stopColor="oklch(0.65 0.18 190 / 0.5)" />
            <stop offset="80%" stopColor="oklch(0.6 0.2 170 / 0.4)" />
            <stop offset="100%" stopColor="oklch(0.6 0.2 170 / 0)" />
          </linearGradient>
          <linearGradient id="aurora-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.6 0.15 200 / 0)" />
            <stop offset="30%" stopColor="oklch(0.6 0.15 200 / 0.4)" />
            <stop offset="70%" stopColor="oklch(0.55 0.18 180 / 0.3)" />
            <stop offset="100%" stopColor="oklch(0.55 0.18 180 / 0)" />
          </linearGradient>
          <filter id="aurora-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Animated aurora paths */}
        <path
          d={`M-100,${600 + Math.sin(time) * 30}
              Q${200 + Math.sin(time * 0.7) * 50},${500 + Math.cos(time * 0.5) * 40}
              ${500 + Math.cos(time * 0.3) * 30},${450 + Math.sin(time * 0.8) * 35}
              T${900 + Math.sin(time * 0.6) * 40},${380 + Math.cos(time * 0.4) * 30}
              T${1300 + Math.cos(time * 0.5) * 35},${420 + Math.sin(time * 0.7) * 25}
              T1600,${350 + Math.cos(time) * 20}`}
          fill="none"
          stroke="url(#aurora-grad-1)"
          strokeWidth="4"
          filter="url(#aurora-glow)"
          opacity="0.8"
        />
        <path
          d={`M-50,${650 + Math.cos(time * 0.8) * 25}
              Q${300 + Math.cos(time * 0.6) * 40},${550 + Math.sin(time * 0.4) * 35}
              ${600 + Math.sin(time * 0.5) * 35},${480 + Math.cos(time * 0.7) * 30}
              T${1000 + Math.cos(time * 0.4) * 45},${420 + Math.sin(time * 0.6) * 25}
              T1500,${380 + Math.cos(time * 0.8) * 20}`}
          fill="none"
          stroke="url(#aurora-grad-2)"
          strokeWidth="3"
          filter="url(#aurora-glow)"
          opacity="0.6"
        />
      </svg>

      {/* Mouse-following highlight */}
      <div
        className="absolute w-[600px] h-[600px] pointer-events-none opacity-30"
        style={{
          left: mouse.x - 300,
          top: mouse.y - 300,
          background: 'radial-gradient(circle, oklch(0.6 0.15 180 / 0.15) 0%, transparent 60%)',
          filter: 'blur(40px)',
          transition: 'left 0.3s ease-out, top 0.3s ease-out',
        }}
      />

      {/* Bottom fade to solid */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40"
        style={{
          background: 'linear-gradient(to top, oklch(0.03 0.02 200), transparent)'
        }}
      />
    </div>
  );
}

function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { count, ref } = useCounter(value);

  return (
    <div ref={ref} className="relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative p-8 border-l border-white/10">
        <div className="font-mono text-5xl md:text-6xl font-extralight tracking-tighter text-white/90">
          {count.toLocaleString()}
          <span className="text-cyan-400/80 text-3xl ml-1">{suffix}</span>
        </div>
        <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-white/40">
          {label}
        </div>
      </div>
    </div>
  );
}

// Color schemes for feature blocks
const featureColorSchemes = {
  cyan: {
    bg: 'oklch(0.12 0.04 200)',
    gradient: 'radial-gradient(ellipse 80% 60% at 0% 100%, oklch(0.25 0.12 195 / 0.5) 0%, transparent 60%)',
    accent: 'oklch(0.7 0.15 195)',
    accentGlow: 'oklch(0.5 0.15 195 / 0.3)',
    number: 'text-cyan-400',
  },
  emerald: {
    bg: 'oklch(0.10 0.04 160)',
    gradient: 'radial-gradient(ellipse 70% 50% at 100% 0%, oklch(0.3 0.14 160 / 0.4) 0%, transparent 55%)',
    accent: 'oklch(0.7 0.18 160)',
    accentGlow: 'oklch(0.5 0.18 160 / 0.3)',
    number: 'text-emerald-400',
  },
  teal: {
    bg: 'oklch(0.11 0.035 180)',
    gradient: 'radial-gradient(ellipse 60% 70% at 50% 100%, oklch(0.28 0.1 180 / 0.45) 0%, transparent 50%)',
    accent: 'oklch(0.65 0.14 180)',
    accentGlow: 'oklch(0.45 0.14 180 / 0.3)',
    number: 'text-teal-400',
  },
  mint: {
    bg: 'oklch(0.13 0.045 165)',
    gradient: 'radial-gradient(ellipse 75% 55% at 100% 100%, oklch(0.35 0.15 165 / 0.35) 0%, transparent 60%)',
    accent: 'oklch(0.75 0.16 165)',
    accentGlow: 'oklch(0.55 0.16 165 / 0.25)',
    number: 'text-green-400',
  },
  ocean: {
    bg: 'oklch(0.09 0.05 220)',
    gradient: 'radial-gradient(ellipse 65% 80% at 0% 50%, oklch(0.22 0.1 220 / 0.5) 0%, transparent 55%)',
    accent: 'oklch(0.6 0.12 220)',
    accentGlow: 'oklch(0.4 0.12 220 / 0.35)',
    number: 'text-blue-400',
  },
  aqua: {
    bg: 'oklch(0.115 0.04 190)',
    gradient: 'radial-gradient(ellipse 70% 60% at 80% 20%, oklch(0.32 0.13 190 / 0.4) 0%, transparent 50%)',
    accent: 'oklch(0.68 0.15 190)',
    accentGlow: 'oklch(0.48 0.15 190 / 0.3)',
    number: 'text-cyan-300',
  },
};

type ColorScheme = keyof typeof featureColorSchemes;

function ColoredFeatureBlock({
  number,
  title,
  description,
  align = 'left',
  colorScheme,
  icon
}: {
  number: string;
  title: string;
  description: string;
  align?: 'left' | 'right';
  colorScheme: ColorScheme;
  icon: string;
}) {
  const { ref, inView } = useInView(0.15);
  const colors = featureColorSchemes[colorScheme];

  return (
    <div
      ref={ref}
      className={`
        relative overflow-hidden
        transform transition-all duration-1000
        ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}
      `}
      style={{ background: colors.bg }}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: colors.gradient }}
      />

      {/* Accent shape - geometric element */}
      <div
        className={`absolute ${align === 'right' ? 'left-8' : 'right-8'} top-1/2 -translate-y-1/2 w-32 h-32 md:w-48 md:h-48 opacity-20`}
        style={{
          background: `conic-gradient(from 180deg, ${colors.accent}, transparent, ${colors.accent})`,
          filter: 'blur(40px)',
        }}
      />

      {/* Accent line */}
      <div
        className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-0 bottom-0 w-1`}
        style={{
          background: `linear-gradient(to bottom, transparent, ${colors.accent}, transparent)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 py-20 md:py-28">
        <div className={`grid md:grid-cols-12 gap-8 items-center ${align === 'right' ? '' : ''}`}>
          {/* Icon/Number side */}
          <div className={`md:col-span-3 ${align === 'right' ? 'md:order-2' : ''}`}>
            <div className={`flex flex-col ${align === 'right' ? 'md:items-end' : 'items-start'}`}>
              <span
                className={`font-mono text-6xl md:text-7xl font-extralight ${colors.number} opacity-30`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {number}
              </span>
              <span className="text-4xl mt-2">{icon}</span>
            </div>
          </div>

          {/* Text content */}
          <div className={`md:col-span-9 ${align === 'right' ? 'md:order-1 md:text-right' : ''}`}>
            <h3
              className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-white/95"
              style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
            >
              {title}
            </h3>
            <p className={`mt-6 text-lg text-white/50 leading-relaxed max-w-2xl ${align === 'right' ? 'md:ml-auto' : ''}`}>
              {description}
            </p>

            {/* Decorative dots */}
            <div className={`mt-8 flex gap-2 ${align === 'right' ? 'md:justify-end' : ''}`}>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5"
                  style={{
                    background: colors.accent,
                    opacity: 1 - i * 0.3,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom border glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${colors.accentGlow}, transparent)`,
        }}
      />
    </div>
  );
}

function ProcessStep({
  step,
  title,
  description,
  variant
}: {
  step: string;
  title: string;
  description: string;
  variant: 'light' | 'mid' | 'dark';
}) {
  const variants = {
    light: {
      bg: 'bg-gradient-to-br from-white to-slate-50',
      text: 'text-slate-900',
      subtext: 'text-slate-600',
      badge: 'bg-emerald-100 text-emerald-800'
    },
    mid: {
      bg: 'bg-gradient-to-br from-emerald-50 via-cyan-50 to-teal-100',
      text: 'text-slate-900',
      subtext: 'text-slate-600',
      badge: 'bg-white/80 text-teal-700 shadow-sm'
    },
    dark: {
      bg: 'bg-gradient-to-br from-teal-800 via-emerald-900 to-cyan-900',
      text: 'text-white',
      subtext: 'text-white/70',
      badge: 'bg-white/20 text-white backdrop-blur-sm'
    }
  };

  const v = variants[variant];

  return (
    <div className={`${v.bg} p-10 md:p-12 transition-transform duration-300 hover:scale-[1.02]`}>
      <span className={`inline-block px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider ${v.badge}`}>
        {step}
      </span>
      <h4
        className={`mt-6 text-2xl md:text-3xl font-light tracking-tight ${v.text}`}
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        {title}
      </h4>
      <p className={`mt-4 text-sm leading-relaxed ${v.subtext}`}>
        {description}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function LandingPage_v3() {
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const heroOpacity = Math.max(0, 1 - scrollY / 600);
  const heroScale = 1 + scrollY * 0.0002;

  return (
    <div className="min-h-screen text-white" style={{ background: 'oklch(0.03 0.02 200)' }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;600&family=JetBrains+Mono:wght@300;400;500&display=swap');
      `}</style>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* NAVIGATION */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrollY > 100 ? 'oklch(0.03 0.02 200 / 0.9)' : 'transparent',
          backdropFilter: scrollY > 100 ? 'blur(20px)' : 'none',
          borderBottom: scrollY > 100 ? '1px solid oklch(1 0 0 / 0.05)' : 'none'
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-4 group">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-emerald-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-lg font-semibold"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: 'oklch(0.03 0.02 200)' }}
                  >
                    L
                  </span>
                </div>
              </div>
              <span
                className="text-xl tracking-tight"
                style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 400 }}
              >
                <span className="text-white/90">Lumina</span>
                <span className="text-cyan-400">Ops</span>
              </span>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-10">
              {['기능', '프로세스', '가격', '문서'].map((item) => (
                <a
                  key={item}
                  href={`#${item}`}
                  className="text-[13px] text-white/50 hover:text-white/90 transition-colors tracking-wide"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {item}
                </a>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-[13px] text-white/60 hover:text-white transition-colors px-4 py-2"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                로그인
              </Link>
              <Link
                to="/signup"
                className="relative group text-[13px] px-5 py-2.5 overflow-hidden"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 opacity-90 group-hover:opacity-100 transition-opacity" />
                <span className="relative text-slate-950 font-medium">시작하기</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* HERO */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        <BioluminescentAurora />

        <div
          className="relative z-10 w-full pt-32 pb-24"
          style={{
            opacity: heroOpacity,
            transform: `scale(${heroScale})`,
          }}
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            {/* Asymmetric layout */}
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-4">
              {/* Main headline - spans 8 cols, left aligned */}
              <div className="lg:col-span-8">
                {/* Eyebrow */}
                <div
                  className="inline-flex items-center gap-3 mb-8"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <span className="w-2 h-2 bg-cyan-400 animate-pulse" />
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                    Enterprise LLMOps Platform
                  </span>
                </div>

                {/* Main headline - editorial style */}
                <h1
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light leading-[0.95] tracking-tight"
                  style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
                >
                  <span className="text-white/95">LLM의</span>
                  <br />
                  <span className="text-white/95">복잡함을</span>
                  <br />
                  <span
                    className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent"
                    style={{
                      backgroundSize: '200% 100%',
                      animation: 'gradient-shift 8s ease infinite'
                    }}
                  >
                    제거합니다
                  </span>
                </h1>

                <style>{`
                  @keyframes gradient-shift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                  }
                `}</style>
              </div>

              {/* Right side - description + CTA */}
              <div className="lg:col-span-4 lg:pt-32 flex flex-col justify-end">
                <p className="text-lg text-white/40 leading-relaxed mb-10">
                  문서 업로드부터 프롬프트 배포까지,
                  <br />
                  <span className="text-white/60">하나의 플랫폼</span>에서
                  LLM 운영의 모든 것을.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    to="/signup"
                    className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white" />
                    <span
                      className="relative text-slate-900 font-medium text-sm tracking-wide"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      무료로 시작
                    </span>
                    <span className="relative text-slate-900 group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </Link>

                  <a
                    href="#demo"
                    className="inline-flex items-center justify-center gap-3 px-8 py-4 border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
                  >
                    <span
                      className="text-white/70 text-sm"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      데모 보기
                    </span>
                  </a>
                </div>
              </div>
            </div>

            {/* Scroll indicator - positioned bottom left */}
            <div className="absolute bottom-12 left-6 lg:left-12 flex items-center gap-4 text-white/30">
              <div className="w-px h-16 bg-gradient-to-b from-white/40 to-transparent" />
              <span
                className="text-[10px] uppercase tracking-[0.2em] rotate-90 origin-left"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Scroll
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* STATS */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            <StatCard value={99} suffix="%" label="가동률 SLA" />
            <StatCard value={47} suffix="ms" label="평균 레이턴시" />
            <StatCard value={10000} suffix="+" label="일일 API 호출" />
            <StatCard value={256} suffix="bit" label="AES 암호화" />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* FEATURES - Colored sections with visual rhythm */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section id="기능" className="relative">
        {/* Section intro */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-24 lg:py-32">
          <div className="max-w-xl">
            <span
              className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/70"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              핵심 기능
            </span>
            <h2
              className="mt-4 text-4xl md:text-5xl font-light tracking-tight text-white/90"
              style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
            >
              왜 LuminaOps인가
            </h2>
            <p className="mt-6 text-lg text-white/40 leading-relaxed">
              복잡한 인프라 구축 없이, 즉시 엔터프라이즈급 LLM 운영을 시작하세요.
            </p>
          </div>
        </div>

        {/* Colored feature blocks */}
        <ColoredFeatureBlock
          number="01"
          title="No-Code RAG"
          description="문서를 업로드하면 AI가 자동으로 학습합니다. PDF, 매뉴얼, 내부 위키 — 어떤 형식이든 지식 베이스로 전환됩니다. 복잡한 임베딩 파이프라인 구축 없이, 드래그 앤 드롭으로 시작하세요."
          align="left"
          colorScheme="cyan"
          icon="📄"
        />
        <ColoredFeatureBlock
          number="02"
          title="완벽한 데이터 격리"
          description="조직 단위 멀티테넌시로 완벽한 보안을 보장합니다. 귀사의 민감한 데이터는 타 조직과 물리적으로 분리되어 저장되며, organization_id 기반 접근 제어로 데이터 유출을 원천 차단합니다."
          align="right"
          colorScheme="emerald"
          icon="🔐"
        />
        <ColoredFeatureBlock
          number="03"
          title="BYOK — 자체 API 키 사용"
          description="OpenAI, Google Gemini, Anthropic — 자체 API 키를 등록하고 사용하세요. 요청 시점에 동적으로 주입되어 비용을 직접 관리하고, 제공업체 종속 없이 자유롭게 전환할 수 있습니다."
          align="left"
          colorScheme="teal"
          icon="🔑"
        />
        <ColoredFeatureBlock
          number="04"
          title="프롬프트 버전 관리"
          description="Git처럼 프롬프트를 관리합니다. 버전별 배포와 롤백, 히스토리 추적, A/B 테스트까지. 더 이상 프롬프트 변경이 두렵지 않습니다. 언제든 이전 버전으로 돌아갈 수 있으니까요."
          align="right"
          colorScheme="ocean"
          icon="🔄"
        />
        <ColoredFeatureBlock
          number="05"
          title="실시간 비용 모니터링"
          description="토큰 사용량과 예상 비용을 실시간으로 추적합니다. 워크스페이스별, 프롬프트 버전별 상세 분석으로 비용 최적화 포인트를 찾아내고, 예산 알림으로 과금 폭탄을 방지하세요."
          align="left"
          colorScheme="mint"
          icon="📊"
        />
        <ColoredFeatureBlock
          number="06"
          title="통합 API Gateway"
          description="모든 LLM 제공업체를 하나의 API로 통합합니다. OpenAI에서 Gemini로, Gemini에서 Claude로 — 코드 변경 없이 제공업체를 전환하세요. 자동 재시도와 폴백 로직이 내장되어 있습니다."
          align="right"
          colorScheme="aqua"
          icon="🔌"
        />
      </section>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* PROCESS - Light section with gradient cards */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section id="프로세스" className="relative py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span
              className="text-[11px] uppercase tracking-[0.2em] text-teal-600"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              시작 가이드
            </span>
            <h2
              className="mt-4 text-4xl md:text-5xl font-light tracking-tight text-slate-900"
              style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
            >
              세 단계로 시작하세요
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-slate-200">
            <ProcessStep
              step="Step 01"
              title="워크스페이스 생성"
              description="팀 또는 프로젝트별로 독립된 워크스페이스를 생성하고, 역할 기반 권한 관리로 팀원을 초대하세요."
              variant="light"
            />
            <ProcessStep
              step="Step 02"
              title="문서 업로드 & 프롬프트"
              description="PDF, 문서를 업로드하면 자동 벡터화됩니다. 프롬프트를 설정하고 버전을 관리하세요."
              variant="mid"
            />
            <ProcessStep
              step="Step 03"
              title="API 연동 & 운영"
              description="단일 API 엔드포인트로 모든 기능을 사용하세요. 실시간 모니터링으로 안정적으로 운영합니다."
              variant="dark"
            />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* CODE EXAMPLE */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-32 overflow-hidden" style={{ background: 'oklch(0.06 0.02 220)' }}>
        {/* Subtle aurora in background */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `
              radial-gradient(ellipse 60% 40% at 20% 60%, oklch(0.4 0.15 180 / 0.2) 0%, transparent 50%),
              radial-gradient(ellipse 50% 35% at 80% 40%, oklch(0.35 0.12 200 / 0.15) 0%, transparent 50%)
            `
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Code block */}
            <div className="relative">
              <div
                className="absolute -inset-8 opacity-50"
                style={{
                  background: 'radial-gradient(ellipse at center, oklch(0.5 0.15 180 / 0.2) 0%, transparent 60%)',
                  filter: 'blur(40px)'
                }}
              />
              <div
                className="relative overflow-hidden"
                style={{
                  background: 'oklch(0.03 0.02 200)',
                  border: '1px solid oklch(1 0 0 / 0.1)'
                }}
              >
                {/* Window chrome */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <span
                    className="text-[11px] text-white/40"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    api-example.ts
                  </span>
                  <button
                    className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    복사
                  </button>
                </div>

                {/* Code content */}
                <pre
                  className="p-6 text-sm overflow-x-auto"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <code>
                    <span className="text-white/30">{'// RAG 기반 응답 생성'}</span>{'\n'}
                    <span className="text-purple-400">const</span>{' '}
                    <span className="text-white/90">response</span>{' '}
                    <span className="text-white/40">=</span>{' '}
                    <span className="text-purple-400">await</span>{' '}
                    <span className="text-cyan-400">lumina</span>
                    <span className="text-white/40">.</span>
                    <span className="text-cyan-400">chat</span>
                    <span className="text-white/40">(</span>
                    <span className="text-white/40">{'{'}</span>{'\n'}
                    {'  '}<span className="text-white/70">prompt</span>
                    <span className="text-white/40">:</span>{' '}
                    <span className="text-emerald-400">"고객 문의에 답변해주세요"</span>
                    <span className="text-white/40">,</span>{'\n'}
                    {'  '}<span className="text-white/70">context</span>
                    <span className="text-white/40">:</span>{' '}
                    <span className="text-emerald-400">"customer-support"</span>
                    <span className="text-white/40">,</span>{'\n'}
                    {'  '}<span className="text-white/70">version</span>
                    <span className="text-white/40">:</span>{' '}
                    <span className="text-emerald-400">"latest"</span>{'\n'}
                    <span className="text-white/40">{'})'}</span>
                    <span className="text-white/40">;</span>{'\n\n'}
                    <span className="text-white/30">{'// 문서 출처 확인'}</span>{'\n'}
                    <span className="text-cyan-400">console</span>
                    <span className="text-white/40">.</span>
                    <span className="text-cyan-400">log</span>
                    <span className="text-white/40">(</span>
                    <span className="text-white/90">response</span>
                    <span className="text-white/40">.</span>
                    <span className="text-white/70">sources</span>
                    <span className="text-white/40">);</span>
                  </code>
                </pre>
              </div>
            </div>

            {/* Description */}
            <div>
              <span
                className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/70"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                개발자 친화적
              </span>
              <h3
                className="mt-4 text-4xl md:text-5xl font-light tracking-tight text-white/90"
                style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
              >
                5분 만에 통합
              </h3>
              <p className="mt-6 text-lg text-white/40 leading-relaxed">
                복잡한 SDK 없이 표준 HTTP 요청만으로 연동됩니다.
                OpenAI 호환 API로 기존 코드 변경을 최소화하세요.
              </p>

              <ul className="mt-10 space-y-4">
                {[
                  'OpenAI SDK 완벽 호환',
                  '실시간 스트리밍 응답 지원',
                  '자동 재시도 & 폴백 로직',
                  'TypeScript / Python SDK'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-4">
                    <span className="w-1.5 h-1.5 bg-cyan-400" />
                    <span className="text-white/60 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* CTA */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-32 overflow-hidden">
        <BioluminescentAurora />

        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2
            className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-white/90"
            style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 300 }}
          >
            AI 도입,
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              더 이상 미루지 마세요
            </span>
          </h2>
          <p className="mt-8 text-lg text-white/40 max-w-xl mx-auto">
            무료 플랜으로 지금 바로 시작하세요.
            신용카드 없이, 5분 안에 첫 API 호출이 가능합니다.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white" />
              <span
                className="relative text-slate-900 font-medium tracking-wide"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                무료로 시작하기
              </span>
              <span className="relative text-slate-900 group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-3 px-10 py-5 border border-white/20 hover:border-white/40 transition-colors"
            >
              <span
                className="text-white/70"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                영업팀 문의
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ════════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/5 py-20" style={{ background: 'oklch(0.03 0.02 200)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid md:grid-cols-12 gap-12">
            {/* Brand */}
            <div className="md:col-span-5">
              <Link to="/" className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center">
                  <span
                    className="text-lg font-semibold"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: 'oklch(0.03 0.02 200)' }}
                  >
                    L
                  </span>
                </div>
                <span
                  className="text-xl tracking-tight"
                  style={{ fontFamily: "'Crimson Pro', serif" }}
                >
                  <span className="text-white/90">Lumina</span>
                  <span className="text-cyan-400">Ops</span>
                </span>
              </Link>
              <p className="mt-6 text-sm text-white/40 leading-relaxed max-w-sm">
                중소기업과 스타트업을 위한
                <br />
                엔터프라이즈급 LLMOps 플랫폼
              </p>
            </div>

            {/* Links */}
            <div className="md:col-span-2">
              <h4 className="text-sm font-medium text-white/90 mb-4">제품</h4>
              <ul className="space-y-3 text-sm text-white/40">
                <li><a href="#" className="hover:text-white/70 transition-colors">기능</a></li>
                <li><a href="#" className="hover:text-white/70 transition-colors">가격</a></li>
                <li><a href="#" className="hover:text-white/70 transition-colors">문서</a></li>
                <li><a href="#" className="hover:text-white/70 transition-colors">API</a></li>
              </ul>
            </div>

            <div className="md:col-span-2">
              <h4 className="text-sm font-medium text-white/90 mb-4">회사</h4>
              <ul className="space-y-3 text-sm text-white/40">
                <li><a href="#" className="hover:text-white/70 transition-colors">소개</a></li>
                <li><a href="#" className="hover:text-white/70 transition-colors">블로그</a></li>
                <li><a href="#" className="hover:text-white/70 transition-colors">채용</a></li>
                <li><a href="#" className="hover:text-white/70 transition-colors">문의</a></li>
              </ul>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-sm font-medium text-white/90 mb-4">법적 고지</h4>
              <ul className="space-y-3 text-sm text-white/40">
                <li><a href="#" className="hover:text-white/70 transition-colors">이용약관</a></li>
                <li><a href="#" className="hover:text-white/70 transition-colors">개인정보처리방침</a></li>
                <li><a href="#" className="hover:text-white/70 transition-colors">보안</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <span
              className="text-[11px] text-white/30"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              © 2024 LuminaOps. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
