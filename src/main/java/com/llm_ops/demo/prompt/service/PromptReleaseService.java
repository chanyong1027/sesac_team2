package com.llm_ops.demo.prompt.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
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
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PromptReleaseService {

    private final PromptReleaseRepository promptReleaseRepository;
    private final PromptReleaseHistoryRepository promptReleaseHistoryRepository;
    private final PromptRepository promptRepository;
    private final PromptVersionRepository promptVersionRepository;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    @Transactional
    public PromptReleaseResponse release(Long promptId, Long userId, PromptReleaseRequest request) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt, user);

        PromptVersion newVersion = findVersionBelongsToPrompt(prompt, request.versionId());

        return createOrUpdateRelease(prompt, newVersion, user, request.reason(), ChangeType.RELEASE);
    }

    @Transactional
    public PromptReleaseResponse rollback(Long promptId, Long userId, PromptRollbackRequest request) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt, user);

        PromptRelease existingRelease = findExistingRelease(promptId);
        PromptVersion targetVersion = findVersionBelongsToPrompt(prompt, request.versionId());

        validateVersionChange(existingRelease.getActiveVersion(), targetVersion);

        return doChangeActiveVersion(existingRelease, targetVersion, user, request.reason(), ChangeType.ROLLBACK);
    }

    @Transactional(readOnly = true)
    public List<PromptReleaseHistoryResponse> getHistory(Long promptId, Long userId) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt, user);

        return promptReleaseHistoryRepository.findByPromptOrderByCreatedAtDesc(prompt)
                .stream()
                .map(PromptReleaseHistoryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PromptReleaseResponse getCurrentRelease(Long promptId, Long userId) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt, user);

        PromptRelease release = promptReleaseRepository.findByPromptId(promptId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "릴리즈된 버전이 없습니다."));
        if (release.getActiveVersion() == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "릴리즈된 버전이 없습니다.");
        }

        return PromptReleaseResponse.from(release);
    }

    private PromptReleaseResponse createOrUpdateRelease(Prompt prompt, PromptVersion newVersion, User user,
                                                          String reason, ChangeType changeType) {
        return promptReleaseRepository.findByPromptId(prompt.getId())
                .map(existing -> {
                    validateVersionChange(existing.getActiveVersion(), newVersion);
                    return doChangeActiveVersion(existing, newVersion, user, reason, changeType);
                })
                .orElseGet(() -> createFirstRelease(prompt, newVersion, user, reason));
    }

    private PromptReleaseResponse doChangeActiveVersion(PromptRelease release, PromptVersion newVersion,
                                                         User user, String reason, ChangeType changeType) {
        PromptVersion oldVersion = release.getActiveVersion();
        release.changeActiveVersion(newVersion);
        recordHistory(release.getPrompt(), oldVersion, newVersion, changeType, reason, user);

        return PromptReleaseResponse.from(release);
    }

    private void validateVersionChange(PromptVersion currentVersion, PromptVersion targetVersion) {
        if (currentVersion.getId().equals(targetVersion.getId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 해당 버전이 활성화되어 있습니다.");
        }
    }

    private PromptRelease findExistingRelease(Long promptId) {
        return promptReleaseRepository.findByPromptId(promptId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "릴리스된 버전이 없어 롤백할 수 없습니다."));
    }

    private PromptReleaseResponse createFirstRelease(Prompt prompt, PromptVersion newVersion, User user, String reason) {
        PromptRelease release = PromptRelease.create(prompt, newVersion);
        promptReleaseRepository.save(release);

        recordHistory(prompt, null, newVersion, ChangeType.RELEASE, reason, user);

        return PromptReleaseResponse.from(release);
    }

    private void recordHistory(Prompt prompt, PromptVersion fromVersion, PromptVersion toVersion,
                               ChangeType changeType, String reason, User changedBy) {
        PromptReleaseHistory history = PromptReleaseHistory.create(
                prompt, fromVersion, toVersion, changeType, reason, changedBy
        );
        promptReleaseHistoryRepository.save(history);
    }

    private User findUser(Long userId) {
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED, "로그인이 필요합니다.");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다."));
    }

    private Prompt findActivePrompt(Long promptId) {
        return promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private PromptVersion findVersionBelongsToPrompt(Prompt prompt, Long versionId) {
        return promptVersionRepository.findById(versionId)
                .filter(v -> v.getPrompt().getId().equals(prompt.getId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "해당 프롬프트의 버전이 아닙니다."));
    }

    private void validateWorkspaceMembership(Prompt prompt, User user) {
        boolean isMember = workspaceMemberRepository.existsByWorkspaceAndUser(prompt.getWorkspace(), user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }
}
