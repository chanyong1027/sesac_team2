package com.llm_ops.demo.workspace.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
    name = "workspace_rag_settings",
    uniqueConstraints = @UniqueConstraint(columnNames = {"workspace_id"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkspaceRagSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @Column(name = "top_k", nullable = false)
    private Integer topK;

    @Column(name = "similarity_threshold", nullable = false)
    private Double similarityThreshold;

    @Column(name = "max_chunks", nullable = false)
    private Integer maxChunks;

    @Column(name = "max_context_chars", nullable = false)
    private Integer maxContextChars;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public Workspace getWorkspace() {
        return workspace;
    }

    public Integer getTopK() {
        return topK;
    }

    public Double getSimilarityThreshold() {
        return similarityThreshold;
    }

    public Integer getMaxChunks() {
        return maxChunks;
    }

    public Integer getMaxContextChars() {
        return maxContextChars;
    }

    public static WorkspaceRagSettings create(
        Workspace workspace,
        Integer topK,
        Double similarityThreshold,
        Integer maxChunks,
        Integer maxContextChars
    ) {
        WorkspaceRagSettings settings = new WorkspaceRagSettings();
        settings.workspace = workspace;
        settings.topK = topK;
        settings.similarityThreshold = similarityThreshold;
        settings.maxChunks = maxChunks;
        settings.maxContextChars = maxContextChars;
        return settings;
    }

    public void update(Integer topK, Double similarityThreshold, Integer maxChunks, Integer maxContextChars) {
        this.topK = topK;
        this.similarityThreshold = similarityThreshold;
        this.maxChunks = maxChunks;
        this.maxContextChars = maxContextChars;
    }
}
