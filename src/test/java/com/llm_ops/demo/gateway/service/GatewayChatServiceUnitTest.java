package com.llm_ops.demo.gateway.service;

import com.google.genai.errors.ApiException;
import com.llm_ops.demo.gateway.config.GatewayReliabilityProperties;
import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.dto.GatewayChatResponse;
import com.llm_ops.demo.gateway.log.service.RequestLogWriter;
import com.llm_ops.demo.budget.service.BudgetDecision;
import com.llm_ops.demo.budget.service.BudgetGuardrailService;
import com.llm_ops.demo.budget.service.BudgetUsageService;
import com.llm_ops.demo.global.error.GatewayException;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.service.OrganizationApiKeyAuthService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.prompt.domain.PromptRelease;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.rag.dto.ChunkDetailResponse;
import com.llm_ops.demo.rag.config.RagContextProperties;
import com.llm_ops.demo.rag.service.RagContextBuilder;
import com.llm_ops.demo.rag.service.RagSearchService;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import com.llm_ops.demo.workspace.service.WorkspaceRagSettingsService;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

/**
 * GatewayChatService의 순수 단위 테스트입니다.
 * Mockito를 사용하여 의존성을 주입하고, renderPrompt() 메서드의 로직을 검증합니다.
 * RAG 검색 서비스가 주입되지 않음을 확인하여 게이트웨이의 독립성을 증명합니다.
 */
@ExtendWith(MockitoExtension.class)
class GatewayChatServiceUnitTest {

    @Mock
    private OrganizationApiKeyAuthService organizationApiKeyAuthService;

    @Mock
    private ProviderCredentialService providerCredentialService;

    @Mock
    private LlmCallService llmCallService;

    @Mock
    private RagSearchService ragSearchService;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private WorkspaceRagSettingsService workspaceRagSettingsService;

    @Mock
    private RequestLogWriter requestLogWriter;

    @Mock
    private BudgetGuardrailService budgetGuardrailService;

    @Mock
    private BudgetUsageService budgetUsageService;

    @Mock
    private PromptRepository promptRepository;

    @Mock
    private PromptReleaseRepository promptReleaseRepository;

    @Spy
    private RagContextBuilder ragContextBuilder = new RagContextBuilder(new RagContextProperties());

    @Spy
    private GatewayReliabilityProperties gatewayReliabilityProperties = new GatewayReliabilityProperties();

    @Mock
    private GatewayMetrics gatewayMetrics;

    @Mock
    private CircuitBreakerRegistry circuitBreakerRegistry;

    @InjectMocks
    private GatewayChatService gatewayChatService;

    private final Map<String, CircuitBreaker> testCircuitBreakers = new HashMap<>();

    @BeforeEach
    void setUpCircuitBreakerRegistry() {
        lenient().when(circuitBreakerRegistry.circuitBreaker(anyString()))
                .thenAnswer(invocation ->
                        testCircuitBreakers.computeIfAbsent(
                                invocation.getArgument(0),
                                CircuitBreaker::ofDefaults
                        ));
    }

    @Test
    @DisplayName("변수 치환 테스트: {{name}} 플레이스홀더가 값으로 치환된다")
    void 변수_치환_테스트() throws Exception {
        // given
        String promptKey = "hello {{name}}, welcome to {{place}}";
        Map<String, String> variables = new HashMap<>();
        variables.put("name", "lumina");
        variables.put("place", "gateway");

        // when
        String result = invokeRenderPrompt(promptKey, variables);

        // then
        assertThat(result).isEqualTo("hello lumina, welcome to gateway");
    }

    @Test
    @DisplayName("빈 변수 테스트: 변수가 없으면 원본 프롬프트가 반환된다")
    void 빈_변수_테스트() throws Exception {
        // given
        String promptKey = "hello {{name}}";
        Map<String, String> variables = new HashMap<>();

        // when
        String result = invokeRenderPrompt(promptKey, variables);

        // then
        assertThat(result).isEqualTo("hello {{name}}");
    }

    @Test
    @DisplayName("null 변수 맵 테스트: variables가 null이면 원본 프롬프트가 반환된다")
    void null_변수_맵_테스트() throws Exception {
        // given
        String promptKey = "hello {{name}}";

        // when
        String result = invokeRenderPrompt(promptKey, null);

        // then
        assertThat(result).isEqualTo("hello {{name}}");
    }

    @Test
    @DisplayName("복수 변수 치환 테스트: 여러 플레이스홀더가 모두 치환된다")
    void 복수_변수_치환_테스트() throws Exception {
        // given
        String promptKey = "{{greeting}} {{name}}, your id is {{id}}";
        Map<String, String> variables = new HashMap<>();
        variables.put("greeting", "Hello");
        variables.put("name", "Alice");
        variables.put("id", "12345");

        // when
        String result = invokeRenderPrompt(promptKey, variables);

        // then
        assertThat(result).isEqualTo("Hello Alice, your id is 12345");
    }

    @Test
    @DisplayName("부분 변수 치환 테스트: 일부 플레이스홀더만 치환되고 나머지는 유지된다")
    void 부분_변수_치환_테스트() throws Exception {
        // given
        String promptKey = "{{greeting}} {{name}}, your id is {{id}}";
        Map<String, String> variables = new HashMap<>();
        variables.put("greeting", "Hello");
        variables.put("name", "Bob");
        // id는 제공하지 않음

        // when
        String result = invokeRenderPrompt(promptKey, variables);

        // then
        assertThat(result).isEqualTo("Hello Bob, your id is {{id}}");
    }

