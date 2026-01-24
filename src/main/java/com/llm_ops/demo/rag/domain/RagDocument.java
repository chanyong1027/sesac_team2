package com.llm_ops.demo.rag.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * RAG 지식베이스의 원본 문서 메타데이터 엔티티입니다.
 *
 * <p>현재는 S3 연동(T-0401) 이전 단계이므로 fileUrl은 로컬 경로/임시 URL 등으로도 사용될 수 있습니다.</p>
 */
@Entity
@Table(name = "documents")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RagDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "file_url")
    private String fileUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private RagDocumentStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private RagDocument(Long workspaceId, String fileName, String fileUrl, RagDocumentStatus status) {
        this.workspaceId = workspaceId;
        this.fileName = fileName;
        this.fileUrl = fileUrl;
        this.status = status;
    }

    public static RagDocument create(Long workspaceId, String fileName, String fileUrl) {
        return new RagDocument(workspaceId, fileName, fileUrl, RagDocumentStatus.ACTIVE);
    }

    public void markDeleted() {
        this.status = RagDocumentStatus.DELETED;
    }
}

