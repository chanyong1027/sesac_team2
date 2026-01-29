package com.llm_ops.demo.rag.dto;

import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.domain.RagDocumentStatus;

public record DocumentUploadResponse(
        Long documentId,
        RagDocumentStatus status
) {

    public static DocumentUploadResponse from(RagDocument document) {
        return new DocumentUploadResponse(document.getId(), document.getStatus());
    }
}
