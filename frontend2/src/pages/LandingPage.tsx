import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ========== Element 2: Header ========== */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-slate-900/80 border-b border-white/10">
        <nav className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">
            Lumina<span className="text-indigo-400">Ops</span>
          </h1>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-slate-400 hover:text-white transition-colors"
            >
              로그인
            </Link>
            <Button
              asChild
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              <Link to="/signup">무료로 시작하기</Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* ========== Elements 3-5: Hero Section ========== */}
      <section className="pt-32 pb-20 px-8">
        <div className="max-w-7xl mx-auto text-center">
          {/* Badge */}
          <Badge
            variant="outline"
            className="mb-8 px-4 py-2 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 animate-fade-in-up"
          >
            SaaS형 LLMOps 플랫폼
          </Badge>

          {/* Hero Title - Element 3 */}
          <h2 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-8">
            <span className="animate-fade-in-up inline-block">
              프롬프트 관리부터
            </span>
            <br />
            <span className="animate-fade-in-up delay-200 inline-block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400">
              RAG 지식베이스까지
            </span>
          </h2>

          {/* Subtitle */}
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 animate-fade-in-up delay-300">
            별도 인프라 구축 없이 문서 업로드와 프롬프트 설정만으로 보안이 강화된
            사내 AI 서비스를 즉시 구축하세요.
          </p>

          {/* Primary CTA - Element 4 */}
          <div className="flex items-center justify-center gap-4 animate-fade-in-up delay-400">
            <Button
              size="lg"
              asChild
              className="px-8 py-6 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:scale-105 transition-all duration-300 rounded-xl"
            >
              <Link to="/signup">무료로 시작하기</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="px-8 py-6 text-lg border-white/20 hover:bg-white/10 rounded-xl"
            >
              <a href="#features">기능 둘러보기</a>
            </Button>
          </div>

          {/* Social Proof - Element 5 */}
          <div className="mt-16 flex items-center justify-center gap-12 animate-fade-in-up delay-500">
            <div className="text-center">
              <p className="text-4xl font-bold text-white">500+</p>
              <p className="text-slate-500 text-sm">활성 조직</p>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="text-center">
              <p className="text-4xl font-bold text-white">99.9%</p>
              <p className="text-slate-500 text-sm">업타임</p>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="text-center">
              <p className="text-4xl font-bold text-white">10M+</p>
              <p className="text-slate-500 text-sm">API 호출/월</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Element 7: Features Section ========== */}
      <section id="features" className="py-20 px-8">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-4xl font-bold text-white text-center mb-16">
            핵심 기능
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🎯',
                title: '프롬프트 버전 관리',
                desc: 'Git처럼 프롬프트를 버전 관리하고, 원클릭으로 배포하거나 롤백하세요.',
              },
              {
                icon: '📚',
                title: 'No-Code RAG',
                desc: 'PDF, 문서를 업로드하면 자동으로 지식베이스가 구축되어 AI가 참조합니다.',
              },
              {
                icon: '🔐',
                title: '멀티테넌트 보안',
                desc: '조직별 데이터 격리와 암호화된 API 키 관리로 엔터프라이즈급 보안을 제공합니다.',
              },
              {
                icon: '🔗',
                title: '다중 LLM 지원',
                desc: 'OpenAI, Anthropic, Google 등 다양한 LLM 제공업체를 통합 API로 관리합니다.',
              },
              {
                icon: '📊',
                title: '사용량 모니터링',
                desc: '실시간 토큰 사용량과 비용을 추적하여 예산을 효율적으로 관리하세요.',
              },
              {
                icon: '👥',
                title: '팀 협업',
                desc: '역할 기반 접근 제어와 초대 시스템으로 팀원들과 안전하게 협업하세요.',
              },
            ].map((feature, i) => (
              <Card
                key={i}
                className="bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 hover:-translate-y-1 transition-all duration-300 rounded-2xl"
              >
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4">
                    <span className="text-3xl">{feature.icon}</span>
                  </div>
                  <CardTitle className="text-xl text-white">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ========== Element 9: FAQ Section ========== */}
      <section className="py-20 px-8 bg-slate-800/50">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-4xl font-bold text-white text-center mb-16">
            자주 묻는 질문
          </h3>

          <Accordion type="single" collapsible className="w-full">
            {[
              {
                q: '무료 플랜은 어떤 기능이 포함되나요?',
                a: '무료 플랜에서는 1개 워크스페이스, 월 1,000 API 호출, 기본 프롬프트 관리 기능을 제공합니다.',
              },
              {
                q: '기존 LLM 제공업체 API 키를 사용할 수 있나요?',
                a: '네, OpenAI, Anthropic, Google Gemini 등 주요 LLM 제공업체의 API 키를 연동할 수 있습니다.',
              },
              {
                q: '데이터 보안은 어떻게 보장되나요?',
                a: '모든 데이터는 조직별로 완전히 격리되며, API 키는 AES-256으로 암호화되어 저장됩니다.',
              },
              {
                q: 'RAG 문서 업로드 제한이 있나요?',
                a: '플랜에 따라 다르며, Pro 플랜은 무제한 문서 업로드가 가능합니다.',
              },
            ].map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-b border-white/10 py-2"
              >
                <AccordionTrigger className="text-left font-semibold text-lg text-white hover:text-indigo-400 transition-colors">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 pt-2">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ========== Element 10: Final CTA ========== */}
      <section className="py-20 px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-white/10 rounded-3xl text-center">
            <h3 className="text-4xl font-bold text-white mb-4">
              지금 바로 시작하세요
            </h3>
            <p className="text-slate-400 text-lg mb-8">
              신용카드 없이 무료로 시작할 수 있습니다. 5분 안에 첫 번째 프롬프트를
              배포하세요.
            </p>
            <Button
              size="lg"
              asChild
              className="px-10 py-6 text-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:scale-105 transition-all duration-300 rounded-xl"
            >
              <Link to="/signup">무료 계정 만들기</Link>
            </Button>
          </Card>
        </div>
      </section>

      {/* ========== Element 11: Footer ========== */}
      <footer className="border-t border-white/10 py-12 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-xl font-bold text-white mb-4">
                Lumina<span className="text-indigo-400">Ops</span>
              </h4>
              <p className="text-slate-500 text-sm">
                SaaS형 LLMOps 플랫폼으로
                <br />
                사내 AI를 즉시 구축하세요.
              </p>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-4">제품</h5>
              <ul className="space-y-2 text-slate-500 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    기능
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    가격
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API 문서
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-4">회사</h5>
              <ul className="space-y-2 text-slate-500 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    소개
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    블로그
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    채용
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-4">법적 고지</h5>
              <ul className="space-y-2 text-slate-500 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    이용약관
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    개인정보처리방침
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex items-center justify-between text-slate-500 text-sm">
            <span>&copy; 2026 LuminaOps. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-white transition-colors">
                Twitter
              </a>
              <a href="#" className="hover:text-white transition-colors">
                GitHub
              </a>
              <a href="#" className="hover:text-white transition-colors">
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