    @Test
    @DisplayName("중복 플레이스홀더 테스트: 같은 플레이스홀더가 여러 번 나타나면 모두 치환된다")
    void 중복_플레이스홀더_테스트() throws Exception {
        // given
        String promptKey = "{{name}} is {{name}}, and {{name}} is great";
        Map<String, String> variables = new HashMap<>();
        variables.put("name", "lumina");

        // when
        String result = invokeRenderPrompt(promptKey, variables);

        // then
        assertThat(result).isEqualTo("lumina is lumina, and lumina is great");
    }

    @Test
    @DisplayName("특수문자 포함 변수 테스트: 특수문자가 포함된 값도 정상 치환된다")
    void 특수문자_포함_변수_테스트() throws Exception {
        // given
        String promptKey = "question: {{question}}";
        Map<String, String> variables = new HashMap<>();
        variables.put("question", "What's the weather? It's 25\u00b0C & sunny!");

        // when
        String result = invokeRenderPrompt(promptKey, variables);

        // then
        assertThat(result).isEqualTo("question: What's the weather? It's 25\u00b0C & sunny!");
    }

    @Nested
    @DisplayName("RAG 컨텍스트 주입 테스트")
    class RagContextEnrichmentTest {
        private static final int RAG_TOP_K = 3;
        private static final double RAG_SIMILARITY_THRESHOLD = 0.0;
        private static final int RAG_MAX_CHUNKS = 3;
        private static final int RAG_MAX_CONTEXT_CHARS = 4000;

        @Test
        @DisplayName("sha256HexOrNull은 공백이면 null, 값이 있으면 64자리 hex")
        void sha256_hex_테스트() throws Exception {
            assertThat(invokeSha256HexOrNull(" ")).isNull();
            String hash = invokeSha256HexOrNull("hello");
            assertThat(hash).isNotNull();
            assertThat(hash).hasSize(64);
            assertThat(hash).matches("[0-9a-f]{64}");
        }

        @Test
        @DisplayName("RAG enabled 시 markSuccess에 rag_* 메트릭이 전달된다")
        void RAG_enabled_markSuccess_rag_metrics_전달_테스트() throws Exception {
            // given
            String apiKey = "lum_test";
            Long organizationId = 1L;
            Long workspaceId = 1L;
            UUID requestId = UUID.randomUUID();

            List<ChunkDetailResponse> chunks = List.of(
                    new ChunkDetailResponse("서울의 오늘 날씨는 맑음입니다.", 0.95, 10L, "weather.txt"),
                    new ChunkDetailResponse("기온은 25도입니다.", 0.90, 10L, "weather.txt")
            );

            OrganizationApiKeyAuthService.AuthResult authResult =
                    new OrganizationApiKeyAuthService.AuthResult(organizationId, 99L, "lum_test");
            when(organizationApiKeyAuthService.resolveAuthResult(apiKey)).thenReturn(authResult);
            when(requestLogWriter.start(any())).thenReturn(requestId);
            Workspace workspace = org.mockito.Mockito.mock(Workspace.class);
            when(workspace.getId()).thenReturn(workspaceId);
            when(workspaceRepository.findByIdAndOrganizationIdAndStatus(workspaceId, organizationId, WorkspaceStatus.ACTIVE))
                    .thenReturn(Optional.of(workspace));

            com.llm_ops.demo.prompt.domain.Prompt promptEntity = org.mockito.Mockito.mock(com.llm_ops.demo.prompt.domain.Prompt.class);
            when(promptEntity.getId()).thenReturn(100L);
            when(promptRepository.findByWorkspaceAndPromptKeyAndStatus(eq(workspace), eq("hello"), eq(PromptStatus.ACTIVE)))
                    .thenReturn(Optional.of(promptEntity));

            PromptVersion activeVersion = org.mockito.Mockito.mock(PromptVersion.class);
            when(activeVersion.getUserTemplate()).thenReturn("hello");
            when(activeVersion.getSystemPrompt()).thenReturn(null);
            when(activeVersion.getProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getModel()).thenReturn("gpt-4o-mini");

            PromptRelease release = org.mockito.Mockito.mock(PromptRelease.class);
            when(release.getActiveVersion()).thenReturn(activeVersion);
            when(promptReleaseRepository.findWithActiveVersionByPromptId(100L)).thenReturn(Optional.of(release));

            when(workspaceRagSettingsService.resolveRuntimeSettings(workspaceId))
                    .thenReturn(new WorkspaceRagSettingsService.RagRuntimeSettings(
                            RAG_TOP_K,
                            RAG_SIMILARITY_THRESHOLD,
                            RAG_MAX_CHUNKS,
                            RAG_MAX_CONTEXT_CHARS,
                            true,
                            false,
                            10,
                            500,
                            50
                    ));
            when(ragSearchService.search(eq(workspaceId), anyString(), any(com.llm_ops.demo.rag.service.RagSearchService.RagSearchOptions.class)))
                    .thenReturn(new com.llm_ops.demo.rag.dto.RagSearchResponse(chunks));
            when(providerCredentialService.resolveApiKey(eq(organizationId), eq(ProviderType.OPENAI)))
                    .thenReturn(new ProviderCredentialService.ResolvedProviderApiKey(10L, ProviderType.OPENAI, "provider-key"));
            when(budgetUsageService.currentUtcYearMonth()).thenReturn(YearMonth.of(2026, 2));
            when(budgetGuardrailService.evaluateWorkspaceDegrade(eq(workspaceId), anyString())).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(10L))).thenReturn(BudgetDecision.allow());

            ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                    .withModel("gpt-4o-mini")
                    .withUsage(new DefaultUsage(null, null, 10L))
                    .build();
            ChatResponse chatResponse = new ChatResponse(List.of(new Generation(new AssistantMessage("ok"))), metadata);
            when(llmCallService.callProvider(any(), anyString(), any(), anyString(), any())).thenReturn(chatResponse);

