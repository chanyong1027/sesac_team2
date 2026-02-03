package com.llm_ops.demo.rag.dto;

import java.util.List;

public record DocumentPreviewResponse(
        DocumentResponse document,
        String extractedPreview,
        List<ChunkPreviewResponse> chunkSamples,
        Integer totalChunks
) {
    public static DocumentPreviewResponse of(
            DocumentResponse document,
            String extractedPreview,
            List<ChunkPreviewResponse> chunkSamples,
            int totalChunks
    ) {
        return new DocumentPreviewResponse(document, extractedPreview, chunkSamples, totalChunks);
    }
}
