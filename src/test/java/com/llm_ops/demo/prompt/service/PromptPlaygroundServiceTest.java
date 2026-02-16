package com.llm_ops.demo.prompt.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.gateway.log.service.RequestLogWriter;
import com.llm_ops.demo.gateway.service.LlmCallService;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.keys.service.ProviderCredentialService.ResolvedProviderApiKey;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.dto.PlaygroundRunRequest;
import com.llm_ops.demo.prompt.dto.PlaygroundRunResponse;
import com.llm_ops.demo.prompt.dto.PlaygroundSaveVersionRequest;
import com.llm_ops.demo.prompt.dto.PlaygroundSaveVersionResponse;
import com.llm_ops.demo.prompt.dto.PromptReleaseRequest;
import com.llm_ops.demo.prompt.dto.PromptReleaseResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateRequest;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateResponse;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.rag.service.RagContextBuilder;
import com.llm_ops.demo.rag.service.RagSearchService;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.service.WorkspaceRagSettingsService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

@ExtendWith(MockitoExtension.class)
class PromptPlaygroundServiceTest {

    @Mock private PromptRepository promptRepository;
    @Mock private UserRepository userRepository;
    @Mock private WorkspaceMemberRepository workspaceMemberRepository;
    @Mock private ProviderCredentialService providerCredentialService;
    @Mock private LlmCallService llmCallService;
    @Mock private RagSearchService ragSearchService;
    @Mock private RagContextBuilder ragContextBuilder;
    @Mock private WorkspaceRagSettingsService workspaceRagSettingsService;
    @Mock private RequestLogWriter requestLogWriter;
    @Mock private PromptVersionService promptVersionService;
    @Mock private PromptReleaseService promptReleaseService;

    @Mock private User user;
    @Mock private Prompt prompt;
    @Mock private Workspace workspace;
    @Mock private Organization organization;

    private PromptPlaygroundService service;

    @BeforeEach
    void setUp() {
        service = new PromptPlaygroundService(
                promptRepository, userRepository, workspaceMemberRepository,
                providerCredentialService, llmCallService,
                ragSearchService, ragContextBuilder, workspaceRagSettingsService,
                requestLogWriter, promptVersionService, promptReleaseService);
    }