            GatewayChatRequest request = new GatewayChatRequest(
                    workspaceId,
                    "hello",
                    Map.of(),
                    true
            );

            RagContextBuilder.RagContextResult ctx = ragContextBuilder.build(chunks, RAG_MAX_CHUNKS, RAG_MAX_CONTEXT_CHARS);
            String expectedHash = invokeSha256HexOrNull(ctx.context());

            // when
            gatewayChatService.chat(apiKey, request);

            // then
            ArgumentCaptor<RequestLogWriter.SuccessUpdate> captor = ArgumentCaptor.forClass(RequestLogWriter.SuccessUpdate.class);
            verify(requestLogWriter).markSuccess(eq(requestId), captor.capture());
            RequestLogWriter.SuccessUpdate update = captor.getValue();
            assertThat(update.ragLatencyMs()).isNotNull();
            assertThat(update.ragLatencyMs()).isGreaterThanOrEqualTo(0);
            assertThat(update.ragChunksCount()).isEqualTo(2);
            assertThat(update.ragContextChars()).isEqualTo(ctx.contextChars());
            assertThat(update.ragContextTruncated()).isEqualTo(ctx.truncated());
            assertThat(update.ragContextHash()).isEqualTo(expectedHash);
            assertThat(update.ragTopK()).isEqualTo(RAG_TOP_K);
            assertThat(update.ragSimilarityThreshold()).isEqualTo(RAG_SIMILARITY_THRESHOLD);
        }

        private String invokeSha256HexOrNull(String value) throws Exception {
            Method method = GatewayChatService.class.getDeclaredMethod(
                    "sha256HexOrNull",
                    String.class
            );
            method.setAccessible(true);
            return (String) method.invoke(null, value);
        }

    }

    @Nested
    @DisplayName("Failover 조건 테스트")
    class FailoverConditionTest {

        @Test
        @DisplayName("HTTP 429(Too Many Requests)은 secondary failover 대상이다")
        void http_429_예외이면_failover_대상이다() throws Exception {
            // given
            HttpClientErrorException tooManyRequests = HttpClientErrorException.create(
                    HttpStatusCode.valueOf(429),
                    "Too Many Requests",
                    HttpHeaders.EMPTY,
                    new byte[0],
                    StandardCharsets.UTF_8
            );

            // when
            boolean retryable = invokeIsRetryableException(tooManyRequests);

            // then
            assertThat(retryable).isTrue();
        }

        @Test
        @DisplayName("Gemini ApiException 429/RESOURCE_EXHAUSTED는 secondary failover 대상이다")
        void gemini_resource_exhausted_예외이면_failover_대상이다() throws Exception {
            // given
            ApiException quotaExceeded = new ApiException(429, "RESOURCE_EXHAUSTED", "quota exceeded");

            // when
            boolean retryable = invokeIsRetryableException(quotaExceeded);

            // then
            assertThat(retryable).isTrue();
        }

        @Test
        @DisplayName("Primary circuit breaker가 OPEN이면 primary 호출 없이 secondary로 failover한다")
        void primary_circuit_open이면_secondary로_failover한다() {
            // given
            String apiKey = "lum_test";
            Long organizationId = 1L;
            Long workspaceId = 1L;
            UUID requestId = UUID.randomUUID();

            OrganizationApiKeyAuthService.AuthResult authResult =
                    new OrganizationApiKeyAuthService.AuthResult(organizationId, 99L, "lum_test");
            when(organizationApiKeyAuthService.resolveAuthResult(apiKey)).thenReturn(authResult);
            when(requestLogWriter.start(any())).thenReturn(requestId);

            Workspace workspace = org.mockito.Mockito.mock(Workspace.class);
            when(workspace.getId()).thenReturn(workspaceId);
            when(workspaceRepository.findByIdAndOrganizationIdAndStatus(workspaceId, organizationId, WorkspaceStatus.ACTIVE))
                    .thenReturn(Optional.of(workspace));

            com.llm_ops.demo.prompt.domain.Prompt promptEntity = org.mockito.Mockito.mock(com.llm_ops.demo.prompt.domain.Prompt.class);
            when(promptEntity.getId()).thenReturn(100L);
            when(promptRepository.findByWorkspaceAndPromptKeyAndStatus(eq(workspace), eq("hello"), eq(PromptStatus.ACTIVE)))
                    .thenReturn(Optional.of(promptEntity));

            PromptVersion activeVersion = org.mockito.Mockito.mock(PromptVersion.class);
            when(activeVersion.getUserTemplate()).thenReturn("hello");
            when(activeVersion.getSystemPrompt()).thenReturn(null);
            when(activeVersion.getProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getModel()).thenReturn("gpt-4o-mini");
            when(activeVersion.getSecondaryProvider()).thenReturn(ProviderType.ANTHROPIC);
            when(activeVersion.getSecondaryModel()).thenReturn("claude-3-5-haiku");

            PromptRelease release = org.mockito.Mockito.mock(PromptRelease.class);
            when(release.getActiveVersion()).thenReturn(activeVersion);
            when(promptReleaseRepository.findWithActiveVersionByPromptId(100L)).thenReturn(Optional.of(release));

            when(providerCredentialService.resolveApiKey(eq(organizationId), eq(ProviderType.OPENAI)))
                    .thenReturn(new ProviderCredentialService.ResolvedProviderApiKey(10L, ProviderType.OPENAI, "provider-key-openai"));
            when(providerCredentialService.resolveApiKey(eq(organizationId), eq(ProviderType.ANTHROPIC)))
                    .thenReturn(new ProviderCredentialService.ResolvedProviderApiKey(11L, ProviderType.ANTHROPIC, "provider-key-anthropic"));

            when(budgetUsageService.currentUtcYearMonth()).thenReturn(YearMonth.of(2026, 2));
            when(budgetGuardrailService.evaluateWorkspaceDegrade(eq(workspaceId), anyString())).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(10L))).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(11L))).thenReturn(BudgetDecision.allow());

            CircuitBreaker openAiCircuitBreaker = CircuitBreaker.ofDefaults("openai");
            openAiCircuitBreaker.transitionToOpenState();
            CircuitBreaker anthropicCircuitBreaker = CircuitBreaker.ofDefaults("anthropic");
            when(circuitBreakerRegistry.circuitBreaker("openai")).thenReturn(openAiCircuitBreaker);
            when(circuitBreakerRegistry.circuitBreaker("anthropic")).thenReturn(anthropicCircuitBreaker);

            ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                    .withModel("claude-3-5-haiku")
                    .withUsage(new DefaultUsage(null, null, 10L))
                    .build();
            ChatResponse chatResponse = new ChatResponse(List.of(new Generation(new AssistantMessage("ok"))), metadata);
            when(llmCallService.callProvider(any(), anyString(), any(), anyString(), any()))
                    .thenReturn(chatResponse);

            GatewayChatRequest request = new GatewayChatRequest(workspaceId, "hello", Map.of(), false);

            // when
            GatewayChatResponse response = gatewayChatService.chat(apiKey, request);

            // then
            assertThat(response).isNotNull();
            assertThat(response.isFailover()).isTrue();
            verify(llmCallService, times(1)).callProvider(any(), anyString(), any(), anyString(), any());
        }

        @Test
        @DisplayName("Primary가 429로 실패하면 secondary로 재시도하여 성공한다")
        void primary가_429로_실패하면_secondary로_failover한다() {
            // given
            String apiKey = "lum_test";
            Long organizationId = 1L;
            Long workspaceId = 1L;
            UUID requestId = UUID.randomUUID();

            OrganizationApiKeyAuthService.AuthResult authResult =
                    new OrganizationApiKeyAuthService.AuthResult(organizationId, 99L, "lum_test");
            when(organizationApiKeyAuthService.resolveAuthResult(apiKey)).thenReturn(authResult);
            when(requestLogWriter.start(any())).thenReturn(requestId);

            Workspace workspace = org.mockito.Mockito.mock(Workspace.class);
            when(workspace.getId()).thenReturn(workspaceId);
            when(workspaceRepository.findByIdAndOrganizationIdAndStatus(workspaceId, organizationId, WorkspaceStatus.ACTIVE))
                    .thenReturn(Optional.of(workspace));

            com.llm_ops.demo.prompt.domain.Prompt promptEntity = org.mockito.Mockito.mock(com.llm_ops.demo.prompt.domain.Prompt.class);
            when(promptEntity.getId()).thenReturn(100L);
            when(promptRepository.findByWorkspaceAndPromptKeyAndStatus(eq(workspace), eq("hello"), eq(PromptStatus.ACTIVE)))
                    .thenReturn(Optional.of(promptEntity));

            PromptVersion activeVersion = org.mockito.Mockito.mock(PromptVersion.class);
            when(activeVersion.getUserTemplate()).thenReturn("hello");
            when(activeVersion.getSystemPrompt()).thenReturn(null);
            when(activeVersion.getProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getModel()).thenReturn("gpt-4o-mini");
            when(activeVersion.getSecondaryProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getSecondaryModel()).thenReturn("gpt-4o-mini");

            PromptRelease release = org.mockito.Mockito.mock(PromptRelease.class);
            when(release.getActiveVersion()).thenReturn(activeVersion);
            when(promptReleaseRepository.findWithActiveVersionByPromptId(100L)).thenReturn(Optional.of(release));

            when(providerCredentialService.resolveApiKey(eq(organizationId), eq(ProviderType.OPENAI)))
                    .thenReturn(new ProviderCredentialService.ResolvedProviderApiKey(10L, ProviderType.OPENAI, "provider-key"));
            when(budgetUsageService.currentUtcYearMonth()).thenReturn(YearMonth.of(2026, 2));
            when(budgetGuardrailService.evaluateWorkspaceDegrade(eq(workspaceId), anyString())).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(10L))).thenReturn(BudgetDecision.allow());

            HttpClientErrorException tooManyRequests = HttpClientErrorException.create(
                    HttpStatusCode.valueOf(429),
                    "Too Many Requests",
                    HttpHeaders.EMPTY,
                    new byte[0],
                    StandardCharsets.UTF_8
            );

            ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                    .withModel("gpt-4o-mini")
                    .withUsage(new DefaultUsage(null, null, 10L))
                    .build();
            ChatResponse chatResponse = new ChatResponse(List.of(new Generation(new AssistantMessage("ok"))), metadata);
            when(llmCallService.callProvider(any(), anyString(), any(), anyString(), any()))
                    .thenThrow(tooManyRequests)
                    .thenReturn(chatResponse);

            GatewayChatRequest request = new GatewayChatRequest(
                    workspaceId,
                    "hello",
                    Map.of(),
                    false
            );

            // when
            GatewayChatResponse response = gatewayChatService.chat(apiKey, request);

            // then
            assertThat(response).isNotNull();
            assertThat(response.isFailover()).isTrue();
            verify(llmCallService, times(2)).callProvider(any(), anyString(), any(), anyString(), any());
        }

        @Test
        @DisplayName("Primary가 503이면 1회 재시도 후 secondary로 전환한다")
        void primary가_503이면_1회_재시도_후_secondary로_failover한다() {
            // given
            String apiKey = "lum_test";
            Long organizationId = 1L;
            Long workspaceId = 1L;
            UUID requestId = UUID.randomUUID();

            OrganizationApiKeyAuthService.AuthResult authResult =
                    new OrganizationApiKeyAuthService.AuthResult(organizationId, 99L, "lum_test");
            when(organizationApiKeyAuthService.resolveAuthResult(apiKey)).thenReturn(authResult);
            when(requestLogWriter.start(any())).thenReturn(requestId);

            Workspace workspace = org.mockito.Mockito.mock(Workspace.class);
            when(workspace.getId()).thenReturn(workspaceId);
            when(workspaceRepository.findByIdAndOrganizationIdAndStatus(workspaceId, organizationId, WorkspaceStatus.ACTIVE))
                    .thenReturn(Optional.of(workspace));

            com.llm_ops.demo.prompt.domain.Prompt promptEntity = org.mockito.Mockito.mock(com.llm_ops.demo.prompt.domain.Prompt.class);
            when(promptEntity.getId()).thenReturn(100L);
            when(promptRepository.findByWorkspaceAndPromptKeyAndStatus(eq(workspace), eq("hello"), eq(PromptStatus.ACTIVE)))
                    .thenReturn(Optional.of(promptEntity));

            PromptVersion activeVersion = org.mockito.Mockito.mock(PromptVersion.class);
            when(activeVersion.getUserTemplate()).thenReturn("hello");
            when(activeVersion.getSystemPrompt()).thenReturn(null);
            when(activeVersion.getProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getModel()).thenReturn("gpt-4o-mini");
            when(activeVersion.getSecondaryProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getSecondaryModel()).thenReturn("gpt-4o-mini");

            PromptRelease release = org.mockito.Mockito.mock(PromptRelease.class);
            when(release.getActiveVersion()).thenReturn(activeVersion);
            when(promptReleaseRepository.findWithActiveVersionByPromptId(100L)).thenReturn(Optional.of(release));

            when(providerCredentialService.resolveApiKey(eq(organizationId), eq(ProviderType.OPENAI)))
                    .thenReturn(
                            new ProviderCredentialService.ResolvedProviderApiKey(10L, ProviderType.OPENAI, "provider-key"),
                            new ProviderCredentialService.ResolvedProviderApiKey(11L, ProviderType.OPENAI, "provider-key-2")
                    );
            when(budgetUsageService.currentUtcYearMonth()).thenReturn(YearMonth.of(2026, 2));
            when(budgetGuardrailService.evaluateWorkspaceDegrade(eq(workspaceId), anyString())).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(10L))).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(11L))).thenReturn(BudgetDecision.allow());

            HttpServerErrorException upstream503 = HttpServerErrorException.create(
                    HttpStatusCode.valueOf(503),
                    "Service Unavailable",
                    HttpHeaders.EMPTY,
                    new byte[0],
                    StandardCharsets.UTF_8
            );
            ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                    .withModel("gpt-4o-mini")
                    .withUsage(new DefaultUsage(null, null, 10L))
                    .build();
            ChatResponse chatResponse = new ChatResponse(List.of(new Generation(new AssistantMessage("ok"))), metadata);

            when(llmCallService.callProvider(any(), anyString(), any(), anyString(), any()))
                    .thenThrow(upstream503)
                    .thenThrow(upstream503)
                    .thenReturn(chatResponse);

            GatewayChatRequest request = new GatewayChatRequest(workspaceId, "hello", Map.of(), false);

            // when
            GatewayChatResponse response = gatewayChatService.chat(apiKey, request);

            // then
            assertThat(response).isNotNull();
            assertThat(response.isFailover()).isTrue();
            verify(llmCallService, times(3)).callProvider(any(), anyString(), any(), anyString(), any());
        }

        @Test
        @DisplayName("Primary가 503이어도 남은 시간이 부족하면 retry를 생략하고 secondary로 전환한다")
        void primary가_503이어도_남은시간_부족하면_retry를_생략하고_secondary로_failover한다() {
            // given
            gatewayReliabilityProperties.setRequestTimeoutMs(1_000);
            gatewayReliabilityProperties.setMinRetryBudgetMs(1_200);
            gatewayReliabilityProperties.setMinFailoverBudgetMs(100);
            gatewayReliabilityProperties.setRetryBackoffMs(0);

            String apiKey = "lum_test";
            Long organizationId = 1L;
            Long workspaceId = 1L;
            UUID requestId = UUID.randomUUID();

            OrganizationApiKeyAuthService.AuthResult authResult =
                    new OrganizationApiKeyAuthService.AuthResult(organizationId, 99L, "lum_test");
            when(organizationApiKeyAuthService.resolveAuthResult(apiKey)).thenReturn(authResult);
            when(requestLogWriter.start(any())).thenReturn(requestId);

            Workspace workspace = org.mockito.Mockito.mock(Workspace.class);
            when(workspace.getId()).thenReturn(workspaceId);
            when(workspaceRepository.findByIdAndOrganizationIdAndStatus(workspaceId, organizationId, WorkspaceStatus.ACTIVE))
                    .thenReturn(Optional.of(workspace));

            com.llm_ops.demo.prompt.domain.Prompt promptEntity = org.mockito.Mockito.mock(com.llm_ops.demo.prompt.domain.Prompt.class);
            when(promptEntity.getId()).thenReturn(100L);
            when(promptRepository.findByWorkspaceAndPromptKeyAndStatus(eq(workspace), eq("hello"), eq(PromptStatus.ACTIVE)))
                    .thenReturn(Optional.of(promptEntity));

            PromptVersion activeVersion = org.mockito.Mockito.mock(PromptVersion.class);
            when(activeVersion.getUserTemplate()).thenReturn("hello");
            when(activeVersion.getSystemPrompt()).thenReturn(null);
            when(activeVersion.getProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getModel()).thenReturn("gpt-4o-mini");
            when(activeVersion.getSecondaryProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getSecondaryModel()).thenReturn("gpt-4o-mini");

            PromptRelease release = org.mockito.Mockito.mock(PromptRelease.class);
            when(release.getActiveVersion()).thenReturn(activeVersion);
            when(promptReleaseRepository.findWithActiveVersionByPromptId(100L)).thenReturn(Optional.of(release));

            when(providerCredentialService.resolveApiKey(eq(organizationId), eq(ProviderType.OPENAI)))
                    .thenReturn(
                            new ProviderCredentialService.ResolvedProviderApiKey(10L, ProviderType.OPENAI, "provider-key"),
                            new ProviderCredentialService.ResolvedProviderApiKey(11L, ProviderType.OPENAI, "provider-key-2")
                    );
            when(budgetUsageService.currentUtcYearMonth()).thenReturn(YearMonth.of(2026, 2));
            when(budgetGuardrailService.evaluateWorkspaceDegrade(eq(workspaceId), anyString())).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(10L))).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(11L))).thenReturn(BudgetDecision.allow());

            HttpServerErrorException upstream503 = HttpServerErrorException.create(
                    HttpStatusCode.valueOf(503),
                    "Service Unavailable",
                    HttpHeaders.EMPTY,
                    new byte[0],
                    StandardCharsets.UTF_8
            );
            ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                    .withModel("gpt-4o-mini")
                    .withUsage(new DefaultUsage(null, null, 10L))
                    .build();
            ChatResponse chatResponse = new ChatResponse(List.of(new Generation(new AssistantMessage("ok"))), metadata);

            when(llmCallService.callProvider(any(), anyString(), any(), anyString(), any()))
                    .thenThrow(upstream503)
                    .thenReturn(chatResponse);

            GatewayChatRequest request = new GatewayChatRequest(workspaceId, "hello", Map.of(), false);

            // when
            GatewayChatResponse response = gatewayChatService.chat(apiKey, request);

            // then
            assertThat(response).isNotNull();
            assertThat(response.isFailover()).isTrue();
            verify(llmCallService, times(2)).callProvider(any(), anyString(), any(), anyString(), any());
        }

        @Test
        @DisplayName("Primary 시도 시간이 길어 time-budget timeout이면 secondary로 전환한다")
        void primary_시도시간이_길어_timeout이면_secondary로_failover한다() {
            // given
            gatewayReliabilityProperties.setRequestTimeoutMs(500);
            gatewayReliabilityProperties.setMinRetryBudgetMs(1_200);
            gatewayReliabilityProperties.setMinFailoverBudgetMs(50);
            gatewayReliabilityProperties.setRetryBackoffMs(0);

            String apiKey = "lum_test";
            Long organizationId = 1L;
            Long workspaceId = 1L;
            UUID requestId = UUID.randomUUID();

            OrganizationApiKeyAuthService.AuthResult authResult =
                    new OrganizationApiKeyAuthService.AuthResult(organizationId, 99L, "lum_test");
            when(organizationApiKeyAuthService.resolveAuthResult(apiKey)).thenReturn(authResult);
            when(requestLogWriter.start(any())).thenReturn(requestId);

            Workspace workspace = org.mockito.Mockito.mock(Workspace.class);
            when(workspace.getId()).thenReturn(workspaceId);
            when(workspaceRepository.findByIdAndOrganizationIdAndStatus(workspaceId, organizationId, WorkspaceStatus.ACTIVE))
                    .thenReturn(Optional.of(workspace));

            com.llm_ops.demo.prompt.domain.Prompt promptEntity = org.mockito.Mockito.mock(com.llm_ops.demo.prompt.domain.Prompt.class);
            when(promptEntity.getId()).thenReturn(100L);
            when(promptRepository.findByWorkspaceAndPromptKeyAndStatus(eq(workspace), eq("hello"), eq(PromptStatus.ACTIVE)))
                    .thenReturn(Optional.of(promptEntity));

            PromptVersion activeVersion = org.mockito.Mockito.mock(PromptVersion.class);
            when(activeVersion.getUserTemplate()).thenReturn("hello");
            when(activeVersion.getSystemPrompt()).thenReturn(null);
            when(activeVersion.getProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getModel()).thenReturn("gpt-4o-mini");
            when(activeVersion.getSecondaryProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getSecondaryModel()).thenReturn("gpt-4o-mini");

            PromptRelease release = org.mockito.Mockito.mock(PromptRelease.class);
            when(release.getActiveVersion()).thenReturn(activeVersion);
            when(promptReleaseRepository.findWithActiveVersionByPromptId(100L)).thenReturn(Optional.of(release));

            when(providerCredentialService.resolveApiKey(eq(organizationId), eq(ProviderType.OPENAI)))
                    .thenReturn(
                            new ProviderCredentialService.ResolvedProviderApiKey(10L, ProviderType.OPENAI, "provider-key"),
                            new ProviderCredentialService.ResolvedProviderApiKey(11L, ProviderType.OPENAI, "provider-key-2")
                    );
            when(budgetUsageService.currentUtcYearMonth()).thenReturn(YearMonth.of(2026, 2));
            when(budgetGuardrailService.evaluateWorkspaceDegrade(eq(workspaceId), anyString())).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(10L))).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(11L))).thenReturn(BudgetDecision.allow());

            ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                    .withModel("gpt-4o-mini")
                    .withUsage(new DefaultUsage(null, null, 10L))
                    .build();
            ChatResponse chatResponse = new ChatResponse(List.of(new Generation(new AssistantMessage("ok"))), metadata);

            when(llmCallService.callProvider(any(), anyString(), any(), anyString(), any()))
                    .thenAnswer(invocation -> {
                        Thread.sleep(700L);
                        return chatResponse;
                    })
                    .thenReturn(chatResponse);

            GatewayChatRequest request = new GatewayChatRequest(workspaceId, "hello", Map.of(), false);

            // when
            GatewayChatResponse response = gatewayChatService.chat(apiKey, request);

            // then
            assertThat(response).isNotNull();
            assertThat(response.isFailover()).isTrue();
            verify(llmCallService, times(2)).callProvider(any(), anyString(), any(), anyString(), any());
        }

        @Test
        @DisplayName("남은 시간이 failover 최소 예산보다 작으면 GW-UP-TIMEOUT으로 종료한다")
        void 남은시간이_failover_최소예산보다_작으면_timeout으로_종료한다() {
            // given
            gatewayReliabilityProperties.setRequestTimeoutMs(400);
            gatewayReliabilityProperties.setMinRetryBudgetMs(1_200);
            gatewayReliabilityProperties.setMinFailoverBudgetMs(500);
            gatewayReliabilityProperties.setRetryBackoffMs(0);

            String apiKey = "lum_test";
            Long organizationId = 1L;
            Long workspaceId = 1L;
            UUID requestId = UUID.randomUUID();

            OrganizationApiKeyAuthService.AuthResult authResult =
                    new OrganizationApiKeyAuthService.AuthResult(organizationId, 99L, "lum_test");
            when(organizationApiKeyAuthService.resolveAuthResult(apiKey)).thenReturn(authResult);
            when(requestLogWriter.start(any())).thenReturn(requestId);

            Workspace workspace = org.mockito.Mockito.mock(Workspace.class);
            when(workspace.getId()).thenReturn(workspaceId);
            when(workspaceRepository.findByIdAndOrganizationIdAndStatus(workspaceId, organizationId, WorkspaceStatus.ACTIVE))
                    .thenReturn(Optional.of(workspace));

            com.llm_ops.demo.prompt.domain.Prompt promptEntity = org.mockito.Mockito.mock(com.llm_ops.demo.prompt.domain.Prompt.class);
            when(promptEntity.getId()).thenReturn(100L);
            when(promptRepository.findByWorkspaceAndPromptKeyAndStatus(eq(workspace), eq("hello"), eq(PromptStatus.ACTIVE)))
                    .thenReturn(Optional.of(promptEntity));

            PromptVersion activeVersion = org.mockito.Mockito.mock(PromptVersion.class);
            when(activeVersion.getUserTemplate()).thenReturn("hello");
            when(activeVersion.getSystemPrompt()).thenReturn(null);
            when(activeVersion.getProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getModel()).thenReturn("gpt-4o-mini");
            when(activeVersion.getSecondaryProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getSecondaryModel()).thenReturn("gpt-4o-mini");

            PromptRelease release = org.mockito.Mockito.mock(PromptRelease.class);
            when(release.getActiveVersion()).thenReturn(activeVersion);
            when(promptReleaseRepository.findWithActiveVersionByPromptId(100L)).thenReturn(Optional.of(release));

            when(providerCredentialService.resolveApiKey(eq(organizationId), eq(ProviderType.OPENAI)))
                    .thenReturn(new ProviderCredentialService.ResolvedProviderApiKey(10L, ProviderType.OPENAI, "provider-key"));
            when(budgetUsageService.currentUtcYearMonth()).thenReturn(YearMonth.of(2026, 2));
            when(budgetGuardrailService.evaluateWorkspaceDegrade(eq(workspaceId), anyString())).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(10L))).thenReturn(BudgetDecision.allow());

            GatewayChatRequest request = new GatewayChatRequest(workspaceId, "hello", Map.of(), false);

            // when
            Throwable thrown = org.assertj.core.api.Assertions.catchThrowable(() -> gatewayChatService.chat(apiKey, request));

            // then
            assertThat(thrown).isInstanceOf(GatewayException.class);
            assertThat(((GatewayException) thrown).getCode()).isEqualTo("GW-UP-TIMEOUT");

            ArgumentCaptor<RequestLogWriter.FailUpdate> captor = ArgumentCaptor.forClass(RequestLogWriter.FailUpdate.class);
            verify(requestLogWriter).markFail(eq(requestId), captor.capture());
            RequestLogWriter.FailUpdate update = captor.getValue();
            assertThat(update.errorCode()).isEqualTo("GW-UP-TIMEOUT");
            assertThat(update.failReason()).isEqualTo("REQUEST_DEADLINE_EXCEEDED");
        }

        @Test
        @DisplayName("Primary/Secondary 모두 실패하면 GW-GW-ALL_PROVIDERS_FAILED로 기록된다")
        void primary_secondary가_모두_실패하면_예외가_발생한다() {
            // given
            String apiKey = "lum_test";
            Long organizationId = 1L;
            Long workspaceId = 1L;
            UUID requestId = UUID.randomUUID();

            OrganizationApiKeyAuthService.AuthResult authResult =
                    new OrganizationApiKeyAuthService.AuthResult(organizationId, 99L, "lum_test");
            when(organizationApiKeyAuthService.resolveAuthResult(apiKey)).thenReturn(authResult);
            when(requestLogWriter.start(any())).thenReturn(requestId);

            Workspace workspace = org.mockito.Mockito.mock(Workspace.class);
            when(workspace.getId()).thenReturn(workspaceId);
            when(workspaceRepository.findByIdAndOrganizationIdAndStatus(workspaceId, organizationId, WorkspaceStatus.ACTIVE))
                    .thenReturn(Optional.of(workspace));

            com.llm_ops.demo.prompt.domain.Prompt promptEntity = org.mockito.Mockito.mock(com.llm_ops.demo.prompt.domain.Prompt.class);
            when(promptEntity.getId()).thenReturn(100L);
            when(promptRepository.findByWorkspaceAndPromptKeyAndStatus(eq(workspace), eq("hello"), eq(PromptStatus.ACTIVE)))
                    .thenReturn(Optional.of(promptEntity));

            PromptVersion activeVersion = org.mockito.Mockito.mock(PromptVersion.class);
            when(activeVersion.getUserTemplate()).thenReturn("hello");
            when(activeVersion.getSystemPrompt()).thenReturn(null);
            when(activeVersion.getProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getModel()).thenReturn("gpt-4o-mini");
            when(activeVersion.getSecondaryProvider()).thenReturn(ProviderType.OPENAI);
            when(activeVersion.getSecondaryModel()).thenReturn("gpt-4o-mini");

            PromptRelease release = org.mockito.Mockito.mock(PromptRelease.class);
            when(release.getActiveVersion()).thenReturn(activeVersion);
            when(promptReleaseRepository.findWithActiveVersionByPromptId(100L)).thenReturn(Optional.of(release));

            when(providerCredentialService.resolveApiKey(eq(organizationId), eq(ProviderType.OPENAI)))
                    .thenReturn(
                            new ProviderCredentialService.ResolvedProviderApiKey(10L, ProviderType.OPENAI, "provider-key"),
                            new ProviderCredentialService.ResolvedProviderApiKey(11L, ProviderType.OPENAI, "provider-key-2")
                    );
            when(budgetUsageService.currentUtcYearMonth()).thenReturn(YearMonth.of(2026, 2));
            when(budgetGuardrailService.evaluateWorkspaceDegrade(eq(workspaceId), anyString())).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(10L))).thenReturn(BudgetDecision.allow());
            when(budgetGuardrailService.evaluateProviderCredential(eq(11L))).thenReturn(BudgetDecision.allow());

            HttpClientErrorException tooManyRequests = HttpClientErrorException.create(
                    HttpStatusCode.valueOf(429),
                    "Too Many Requests",
                    HttpHeaders.EMPTY,
                    new byte[0],
                    StandardCharsets.UTF_8
            );
            when(llmCallService.callProvider(any(), anyString(), any(), anyString(), any()))
                    .thenThrow(tooManyRequests)
                    .thenThrow(tooManyRequests);

            GatewayChatRequest request = new GatewayChatRequest(workspaceId, "hello", Map.of(), false);

            // when
            Throwable thrown = org.assertj.core.api.Assertions.catchThrowable(() -> gatewayChatService.chat(apiKey, request));

            // then
            assertThat(thrown)
                    .isInstanceOf(GatewayException.class);
            assertThat(((GatewayException) thrown).getCode()).isEqualTo("GW-GW-ALL_PROVIDERS_FAILED");

            ArgumentCaptor<RequestLogWriter.FailUpdate> captor = ArgumentCaptor.forClass(RequestLogWriter.FailUpdate.class);
            verify(requestLogWriter).markFail(eq(requestId), captor.capture());
            RequestLogWriter.FailUpdate update = captor.getValue();
            assertThat(update.errorCode()).isEqualTo("GW-GW-ALL_PROVIDERS_FAILED");
            assertThat(update.failReason()).contains("ALL_FAILED");
        }

        private boolean invokeIsRetryableException(Exception exception) throws Exception {
            Method method = GatewayChatService.class.getDeclaredMethod("isRetryableException", Exception.class);
            method.setAccessible(true);
            return (boolean) method.invoke(gatewayChatService, exception);
        }
    }

    @Test
    @DisplayName("RAG 통합 테스트: GatewayChatService는 RagSearchService를 선택적으로 주입받는다")
    void RAG_통합_테스트() {
        // given & when & then
        assertThat(gatewayChatService).isNotNull();
        assertThat(gatewayChatService).hasFieldOrPropertyWithValue("ragSearchService", ragSearchService);
        assertThat(gatewayChatService).hasFieldOrPropertyWithValue("organizationApiKeyAuthService", organizationApiKeyAuthService);
        assertThat(gatewayChatService).hasFieldOrPropertyWithValue("providerCredentialService", providerCredentialService);
        assertThat(gatewayChatService).hasFieldOrPropertyWithValue("promptRepository", promptRepository);
        assertThat(gatewayChatService).hasFieldOrPropertyWithValue("promptReleaseRepository", promptReleaseRepository);
    }

    @Test
    @DisplayName("공백 변수 테스트: 공백 문자열도 정상적으로 치환된다")
    void 공백_변수_테스트() throws Exception {
        // given
        String promptKey = "prefix {{value}} suffix";
        Map<String, String> variables = new HashMap<>();
        variables.put("value", "   ");

        // when
        String result = invokeRenderPrompt(promptKey, variables);

        // then
        assertThat(result).isEqualTo("prefix     suffix");
    }

    @Test
    @DisplayName("빈 문자열 변수 테스트: 빈 문자열로 치환되면 플레이스홀더가 제거된다")
    void 빈_문자열_변수_테스트() throws Exception {
        // given
        String promptKey = "hello {{name}} world";
        Map<String, String> variables = new HashMap<>();
        variables.put("name", "");

        // when
        String result = invokeRenderPrompt(promptKey, variables);

        // then
        assertThat(result).isEqualTo("hello  world");
    }

    /**
     * renderPrompt 메서드는 private이므로 리플렉션을 통해 호출합니다.
     */
    private String invokeRenderPrompt(String promptKey, Map<String, String> variables) throws Exception {
        Method renderPromptMethod = GatewayChatService.class.getDeclaredMethod(
                "renderPrompt",
                String.class,
                Map.class
        );
        renderPromptMethod.setAccessible(true);
        return (String) renderPromptMethod.invoke(gatewayChatService, promptKey, variables);
    }
}
