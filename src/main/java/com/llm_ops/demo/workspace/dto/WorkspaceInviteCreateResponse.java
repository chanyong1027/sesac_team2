package com.llm_ops.demo.workspace.dto;

import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import java.time.LocalDateTime;
import java.util.Objects;

public record WorkspaceInviteCreateResponse(
    String invitationUrl,
    String token,
    WorkspaceRole role,
    LocalDateTime expiredAt
) {
    public static WorkspaceInviteCreateResponse from(WorkspaceInvitationLink link, String baseUrl) {
        Objects.requireNonNull(link, "WorkspaceInvitationLink must not be null");
        Objects.requireNonNull(baseUrl, "baseUrl must not be null");

        String invitationUrl = buildInvitationUrl(baseUrl, link.getToken());
        return new WorkspaceInviteCreateResponse(
            invitationUrl,
            link.getToken(),
            link.getRole(),
            link.getExpiredAt()
        );
    }

    private static String buildInvitationUrl(String baseUrl, String token) {
        String normalizedBaseUrl = baseUrl.endsWith("/")
            ? baseUrl.substring(0, baseUrl.length() - 1)
            : baseUrl;
        return normalizedBaseUrl + "/invitations/accept?token=" + token;
    }
}
