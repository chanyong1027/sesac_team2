package com.llm_ops.demo.gateway.log.dto;

import com.llm_ops.demo.gateway.log.domain.RetrievedDocument;

/**
 * RAG 검색 문서 응답 DTO
 */
public record RetrievedDocumentResponse(
        Long id,
        String documentName,
        Double score,
        String content,
        Integer durationMs,
        Integer ranking) {

    public static RetrievedDocumentResponse from(RetrievedDocument doc) {
        return new RetrievedDocumentResponse(
                doc.getId(),
                doc.getDocumentName(),
                doc.getScore(),
                doc.getContent(),
                doc.getDurationMs(),
                doc.getRanking());
    }
}
