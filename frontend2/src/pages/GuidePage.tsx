import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Database,
  ExternalLink,
  Home,
  LayoutGrid,
  MessageSquare,
  Rocket,
  Search,
  Shield,
} from 'lucide-react';

type GuideLink = {
  label: string;
  to: string;
  note?: string;
};

type GuideArticle = {
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
  steps: string[];
  checklist?: string[];
  tips?: string[];
  links?: GuideLink[];
};

type GuideCategory = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  articles: GuideArticle[];
};

type GuideArticleMeta = GuideArticle & {
  categoryId: string;
  categoryTitle: string;
};

const LAST_UPDATED = '2026.02.12';

const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    id: 'start',
    title: '시작하기',
    description: '가입부터 첫 조직 생성까지 가장 빠른 시작 경로입니다.',
    icon: Rocket,
    articles: [
      {
        id: 'signup',
        title: '회원가입',
        summary: '새 계정을 생성하고 로그인 준비를 완료합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '회원가입 페이지(`/signup`)로 이동합니다.',
          '이름, 이메일, 비밀번호(8자 이상), 비밀번호 확인을 입력합니다.',
          '회원가입 버튼을 누르면 로그인 페이지로 이동합니다.',
        ],
        checklist: ['업무용 이메일 사용 권장', '비밀번호는 8자 이상'],
        links: [{ label: '회원가입 페이지', to: '/signup' }],
      },
      {
        id: 'login',
        title: '로그인',
        summary: '계정으로 로그인하고 대시보드로 진입합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '로그인 페이지(`/login`)로 이동합니다.',
          '이메일과 비밀번호를 입력 후 로그인 버튼을 클릭합니다.',
          '정상 로그인 시 대시보드(`/dashboard`)로 이동합니다.',
        ],
        checklist: ['로그인 실패 시 비밀번호/이메일 형식 확인'],
        links: [{ label: '로그인 페이지', to: '/login' }],
      },
      {
        id: 'first-organization',
        title: '첫 조직 생성 (온보딩)',
        summary: '워크스페이스가 없는 사용자는 온보딩에서 조직을 생성합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '로그인 후 자동으로 온보딩 페이지(`/onboarding`)로 이동합니다.',
          '조직 이름을 입력하고 Create Organization을 클릭합니다.',
          '기본 워크스페이스(`general`)가 자동으로 생성되고 조직 대시보드로 이동합니다.',
        ],
        checklist: ['조직 이름은 팀/회사 단위로 설정 권장'],
        links: [{ label: '온보딩 페이지', to: '/onboarding' }],
      },
      {
        id: 'invitation-accept',
        title: '초대 링크로 참여',
        summary: '워크스페이스 초대 링크를 통해 팀에 합류합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '초대 URL에 접속하면 초대 수락 화면으로 이동합니다.',
          '로그인 전이라면 먼저 로그인 후 다시 수락 흐름으로 복귀합니다.',
          '수락 완료 시 해당 워크스페이스 대시보드로 이동합니다.',
        ],
        links: [{ label: '초대 수락 페이지', to: '/invitations/accept' }],
      },
    ],
  },
  {
    id: 'workspace',
    title: '워크스페이스',
    description: '워크스페이스 생성과 팀 협업의 기본 흐름입니다.',
    icon: LayoutGrid,
    articles: [
      {
        id: 'workspace-overview',
        title: '조직 대시보드 이해',
        summary: '내 워크스페이스 목록과 상태를 확인합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '대시보드(`/dashboard`)에서 조직의 워크스페이스 목록을 확인합니다.',
          '각 카드에서 상태, 사용량, RAG 상태를 점검합니다.',
          '원하는 워크스페이스의 대시보드 이동 버튼으로 상세 화면에 진입합니다.',
        ],
        links: [{ label: '대시보드', to: '/dashboard' }],
      },
      {
        id: 'workspace-create',
        title: '새 워크스페이스 만들기',
        summary: '조직 내 새 워크스페이스를 추가합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '조직 대시보드에서 새 워크스페이스 만들기 버튼을 클릭합니다.',
          '워크스페이스 이름/표시 이름을 입력하고 생성합니다.',
          '생성된 워크스페이스 카드에서 바로 상세 페이지로 이동합니다.',
        ],
        checklist: ['프로젝트/서비스 단위로 워크스페이스 분리 권장'],
        links: [{ label: '대시보드', to: '/dashboard' }],
      },
      {
        id: 'workspace-team-invite',
        title: '팀원 초대 링크 생성',
        summary: '워크스페이스 멤버 권한으로 초대 링크를 생성합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '사이드바에서 설정 > 조직 및 보안으로 이동합니다.',
          '멤버 초대 버튼을 클릭하고 대상 워크스페이스를 선택합니다.',
          '생성된 초대 링크를 복사해 팀원에게 전달합니다.',
        ],
        links: [{ label: '조직 및 보안(예시 경로)', to: '/dashboard', note: '설정 > 조직 및 보안 메뉴에서 접근' }],
      },
    ],
  },
  {
    id: 'prompt',
    title: '프롬프트',
    description: '프롬프트 생성, 버전 관리, 릴리즈 운영 방법입니다.',
    icon: MessageSquare,
    articles: [
      {
        id: 'prompt-create',
        title: '새 프롬프트 생성',
        summary: '프롬프트 키를 만들고 워크스페이스에서 사용 시작합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '워크스페이스 대시보드에서 프롬프트 설정 카드로 이동합니다.',
          '프롬프트가 없으면 새 프롬프트 만들기를 클릭합니다.',
          'Prompt Key(영문 소문자/숫자/하이픈)와 설명을 입력해 생성합니다.',
        ],
        checklist: ['Prompt Key는 API 호출 식별자이므로 변경 최소화'],
      },
      {
        id: 'prompt-version',
        title: '버전 생성 및 테스트',
        summary: '버전 탭에서 시스템 프롬프트/템플릿/모델 설정을 관리합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '프롬프트 상세에서 버전(Versions) 탭을 엽니다.',
          '새 버전 생성에서 모델, 시스템 프롬프트, 사용자 템플릿을 입력합니다.',
          '필요 시 기존 버전을 복사해 빠르게 새 버전을 만듭니다.',
        ],
        checklist: ['테스트용 버전과 운영 배포 버전을 분리 관리'],
      },
      {
        id: 'prompt-release',
        title: '배포(Release)와 롤백',
        summary: '운영 환경에 반영할 버전을 선택해 배포합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '프롬프트 상세에서 배포(Release) 탭을 엽니다.',
          '배포할 버전을 선택하고 필요하면 배포 사유를 입력합니다.',
          '배포하기를 실행하면 즉시 API 응답 버전에 반영됩니다.',
        ],
        checklist: ['배포 이력에서 변경자/버전/사유를 추적'],
      },
    ],
  },
  {
    id: 'rag',
    title: '문서/RAG',
    description: '지식 베이스 구축과 검색 품질 튜닝 방법입니다.',
    icon: Database,
    articles: [
      {
        id: 'document-upload',
        title: '문서 업로드',
        summary: 'PDF/DOCX/TXT/MD 문서를 업로드해 RAG 인덱싱을 시작합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '워크스페이스에서 문서 메뉴로 이동합니다.',
          '문서 업로드 버튼을 클릭해 파일을 선택하거나 드래그 앤 드롭합니다.',
          '업로드 완료 후 상태가 INDEXING/READY로 전환되는지 확인합니다.',
        ],
        checklist: ['지원 확장자: pdf, docx, txt, md', '최대 업로드 크기: 50MB'],
      },
      {
        id: 'rag-settings',
        title: 'RAG 설정 튜닝',
        summary: 'Top K, 유사도 임계값, 하이브리드/리랭크 옵션을 조정합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '문서 화면의 RAG 설정 패널에서 파라미터를 조정합니다.',
          '필요 시 고급 설정(하이브리드, 리랭크, 청킹)을 펼칩니다.',
          '저장 버튼으로 설정을 반영하고 검색 품질을 재검증합니다.',
        ],
        tips: ['청킹 설정 변경은 신규 업로드 문서부터 적용됩니다.'],
      },
      {
        id: 'rag-preview-search',
        title: '검색 결과 미리보기',
        summary: 'RAG 검색 테스트로 실제 참조 청크 품질을 점검합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '문서 화면 우측의 검색 미리보기에서 질의를 입력합니다.',
          '결과의 score와 문서명을 확인해 적합도를 점검합니다.',
          '필요하면 설정을 조정하고 다시 검색해 품질을 개선합니다.',
        ],
      },
    ],
  },
  {
    id: 'ops',
    title: '운영/모니터링',
    description: '요청 상태, 로그, 비용/성능 지표를 운영 관점에서 확인합니다.',
    icon: Activity,
    articles: [
      {
        id: 'workspace-dashboard',
        title: '워크스페이스 대시보드',
        summary: '프롬프트/문서/최근 요청/예산 상태를 한 화면에서 확인합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '워크스페이스 대시보드에서 요약 카드와 최근 요청 목록을 확인합니다.',
          '제공되는 API 예시(cURL)를 복사해 빠르게 호출 테스트를 진행합니다.',
          '이상 징후가 있으면 로그 상세 또는 통계 화면으로 이동합니다.',
        ],
      },
      {
        id: 'logs',
        title: '로그 분석',
        summary: 'trace 단위로 상태/지연/에러 코드/실패 사유를 확인합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '워크스페이스의 Logs 메뉴로 이동합니다.',
          'promptKey, 상태, provider, traceId 필터로 조회 범위를 좁힙니다.',
          '상세 버튼으로 trace 상세 화면에서 요청/응답/에러 정보를 확인합니다.',
        ],
        checklist: ['FAIL/BLOCKED 로그 우선 확인', 'errorCode + failReason 함께 점검'],
      },
      {
        id: 'statistics',
        title: '통계 대시보드',
        summary: '요청량, 토큰, 지연시간, 비용 지표를 기간별로 확인합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '사이드바의 통계 메뉴로 이동합니다.',
          '기간(일간/주간/월간)과 워크스페이스 범위를 선택합니다.',
          'KPI, 시계열, 모델별/프롬프트별 사용량을 확인해 최적화 포인트를 찾습니다.',
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: '설정/보안',
    description: '조직 보안, API 키, Provider 키, 예산 정책 관리입니다.',
    icon: Shield,
    articles: [
      {
        id: 'organization-security',
        title: '조직 및 보안',
        summary: '멤버, 권한, 보안 관련 운영 작업을 수행합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '설정 > 조직 및 보안 화면으로 이동합니다.',
          '멤버 목록에서 역할/상태를 확인하고 필요 시 멤버를 제거합니다.',
          '감사 또는 리포트를 위해 CSV 내보내기를 활용합니다.',
        ],
      },
      {
        id: 'gateway-api-keys',
        title: 'Gateway API 키 관리',
        summary: '외부 서비스 연동용 API 키를 생성/재발급합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '설정 > API 키 화면으로 이동합니다.',
          '새 API 키 버튼으로 키를 생성하고 즉시 안전한 위치에 보관합니다.',
          '키 유출 의심 시 재발급(Rotate)으로 기존 키를 교체합니다.',
        ],
        tips: ['생성 직후 노출되는 원문 키는 다시 확인할 수 없습니다.'],
      },
      {
        id: 'provider-keys',
        title: 'Provider 키 등록',
        summary: 'OpenAI/Gemini/Anthropic 등의 Provider API 키를 연결합니다.',
        updatedAt: LAST_UPDATED,
        steps: [
          '설정 > Provider 키 화면으로 이동합니다.',
          '사용할 Provider 카드에서 API 키 등록 또는 업데이트를 진행합니다.',
          '상태(Active/Invalid/Verifying)를 확인하고 필요 시 재검증합니다.',
        ],
        checklist: ['Provider별 예산 정책(ON/OFF, Hard-limit) 확인'],
      },
    ],
  },
];

