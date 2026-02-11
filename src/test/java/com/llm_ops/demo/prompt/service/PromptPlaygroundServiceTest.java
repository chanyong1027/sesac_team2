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
import java.util.List;

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
    @DisplayName("플레이그라운드 실행 성공")
    void run_Success() {
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
        given(llmCallService.callProvider(eq(resolvedKey), eq("gpt-4o"), any(), any())).willReturn(chatResponse);

        PlaygroundRunRequest request = new PlaygroundRunRequest(
                ProviderType.OPENAI, "gpt-4o",
                "You are helpful.", "{{question}}",
                false, null,
                Map.of("question", "안녕하세요?"), null);

        PlaygroundRunResponse response = service.run(promptId, userId, request);

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
    @DisplayName("프롬프트가 없으면 NOT_FOUND")
    void run_PromptNotFound() {
        Long promptId = 999L;
        Long userId = 1L;

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatusWithWorkspaceAndOrganization(promptId, PromptStatus.ACTIVE)).willReturn(Optional.empty());

        PlaygroundRunRequest request = new PlaygroundRunRequest(
                ProviderType.OPENAI, "gpt-4o", null, "{{question}}",
                false, null, Map.of("question", "test"), null);

        assertThatThrownBy(() -> service.run(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("워크스페이스 멤버가 아니면 FORBIDDEN")
    void run_NotMember() {
        Long promptId = 1L;
        Long userId = 1L;

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatusWithWorkspaceAndOrganization(promptId, PromptStatus.ACTIVE)).willReturn(Optional.of(prompt));
        given(prompt.getWorkspace()).willReturn(workspace);
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)).willReturn(false);

        PlaygroundRunRequest request = new PlaygroundRunRequest(
                ProviderType.OPENAI, "gpt-4o", null, "{{question}}",
                false, null, Map.of("question", "test"), null);

        assertThatThrownBy(() -> service.run(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("버전 저장 성공 (배포 없음)")
    void saveAsVersion_WithoutRelease() {
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

        PlaygroundSaveVersionResponse response = service.saveAsVersion(promptId, userId, request);

        assertThat(response.version().id()).isEqualTo(10L);
        assertThat(response.released()).isFalse();
        verify(promptReleaseService, never()).release(any(), any(), any());
    }

    @Test
    @DisplayName("버전 저장 + 즉시 배포 성공")
    void saveAsVersion_WithRelease() {
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

        PlaygroundSaveVersionResponse response = service.saveAsVersion(promptId, userId, request);

        assertThat(response.version().id()).isEqualTo(10L);
        assertThat(response.released()).isTrue();
        verify(promptReleaseService).release(eq(promptId), eq(userId), any(PromptReleaseRequest.class));
    }
}
