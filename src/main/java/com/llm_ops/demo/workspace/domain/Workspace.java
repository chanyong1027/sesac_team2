package com.llm_ops.demo.workspace.domain;

import com.llm_ops.demo.organization.domain.Organization;
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
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "workspaces",
       uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "name"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Workspace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 100)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WorkspaceStatus status;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public static Workspace create(Organization organization, String name, String displayName) {
        Workspace workspace = new Workspace();
        workspace.organization = organization;
        workspace.name = name;
        workspace.displayName = displayName;
        workspace.status = WorkspaceStatus.ACTIVE;
        return workspace;
    }

    public void deactivate() {
        this.status = WorkspaceStatus.INACTIVE;
    }

    public void activate() {
        this.status = WorkspaceStatus.ACTIVE;
    }

    public boolean isActive() {
        return this.status == WorkspaceStatus.ACTIVE;
    }
}
