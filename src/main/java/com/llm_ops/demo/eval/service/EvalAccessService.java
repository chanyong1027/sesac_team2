package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.eval.domain.EvalDataset;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.repository.EvalDatasetRepository;
import com.llm_ops.demo.eval.repository.EvalRunRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import org.springframework.stereotype.Service;

@Service
public class EvalAccessService {

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final PromptRepository promptRepository;
    private final PromptVersionRepository promptVersionRepository;
    private final EvalDatasetRepository evalDatasetRepository;
    private final EvalRunRepository evalRunRepository;

    public EvalAccessService(
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            WorkspaceMemberRepository workspaceMemberRepository,
            PromptRepository promptRepository,
            PromptVersionRepository promptVersionRepository,
            EvalDatasetRepository evalDatasetRepository,
            EvalRunRepository evalRunRepository
    ) {
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.workspaceMemberRepository = workspaceMemberRepository;
        this.promptRepository = promptRepository;
        this.promptVersionRepository = promptVersionRepository;
        this.evalDatasetRepository = evalDatasetRepository;
        this.evalRunRepository = evalRunRepository;
    }

    public PromptScope requirePromptScope(Long workspaceId, Long promptId, Long userId) {
        User user = findUser(userId);
        Workspace workspace = workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        Prompt prompt = promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (!prompt.getWorkspace().getId().equals(workspace.getId())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }

        boolean isMember = workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        return new PromptScope(user, workspace, prompt);
    }

    public PromptVersion requirePromptVersion(Prompt prompt, Long versionId) {
        return promptVersionRepository.findById(versionId)
                .filter(version -> version.getPrompt().getId().equals(prompt.getId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    public EvalDataset requireDataset(Long workspaceId, Long datasetId) {
        return evalDatasetRepository.findByIdAndWorkspaceId(datasetId, workspaceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    public EvalRun requireRun(Prompt prompt, Long runId) {
        return evalRunRepository.findByIdAndPromptId(runId, prompt.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private User findUser(Long userId) {
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED);
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    public record PromptScope(User user, Workspace workspace, Prompt prompt) {
        public Long organizationId() {
            return workspace.getOrganization().getId();
        }
    }
}
