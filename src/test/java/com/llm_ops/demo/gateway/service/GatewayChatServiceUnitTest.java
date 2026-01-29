package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.gateway.config.GatewayModelProperties;
import com.llm_ops.demo.keys.service.OrganizationApiKeyAuthService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.rag.dto.ChunkDetailResponse;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.service.RagSearchService;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.ObjectProvider;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
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
    private GatewayChatProviderResolveService gatewayChatProviderResolveService;

    @Mock
    private GatewayChatOptionsCreateService gatewayChatOptionsCreateService;

    @Mock
    private ProviderCredentialService providerCredentialService;

    @Mock
    private GatewayModelProperties gatewayModelProperties;

    @Mock
    private ObjectProvider<ChatModel> openAiChatModelProvider;

    @Mock
    private RagSearchService ragSearchService;

    @Mock
    private WorkspaceRepository workspaceRepository;

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

        @Test
        @DisplayName("RAG 검색 결과가 있으면 프롬프트에 컨텍스트가 주입된다")
        void RAG_컨텍스트_주입_테스트() throws Exception {
            // given
            Long workspaceId = 1L;
            String originalPrompt = "오늘 날씨 어때?";
            List<ChunkDetailResponse> chunks = List.of(
                    new ChunkDetailResponse("서울의 오늘 날씨는 맑음입니다.", 0.95, null, "weather.txt"),
                    new ChunkDetailResponse("기온은 25도입니다.", 0.90, null, "weather.txt")
            );
            when(ragSearchService.search(anyLong(), anyString()))
                    .thenReturn(new RagSearchResponse(chunks));

            // when
            String result = invokeEnrichPromptWithRagContext(workspaceId, originalPrompt);

            // then
            assertThat(result).contains("서울의 오늘 날씨는 맑음입니다.");
            assertThat(result).contains("기온은 25도입니다.");
            assertThat(result).contains(originalPrompt);
        }

        @Test
        @DisplayName("RAG 검색 결과가 없으면 원본 프롬프트가 반환된다")
        void RAG_검색결과_없음_테스트() throws Exception {
            // given
            Long workspaceId = 1L;
            String originalPrompt = "오늘 날씨 어때?";
            when(ragSearchService.search(anyLong(), anyString()))
                    .thenReturn(new RagSearchResponse(List.of()));

            // when
            String result = invokeEnrichPromptWithRagContext(workspaceId, originalPrompt);

            // then
            assertThat(result).isEqualTo(originalPrompt);
        }

        @Test
        @DisplayName("RAG 검색 결과가 null이면 원본 프롬프트가 반환된다")
        void RAG_검색결과_null_테스트() throws Exception {
            // given
            Long workspaceId = 1L;
            String originalPrompt = "오늘 날씨 어때?";
            when(ragSearchService.search(anyLong(), anyString()))
                    .thenReturn(new RagSearchResponse(null));

            // when
            String result = invokeEnrichPromptWithRagContext(workspaceId, originalPrompt);

            // then
            assertThat(result).isEqualTo(originalPrompt);
        }

        private String invokeEnrichPromptWithRagContext(Long workspaceId, String originalPrompt) throws Exception {
            Method method = GatewayChatService.class.getDeclaredMethod(
                    "enrichPromptWithRagContext",
                    Long.class,
                    String.class
            );
            method.setAccessible(true);
            return (String) method.invoke(gatewayChatService, workspaceId, originalPrompt);
        }
    }

    @Test
    @DisplayName("RAG 통합 테스트: GatewayChatService는 RagSearchService를 선택적으로 주입받는다")
    void RAG_통합_테스트() {
        // given & when & then
        assertThat(gatewayChatService).isNotNull();
        assertThat(gatewayChatService).hasFieldOrPropertyWithValue("ragSearchService", ragSearchService);
        assertThat(gatewayChatService).hasFieldOrPropertyWithValue("organizationApiKeyAuthService", organizationApiKeyAuthService);
        assertThat(gatewayChatService).hasFieldOrPropertyWithValue("gatewayChatProviderResolveService", gatewayChatProviderResolveService);
        assertThat(gatewayChatService).hasFieldOrPropertyWithValue("providerCredentialService", providerCredentialService);
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
