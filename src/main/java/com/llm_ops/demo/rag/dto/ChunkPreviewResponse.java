package com.llm_ops.demo.rag.dto;

import java.util.Map;
import org.springframework.ai.document.Document;

public record ChunkPreviewResponse(
        Integer chunkIndex,
        Integer chunkTotal,
        String content
) {
    public static ChunkPreviewResponse from(Document document) {
        Map<String, Object> metadata = document.getMetadata();
        return new ChunkPreviewResponse(
                resolveInt(metadata, "chunk_index"),
                resolveInt(metadata, "chunk_total"),
                document.getContent()
        );
    }

    private static Integer resolveInt(Map<String, Object> metadata, String key) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        Object value = metadata.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
