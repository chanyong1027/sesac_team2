package com.llm_ops.demo.workspace.dto;

public record WorkspaceDeleteResponse(
    Long workspaceId,
    String message
) {
    public static WorkspaceDeleteResponse of(Long workspaceId) {
        return new WorkspaceDeleteResponse(workspaceId, "워크스페이스가 비활성화되었습니다.");
    }
}
