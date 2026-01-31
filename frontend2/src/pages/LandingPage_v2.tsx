import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Typing animation hook
function useTypewriter(text: string, speed: number = 50, delay: number = 0) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length < text.length) {
      const timeout = setTimeout(() => {
        setDisplayed(text.slice(0, displayed.length + 1));
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [displayed, text, speed, started]);

  return displayed;
}

// Animated counter hook
function useCounter(end: number, duration: number = 2000, delay: number = 0) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const startTimeout = setTimeout(() => {
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
    }, delay);
    return () => clearTimeout(startTimeout);
  }, [end, duration, delay]);

  return count;
}

// Terminal Line Component
function TerminalLine({
  prefix = '▸',
  children,
  delay = 0,
  className = ''
}: {
  prefix?: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <div
      className={`font-mono text-sm transition-all duration-500 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
      } ${className}`}
    >
      <span className="text-emerald-400 mr-2">{prefix}</span>
      {children}
    </div>
  );
}

// Feature Card with Terminal aesthetic
function FeatureCard({
  command,
  title,
  description,
  index
}: {
  command: string;
  title: string;
  description: string;
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Glow effect */}
      <div className={`absolute -inset-px bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-emerald-500/20 rounded-none opacity-0 blur-sm transition-opacity duration-500 ${isHovered ? 'opacity-100' : ''}`} />

      <div className="relative h-full bg-zinc-950 border border-zinc-800 p-6 transition-all duration-300 hover:border-emerald-500/50">
        {/* Terminal header */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800">
          <div className="w-2 h-2 rounded-full bg-zinc-700" />
          <div className="w-2 h-2 rounded-full bg-zinc-700" />
          <div className="w-2 h-2 rounded-full bg-zinc-700" />
          <code className="ml-2 text-xs text-zinc-500 font-mono">~/luminaops</code>
        </div>

        {/* Command */}
        <div className="font-mono text-xs mb-4">
          <span className="text-emerald-400">$</span>
          <span className="text-zinc-400 ml-2">{command}</span>
        </div>

        {/* Content */}
        <h3 className="text-lg font-light tracking-tight text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        <p className="text-sm text-zinc-500 leading-relaxed">
          {description}
        </p>

        {/* Cursor blink */}
        <div className={`mt-4 font-mono text-xs text-emerald-400 ${isHovered ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
          <span className="animate-pulse">▋</span>
        </div>
      </div>
    </div>
  );
}

// Stat display
function StatBlock({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const count = useCounter(value, 2000, 500);

  return (
    <div className="text-center">
      <div className="font-mono text-4xl md:text-5xl font-light text-white tracking-tighter">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-xs uppercase tracking-[0.2em] text-zinc-600 mt-2">
        {label}
      </div>
    </div>
  );
}

export function LandingPage_v2() {
  const heroText = useTypewriter('LLM 인프라의 복잡함을 제거합니다', 40, 800);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      command: 'lumina upload ./docs --rag',
      title: 'No-Code RAG',
      description: '문서를 업로드하면 즉시 AI 지식 베이스가 구축됩니다. 코드 한 줄 없이.'
    },
    {
      command: 'lumina config --tenant isolated',
      title: '완벽한 데이터 격리',
      description: '조직 단위 멀티테넌시. 귀사의 데이터는 오직 귀사만 접근합니다.'
    },
    {
      command: 'lumina keys add --provider openai',
      title: '동적 API 키 관리',
      description: '자체 OpenAI, Gemini 키를 사용하세요. 요청 시점에 동적 주입됩니다.'
    },
    {
      command: 'lumina prompt deploy v2.3.1',
      title: '프롬프트 버전 관리',
      description: 'Git처럼 프롬프트를 관리합니다. 배포, 롤백, 히스토리 추적.'
    },
    {
      command: 'lumina usage --realtime',
      title: '실시간 비용 추적',
      description: '토큰 사용량과 예상 비용을 실시간으로 모니터링합니다.'
    },
    {
      command: 'lumina api --unified',
      title: '통합 API 게이트웨이',
      description: '모든 LLM 제공업체를 하나의 API로. 스위칭 비용 제로.'
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015] z-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
          transform: `translateY(${scrollY * 0.1}px)`
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                <span className="text-zinc-950 font-mono text-xs font-bold">L</span>
              </div>
              <span className="font-mono text-sm tracking-tight">
                <span className="text-zinc-400">lumina</span>
                <span className="text-emerald-400">ops</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-xs uppercase tracking-[0.15em] text-zinc-500">
              <a href="#features" className="hover:text-white transition-colors">기능</a>
              <a href="#pricing" className="hover:text-white transition-colors">가격</a>
              <a href="#docs" className="hover:text-white transition-colors">문서</a>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-xs uppercase tracking-[0.1em] text-zinc-400 hover:text-white transition-colors px-4 py-2"
              >
                로그인
              </Link>
              <Link
                to="/signup"
                className="text-xs uppercase tracking-[0.1em] bg-white text-zinc-950 px-4 py-2 hover:bg-emerald-400 transition-colors"
              >
                시작하기
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20">
        <div className="max-w-7xl mx-auto px-6 py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div>
              {/* Eyebrow */}
              <TerminalLine delay={0} className="mb-8">
                <span className="text-zinc-600">Enterprise-grade LLMOps Platform</span>
              </TerminalLine>

              {/* Main headline */}
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-light tracking-[-0.03em] leading-[1.1] mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span className="text-zinc-400 block text-2xl md:text-3xl mb-2 font-mono">{'>'}</span>
                {heroText}
                <span className="animate-pulse text-emerald-400">▋</span>
              </h1>

              {/* Sub copy */}
              <p className="text-zinc-500 text-lg leading-relaxed mb-8 max-w-lg">
                문서 업로드부터 프롬프트 배포까지.
                <br />
                <span className="text-zinc-400">LLM 운영의 모든 것을 하나의 플랫폼에서.</span>
              </p>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/signup"
                  className="group inline-flex items-center gap-3 bg-emerald-400 text-zinc-950 px-6 py-3 text-sm font-medium hover:bg-emerald-300 transition-all"
                >
                  <span className="uppercase tracking-[0.1em]">무료로 시작</span>
                  <span className="font-mono group-hover:translate-x-1 transition-transform">→</span>
                </Link>
                <a
                  href="#demo"
                  className="inline-flex items-center gap-3 border border-zinc-800 text-zinc-400 px-6 py-3 text-sm hover:border-zinc-600 hover:text-white transition-all"
                >
                  <span className="uppercase tracking-[0.1em]">데모 보기</span>
                  <span className="font-mono text-xs">2:34</span>
                </a>
              </div>

              {/* Trust badges */}
              <div className="mt-12 pt-8 border-t border-zinc-900">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-700 mb-4">신뢰하는 기업들</div>
                <div className="flex items-center gap-8 opacity-40">
                  {['STARTUP', 'FINTECH', 'BIOTECH', 'RETAILCO'].map((name) => (
                    <span key={name} className="font-mono text-xs text-zinc-500">{name}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Terminal visualization */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/10 blur-3xl" />

              <div className="relative bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm">
                {/* Terminal header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  <span className="ml-4 font-mono text-xs text-zinc-600">lumina-cli — zsh — 80×24</span>
                </div>

                {/* Terminal content */}
                <div className="p-6 font-mono text-sm space-y-3">
                  <TerminalLine delay={200}>
                    <span className="text-white">lumina init my-workspace</span>
                  </TerminalLine>
                  <TerminalLine prefix="✓" delay={600}>
                    <span className="text-zinc-500">워크스페이스 생성 완료</span>
                  </TerminalLine>

                  <div className="h-4" />

                  <TerminalLine delay={1000}>
                    <span className="text-white">lumina upload ./manuals/*.pdf --rag</span>
                  </TerminalLine>
                  <TerminalLine prefix="⠋" delay={1400}>
                    <span className="text-cyan-400">PDF 파싱 중...</span>
                  </TerminalLine>
                  <TerminalLine prefix="⠙" delay={1800}>
                    <span className="text-cyan-400">텍스트 청킹 중...</span>
                  </TerminalLine>
                  <TerminalLine prefix="⠸" delay={2200}>
                    <span className="text-cyan-400">임베딩 생성 중...</span>
                  </TerminalLine>
                  <TerminalLine prefix="✓" delay={2600}>
                    <span className="text-emerald-400">247개 문서 벡터화 완료</span>
                  </TerminalLine>

                  <div className="h-4" />

                  <TerminalLine delay={3000}>
                    <span className="text-white">lumina prompt deploy v1.0.0</span>
                  </TerminalLine>
                  <TerminalLine prefix="✓" delay={3400}>
                    <span className="text-emerald-400">프롬프트 배포 완료</span>
                    <span className="text-zinc-600 ml-2">— 0.3s</span>
                  </TerminalLine>

                  <div className="h-2" />

                  <div className="text-zinc-600 text-xs mt-4">
                    API Endpoint: <span className="text-emerald-400">https://api.luminaops.com/v1/chat</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-600">
          <span className="text-xs uppercase tracking-[0.2em]">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-zinc-600 to-transparent animate-pulse" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-24 border-y border-zinc-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatBlock value={99} suffix="%" label="Uptime SLA" />
            <StatBlock value={50} suffix="ms" label="평균 응답 시간" />
            <StatBlock value={10000} suffix="+" label="일일 API 호출" />
            <StatBlock value={256} suffix="-bit" label="암호화 수준" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-32">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section header */}
          <div className="max-w-2xl mb-16">
            <div className="font-mono text-xs text-emerald-400 mb-4">
              <span className="text-zinc-600">001</span> — FEATURES
            </div>
            <h2
              className="text-3xl md:text-4xl font-light tracking-[-0.02em] mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              개발자를 위해,
              <br />
              <span className="text-zinc-500">개발자가 만들었습니다</span>
            </h2>
            <p className="text-zinc-500 leading-relaxed">
              CLI 친화적인 워크플로우. RESTful API.
              당신이 익숙한 방식 그대로.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-800">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Code Example Section */}
      <section className="relative py-32 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Code */}
            <div className="relative">
              <div className="absolute -inset-4 bg-emerald-500/5 blur-3xl" />
              <div className="relative bg-zinc-950 border border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-emerald-400">api-call.ts</span>
                  </div>
                  <button className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors font-mono">
                    복사
                  </button>
                </div>
                <pre className="p-6 text-sm font-mono overflow-x-auto">
                  <code>
                    <span className="text-zinc-600">{'// 단 몇 줄로 RAG 기반 챗봇 완성'}</span>{'\n'}
                    <span className="text-purple-400">const</span>{' '}
                    <span className="text-white">response</span>{' '}
                    <span className="text-zinc-500">=</span>{' '}
                    <span className="text-purple-400">await</span>{' '}
                    <span className="text-cyan-400">fetch</span>
                    <span className="text-zinc-500">(</span>{'\n'}
                    {'  '}<span className="text-emerald-400">'https://api.luminaops.com/v1/chat'</span>
                    <span className="text-zinc-500">,</span>{'\n'}
                    {'  '}<span className="text-zinc-500">{'{'}</span>{'\n'}
                    {'    '}<span className="text-white">method</span>
                    <span className="text-zinc-500">:</span>{' '}
                    <span className="text-emerald-400">'POST'</span>
                    <span className="text-zinc-500">,</span>{'\n'}
                    {'    '}<span className="text-white">headers</span>
                    <span className="text-zinc-500">:</span>{' '}
                    <span className="text-zinc-500">{'{'}</span>{'\n'}
                    {'      '}<span className="text-emerald-400">'Authorization'</span>
                    <span className="text-zinc-500">:</span>{' '}
                    <span className="text-emerald-400">`Bearer {'$'}{'{'}API_KEY{'}'}`</span>
                    <span className="text-zinc-500">,</span>{'\n'}
                    {'    '}<span className="text-zinc-500">{'},'}</span>{'\n'}
                    {'    '}<span className="text-white">body</span>
                    <span className="text-zinc-500">:</span>{' '}
                    <span className="text-cyan-400">JSON</span>
                    <span className="text-zinc-500">.</span>
                    <span className="text-cyan-400">stringify</span>
                    <span className="text-zinc-500">({'{'}</span>{'\n'}
                    {'      '}<span className="text-white">prompt</span>
                    <span className="text-zinc-500">:</span>{' '}
                    <span className="text-emerald-400">'고객 문의에 답변해주세요'</span>
                    <span className="text-zinc-500">,</span>{'\n'}
                    {'      '}<span className="text-white">context</span>
                    <span className="text-zinc-500">:</span>{' '}
                    <span className="text-emerald-400">'user-manual'</span>{'\n'}
                    {'    '}<span className="text-zinc-500">{'})'}</span>{'\n'}
                    {'  '}<span className="text-zinc-500">{'}'}</span>{'\n'}
                    <span className="text-zinc-500">)</span>
                    <span className="text-zinc-500">;</span>
                  </code>
                </pre>
              </div>
            </div>

            {/* Right: Copy */}
            <div>
              <div className="font-mono text-xs text-emerald-400 mb-4">
                <span className="text-zinc-600">002</span> — INTEGRATION
              </div>
              <h2
                className="text-3xl md:text-4xl font-light tracking-[-0.02em] mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                5분 안에 통합.
                <br />
                <span className="text-zinc-500">영원히 확장.</span>
              </h2>
              <p className="text-zinc-500 leading-relaxed mb-8">
                복잡한 SDK 없이 표준 HTTP 요청만으로 연동됩니다.
                OpenAI 호환 API로 기존 코드 변경 최소화.
              </p>

              <ul className="space-y-4">
                {[
                  'OpenAI SDK 호환 — 기존 코드 그대로 사용',
                  'WebSocket 스트리밍 지원',
                  '자동 재시도 및 폴백 로직 내장',
                  'TypeScript / Python SDK 제공'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="text-emerald-400 font-mono mt-0.5">✓</span>
                    <span className="text-zinc-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative bg-zinc-900 border border-zinc-800 p-12 md:p-20">
            {/* Background pattern */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 1px)`,
                backgroundSize: '24px 24px'
              }}
            />

            <div className="relative max-w-2xl mx-auto text-center">
              <div className="font-mono text-xs text-emerald-400 mb-6">
                {'>'} START BUILDING
              </div>
              <h2
                className="text-3xl md:text-5xl font-light tracking-[-0.03em] mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                복잡한 건 우리에게.
                <br />
                <span className="text-zinc-500">당신은 제품에 집중하세요.</span>
              </h2>
              <p className="text-zinc-500 mb-10 text-lg">
                무료 플랜으로 시작하세요. 신용카드 필요 없음.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/signup"
                  className="group inline-flex items-center justify-center gap-3 bg-white text-zinc-950 px-8 py-4 text-sm font-medium hover:bg-emerald-400 transition-all"
                >
                  <span className="uppercase tracking-[0.1em]">무료로 시작하기</span>
                  <span className="font-mono group-hover:translate-x-1 transition-transform">→</span>
                </Link>
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center gap-3 border border-zinc-700 text-zinc-400 px-8 py-4 text-sm hover:border-zinc-500 hover:text-white transition-all"
                >
                  <span className="uppercase tracking-[0.1em]">영업팀 문의</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                  <span className="text-zinc-950 font-mono text-xs font-bold">L</span>
                </div>
                <span className="font-mono text-sm">
                  <span className="text-zinc-400">lumina</span>
                  <span className="text-emerald-400">ops</span>
                </span>
              </div>
              <p className="text-sm text-zinc-600 max-w-xs leading-relaxed">
                중소기업과 스타트업을 위한
                <br />
                엔터프라이즈급 LLMOps 플랫폼
              </p>
            </div>

            {/* Links */}
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-600 mb-4">제품</div>
              <ul className="space-y-3 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-white transition-colors">기능</a></li>
                <li><a href="#" className="hover:text-white transition-colors">가격</a></li>
                <li><a href="#" className="hover:text-white transition-colors">문서</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API 레퍼런스</a></li>
              </ul>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-600 mb-4">회사</div>
              <ul className="space-y-3 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-white transition-colors">소개</a></li>
                <li><a href="#" className="hover:text-white transition-colors">블로그</a></li>
                <li><a href="#" className="hover:text-white transition-colors">채용</a></li>
                <li><a href="#" className="hover:text-white transition-colors">문의</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-16 pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-xs text-zinc-700">
              © 2024 LuminaOps. All rights reserved.
            </div>
            <div className="flex items-center gap-6 text-xs text-zinc-600">
              <a href="#" className="hover:text-white transition-colors">이용약관</a>
              <a href="#" className="hover:text-white transition-colors">개인정보처리방침</a>
              <a href="#" className="hover:text-white transition-colors">보안</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
