# PromptDock 🚢

LLM Gateway + PromptOps SaaS Console

## 기술 스택

- **React 18** + **TypeScript**
- **Vite** - Fast build tool
- **TailwindCSS** - Utility-first CSS
- **shadcn/ui** - High-quality UI components
- **React Router** - Client-side routing
- **TanStack Query** - Server state management
- **React Hook Form + Zod** - Form validation
- **Recharts** - Data visualization
- **Sonner** - Toast notifications

## 시작하기

### 1. 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 편집하여 API Base URL을 설정하세요.
비워두면 Mock API 모드로 동작합니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 으로 접속하세요.

### 4. 빌드

```bash
npm run build
```

## 주요 기능

### 🔐 인증 (Auth)
- 로그인 / 회원가입
- JWT 토큰 기반 인증
- 자동 리다이렉트

### 🏢 워크스페이스 (Workspace)
- 멀티 워크스페이스 지원
- 워크스페이스 생성 및 전환
- Role-based access control

### 📊 대시보드 (Dashboard)
- 실시간 통계 (Calls, Cost, Latency, Success Rate)
- 3개의 인터랙티브 차트
  - API Calls 추이
  - Cost 추이
  - Health Metrics (Success Rate + Latency)
- 기간 필터링 (24h, 7d, 30d)

### 📝 프롬프트 관리 (Prompts)
- 프롬프트 CRUD
- 버전 관리 (Version Control)
- 릴리즈 & 롤백
- 플레이그라운드 (실시간 테스트)
- Reason + Reference Links (Jira, Notion 등)

### 📜 로그 (Logs)
- 모든 API 호출 로그 조회
- 상세 Trace 뷰
- 필터링 (Status Code, Trace ID, Prompt Key)
- 페이지네이션

### ⚙️ 설정 (Settings)
- **Gateway API Keys**: 프로덕션 환경용 API Key 관리
- **Provider Keys**: OpenAI, Anthropic 등 LLM Provider Key 관리
- **Members**: 팀 멤버 초대 및 권한 관리

### 🚀 온보딩 (Onboarding)
- 1분 셋업 위자드
- Provider Key 등록 → 템플릿 선택 → 프롬프트 생성
- 단계별 가이드

## 프로젝트 구조

```
src/
├── components/          # 공통 컴포넌트
│   ├── ui/             # shadcn/ui 기반 UI 컴포넌트
│   ├── layout/         # 레이아웃 컴포넌트
│   ├── auth/           # 인증 관련
│   └── prompts/        # 프롬프트 탭 컴포넌트
├── pages/              # 페이지 컴포넌트
│   ├── auth/           # 로그인, 회원가입
│   ├── workspaces/     # 워크스페이스 선택
│   ├── dashboard/      # 대시보드
│   ├── prompts/        # 프롬프트 관리
│   ├── logs/           # 로그
│   ├── settings/       # 설정
│   └── onboarding/     # 온보딩
├── hooks/              # Custom hooks
├── lib/                # 유틸리티
│   ├── api-client.ts   # API 클라이언트
│   ├── mock-api.ts     # Mock API
│   └── utils.ts        # 헬퍼 함수
├── types/              # TypeScript 타입 정의
├── App.tsx             # 라우팅 설정
├── main.tsx            # 엔트리 포인트
└── index.css           # 글로벌 스타일

```

## API 구조

### 인증
- `POST /auth/login` - 로그인
- `POST /auth/signup` - 회원가입

### 워크스페이스
- `GET /workspaces` - 워크스페이스 목록
- `POST /workspaces` - 워크스페이스 생성

### 대시보드
- `GET /workspaces/:id/dashboard/overview` - 개요 통계
- `GET /workspaces/:id/dashboard/calls` - Calls 차트 데이터
- `GET /workspaces/:id/dashboard/costs` - Cost 차트 데이터
- `GET /workspaces/:id/dashboard/health` - Health 차트 데이터

### 프롬프트
- `GET /workspaces/:id/prompts` - 프롬프트 목록
- `POST /workspaces/:id/prompts` - 프롬프트 생성
- `GET /workspaces/:id/prompts/:promptId` - 프롬프트 상세
- `PATCH /workspaces/:id/prompts/:promptId` - 프롬프트 업데이트
- `GET /workspaces/:id/prompts/:promptId/versions` - 버전 목록
- `POST /workspaces/:id/prompts/:promptId/versions` - 버전 생성
- `GET /workspaces/:id/prompts/:promptId/release` - 현재 릴리즈
- `POST /workspaces/:id/prompts/:promptId/release` - 릴리즈
- `POST /workspaces/:id/prompts/:promptId/rollback` - 롤백
- `POST /workspaces/:id/prompts/:promptId/playground` - 플레이그라운드

### 로그
- `GET /workspaces/:id/logs` - 로그 목록
- `GET /workspaces/:id/logs/:traceId` - 로그 상세

### 설정
- `GET/POST/DELETE /workspaces/:id/gateway-api-keys` - Gateway API Keys
- `GET/POST/DELETE /workspaces/:id/provider-keys` - Provider Keys
- `POST /workspaces/:id/provider-keys/:keyId/verify` - Provider Key 검증
- `GET/POST/PATCH/DELETE /workspaces/:id/members` - Members

### 온보딩
- `GET /prompt-templates` - 템플릿 목록
- `POST /workspaces/:id/onboarding/wizard` - 위자드 완료

## Mock API 모드

`VITE_API_BASE_URL`이 설정되지 않으면 자동으로 Mock API 모드로 동작합니다.
개발 중 백엔드 없이 프론트엔드만으로 테스트 가능합니다.

Mock API는 `src/lib/mock-api.ts`에 정의되어 있습니다.

## 배포

### Vercel

```bash
vercel
```

### Netlify

```bash
npm run build
netlify deploy --prod --dir=dist
```

## 라이선스

MIT
