# LuminaOps 사용자 가이드 🚀

> 처음 사용하시는 분들도 쉽게 따라할 수 있도록 작성된 완벽 가이드입니다.

## 📋 목차

1. [LuminaOps란?](#1-luminaops란)
2. [시작하기 전에](#2-시작하기-전에)
3. [챗봇 프롬프트 만들기](#3-챗봇-프롬프트-만들기)
4. [챗봇 버전 생성하기](#4-챗봇-버전-생성하기)
5. [RAG 설정 이해하기](#5-rag-설정-이해하기)
6. [실제 서비스 호출하기](#6-실제-서비스-호출하기)
7. [고급 기능](#7-고급-기능)

---

## 1. LuminaOps란?

**LuminaOps**는 여러 AI 모델(ChatGPT, Claude, Gemini 등)을 한 곳에서 관리하고 사용할 수 있는 플랫폼입니다.

### 주요 기능
- 🤖 **여러 AI 모델을 한 번에**: OpenAI, Anthropic, Google Gemini를 모두 사용 가능
- 📝 **프롬프트 버전 관리**: 챗봇 프롬프트를 버전별로 관리하고 롤백 가능
- 🔄 **자동 장애복구**: 한 AI가 응답 안 하면 자동으로 다른 AI로 전환
- 📚 **RAG (문서 기반 답변)**: 업로드한 문서를 기반으로 정확한 답변 제공
- 💰 **비용 관리**: AI 사용량과 비용을 실시간으로 추적
- 🔐 **팀 단위 관리**: 조직, 워크스페이스 단위로 권한 관리

---

## 2. 시작하기 전에

### 필요한 것들

1. **계정 생성**: 회원가입 후 로그인
2. **조직(Organization) 생성**: 회사/팀 단위 공간
3. **워크스페이스(Workspace) 생성**: 프로젝트 단위 공간
4. **API 키 발급**: 외부 시스템에서 호출하기 위한 키

### 주요 개념 이해하기

```
조직 (Organization)
  └── 워크스페이스 (Workspace)
       ├── 프롬프트 (Prompt)
       │    └── 버전들 (Versions)
       ├── RAG 문서들
       └── API 키
```

- **조직(Organization)**: 회사/팀 전체를 관리하는 최상위 단위
- **워크스페이스(Workspace)**: 프로젝트 단위 (예: "고객센터 챗봇", "상품 추천 봇")
- **프롬프트(Prompt)**: 챗봇의 기본 템플릿 (예: "customer_support_bot")
- **버전(Version)**: 프롬프트의 각 버전 (v1, v2, v3...)

---

## 3. 챗봇 프롬프트 만들기

### 3-1. 프롬프트란?

프롬프트는 **챗봇의 정체성과 행동 방식을 정의하는 템플릿**입니다.

예시:
- `customer_support_bot`: 고객센터 챗봇
- `product_recommender`: 상품 추천 챗봇
- `daily_report_generator`: 일일 보고서 생성 봇

### 3-2. 프롬프트 생성 API

**엔드포인트**: `POST /api/v1/workspaces/{workspaceId}/prompts`

**요청 예시**:
```bash
curl -X POST "https://api.luminaops.com/api/v1/workspaces/1/prompts" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "promptKey": "customer_support_bot",
    "description": "고객 문의에 친절하게 답변하는 챗봇"
  }'
```

**필드 설명**:
- `promptKey`: 프롬프트 고유 키 (소문자, 숫자, 하이픈, 언더스코어만 사용)
  - ✅ 올바른 예: `customer_bot`, `product-recommender`, `daily_report_v2`
  - ❌ 잘못된 예: `Customer Bot`, `상품추천`, `product@bot`
- `description`: 프롬프트 설명 (선택사항, 최대 500자)

**응답 예시**:
```json
{
  "promptId": 42,
  "promptKey": "customer_support_bot",
  "description": "고객 문의에 친절하게 답변하는 챗봇",
  "createdAt": "2024-02-05T15:30:00"
}
```

---

## 4. 챗봇 버전 생성하기

### 4-1. 버전이란?

버전은 **프롬프트의 실제 내용과 설정**입니다. 하나의 프롬프트는 여러 버전을 가질 수 있습니다.

**왜 버전 관리가 필요한가요?**
- 📝 프롬프트를 수정할 때마다 새 버전으로 저장
- 🔄 문제가 생기면 이전 버전으로 롤백 가능
- 📊 버전별 성능 비교 가능
- 🧪 A/B 테스트 가능

### 4-2. 버전 생성 API

**엔드포인트**: `POST /api/v1/prompts/{promptId}/versions`

**요청 예시 (고객센터 챗봇)**:
```bash
curl -X POST "https://api.luminaops.com/api/v1/prompts/42/versions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "친절한 고객센터 챗봇 v1",
    "provider": "OPENAI",
    "model": "gpt-4o",
    "secondaryProvider": "ANTHROPIC",
    "secondaryModel": "claude-3-5-sonnet-20241022",
    "systemPrompt": "당신은 친절하고 전문적인 고객센터 상담원입니다. 고객의 질문에 정확하고 공손하게 답변해주세요.",
    "userTemplate": "고객 질문: {{question}}\n\n위 질문에 대해 답변해주세요.",
    "ragEnabled": true,
    "contextUrl": "https://github.com/mycompany/customer-support/releases/v1.0.0",
    "modelConfig": {
      "temperature": 0.7,
      "maxTokens": 1000
    }
  }'
```

### 4-3. 필드 상세 설명

#### 기본 정보
- **`title`** (선택): 버전 이름 (예: "친절한 고객센터 챗봇 v1")
- **`provider`** (필수): 주 AI 제공자
  - `OPENAI`: ChatGPT
  - `ANTHROPIC`: Claude
  - `GOOGLE`: Gemini
- **`model`** (필수): 사용할 모델명
  - OpenAI: `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
  - Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`
  - Google: `gemini-2.0-flash-exp`, `gemini-1.5-pro`

#### 장애복구 설정 (선택사항)
- **`secondaryProvider`**: 예비 AI 제공자 (주 AI가 실패하면 자동 전환)
- **`secondaryModel`**: 예비 모델명

#### 프롬프트 내용
- **`systemPrompt`** (선택): AI의 역할과 행동 방식 정의
  ```
  예시: "당신은 전문적인 금융 상담사입니다. 
         고객에게 투자 조언을 제공할 때는 항상 
         리스크를 명확히 설명해주세요."
  ```

- **`userTemplate`** (필수): 사용자 메시지 템플릿
  - `{{변수명}}` 형식으로 동적 값 주입 가능
  ```
  예시: "제품명: {{product_name}}
         가격: {{price}}원
         
         위 제품에 대한 설명을 작성해주세요."
  ```

#### RAG 설정
- **`ragEnabled`** (선택): RAG 활성화 여부 (true/false)
  - `true`: 업로드한 문서를 기반으로 답변
  - `false`: AI의 일반 지식으로만 답변

#### 기타
- **`contextUrl`** (선택): 버전 관련 참조 URL (GitHub 릴리즈 등)
- **`modelConfig`** (선택): 모델 세부 설정
  - `temperature`: 창의성 (0.0~2.0, 낮을수록 일관적)
    - `0.0~0.3`: 정확한 답변 필요 (고객센터, 법률)
    - `0.7~1.0`: 균형 잡힌 답변 (일반 챗봇)
    - `1.0~2.0`: 창의적 답변 (마케팅 카피, 스토리)
  - `maxTokens`: 최대 응답 길이 (토큰 단위)

### 4-4. 버전 목록 조회

**엔드포인트**: `GET /api/v1/prompts/{promptId}/versions`

```bash
curl -X GET "https://api.luminaops.com/api/v1/prompts/42/versions" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**응답 예시**:
```json
[
  {
    "versionId": 101,
    "title": "친절한 고객센터 챗봇 v1",
    "provider": "OPENAI",
    "model": "gpt-4o",
    "createdAt": "2024-02-05T15:30:00",
    "isReleased": true
  },
  {
    "versionId": 102,
    "title": "친절한 고객센터 챗봇 v2",
    "provider": "ANTHROPIC",
    "model": "claude-3-5-sonnet-20241022",
    "createdAt": "2024-02-06T10:20:00",
    "isReleased": false
  }
]
```

---

## 5. RAG 설정 이해하기

### 5-1. RAG란?

**RAG (Retrieval-Augmented Generation)** = 문서 기반 답변 생성

일반 AI는 **학습된 지식**으로만 답변하지만, RAG는 **내가 업로드한 문서**를 기반으로 답변합니다.

**예시**:
```
질문: "우리 회사 환불 정책이 뭐야?"

❌ 일반 AI: "일반적으로 환불은 14일 이내에..."
✅ RAG 적용: "귀사의 환불 정책 문서에 따르면 7일 이내 100% 환불이 가능합니다..."
```

### 5-2. RAG 설정 항목

RAG 설정은 워크스페이스 단위로 관리됩니다.

**엔드포인트**: 
- 조회: `GET /api/v1/workspaces/{workspaceId}/rag/settings`
- 수정: `PUT /api/v1/workspaces/{workspaceId}/rag/settings`

#### 주요 설정 파라미터

1. **`topK`** (1~10)
   - **의미**: 검색할 문서 조각(chunk) 개수
   - **설명**: 
     - 숫자가 클수록 더 많은 문서를 참고하지만 속도가 느려지고 비용이 증가
     - 숫자가 작을수록 빠르지만 정보가 부족할 수 있음
   - **권장값**:
     - `3`: 간단한 질문 (FAQ, 빠른 응답 필요)
     - `5`: 일반적인 사용 (균형)
     - `7~10`: 복잡한 질문 (여러 문서 참조 필요)

2. **`similarityThreshold`** (0.0~1.0)
   - **의미**: 문서 유사도 최소 기준
   - **설명**:
     - 질문과 문서의 유사도가 이 값보다 낮으면 제외
     - 숫자가 높을수록 더 관련성 높은 문서만 선택
   - **권장값**:
     - `0.5`: 느슨한 매칭 (관련성 낮아도 포함)
     - `0.7`: 일반적인 사용 (균형)
     - `0.8~0.9`: 엄격한 매칭 (정확한 문서만)

3. **`maxChunks`** (1~10)
   - **의미**: 실제로 사용할 최대 문서 조각 개수
   - **설명**:
     - topK로 검색 후, 상위 N개만 실제로 사용
     - 비용 절감 및 응답 품질 향상

4. **`maxContextChars`** (500~8000)
   - **의미**: AI에게 전달할 최대 문맥 길이 (글자 수)
   - **설명**:
     - 너무 길면 비용 증가, 너무 짧으면 정보 부족
   - **권장값**:
     - `2000`: 짧은 답변 (FAQ)
     - `4000`: 일반적인 사용
     - `6000~8000`: 복잡한 문서 분석

### 5-3. RAG 설정 API 예시

**설정 조회**:
```bash
curl -X GET "https://api.luminaops.com/api/v1/workspaces/1/rag/settings" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**응답**:
```json
{
  "topK": 5,
  "similarityThreshold": 0.7,
  "maxChunks": 5,
  "maxContextChars": 4000
}
```

**설정 수정**:
```bash
curl -X PUT "https://api.luminaops.com/api/v1/workspaces/1/rag/settings" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topK": 7,
    "similarityThreshold": 0.75,
    "maxChunks": 5,
    "maxContextChars": 5000
  }'
```

### 5-4. RAG 설정 최적화 가이드

| 사용 사례 | topK | similarityThreshold | maxChunks | maxContextChars |
|----------|------|---------------------|-----------|-----------------|
| **FAQ 챗봇** | 3 | 0.8 | 3 | 2000 |
| **고객센터** | 5 | 0.7 | 5 | 4000 |
| **법률/의료 상담** | 7 | 0.8 | 7 | 6000 |
| **기술 문서 검색** | 10 | 0.65 | 8 | 8000 |
| **상품 추천** | 5 | 0.6 | 5 | 3000 |

### 5-5. 고급 검색 옵션 (하이브리드 + 리랭크)

RAG 품질을 더 높이기 위해 **하이브리드 검색**과 **리랭크**를 사용할 수 있습니다.

- **하이브리드 검색**: 벡터 검색 + 키워드 검색(FTS/pg_trgm)을 결합해 정확도/재현율을 함께 개선합니다.
- **리랭크(Cohere)**: 1차 후보를 재정렬해 최종 정확도를 높입니다.

설정 예시(요약):
```yaml
rag:
  hybrid:
    enabled: true
    vector-top-k: 20
    keyword-top-k: 20
    candidate-top-k: 30
    rrf-k: 60
  rerank:
    cohere:
      enabled: true
      api-key: ${COHERE_API_KEY}
      model: rerank-v3.5
```

---

## 6. 실제 서비스 호출하기

### 6-1. API 키 발급

1. **웹 대시보드 접속** → 조직 설정 → API 키 관리
2. **"새 API 키 생성"** 클릭
3. 발급된 키를 안전하게 보관 (다시 볼 수 없음!)

**API 키 예시**: `lmops_1a2b3c4d5e6f7g8h9i0j`

### 6-2. 챗봇 호출 API

**엔드포인트**: `POST /v1/chat/completions`

이 엔드포인트는 **외부 시스템에서 호출**하는 메인 API입니다.

#### 기본 호출 예시

```bash
curl -X POST "https://api.luminaops.com/v1/chat/completions" \
  -H "X-API-Key: lmops_1a2b3c4d5e6f7g8h9i0j" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": 1,
    "promptKey": "customer_support_bot",
    "variables": {
      "question": "환불은 어떻게 하나요?"
    },
    "ragEnabled": false
  }'
```

**요청 필드**:
- `workspaceId`: 워크스페이스 ID
- `promptKey`: 프롬프트 키 (3번에서 만든 것)
- `variables`: 프롬프트 템플릿에 주입할 변수들
- `ragEnabled`: RAG 사용 여부 (true/false)

**응답 예시**:
```json
{
  "requestId": "req_abc123def456",
  "content": "환불은 제품 수령 후 7일 이내에 가능합니다. 고객센터(1588-1234)로 연락주시면 안내해드리겠습니다.",
  "provider": "OPENAI",
  "model": "gpt-4o",
  "usageInfo": {
    "inputTokens": 50,
    "outputTokens": 80,
    "totalTokens": 130
  },
  "finishReason": "STOP",
  "latencyMs": 1234
}
```

#### RAG 활성화 호출 예시

```bash
curl -X POST "https://api.luminaops.com/v1/chat/completions" \
  -H "X-API-Key: lmops_1a2b3c4d5e6f7g8h9i0j" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": 1,
    "promptKey": "customer_support_bot",
    "variables": {
      "question": "우리 회사 2024년 신제품 출시 일정이 언제야?"
    },
    "ragEnabled": true
  }'
```

RAG가 활성화되면:
1. 질문과 관련된 문서를 자동으로 검색
2. 검색된 문서를 프롬프트에 자동 주입
3. 문서 기반으로 정확한 답변 생성

### 6-3. 다양한 언어 SDK 예시

#### Python
```python
import requests

API_KEY = "lmops_1a2b3c4d5e6f7g8h9i0j"
BASE_URL = "https://api.luminaops.com"

def ask_chatbot(question: str, rag_enabled: bool = False):
    response = requests.post(
        f"{BASE_URL}/v1/chat/completions",
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        },
        json={
            "workspaceId": 1,
            "promptKey": "customer_support_bot",
            "variables": {
                "question": question
            },
            "ragEnabled": rag_enabled
        }
    )
    return response.json()

# 사용 예시
result = ask_chatbot("환불 정책이 뭐야?", rag_enabled=True)
print(result["content"])
```

#### JavaScript (Node.js)
```javascript
const axios = require('axios');

const API_KEY = 'lmops_1a2b3c4d5e6f7g8h9i0j';
const BASE_URL = 'https://api.luminaops.com';

async function askChatbot(question, ragEnabled = false) {
  const response = await axios.post(
    `${BASE_URL}/v1/chat/completions`,
    {
      workspaceId: 1,
      promptKey: 'customer_support_bot',
      variables: {
        question: question
      },
      ragEnabled: ragEnabled
    },
    {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

// 사용 예시
askChatbot('환불 정책이 뭐야?', true)
  .then(result => console.log(result.content));
```

#### Java
```java
import java.net.http.*;
import java.net.URI;
import com.fasterxml.jackson.databind.ObjectMapper;

public class LuminaOpsClient {
    private static final String API_KEY = "lmops_1a2b3c4d5e6f7g8h9i0j";
    private static final String BASE_URL = "https://api.luminaops.com";
    
    public static String askChatbot(String question, boolean ragEnabled) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        
        Map<String, Object> requestBody = Map.of(
            "workspaceId", 1,
            "promptKey", "customer_support_bot",
            "variables", Map.of("question", question),
            "ragEnabled", ragEnabled
        );
        
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/v1/chat/completions"))
            .header("X-API-Key", API_KEY)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(
                mapper.writeValueAsString(requestBody)))
            .build();
        
        HttpResponse<String> response = client.send(request, 
            HttpResponse.BodyHandlers.ofString());
        
        return response.body();
    }
    
    public static void main(String[] args) throws Exception {
        String result = askChatbot("환불 정책이 뭐야?", true);
        System.out.println(result);
    }
}
```

### 6-4. 에러 처리

#### 일반적인 에러 코드

| HTTP 상태 | 에러 코드 | 의미 | 해결 방법 |
|----------|----------|------|----------|
| 401 | UNAUTHORIZED | API 키가 유효하지 않음 | API 키 확인 |
| 403 | FORBIDDEN | 권한 없음 | 워크스페이스 접근 권한 확인 |
| 404 | NOT_FOUND | 프롬프트나 리소스를 찾을 수 없음 | promptKey, workspaceId 확인 |
| 400 | INVALID_INPUT_VALUE | 요청 파라미터 오류 | 필수 필드 확인 |
| 500 | INTERNAL_SERVER_ERROR | 서버 오류 | 잠시 후 재시도 또는 고객센터 문의 |

**에러 응답 예시**:
```json
{
  "errorCode": "INVALID_INPUT_VALUE",
  "message": "promptKey는 필수입니다.",
  "timestamp": "2024-02-05T15:30:00"
}
```

---

## 7. 고급 기능

### 7-1. 프롬프트 릴리즈 (배포)

버전을 만든 후, **릴리즈**해야 실제 서비스에서 사용됩니다.

**릴리즈 API**: `POST /api/v1/prompts/{promptId}/versions/{versionId}/release`

```bash
curl -X POST "https://api.luminaops.com/api/v1/prompts/42/versions/101/release" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "고객센터 챗봇 v1 배포 - 초기 버전"
  }'
```

### 7-2. 버전 롤백

문제가 생기면 이전 버전으로 롤백할 수 있습니다.

**롤백 API**: `POST /api/v1/prompts/{promptId}/versions/{versionId}/rollback`

```bash
curl -X POST "https://api.luminaops.com/api/v1/prompts/42/versions/100/rollback" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "v101에서 응답 품질 저하 발견, v100으로 롤백"
  }'
```

### 7-3. 통계 및 로그 조회

**사용량 통계**: `GET /api/v1/workspaces/{workspaceId}/statistics/overview`

```bash
curl -X GET "https://api.luminaops.com/api/v1/workspaces/1/statistics/overview?startDate=2024-02-01&endDate=2024-02-05" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**요청 로그**: `GET /api/v1/request-logs?workspaceId={workspaceId}`

```bash
curl -X GET "https://api.luminaops.com/api/v1/request-logs?workspaceId=1&page=0&size=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7-4. 문서 업로드 (RAG용)

**문서 업로드 API**: `POST /api/v1/workspaces/{workspaceId}/documents`

```bash
curl -X POST "https://api.luminaops.com/api/v1/workspaces/1/documents" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@환불정책.pdf" \
  -F "description=2024년 환불 정책 문서"
```

**지원 파일 형식**:
- PDF (.pdf)
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- PowerPoint (.ppt, .pptx)
- 텍스트 (.txt, .md)

---

## 📞 문의 및 지원

- **기술 문서**: [SpringAI_Overview.md](../SpringAI_Overview.md)
- **API 명세**: [api-spec.md](../.ai/api-spec.md)
- **이슈 신고**: GitHub Issues
- **이메일**: support@luminaops.com

---

## 📝 체크리스트

서비스를 시작하기 전에 다음 항목을 확인하세요:

- [ ] 계정 생성 완료
- [ ] 조직(Organization) 생성 완료
- [ ] 워크스페이스(Workspace) 생성 완료
- [ ] API 키 발급 완료
- [ ] 프롬프트 생성 완료
- [ ] 프롬프트 버전 생성 완료
- [ ] 버전 릴리즈 완료
- [ ] (선택) RAG 설정 완료
- [ ] (선택) 문서 업로드 완료
- [ ] API 호출 테스트 완료

---

**축하합니다! 🎉 이제 LuminaOps를 사용할 준비가 되었습니다.**
