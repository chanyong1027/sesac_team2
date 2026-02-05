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
import jakarta.validation.constraints.NotNull;
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
    @NotNull
    private Workspace workspace;

    @Column(name = "top_k", nullable = false)
    private Integer topK;

    @Column(name = "similarity_threshold", nullable = false)
    private Double similarityThreshold;

    @Column(name = "max_chunks", nullable = false)
    private Integer maxChunks;

    @Column(name = "max_context_chars", nullable = false)
    private Integer maxContextChars;

    @Column(name = "hybrid_enabled", nullable = false)
    private Boolean hybridEnabled;

    @Column(name = "rerank_enabled", nullable = false)
    private Boolean rerankEnabled;

    @Column(name = "rerank_top_n", nullable = false)
    private Integer rerankTopN;

    @Column(name = "chunk_size", nullable = false)
    private Integer chunkSize;

    @Column(name = "chunk_overlap_tokens", nullable = false)
    private Integer chunkOverlapTokens;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @NotNull
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

    public Boolean getHybridEnabled() {
        return hybridEnabled;
    }

    public Boolean getRerankEnabled() {
        return rerankEnabled;
    }

    public Integer getRerankTopN() {
        return rerankTopN;
    }

    public Integer getChunkSize() {
        return chunkSize;
    }

    public Integer getChunkOverlapTokens() {
        return chunkOverlapTokens;
    }

    public static WorkspaceRagSettings create(
        Workspace workspace,
        Integer topK,
        Double similarityThreshold,
        Integer maxChunks,
        Integer maxContextChars,
        Boolean hybridEnabled,
        Boolean rerankEnabled,
        Integer rerankTopN,
        Integer chunkSize,
        Integer chunkOverlapTokens
    ) {
        WorkspaceRagSettings settings = new WorkspaceRagSettings();
        settings.workspace = workspace;
        settings.topK = topK;
        settings.similarityThreshold = similarityThreshold;
        settings.maxChunks = maxChunks;
        settings.maxContextChars = maxContextChars;
        settings.hybridEnabled = hybridEnabled;
        settings.rerankEnabled = rerankEnabled;
        settings.rerankTopN = rerankTopN;
        settings.chunkSize = chunkSize;
        settings.chunkOverlapTokens = chunkOverlapTokens;
        return settings;
    }

    public void update(
        Integer topK,
        Double similarityThreshold,
        Integer maxChunks,
        Integer maxContextChars,
        Boolean hybridEnabled,
        Boolean rerankEnabled,
        Integer rerankTopN,
        Integer chunkSize,
        Integer chunkOverlapTokens
    ) {
        this.topK = topK;
        this.similarityThreshold = similarityThreshold;
        this.maxChunks = maxChunks;
        this.maxContextChars = maxContextChars;
        this.hybridEnabled = hybridEnabled;
        this.rerankEnabled = rerankEnabled;
        this.rerankTopN = rerankTopN;
        this.chunkSize = chunkSize;
        this.chunkOverlapTokens = chunkOverlapTokens;
    }
}
