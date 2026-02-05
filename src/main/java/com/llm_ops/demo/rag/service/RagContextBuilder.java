package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.rag.config.RagContextProperties;
import com.llm_ops.demo.rag.dto.ChunkDetailResponse;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * RAG 컨텍스트 문자열과 메트릭을 생성합니다.
 */
@Component
public class RagContextBuilder {

    private final RagContextProperties properties;

    public RagContextBuilder(RagContextProperties properties) {
        this.properties = properties;
    }

    public RagContextResult build(List<ChunkDetailResponse> chunks, int maxChunks, int maxChars) {
        if (chunks == null || chunks.isEmpty()) {
            return new RagContextResult("", 0, 0, false);
        }

        StringBuilder builder = new StringBuilder();
        int count = 0;
        int totalChars = 0;
        boolean truncated = false;

        for (ChunkDetailResponse chunk : chunks) {
            if (count >= maxChunks) {
                truncated = true;
                break;
            }
            if (chunk == null || chunk.content() == null || chunk.content().isBlank()) {
                continue;
            }

            String content = formatChunk(chunk);
            int remaining = maxChars - totalChars;
            if (remaining <= 0) {
                truncated = true;
                break;
            }

            if (content.length() > remaining) {
                content = content.substring(0, remaining);
                truncated = true;
            }

            if (builder.length() > 0) {
                builder.append(properties.getSeparator());
            }
            builder.append(content);
            totalChars += content.length();
            count++;

            if (totalChars >= maxChars) {
                truncated = true;
                break;
            }
        }

        if (truncated) {
            if (builder.length() > 0) {
                builder.append(properties.getSeparator());
            }
            builder.append(properties.getTruncatedMarker());
        }

        return new RagContextResult(builder.toString(), count, totalChars, truncated);
    }

    private String formatChunk(ChunkDetailResponse chunk) {
        if (!properties.isIncludeSource() && !properties.isIncludeScore()) {
            return chunk.content();
        }
        StringBuilder builder = new StringBuilder();
        if (properties.isIncludeSource()) {
            if (chunk.documentName() != null && !chunk.documentName().isBlank()) {
                builder.append("[source: ").append(chunk.documentName()).append("] ");
            }
        }
        if (properties.isIncludeScore() && chunk.score() != null) {
            builder.append("[score: ").append(String.format("%.4f", chunk.score())).append("] ");
        }
        builder.append(chunk.content());
        return builder.toString();
    }

    public record RagContextResult(
        String context,
        int chunksIncluded,
        int contextChars,
        boolean truncated
    ) {
    }
}
