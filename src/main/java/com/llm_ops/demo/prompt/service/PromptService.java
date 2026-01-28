package com.llm_ops.demo.prompt.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PromptService {

    private final PromptRepository promptRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public PromptCreateResponse create(Long workspaceId, Long userId, PromptCreateRequest request) {
        User user = findUserById(userId);
        Workspace workspace = findActiveWorkspace(workspaceId);

        validateWorkspaceMembership(workspace, user);
        validateDuplicatePromptKey(workspace, request.promptKey());

        Prompt prompt = Prompt.create(workspace, request.promptKey(), request.description());
        Prompt saved = promptRepository.save(prompt);

        return PromptCreateResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<PromptSummaryResponse> getList(Long workspaceId, Long userId) {
        User user = findUserById(userId);
        Workspace workspace = findActiveWorkspace(workspaceId);

        validateWorkspaceMembership(workspace, user);

        return promptRepository.findByWorkspaceAndStatusOrderByCreatedAtDesc(workspace, PromptStatus.ACTIVE)
                .stream()
                .map(PromptSummaryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PromptDetailResponse getDetail(Long workspaceId, Long promptId, Long userId) {
        User user = findUserById(userId);
        Workspace workspace = findActiveWorkspace(workspaceId);
        Prompt prompt = findActivePrompt(promptId);

        validatePromptBelongsToWorkspace(prompt, workspace);
        validateWorkspaceMembership(workspace, user);

        return PromptDetailResponse.from(prompt);
    }

    @Transactional
    public PromptDetailResponse update(Long workspaceId, Long promptId, Long userId, PromptUpdateRequest request) {
        User user = findUserById(userId);
        Workspace workspace = findActiveWorkspace(workspaceId);
        Prompt prompt = findActivePrompt(promptId);

        validatePromptBelongsToWorkspace(prompt, workspace);
        validateWorkspaceMembership(workspace, user);
        validatePromptKeyFormat(request.promptKey());

        if (request.promptKey() != null && !request.promptKey().equals(prompt.getPromptKey())) {
            validateDuplicatePromptKey(workspace, request.promptKey());
        }

        prompt.update(request.promptKey(), request.description());

        return PromptDetailResponse.from(prompt);
    }

    @Transactional
    public void delete(Long workspaceId, Long promptId, Long userId) {
        User user = findUserById(userId);
        Workspace workspace = findActiveWorkspace(workspaceId);
        Prompt prompt = findActivePrompt(promptId);

        validatePromptBelongsToWorkspace(prompt, workspace);
        validateWorkspaceMembership(workspace, user);

        prompt.archive();
    }

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private Workspace findActiveWorkspace(Long workspaceId) {
        return workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private Prompt findActivePrompt(Long promptId) {
        return promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private void validateWorkspaceMembership(Workspace workspace, User user) {
        boolean isMember = workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    private void validateDuplicatePromptKey(Workspace workspace, String promptKey) {
        if (promptRepository.existsByWorkspaceAndPromptKey(workspace, promptKey)) {
            throw new BusinessException(ErrorCode.CONFLICT);
        }
    }

    private void validatePromptBelongsToWorkspace(Prompt prompt, Workspace workspace) {
        if (!prompt.getWorkspace().getId().equals(workspace.getId())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }
    }

    private void validatePromptKeyFormat(String promptKey) {
        if (promptKey != null && promptKey.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }
    }
}
