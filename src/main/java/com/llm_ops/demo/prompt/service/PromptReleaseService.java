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
        PromptRelease release = createOrUpdateRelease(prompt, newVersion, user, request.reason());

        return PromptReleaseResponse.from(release);
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

        return PromptReleaseResponse.from(release);
    }

    private PromptRelease createOrUpdateRelease(Prompt prompt, PromptVersion newVersion, User user, String reason) {
        return promptReleaseRepository.findByPromptId(prompt.getId())
                .map(existing -> updateExistingRelease(existing, newVersion, user, reason))
                .orElseGet(() -> createFirstRelease(prompt, newVersion, user, reason));
    }

    private PromptRelease updateExistingRelease(PromptRelease existing, PromptVersion newVersion, User user, String reason) {
        PromptVersion oldVersion = existing.getActiveVersion();

        if (oldVersion.getId().equals(newVersion.getId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 해당 버전이 활성화되어 있습니다.");
        }

        existing.changeActiveVersion(newVersion);
        recordHistory(existing.getPrompt(), oldVersion, newVersion, ChangeType.RELEASE, reason, user);

        return existing;
    }

    private PromptRelease createFirstRelease(Prompt prompt, PromptVersion newVersion, User user, String reason) {
        PromptRelease release = PromptRelease.create(prompt, newVersion);
        promptReleaseRepository.save(release);

        recordHistory(prompt, null, newVersion, ChangeType.RELEASE, reason, user);

        return release;
    }

    private void recordHistory(Prompt prompt, PromptVersion fromVersion, PromptVersion toVersion,
                               ChangeType changeType, String reason, User changedBy) {
        PromptReleaseHistory history = PromptReleaseHistory.create(
                prompt, fromVersion, toVersion, changeType, reason, changedBy
        );
        promptReleaseHistoryRepository.save(history);
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
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
