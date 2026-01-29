package com.llm_ops.demo.rag.dto;

public record DocumentDeleteResponse(
        Long documentId,
        String message
) {

    public static DocumentDeleteResponse of(Long documentId, String message) {
        return new DocumentDeleteResponse(documentId, message);
    }
}
