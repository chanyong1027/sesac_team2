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
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PromptVersionService {

    private final PromptVersionRepository promptVersionRepository;
    private final PromptRepository promptRepository;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    /**
     * Create a new version for the specified prompt and persist it.
     *
     * @param promptId the id of the prompt to create a new version for
     * @param userId the id of the user creating the version
     * @param request payload containing the new version's title, provider, model, system prompt, user template, and model configuration
     * @return a response representing the persisted prompt version
     */
    @Transactional
    public PromptVersionCreateResponse create(Long promptId, Long userId, PromptVersionCreateRequest request) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt, user);

        int nextVersionNo = calculateNextVersionNo(prompt);
        PromptVersion version = buildVersion(prompt, nextVersionNo, request, user);
        PromptVersion saved = promptVersionRepository.save(version);

        return PromptVersionCreateResponse.from(saved);
    }

    /**
     * Retrieve detailed information for a specific version of a prompt after validating the requesting user's workspace membership.
     *
     * @param promptId the ID of the prompt that owns the version
     * @param versionId the ID of the prompt version to retrieve
     * @param userId the ID of the user making the request (used to validate access)
     * @return a {@link PromptVersionDetailResponse} representing the requested prompt version
     */
    @Transactional(readOnly = true)
    public PromptVersionDetailResponse getDetail(Long promptId, Long versionId, Long userId) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);

        validateWorkspaceMembership(prompt, user);

        PromptVersion version = findVersion(prompt, versionId);
        return PromptVersionDetailResponse.from(version);
    }

    /**
     * List all versions of a prompt that the specified user can access, ordered by version number descending.
     *
     * @param promptId the ID of the prompt whose versions to list
     * @param userId   the ID of the requesting user (used to validate workspace membership)
     * @return a list of PromptVersionSummaryResponse objects ordered by version number descending
     */
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

    /**
     * Finds the prompt version with the given id and verifies it belongs to the specified prompt.
     *
     * @param prompt    the prompt that the version must be associated with
     * @param versionId the id of the prompt version to find
     * @return the matching PromptVersion
     * @throws BusinessException with ErrorCode.NOT_FOUND if no matching version exists or it does not belong to the prompt
     */
    private PromptVersion findVersion(Prompt prompt, Long versionId) {
        return promptVersionRepository.findById(versionId)
                .filter(v -> v.getPrompt().getId().equals(prompt.getId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    /**
     * Retrieve the User for the given id or throw a NOT_FOUND error if none exists.
     *
     * @return the found User
     * @throws BusinessException with ErrorCode.NOT_FOUND if no user is found for the given id
     */
    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    /**
     * Retrieve an active Prompt by its ID.
     *
     * @param promptId the ID of the prompt to find
     * @return the Prompt with status ACTIVE
     * @throws BusinessException with ErrorCode.NOT_FOUND if no active prompt exists for the given ID
     */
    private Prompt findActivePrompt(Long promptId) {
        return promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    /**
     * Verify the user is a member of the prompt's workspace.
     *
     * @param prompt the prompt whose workspace membership is being checked
     * @param user   the user to validate as a workspace member
     * @throws BusinessException with ErrorCode.FORBIDDEN if the user is not a member of the workspace
     */
    private void validateWorkspaceMembership(Prompt prompt, User user) {
        boolean isMember = workspaceMemberRepository.existsByWorkspaceAndUser(prompt.getWorkspace(), user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    /**
     * Compute the next version number for the given prompt.
     *
     * @param prompt the prompt whose versions are considered
     * @return the next version number (the current maximum version number for the prompt plus 1)
     */
    private int calculateNextVersionNo(Prompt prompt) {
        return promptVersionRepository.findMaxVersionNo(prompt) + 1;
    }

    /**
     * Build a new PromptVersion for the given prompt and version number using values from the request and the creating user.
     *
     * @param prompt    the prompt to which the new version will belong
     * @param versionNo the version number to assign to the new prompt version
     * @param request   the creation request containing title, provider, model, system prompt, user template, and model config
     * @param user      the user creating the version
     * @return          a new PromptVersion instance populated with the provided data (ready to be persisted)
     */
    private PromptVersion buildVersion(Prompt prompt, int versionNo, PromptVersionCreateRequest request, User user) {
        return PromptVersion.create(
                prompt,
                versionNo,
                request.title(),
                request.provider(),
                request.model(),
                request.systemPrompt(),
                request.userTemplate(),
                request.modelConfig(),
                user
        );
    }
}