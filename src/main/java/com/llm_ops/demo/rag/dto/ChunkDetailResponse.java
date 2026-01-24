package com.llm_ops.demo.rag.dto;

import org.springframework.ai.document.Document;

import java.util.Map;

public record ChunkDetailResponse(
        String content,
        Double score,
        String documentName
) {

    public static ChunkDetailResponse from(Document document) {
        Map<String, Object> metadata = document.getMetadata();
        return new ChunkDetailResponse(
                document.getContent(),
                document.getScore(),
                resolveDocumentName(metadata)
        );
    }

    private static String resolveDocumentName(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        Object value = pickFirst(metadata, "document_name", "file_name", "resourceName", "filename");
        return value != null ? value.toString() : null;
    }

    private static Object pickFirst(Map<String, Object> metadata, String... keys) {
        for (String key : keys) {
            if (metadata.containsKey(key)) {
                Object value = metadata.get(key);
                if (value != null) {
                    return value;
                }
            }
        }
        return null;
    }
}