    @Test
    @DisplayName("정상 요청이 주어졌을 때 실행하면 LLM 응답을 반환한다")
    void 정상_요청이_주어졌을_때_실행하면_LLM_응답을_반환한다() {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatusWithWorkspaceAndOrganization(promptId, PromptStatus.ACTIVE)).willReturn(Optional.of(prompt));
        given(prompt.getWorkspace()).willReturn(workspace);
        given(prompt.getPromptKey()).willReturn("test-prompt");
        given(workspace.getOrganization()).willReturn(organization);
        given(organization.getId()).willReturn(10L);
        given(workspace.getId()).willReturn(100L);
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)).willReturn(true);
        given(requestLogWriter.start(any())).willReturn(UUID.randomUUID());

        ResolvedProviderApiKey resolvedKey = new ResolvedProviderApiKey(1L, ProviderType.OPENAI, "sk-test");
        given(providerCredentialService.resolveApiKey(10L, ProviderType.OPENAI)).willReturn(resolvedKey);

        ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                .withModel("gpt-4o-2024-05-13")
                .withUsage(new DefaultUsage(100L, 50L, 150L))
                .build();
        ChatResponse chatResponse = new ChatResponse(
                List.of(new Generation(new AssistantMessage("테스트 응답입니다."))),
                metadata);
        given(llmCallService.callProvider(eq(resolvedKey), eq("gpt-4o"), any(), any(), any())).willReturn(chatResponse);

        PlaygroundRunRequest request = new PlaygroundRunRequest(
                ProviderType.OPENAI, "gpt-4o",
                "You are helpful.", "{{question}}",
                false, null,
                Map.of("question", "안녕하세요?"), null);

        // when
        PlaygroundRunResponse response = service.run(promptId, userId, request);

        // then
        assertThat(response.answer()).isEqualTo("테스트 응답입니다.");
        assertThat(response.usedModel()).isEqualTo("gpt-4o-2024-05-13");
        assertThat(response.usage().inputTokens()).isEqualTo(100);
        assertThat(response.usage().outputTokens()).isEqualTo(50);
        assertThat(response.usage().totalTokens()).isEqualTo(150);
        assertThat(response.traceId()).isNotNull();
        assertThat(response.latencyMs()).isNotNull();

        verify(requestLogWriter).markSuccess(any(), any());
    }

    @Test
    @DisplayName("존재하지 않는 프롬프트ID가 주어졌을 때 실행하면 NOT_FOUND 예외가 발생한다")
    void 존재하지_않는_프롬프트ID가_주어졌을_때_실행하면_NOT_FOUND_예외가_발생한다() {
        // given
        Long promptId = 999L;
        Long userId = 1L;

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatusWithWorkspaceAndOrganization(promptId, PromptStatus.ACTIVE)).willReturn(Optional.empty());

        PlaygroundRunRequest request = new PlaygroundRunRequest(
                ProviderType.OPENAI, "gpt-4o", null, "{{question}}",
                false, null, Map.of("question", "test"), null);

        // when & then
        assertThatThrownBy(() -> service.run(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("워크스페이스 멤버가 아닌 사용자가 주어졌을 때 실행하면 FORBIDDEN 예외가 발생한다")
    void 워크스페이스_멤버가_아닌_사용자가_주어졌을_때_실행하면_FORBIDDEN_예외가_발생한다() {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatusWithWorkspaceAndOrganization(promptId, PromptStatus.ACTIVE)).willReturn(Optional.of(prompt));
        given(prompt.getWorkspace()).willReturn(workspace);
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)).willReturn(false);

        PlaygroundRunRequest request = new PlaygroundRunRequest(
                ProviderType.OPENAI, "gpt-4o", null, "{{question}}",
                false, null, Map.of("question", "test"), null);

        // when & then
        assertThatThrownBy(() -> service.run(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("배포없이 저장 요청이 주어졌을 때 저장하면 버전만 생성하고 배포하지 않는다")
    void 배포없이_저장_요청이_주어졌을_때_저장하면_버전만_생성하고_배포하지_않는다() {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        PromptVersionCreateResponse versionResponse = new PromptVersionCreateResponse(
                10L, promptId, 3, LocalDateTime.now());
        given(promptVersionService.create(eq(promptId), eq(userId), any(PromptVersionCreateRequest.class)))
                .willReturn(versionResponse);

        PlaygroundSaveVersionRequest request = new PlaygroundSaveVersionRequest(
                "테스트", ProviderType.OPENAI, "gpt-4o",
                null, null, "system", "{{question}}",
                false, null, null, false);

        // when
        PlaygroundSaveVersionResponse response = service.saveAsVersion(promptId, userId, request);

        // then
        assertThat(response.version().id()).isEqualTo(10L);
        assertThat(response.released()).isFalse();
        verify(promptReleaseService, never()).release(any(), any(), any());
    }

    @Test
    @DisplayName("즉시배포 저장 요청이 주어졌을 때 저장하면 버전 생성 후 배포도 수행한다")
    void 즉시배포_저장_요청이_주어졌을_때_저장하면_버전_생성_후_배포도_수행한다() {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        PromptVersionCreateResponse versionResponse = new PromptVersionCreateResponse(
                10L, promptId, 3, LocalDateTime.now());
        given(promptVersionService.create(eq(promptId), eq(userId), any(PromptVersionCreateRequest.class)))
                .willReturn(versionResponse);
        given(promptReleaseService.release(eq(promptId), eq(userId), any(PromptReleaseRequest.class)))
                .willReturn(null);

        PlaygroundSaveVersionRequest request = new PlaygroundSaveVersionRequest(
                "테스트", ProviderType.OPENAI, "gpt-4o",
                null, null, "system", "{{question}}",
                false, null, null, true);

        // when
        PlaygroundSaveVersionResponse response = service.saveAsVersion(promptId, userId, request);

        // then
        assertThat(response.version().id()).isEqualTo(10L);
        assertThat(response.released()).isTrue();
        verify(promptReleaseService).release(eq(promptId), eq(userId), any(PromptReleaseRequest.class));
    }
}
