package com.llm_ops.demo.workspace.domain;

import com.llm_ops.demo.auth.domain.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "workspace_invitation_links")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkspaceInvitationLink {

    private static final int EXPIRATION_DAYS = 7;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @Column(nullable = false, unique = true, length = 36)
    private String token;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WorkspaceRole role;

    @Column(nullable = false)
    private LocalDateTime expiredAt;

    @Column(nullable = false)
    private int useCount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public static WorkspaceInvitationLink create(Workspace workspace, WorkspaceRole role, User createdBy) {
        validateCreateParameters(workspace, role, createdBy);

        WorkspaceInvitationLink link = new WorkspaceInvitationLink();
        link.workspace = workspace;
        link.token = generateToken();
        link.role = role;
        link.expiredAt = calculateExpirationDate();
        link.useCount = 0;
        link.createdBy = createdBy;
        return link;
    }

    private static void validateCreateParameters(Workspace workspace, WorkspaceRole role, User createdBy) {
        Objects.requireNonNull(workspace, "Workspace must not be null");
        Objects.requireNonNull(role, "Role must not be null");
        Objects.requireNonNull(createdBy, "CreatedBy must not be null");
    }

    private static String generateToken() {
        return UUID.randomUUID().toString();
    }

    private static LocalDateTime calculateExpirationDate() {
        return LocalDateTime.now().plusDays(EXPIRATION_DAYS);
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(this.expiredAt);
    }

    public boolean isValid() {
        return !isExpired();
    }

    public void incrementUseCount() {
        this.useCount++;
    }

    public Long getWorkspaceId() {
        return this.workspace != null ? this.workspace.getId() : null;
    }

    public Long getOrganizationId() {
        if (this.workspace == null || this.workspace.getOrganization() == null) {
            return null;
        }
        return this.workspace.getOrganization().getId();
    }
}
