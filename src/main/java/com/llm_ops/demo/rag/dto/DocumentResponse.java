package com.llm_ops.demo.rag.dto;

import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.domain.RagDocumentStatus;
import java.time.LocalDateTime;

public record DocumentResponse(
        Long id,
        String fileName,
        RagDocumentStatus status,
        LocalDateTime createdAt
) {

    public static DocumentResponse from(RagDocument document) {
        return new DocumentResponse(
                document.getId(),
                document.getFileName(),
                document.getStatus(),
                document.getCreatedAt()
        );
    }
}
