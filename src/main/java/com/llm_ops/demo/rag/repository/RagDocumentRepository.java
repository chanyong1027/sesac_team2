package com.llm_ops.demo.rag.repository;

import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.domain.RagDocumentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RagDocumentRepository extends JpaRepository<RagDocument, Long> {
    List<RagDocument> findAllByWorkspaceIdAndStatusOrderByCreatedAtDesc(Long workspaceId, RagDocumentStatus status);

    Optional<RagDocument> findByIdAndWorkspaceId(Long id, Long workspaceId);
}

