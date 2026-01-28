package com.llm_ops.demo.rag.controller;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.service.RagSearchService;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/rag")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagController {

    private final RagSearchService ragSearchService;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;

    @GetMapping("/search")
    public ResponseEntity<RagSearchResponse> search(
        @PathVariable Long workspaceId,
        @RequestParam String query,
        @RequestHeader("X-User-Id") Long userId
    ) {
        validateQuery(query);
        validateWorkspaceAccess(workspaceId, userId);

        RagSearchResponse response = ragSearchService.search(workspaceId, query);
        return ResponseEntity.ok(response);
    }

    private void validateQuery(String query) {
        if (query == null || query.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "query가 필요합니다.");
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
