package com.llm_ops.demo.rag.facade;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.service.RagSearchService;
import com.llm_ops.demo.workspace.service.WorkspaceRagSettingsService;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@ConditionalOnBean(RagSearchService.class)
@Transactional(readOnly = true)
public class RagSearchFacade {

    private final RagSearchService ragSearchService;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final WorkspaceRagSettingsService workspaceRagSettingsService;

    public RagSearchFacade(
        RagSearchService ragSearchService,
        WorkspaceRepository workspaceRepository,
        WorkspaceMemberRepository workspaceMemberRepository,
        UserRepository userRepository,
        WorkspaceRagSettingsService workspaceRagSettingsService
    ) {
        this.ragSearchService = ragSearchService;
        this.workspaceRepository = workspaceRepository;
        this.workspaceMemberRepository = workspaceMemberRepository;
        this.userRepository = userRepository;
        this.workspaceRagSettingsService = workspaceRagSettingsService;
    }

    public RagSearchResponse search(Long workspaceId, Long userId, String query, Integer topK, Double similarityThreshold) {
        validateIds(workspaceId, userId);
        validateWorkspaceAccess(workspaceId, userId);
        WorkspaceRagSettingsService.RagRuntimeSettings runtime = workspaceRagSettingsService.resolveRuntimeSettings(workspaceId);
        int resolvedTopK = topK != null ? topK : runtime.topK();
        double resolvedThreshold = similarityThreshold != null ? similarityThreshold : runtime.similarityThreshold();
        RagSearchService.RagSearchOptions options = new RagSearchService.RagSearchOptions(
            resolvedTopK,
            resolvedThreshold,
            runtime.hybridEnabled(),
            runtime.rerankEnabled(),
            runtime.rerankTopN()
        );
        return ragSearchService.search(workspaceId, query, options);
    }

    private void validateIds(Long workspaceId, Long userId) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        if (userId == null || userId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "userId가 필요합니다.");
        }
    }

    private void validateWorkspaceAccess(Long workspaceId, Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다."));

        Workspace workspace = workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "활성화된 워크스페이스를 찾을 수 없습니다."));

        boolean isMember = workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "워크스페이스 멤버가 아닙니다.");
        }
    }
}
