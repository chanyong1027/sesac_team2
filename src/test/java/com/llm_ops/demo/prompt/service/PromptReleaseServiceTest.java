package com.llm_ops.demo.prompt.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.prompt.domain.ChangeType;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptRelease;
import com.llm_ops.demo.prompt.domain.PromptReleaseHistory;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.dto.PromptReleaseHistoryResponse;
import com.llm_ops.demo.prompt.dto.PromptReleaseRequest;
import com.llm_ops.demo.prompt.dto.PromptReleaseResponse;
import com.llm_ops.demo.prompt.dto.PromptRollbackRequest;
import com.llm_ops.demo.prompt.repository.PromptReleaseHistoryRepository;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
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
class PromptReleaseServiceTest {

    @InjectMocks
    private PromptReleaseService promptReleaseService;

    @Mock
    private PromptReleaseRepository promptReleaseRepository;

    @Mock
    private PromptReleaseHistoryRepository promptReleaseHistoryRepository;

    @Mock
    private PromptRepository promptRepository;

    @Mock
    private PromptVersionRepository promptVersionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Test
    @DisplayName("첫 번째 릴리스를 생성한다")
    void release_FirstRelease_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long versionId = 1L;
        Long userId = 1L;
        PromptReleaseRequest request = new PromptReleaseRequest(versionId, "첫 릴리스");

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);
        PromptVersion version = createMockVersion(versionId, prompt, user, 1);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findById(versionId)).willReturn(Optional.of(version));
        given(promptReleaseRepository.findByPromptId(promptId)).willReturn(Optional.empty());
        given(promptReleaseRepository.save(any(PromptRelease.class))).willAnswer(inv -> inv.getArgument(0));

        // when
        PromptReleaseResponse response = promptReleaseService.release(promptId, userId, request);

        // then
        assertThat(response.promptId()).isEqualTo(promptId);
        assertThat(response.activeVersionId()).isEqualTo(versionId);

        verify(promptReleaseRepository).save(any(PromptRelease.class));
        verify(promptReleaseHistoryRepository).save(any(PromptReleaseHistory.class));
    }

    @Test
    @DisplayName("기존 릴리스를 새 버전으로 업데이트한다")
    void release_UpdateExisting_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long oldVersionId = 1L;
        Long newVersionId = 2L;
        Long userId = 1L;
        PromptReleaseRequest request = new PromptReleaseRequest(newVersionId, "버전 업데이트");

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);
        PromptVersion oldVersion = createMockVersion(oldVersionId, prompt, user, 1);
        PromptVersion newVersion = createMockVersion(newVersionId, prompt, user, 2);
        PromptRelease existingRelease = PromptRelease.create(prompt, oldVersion);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findById(newVersionId)).willReturn(Optional.of(newVersion));
        given(promptReleaseRepository.findByPromptId(promptId)).willReturn(Optional.of(existingRelease));

        // when
        PromptReleaseResponse response = promptReleaseService.release(promptId, userId, request);

        // then
        assertThat(response.activeVersionId()).isEqualTo(newVersionId);
        assertThat(response.activeVersionNo()).isEqualTo(2);

        verify(promptReleaseHistoryRepository).save(any(PromptReleaseHistory.class));
    }

    @Test
    @DisplayName("같은 버전을 다시 릴리스하면 예외가 발생한다")
    void release_SameVersion_ThrowsException() throws Exception {
        // given
        Long promptId = 1L;
        Long versionId = 1L;
        Long userId = 1L;
        PromptReleaseRequest request = new PromptReleaseRequest(versionId, "같은 버전");

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);
        PromptVersion version = createMockVersion(versionId, prompt, user, 1);
        PromptRelease existingRelease = PromptRelease.create(prompt, version);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findById(versionId)).willReturn(Optional.of(version));
        given(promptReleaseRepository.findByPromptId(promptId)).willReturn(Optional.of(existingRelease));

        // when & then
        assertThatThrownBy(() -> promptReleaseService.release(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONFLICT);

        verify(promptReleaseHistoryRepository, never()).save(any());
    }

    @Test
    @DisplayName("다른 프롬프트의 버전으로 릴리스하면 예외가 발생한다")
    void release_WrongPromptVersion_ThrowsException() throws Exception {
        // given
        Long promptId = 1L;
        Long otherPromptId = 2L;
        Long versionId = 1L;
        Long userId = 1L;
        PromptReleaseRequest request = new PromptReleaseRequest(versionId, "잘못된 버전");

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);
        Prompt otherPrompt = createMockPrompt(otherPromptId, workspace);
        PromptVersion versionOfOtherPrompt = createMockVersion(versionId, otherPrompt, user, 1);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptVersionRepository.findById(versionId)).willReturn(Optional.of(versionOfOtherPrompt));

        // when & then
        assertThatThrownBy(() -> promptReleaseService.release(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

        verify(promptReleaseRepository, never()).save(any());
    }

    @Test
    @DisplayName("릴리스 히스토리를 조회한다")
    void getHistory_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);
        PromptVersion version1 = createMockVersion(1L, prompt, user, 1);
        PromptVersion version2 = createMockVersion(2L, prompt, user, 2);

        PromptReleaseHistory history1 = createMockHistory(1L, prompt, null, version1, ChangeType.RELEASE, user);
        PromptReleaseHistory history2 = createMockHistory(2L, prompt, version1, version2, ChangeType.RELEASE, user);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptReleaseHistoryRepository.findByPromptOrderByCreatedAtDesc(prompt))
                .willReturn(List.of(history2, history1));

        // when
        List<PromptReleaseHistoryResponse> response = promptReleaseService.getHistory(promptId, userId);

        // then
        assertThat(response).hasSize(2);
        assertThat(response.get(0).toVersionNo()).isEqualTo(2);
        assertThat(response.get(1).toVersionNo()).isEqualTo(1);
        assertThat(response.get(1).fromVersionId()).isNull();
    }

    @Test
    @DisplayName("워크스페이스 멤버가 아니면 예외가 발생한다")
    void release_NotMember_ThrowsException() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptReleaseRequest request = new PromptReleaseRequest(1L, "릴리스");

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(false);

        // when & then
        assertThatThrownBy(() -> promptReleaseService.release(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

        verify(promptReleaseRepository, never()).save(any());
    }

    @Test
    @DisplayName("이전 버전으로 롤백한다")
    void rollback_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long currentVersionId = 2L;
        Long targetVersionId = 1L;
        Long userId = 1L;
        PromptRollbackRequest request = new PromptRollbackRequest(targetVersionId, "버그 발견으로 롤백");

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);
        PromptVersion currentVersion = createMockVersion(currentVersionId, prompt, user, 2);
        PromptVersion targetVersion = createMockVersion(targetVersionId, prompt, user, 1);
        PromptRelease existingRelease = PromptRelease.create(prompt, currentVersion);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptReleaseRepository.findByPromptId(promptId)).willReturn(Optional.of(existingRelease));
        given(promptVersionRepository.findById(targetVersionId)).willReturn(Optional.of(targetVersion));

        // when
        PromptReleaseResponse response = promptReleaseService.rollback(promptId, userId, request);

        // then
        assertThat(response.activeVersionId()).isEqualTo(targetVersionId);
        assertThat(response.activeVersionNo()).isEqualTo(1);

        verify(promptReleaseHistoryRepository).save(any(PromptReleaseHistory.class));
    }

    @Test
    @DisplayName("릴리스가 없으면 롤백할 수 없다")
    void rollback_NoRelease_ThrowsException() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptRollbackRequest request = new PromptRollbackRequest(1L, "롤백");

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptReleaseRepository.findByPromptId(promptId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> promptReleaseService.rollback(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

        verify(promptReleaseHistoryRepository, never()).save(any());
    }

    @Test
    @DisplayName("같은 버전으로 롤백하면 예외가 발생한다")
    void rollback_SameVersion_ThrowsException() throws Exception {
        // given
        Long promptId = 1L;
        Long versionId = 1L;
        Long userId = 1L;
        PromptRollbackRequest request = new PromptRollbackRequest(versionId, "같은 버전 롤백");

        User user = createMockUser(userId);
        Workspace workspace = createMockWorkspace(1L, user);
        Prompt prompt = createMockPrompt(promptId, workspace);
        PromptVersion version = createMockVersion(versionId, prompt, user, 1);
        PromptRelease existingRelease = PromptRelease.create(prompt, version);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                .willReturn(Optional.of(prompt));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user))
                .willReturn(true);
        given(promptReleaseRepository.findByPromptId(promptId)).willReturn(Optional.of(existingRelease));
        given(promptVersionRepository.findById(versionId)).willReturn(Optional.of(version));

        // when & then
        assertThatThrownBy(() -> promptReleaseService.rollback(promptId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONFLICT);

        verify(promptReleaseHistoryRepository, never()).save(any());
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

    private PromptReleaseHistory createMockHistory(Long id, Prompt prompt, PromptVersion from,
                                                    PromptVersion to, ChangeType type, User user) throws Exception {
        PromptReleaseHistory history = PromptReleaseHistory.create(
                prompt, from, to, type, "테스트 사유", user
        );
        setId(history, id);
        return history;
    }

    private void setId(Object entity, Long id) throws Exception {
        var idField = entity.getClass().getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(entity, id);
    }
}
