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
    public PromptDetailResponse getDetail(Long promptId, Long userId) {
        User user = findUserById(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt.getWorkspace(), user);

        return PromptDetailResponse.from(prompt);
    }

    @Transactional
    public PromptDetailResponse update(Long promptId, Long userId, PromptUpdateRequest request) {
        User user = findUserById(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt.getWorkspace(), user);

        if (request.promptKey() != null && !request.promptKey().equals(prompt.getPromptKey())) {
            validateDuplicatePromptKey(prompt.getWorkspace(), request.promptKey());
        }

        prompt.update(request.promptKey(), request.description());

        return PromptDetailResponse.from(prompt);
    }

    @Transactional
    public void delete(Long promptId, Long userId) {
        User user = findUserById(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt.getWorkspace(), user);

        prompt.archive();
    }

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private Workspace findActiveWorkspace(Long wsId) {
        return workspaceRepository.findByIdAndStatus(wsId, WorkspaceStatus.ACTIVE)
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
}