const flattenArticles = (): GuideArticleMeta[] =>
  GUIDE_CATEGORIES.flatMap((category) =>
    category.articles.map((article) => ({
      ...article,
      categoryId: category.id,
      categoryTitle: category.title,
    })),
  );

export function GuidePage() {
  const { categoryId, articleId } = useParams<{ categoryId?: string; articleId?: string }>();
  const [searchQuery, setSearchQuery] = useState('');

  const allArticles = useMemo(() => flattenArticles(), []);
  const activeArticle = allArticles.find((article) => article.id === articleId) ?? null;
  const activeCategory =
    GUIDE_CATEGORIES.find((category) => category.id === categoryId) ??
    GUIDE_CATEGORIES.find((category) => category.id === activeArticle?.categoryId) ??
    GUIDE_CATEGORIES[0];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return GUIDE_CATEGORIES;
    return GUIDE_CATEGORIES.map((category) => {
      const matchesCategory = category.title.toLowerCase().includes(normalizedQuery);
      const filteredArticles = category.articles.filter(
        (article) =>
          matchesCategory ||
          article.title.toLowerCase().includes(normalizedQuery) ||
          article.summary.toLowerCase().includes(normalizedQuery),
      );
      return { ...category, articles: filteredArticles };
    }).filter((category) => category.articles.length > 0);
  }, [normalizedQuery]);

  const activeArticleIndex = activeArticle ? allArticles.findIndex((item) => item.id === activeArticle.id) : -1;
  const previousArticle = activeArticleIndex > 0 ? allArticles[activeArticleIndex - 1] : null;
  const nextArticle =
    activeArticleIndex >= 0 && activeArticleIndex < allArticles.length - 1 ? allArticles[activeArticleIndex + 1] : null;

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 md:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BookOpen size={18} className="text-blue-600" />
            LuminaOps Guide
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
              로그인
            </Link>
            <Link to="/dashboard" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
              대시보드
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 py-6 md:px-8">
        <aside className="hidden w-72 shrink-0 rounded-xl border border-slate-200 bg-white p-4 lg:block">
          <div className="mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="가이드 검색"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <nav className="space-y-3">
            {filteredCategories.map((category) => {
              const Icon = category.icon;
              const isActiveCategory = activeCategory.id === category.id;
              return (
                <div key={category.id} className="space-y-1">
                  <Link
                    to={`/guide/category/${category.id}`}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
                      isActiveCategory ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon size={15} />
                      {category.title}
                    </span>
                    <ChevronRight size={14} />
                  </Link>
                  <div className="space-y-1 pl-3">
                    {category.articles.map((article) => {
                      const isActiveArticle = activeArticle?.id === article.id;
                      return (
                        <Link
                          key={article.id}
                          to={`/guide/article/${article.id}`}
                          className={`block rounded-md px-2 py-1.5 text-xs ${
                            isActiveArticle ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                        >
                          {article.title}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filteredCategories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                검색 결과가 없습니다.
              </div>
            ) : null}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-6 md:p-8">
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <Link to="/guide" className="inline-flex items-center gap-1 hover:text-slate-700">
              <Home size={13} />
              가이드 홈
            </Link>
            <ChevronRight size={13} />
            <Link to={`/guide/category/${activeCategory.id}`} className="hover:text-slate-700">
              {activeCategory.title}
            </Link>
            {activeArticle ? (
              <>
                <ChevronRight size={13} />
                <span className="text-slate-700">{activeArticle.title}</span>
              </>
            ) : null}
          </div>

          {activeArticle ? (
            <>
              <header className="mb-6 border-b border-slate-200 pb-4">
                <h1 className="text-4xl font-black tracking-tight text-slate-900">{activeArticle.title}</h1>
                <p className="mt-3 text-sm text-slate-600">{activeArticle.summary}</p>
                <p className="mt-2 text-xs text-slate-400">last update: {activeArticle.updatedAt}</p>
              </header>

              <section className="space-y-6">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">진행 순서</h2>
                  <ol className="mt-3 space-y-2">
                    {activeArticle.steps.map((step, index) => (
                      <li key={`${activeArticle.id}-step-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {activeArticle.checklist?.length ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-sm font-semibold text-blue-900">체크 포인트</p>
                    <ul className="mt-2 space-y-1 text-sm text-blue-900">
                      {activeArticle.checklist.map((item) => (
                        <li key={`${activeArticle.id}-check-${item}`}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeArticle.tips?.length ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">운영 팁</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                      {activeArticle.tips.map((item) => (
                        <li key={`${activeArticle.id}-tip-${item}`}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeArticle.links?.length ? (
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">관련 페이지</h2>
                    <div className="mt-3 space-y-2">
                      {activeArticle.links.map((link) => (
                        <Link
                          key={`${activeArticle.id}-link-${link.label}`}
                          to={link.to}
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <div>
                            <p className="font-medium">{link.label}</p>
                            {link.note ? <p className="text-xs text-slate-500">{link.note}</p> : null}
                          </div>
                          <ExternalLink size={16} className="text-slate-400" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 pt-2 md:grid-cols-2">
                  {previousArticle ? (
                    <Link to={`/guide/article/${previousArticle.id}`} className="rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
                      <p className="text-xs text-slate-400">이전</p>
                      <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <ArrowLeft size={14} />
                        {previousArticle.title}
                      </p>
                    </Link>
                  ) : (
                    <div />
                  )}
                  {nextArticle ? (
                    <Link to={`/guide/article/${nextArticle.id}`} className="rounded-lg border border-slate-200 px-4 py-3 text-right hover:bg-slate-50">
                      <p className="text-xs text-slate-400">다음</p>
                      <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        {nextArticle.title}
                        <ArrowRight size={14} />
                      </p>
                    </Link>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <>
              <header className="mb-6 border-b border-slate-200 pb-4">
                <h1 className="text-4xl font-black tracking-tight text-slate-900">{activeCategory.title}</h1>
                <p className="mt-3 text-sm text-slate-600">{activeCategory.description}</p>
              </header>

              <div className="grid gap-4 md:grid-cols-2">
                {activeCategory.articles.map((article) => (
                  <Link
                    key={article.id}
                    to={`/guide/article/${article.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-blue-200"
                  >
                    <h2 className="text-xl font-bold text-slate-900">📄 {article.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{article.summary}</p>
                    <p className="mt-4 text-xs text-slate-400">last update: {article.updatedAt}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
