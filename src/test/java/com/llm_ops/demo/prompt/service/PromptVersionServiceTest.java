package com.llm_ops.demo.prompt.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateRequest;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionDetailResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionSummaryResponse;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PromptVersionServiceTest {

    @InjectMocks
    private PromptVersionService promptVersionService;

    @Mock
    private PromptVersionRepository promptVersionRepository;

    @Mock
    private PromptRepository promptRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Mock
    private PromptModelAllowlistService promptModelAllowlistService;

    @Test
    @DisplayName("프롬프트 버전을 생성한다")
    void create_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptVersionCreateRequest request = createRequest();

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findMaxVersionNo(prompt)).willReturn(0);
        given(promptVersionRepository.save(any(PromptVersion.class))).willAnswer(invocation -> {
            PromptVersion version = invocation.getArgument(0);
            setId(version, 1L);
            return version;
        });

        // when
        PromptVersionCreateResponse response = promptVersionService.create(promptId, userId, request);

        // then
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.promptId()).isEqualTo(promptId);
        assertThat(response.versionNo()).isEqualTo(1);

        verify(promptVersionRepository).save(any(PromptVersion.class));
        verify(promptModelAllowlistService).validateModel(request.provider(), request.model());
    }

    @Test
    @DisplayName("허용되지 않은 모델이면 예외가 발생한다")
    void create_InvalidModel_ThrowsException() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptVersionCreateRequest request = createRequest();

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);

        doThrow(new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "지원하지 않는 모델입니다."))
                .when(promptModelAllowlistService)
                .validateModel(request.provider(), request.model());

        // when & then
        assertThatThrownBy(() -> promptVersionService.create(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT_VALUE);

        verify(promptVersionRepository, never()).save(any());
    }

    @Test
    @DisplayName("버전 번호가 자동으로 증가한다")
    void create_VersionNoAutoIncrement() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptVersionCreateRequest request = createRequest();

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findMaxVersionNo(prompt)).willReturn(5);
        given(promptVersionRepository.save(any(PromptVersion.class))).willAnswer(invocation -> {
            PromptVersion version = invocation.getArgument(0);
            setId(version, 6L);
            return version;
        });

        // when
        PromptVersionCreateResponse response = promptVersionService.create(promptId, userId, request);

        // then
        assertThat(response.versionNo()).isEqualTo(6);
    }

    @Test
    @DisplayName("존재하지 않는 사용자로 버전 생성 시 예외가 발생한다")
    void create_UserNotFound_ThrowsException() {
        // given
        Long promptId = 1L;
        Long userId = 999L;
        PromptVersionCreateRequest request = createRequest();

        given(userRepository.findById(userId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> promptVersionService.create(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

        verify(promptVersionRepository, never()).save(any());
    }

    @Test
    @DisplayName("존재하지 않는 프롬프트로 버전 생성 시 예외가 발생한다")
    void create_PromptNotFound_ThrowsException() throws Exception {
        // given
        Long promptId = 999L;
        Long userId = 1L;
        PromptVersionCreateRequest request = createRequest();

        User user = createMockUser(userId);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> promptVersionService.create(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

        verify(promptVersionRepository, never()).save(any());
    }

    @Test
    @DisplayName("워크스페이스 멤버가 아닌 사용자가 버전 생성 시 예외가 발생한다")
    void create_NotWorkspaceMember_ThrowsException() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptVersionCreateRequest request = createRequest();

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(false);

        // when & then
        assertThatThrownBy(() -> promptVersionService.create(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

        verify(promptVersionRepository, never()).save(any());
    }

    @Test
    @DisplayName("프롬프트 버전 상세를 조회한다")
    void getDetail_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long versionId = 1L;
        Long userId = 1L;

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);
        PromptVersion version = createMockVersion(versionId, prompt, user);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findById(versionId)).willReturn(Optional.of(version));

        // when
        PromptVersionDetailResponse response = promptVersionService.getDetail(promptId, versionId, userId);

        // then
        assertThat(response.id()).isEqualTo(versionId);
        assertThat(response.promptId()).isEqualTo(promptId);
        assertThat(response.versionNo()).isEqualTo(1);
        assertThat(response.provider()).isEqualTo(ProviderType.OPENAI);
    }

    @Test
    @DisplayName("존재하지 않는 버전 조회 시 예외가 발생한다")
    void getDetail_VersionNotFound_ThrowsException() throws Exception {
        // given
        Long promptId = 1L;
        Long versionId = 999L;
        Long userId = 1L;

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findById(versionId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> promptVersionService.getDetail(promptId, versionId, userId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("프롬프트 버전 목록을 조회한다")
    void getList_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);
        PromptVersion version1 = createMockVersion(1L, prompt, user, 1);
        PromptVersion version2 = createMockVersion(2L, prompt, user, 2);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findByPromptOrderByVersionNoDesc(prompt))
                .willReturn(List.of(version2, version1));

        // when
        List<PromptVersionSummaryResponse> response = promptVersionService.getList(promptId, userId);

        // then
        assertThat(response).hasSize(2);
        assertThat(response.get(0).versionNo()).isEqualTo(2);
        assertThat(response.get(1).versionNo()).isEqualTo(1);
    }

    @Test
    @DisplayName("버전이 없으면 빈 목록을 반환한다")
    void getList_Empty_ReturnsEmptyList() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findByPromptOrderByVersionNoDesc(prompt))
                .willReturn(List.of());

        // when
        List<PromptVersionSummaryResponse> response = promptVersionService.getList(promptId, userId);

        // then
        assertThat(response).isEmpty();
    }

    private PromptVersionCreateRequest createRequest() {
        return new PromptVersionCreateRequest(
                "버전 제목",
                ProviderType.OPENAI,
                "gpt-4",
                null,
                null,
                "You are a helpful assistant.",
                "{{question}}",
                false,
                "https://notion.so/changes",
                Map.of("temperature", 0.7)
        );
    }

    private User createMockUser(Long id) throws Exception {
        User user = User.create("test@example.com", "encodedPassword", "테스트 유저");
        setId(user, id);
        return user;
    }

    private Workspace createMockWorkspace(Long id, User creator) throws Exception {
        Organization org = Organization.create("테스트 조직", creator);
        setId(org, 1L);
        Workspace workspace = Workspace.create(org, "test-workspace", "테스트 워크스페이스");
        setId(workspace, id);
        return workspace;
    }

    private Prompt createMockPrompt(Long id, Workspace workspace) throws Exception {
        Prompt prompt = Prompt.create(workspace, "test-prompt", "테스트 프롬프트");
        setId(prompt, id);
        return prompt;
    }

    private PromptVersion createMockVersion(Long id, Prompt prompt, User user) throws Exception {
        return createMockVersion(id, prompt, user, 1);
    }

    private PromptVersion createMockVersion(Long id, Prompt prompt, User user, int versionNo) throws Exception {
        PromptVersion version = PromptVersion.create(
                prompt, versionNo, "버전 " + versionNo,
                ProviderType.OPENAI, "gpt-4",
                null,
                null,
                "system prompt", "user template",
                false,
                null,
                Map.of("temperature", 0.7), user
        );
        setId(version, id);
        return version;
    }

    private void setId(Object entity, Long id) throws Exception {
        var idField = entity.getClass().getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(entity, id);
    }
}
