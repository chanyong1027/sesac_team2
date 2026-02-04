package com.llm_ops.demo.workspace.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.config.RagContextProperties;
import com.llm_ops.demo.rag.config.RagSearchProperties;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceRagSettings;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.dto.WorkspaceRagSettingsResponse;
import com.llm_ops.demo.workspace.dto.WorkspaceRagSettingsUpdateRequest;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRagSettingsRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceRagSettingsService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceRagSettingsRepository workspaceRagSettingsRepository;
    private final UserRepository userRepository;
    private final RagSearchProperties ragSearchProperties;
    private final RagContextProperties ragContextProperties;

    public WorkspaceRagSettingsService(
        WorkspaceRepository workspaceRepository,
        WorkspaceMemberRepository workspaceMemberRepository,
        WorkspaceRagSettingsRepository workspaceRagSettingsRepository,
        UserRepository userRepository,
        RagSearchProperties ragSearchProperties,
        RagContextProperties ragContextProperties
    ) {
        this.workspaceRepository = workspaceRepository;
        this.workspaceMemberRepository = workspaceMemberRepository;
        this.workspaceRagSettingsRepository = workspaceRagSettingsRepository;
        this.userRepository = userRepository;
        this.ragSearchProperties = ragSearchProperties;
        this.ragContextProperties = ragContextProperties;
    }

    @Transactional(readOnly = true)
    public WorkspaceRagSettingsResponse getSettings(Long workspaceId, Long userId) {
        Workspace workspace = findActiveWorkspace(workspaceId);
        validateWorkspaceMembership(workspace, userId);

        Optional<WorkspaceRagSettings> existing = workspaceRagSettingsRepository.findByWorkspaceId(workspaceId);
        if (existing.isPresent()) {
            return WorkspaceRagSettingsResponse.from(existing.get());
        }
        return new WorkspaceRagSettingsResponse(
            workspaceId,
            ragSearchProperties.getTopK(),
            ragSearchProperties.getSimilarityThreshold(),
            ragContextProperties.getMaxChunks(),
            ragContextProperties.getMaxContextChars()
        );
    }

    @Transactional
    public WorkspaceRagSettingsResponse updateSettings(Long workspaceId, Long userId, WorkspaceRagSettingsUpdateRequest request) {
        Workspace workspace = findActiveWorkspace(workspaceId);
        validateWorkspaceMembership(workspace, userId);

        WorkspaceRagSettings settings = workspaceRagSettingsRepository.findByWorkspaceId(workspaceId)
            .orElseGet(() -> WorkspaceRagSettings.create(
                workspace,
                request.topK(),
                request.similarityThreshold(),
                request.maxChunks(),
                request.maxContextChars()
            ));

        settings.update(
            request.topK(),
            request.similarityThreshold(),
            request.maxChunks(),
            request.maxContextChars()
        );

        WorkspaceRagSettings saved = workspaceRagSettingsRepository.save(settings);
        return WorkspaceRagSettingsResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public RagRuntimeSettings resolveRuntimeSettings(Long workspaceId) {
        Optional<WorkspaceRagSettings> settings = workspaceRagSettingsRepository.findByWorkspaceId(workspaceId);
        return new RagRuntimeSettings(
            settings.map(WorkspaceRagSettings::getTopK).orElse(ragSearchProperties.getTopK()),
            settings.map(WorkspaceRagSettings::getSimilarityThreshold).orElse(ragSearchProperties.getSimilarityThreshold()),
            settings.map(WorkspaceRagSettings::getMaxChunks).orElse(ragContextProperties.getMaxChunks()),
            settings.map(WorkspaceRagSettings::getMaxContextChars).orElse(ragContextProperties.getMaxContextChars())
        );
    }

    private Workspace findActiveWorkspace(Long workspaceId) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        return workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "활성화된 워크스페이스를 찾을 수 없습니다."));
    }

    private void validateWorkspaceMembership(Workspace workspace, Long userId) {
        if (userId == null || userId <= 0) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED, "로그인이 필요합니다.");
        }
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다."));
        boolean isMember = workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "워크스페이스 멤버가 아닙니다.");
        }
    }

    public record RagRuntimeSettings(
        int topK,
        double similarityThreshold,
        int maxChunks,
        int maxContextChars
    ) {
    }
}
