package com.llm_ops.demo.rag.service;

import org.springframework.ai.document.Document;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 문서 텍스트를 정규화하여 불필요한 공백/구분자를 줄입니다.
 */
@Component
public class RagTextNormalizer {

    public List<Document> normalize(List<Document> documents) {
        if (documents == null || documents.isEmpty()) {
            return List.of();
        }
        return documents.stream()
            .map(this::normalize)
            .toList();
    }

    public Document normalize(Document document) {
        if (document == null) {
            return null;
        }
        String normalized = normalizeText(document.getContent());
        Map<String, Object> metadata = document.getMetadata();
        Document normalizedDoc = new Document(normalized, metadata);
        normalizedDoc.setContentFormatter(document.getContentFormatter());
        return normalizedDoc;
    }

    private String normalizeText(String text) {
        if (text == null) {
            return "";
        }
        String normalized = text.replace("\r\n", "\n").replace("\r", "\n");
        // Replace tab / vertical tab / form feed with a space.
        normalized = normalized.replaceAll("[\\t\\u000B\\f]", " ");
        normalized = normalized.replaceAll(" +", " ");
        normalized = normalized.replaceAll("\n{3,}", "\n\n");
        return normalized.trim();
    }
}
