package com.llm_ops.demo.prompt.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateRequest;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionDetailResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionSummaryResponse;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PromptVersionService {

    private final PromptVersionRepository promptVersionRepository;
    private final PromptRepository promptRepository;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final PromptModelAllowlistService promptModelAllowlistService;

    public PromptVersionService(
            PromptVersionRepository promptVersionRepository,
            PromptRepository promptRepository,
            UserRepository userRepository,
            WorkspaceMemberRepository workspaceMemberRepository,
            PromptModelAllowlistService promptModelAllowlistService
    ) {
        this.promptVersionRepository = promptVersionRepository;
        this.promptRepository = promptRepository;
        this.userRepository = userRepository;
        this.workspaceMemberRepository = workspaceMemberRepository;
        this.promptModelAllowlistService = promptModelAllowlistService;
    }

    @Transactional
    public PromptVersionCreateResponse create(Long promptId, Long userId, PromptVersionCreateRequest request) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt, user);
        promptModelAllowlistService.validateModel(request.provider(), request.model());
        validateUserTemplate(request.userTemplate());
        validateSecondaryModel(request);

        int nextVersionNo = calculateNextVersionNo(prompt);
        PromptVersion version = buildVersion(prompt, nextVersionNo, request, user);
        PromptVersion saved = promptVersionRepository.save(version);

        return PromptVersionCreateResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public PromptVersionDetailResponse getDetail(Long promptId, Long versionId, Long userId) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt, user);

        PromptVersion version = findVersion(prompt, versionId);
        return PromptVersionDetailResponse.from(version);
    }

    @Transactional(readOnly = true)
    public List<PromptVersionSummaryResponse> getList(Long promptId, Long userId) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt, user);

        return promptVersionRepository.findByPromptOrderByVersionNoDesc(prompt)
                .stream()
                .map(PromptVersionSummaryResponse::from)
                .toList();
    }

    private PromptVersion findVersion(Prompt prompt, Long versionId) {
        return promptVersionRepository.findById(versionId)
                .filter(v -> v.getPrompt().getId().equals(prompt.getId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private Prompt findActivePrompt(Long promptId) {
        return promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private void validateWorkspaceMembership(Prompt prompt, User user) {
        boolean isMember = workspaceMemberRepository.existsByWorkspaceAndUser(prompt.getWorkspace(), user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    private int calculateNextVersionNo(Prompt prompt) {
        return promptVersionRepository.findMaxVersionNo(prompt) + 1;
    }

    private PromptVersion buildVersion(Prompt prompt, int versionNo, PromptVersionCreateRequest request, User user) {
        boolean ragEnabled = Boolean.TRUE.equals(request.ragEnabled());
        return PromptVersion.create(
                prompt,
                versionNo,
                request.title(),
                request.provider(),
                request.model(),
                request.secondaryProvider(),
                request.secondaryModel(),
                request.systemPrompt(),
                request.userTemplate(),
                ragEnabled,
                request.contextUrl(),
                request.modelConfig(),
                user
        );
    }

    private void validateUserTemplate(String userTemplate) {
        if (userTemplate == null || userTemplate.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "userTemplate는 필수입니다.");
        }
        if (!containsQuestionPlaceholder(userTemplate)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "userTemplate에 {{question}} 변수가 필요합니다.");
        }
    }

    private boolean containsQuestionPlaceholder(String template) {
        return template.contains("{{question}}") || template.contains("{question}");
    }

    private void validateSecondaryModel(PromptVersionCreateRequest request) {
        ProviderType secondaryProvider = request.secondaryProvider();
        String secondaryModel = request.secondaryModel();

        if (secondaryProvider == null && (secondaryModel == null || secondaryModel.isBlank())) {
            return;
        }

        if (secondaryProvider == null || secondaryModel == null || secondaryModel.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "예비 모델 설정이 올바르지 않습니다.");
        }

        promptModelAllowlistService.validateModel(secondaryProvider, secondaryModel);
    }
}
