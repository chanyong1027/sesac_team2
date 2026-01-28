package com.llm_ops.demo.prompt.controller;

import com.llm_ops.demo.prompt.dto.PromptVersionCreateRequest;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionDetailResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionSummaryResponse;
import com.llm_ops.demo.prompt.service.PromptVersionService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/prompts/{promptId}/versions")
@RequiredArgsConstructor
public class PromptVersionController {

    private final PromptVersionService promptVersionService;

    /**
     * Create a new version for the specified prompt.
     *
     * @param promptId the ID of the parent prompt
     * @param userId   the authenticated user's ID performing the operation
     * @param request  the payload containing data for the new prompt version; validated before processing
     * @return the created PromptVersionCreateResponse containing the new version's details
     */
    @PostMapping
    public ResponseEntity<PromptVersionCreateResponse> createVersion(
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody PromptVersionCreateRequest request) {
        PromptVersionCreateResponse response = promptVersionService.create(promptId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Retrieve details for a specific prompt version.
     *
     * @param promptId  ID of the parent prompt
     * @param versionId ID of the prompt version to retrieve
     * @param userId    authenticated user's ID (used for access control or personalization)
     * @return a ResponseEntity whose body is a PromptVersionDetailResponse with the requested version's details
     */
    @GetMapping("/{versionId}")
    public ResponseEntity<PromptVersionDetailResponse> getVersion(
            @PathVariable Long promptId,
            @PathVariable Long versionId,
            @AuthenticationPrincipal Long userId) {
        PromptVersionDetailResponse response = promptVersionService.getDetail(promptId, versionId, userId);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve summaries of all versions for the specified prompt.
     *
     * @param promptId the ID of the parent prompt whose versions are being listed
     * @param userId the authenticated user's ID (used for access control and personalization)
     * @return a list of PromptVersionSummaryResponse objects describing each version
     */
    @GetMapping
    public ResponseEntity<List<PromptVersionSummaryResponse>> getVersions(
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId) {
        List<PromptVersionSummaryResponse> response = promptVersionService.getList(promptId, userId);
        return ResponseEntity.ok(response);
    }
}