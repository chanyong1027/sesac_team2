package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.log.service.RequestLogWriter;
import com.llm_ops.demo.budget.service.BudgetDecision;
import com.llm_ops.demo.budget.service.BudgetGuardrailService;
import com.llm_ops.demo.budget.service.BudgetUsageService;
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

import java.lang.reflect.Method;
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
import static org.mockito.Mockito.when;

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

    @InjectMocks
    private GatewayChatService gatewayChatService;

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
        variables.put("question", "What's the weather? It's 25°C & sunny!");

        // when
        String result = invokeRenderPrompt(promptKey, variables);

        // then
        assertThat(result).isEqualTo("question: What's the weather? It's 25°C & sunny!");
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
