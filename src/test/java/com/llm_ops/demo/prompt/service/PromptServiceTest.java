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
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.dto.PromptCreateRequest;
import com.llm_ops.demo.prompt.dto.PromptCreateResponse;
import com.llm_ops.demo.prompt.dto.PromptDetailResponse;
import com.llm_ops.demo.prompt.dto.PromptSummaryResponse;
import com.llm_ops.demo.prompt.dto.PromptUpdateRequest;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PromptServiceTest {

    @InjectMocks
    private PromptService promptService;

    @Mock
    private PromptRepository promptRepository;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Nested
    @DisplayName("create 메서드")
    class Create {

        @Test
        @DisplayName("프롬프트를 생성한다")
        void create_Success() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            PromptCreateRequest request = new PromptCreateRequest("chat-bot", "챗봇 프롬프트");

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(true);
            given(promptRepository.existsByWorkspaceAndPromptKey(mockWorkspace, "chat-bot"))
                    .willReturn(false);
            given(promptRepository.save(any(Prompt.class))).willAnswer(invocation -> {
                Prompt prompt = invocation.getArgument(0);
                setId(prompt, 1L);
                return prompt;
            });

            // when
            PromptCreateResponse response = promptService.create(workspaceId, userId, request);

            // then
            assertThat(response.id()).isEqualTo(1L);
            assertThat(response.promptKey()).isEqualTo("chat-bot");
            assertThat(response.description()).isEqualTo("챗봇 프롬프트");
            assertThat(response.status()).isEqualTo(PromptStatus.ACTIVE);

            verify(promptRepository).save(any(Prompt.class));
        }

        @Test
        @DisplayName("존재하지 않는 사용자로 프롬프트 생성 시 예외가 발생한다")
        void create_UserNotFound_ThrowsException() {
            // given
            Long workspaceId = 1L;
            Long userId = 999L;
            PromptCreateRequest request = new PromptCreateRequest("chat-bot", "챗봇");

            given(userRepository.findById(userId)).willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> promptService.create(workspaceId, userId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

            verify(promptRepository, never()).save(any());
        }

        @Test
        @DisplayName("존재하지 않는 워크스페이스에 프롬프트 생성 시 예외가 발생한다")
        void create_WorkspaceNotFound_ThrowsException() throws Exception {
            // given
            Long workspaceId = 999L;
            Long userId = 1L;
            PromptCreateRequest request = new PromptCreateRequest("chat-bot", "챗봇");

            User mockUser = createMockUser(userId);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> promptService.create(workspaceId, userId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

            verify(promptRepository, never()).save(any());
        }

        @Test
        @DisplayName("워크스페이스 멤버가 아닌 사용자가 프롬프트 생성 시 예외가 발생한다")
        void create_NotWorkspaceMember_ThrowsException() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            PromptCreateRequest request = new PromptCreateRequest("chat-bot", "챗봇");

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(false);

            // when & then
            assertThatThrownBy(() -> promptService.create(workspaceId, userId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

            verify(promptRepository, never()).save(any());
        }

        @Test
        @DisplayName("워크스페이스 내 promptKey 중복 시 예외가 발생한다")
        void create_DuplicatePromptKey_ThrowsException() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            PromptCreateRequest request = new PromptCreateRequest("chat-bot", "챗봇");

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(true);
            given(promptRepository.existsByWorkspaceAndPromptKey(mockWorkspace, "chat-bot"))
                    .willReturn(true);

            // when & then
            assertThatThrownBy(() -> promptService.create(workspaceId, userId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONFLICT);

            verify(promptRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("getList 메서드")
    class GetList {

        @Test
        @DisplayName("워크스페이스의 프롬프트 목록을 조회한다")
        void getList_Success() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);
            Prompt mockPrompt1 = createMockPrompt(1L, mockWorkspace, "prompt-1", "프롬프트 1");
            Prompt mockPrompt2 = createMockPrompt(2L, mockWorkspace, "prompt-2", "프롬프트 2");

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(true);
            given(promptRepository.findByWorkspaceAndStatusOrderByCreatedAtDesc(mockWorkspace, PromptStatus.ACTIVE))
                    .willReturn(List.of(mockPrompt1, mockPrompt2));

            // when
            List<PromptSummaryResponse> response = promptService.getList(workspaceId, userId);

            // then
            assertThat(response).hasSize(2);
            assertThat(response.get(0).promptKey()).isEqualTo("prompt-1");
            assertThat(response.get(1).promptKey()).isEqualTo("prompt-2");
        }

        @Test
        @DisplayName("워크스페이스 멤버가 아닌 사용자가 목록 조회 시 예외가 발생한다")
        void getList_NotWorkspaceMember_ThrowsException() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(false);

            // when & then
            assertThatThrownBy(() -> promptService.getList(workspaceId, userId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
        }
    }

    @Nested
    @DisplayName("getDetail 메서드")
    class GetDetail {

        @Test
        @DisplayName("프롬프트 상세 정보를 조회한다")
        void getDetail_Success() throws Exception {
            // given
            Long workspaceId = 1L;
            Long promptId = 1L;
            Long userId = 1L;

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);
            Prompt mockPrompt = createMockPrompt(promptId, mockWorkspace, "chat-bot", "챗봇 프롬프트");

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                    .willReturn(Optional.of(mockPrompt));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(true);

            // when
            PromptDetailResponse response = promptService.getDetail(workspaceId, promptId, userId);

            // then
            assertThat(response.id()).isEqualTo(promptId);
            assertThat(response.promptKey()).isEqualTo("chat-bot");
            assertThat(response.description()).isEqualTo("챗봇 프롬프트");
            assertThat(response.workspaceId()).isEqualTo(workspaceId);
        }

        @Test
        @DisplayName("존재하지 않는 프롬프트 조회 시 예외가 발생한다")
        void getDetail_PromptNotFound_ThrowsException() throws Exception {
            // given
            Long workspaceId = 1L;
            Long promptId = 999L;
            Long userId = 1L;

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                    .willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> promptService.getDetail(workspaceId, promptId, userId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        }

        @Test
        @DisplayName("워크스페이스 멤버가 아닌 사용자가 조회 시 예외가 발생한다")
        void getDetail_NotWorkspaceMember_ThrowsException() throws Exception {
            // given
            Long workspaceId = 1L;
            Long promptId = 1L;
            Long userId = 1L;

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);
            Prompt mockPrompt = createMockPrompt(promptId, mockWorkspace, "chat-bot", "챗봇");

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                    .willReturn(Optional.of(mockPrompt));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(false);

            // when & then
            assertThatThrownBy(() -> promptService.getDetail(workspaceId, promptId, userId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
        }
    }

    @Nested
    @DisplayName("update 메서드")
    class Update {

        @Test
        @DisplayName("프롬프트를 수정한다")
        void update_Success() throws Exception {
            // given
            Long workspaceId = 1L;
            Long promptId = 1L;
            Long userId = 1L;
            PromptUpdateRequest request = new PromptUpdateRequest("updated-key", "수정된 설명");

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);
            Prompt mockPrompt = createMockPrompt(promptId, mockWorkspace, "chat-bot", "챗봇");

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                    .willReturn(Optional.of(mockPrompt));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(true);
            given(promptRepository.existsByWorkspaceAndPromptKey(mockWorkspace, "updated-key"))
                    .willReturn(false);

            // when
            PromptDetailResponse response = promptService.update(workspaceId, promptId, userId, request);

            // then
            assertThat(response.promptKey()).isEqualTo("updated-key");
            assertThat(response.description()).isEqualTo("수정된 설명");
        }

        @Test
        @DisplayName("수정 시 promptKey가 중복되면 예외가 발생한다")
        void update_DuplicatePromptKey_ThrowsException() throws Exception {
            // given
            Long workspaceId = 1L;
            Long promptId = 1L;
            Long userId = 1L;
            PromptUpdateRequest request = new PromptUpdateRequest("existing-key", "설명");

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);
            Prompt mockPrompt = createMockPrompt(promptId, mockWorkspace, "chat-bot", "챗봇");

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                    .willReturn(Optional.of(mockPrompt));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(true);
            given(promptRepository.existsByWorkspaceAndPromptKey(mockWorkspace, "existing-key"))
                    .willReturn(true);

            // when & then
            assertThatThrownBy(() -> promptService.update(workspaceId, promptId, userId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONFLICT);
        }

        @Test
        @DisplayName("동일한 promptKey로 수정 시에는 중복 검사를 하지 않는다")
        void update_SamePromptKey_NoConflict() throws Exception {
            // given
            Long workspaceId = 1L;
            Long promptId = 1L;
            Long userId = 1L;
            PromptUpdateRequest request = new PromptUpdateRequest("chat-bot", "수정된 설명만");

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);
            Prompt mockPrompt = createMockPrompt(promptId, mockWorkspace, "chat-bot", "챗봇");

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                    .willReturn(Optional.of(mockPrompt));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(true);

            // when
            PromptDetailResponse response = promptService.update(workspaceId, promptId, userId, request);

            // then
            assertThat(response.description()).isEqualTo("수정된 설명만");
            verify(promptRepository, never()).existsByWorkspaceAndPromptKey(any(), any());
        }
    }

    @Nested
    @DisplayName("delete 메서드")
    class Delete {

        @Test
        @DisplayName("프롬프트를 삭제(archive)한다")
        void delete_Success() throws Exception {
            // given
            Long workspaceId = 1L;
            Long promptId = 1L;
            Long userId = 1L;

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);
            Prompt mockPrompt = createMockPrompt(promptId, mockWorkspace, "chat-bot", "챗봇");

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                    .willReturn(Optional.of(mockPrompt));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(true);

            // when
            promptService.delete(workspaceId, promptId, userId);

            // then
            assertThat(mockPrompt.getStatus()).isEqualTo(PromptStatus.ARCHIVED);
            assertThat(mockPrompt.isActive()).isFalse();
        }

        @Test
        @DisplayName("존재하지 않는 프롬프트 삭제 시 예외가 발생한다")
        void delete_PromptNotFound_ThrowsException() throws Exception {
            // given
            Long workspaceId = 1L;
            Long promptId = 999L;
            Long userId = 1L;

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                    .willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> promptService.delete(workspaceId, promptId, userId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        }

        @Test
        @DisplayName("워크스페이스 멤버가 아닌 사용자가 삭제 시 예외가 발생한다")
        void delete_NotWorkspaceMember_ThrowsException() throws Exception {
            // given
            Long workspaceId = 1L;
            Long promptId = 1L;
            Long userId = 1L;

            User mockUser = createMockUser(userId);
            Workspace mockWorkspace = createMockWorkspace(workspaceId, mockUser);
            Prompt mockPrompt = createMockPrompt(promptId, mockWorkspace, "chat-bot", "챗봇");

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                    .willReturn(Optional.of(mockWorkspace));
            given(promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE))
                    .willReturn(Optional.of(mockPrompt));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(mockWorkspace, mockUser))
                    .willReturn(false);

            // when & then
            assertThatThrownBy(() -> promptService.delete(workspaceId, promptId, userId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
        }
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

    private Prompt createMockPrompt(Long id, Workspace workspace, String promptKey, String description)
            throws Exception {
        Prompt prompt = Prompt.create(workspace, promptKey, description);
        setId(prompt, id);
        return prompt;
    }

    private void setId(Object entity, Long id) throws Exception {
        var idField = entity.getClass().getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(entity, id);
    }
}
