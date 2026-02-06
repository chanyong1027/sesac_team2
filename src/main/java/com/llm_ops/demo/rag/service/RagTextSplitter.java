package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.rag.config.RagChunkingProperties;
import com.knuddels.jtokkit.Encodings;
import com.knuddels.jtokkit.api.Encoding;
import com.knuddels.jtokkit.api.EncodingRegistry;
import com.knuddels.jtokkit.api.EncodingType;
import org.springframework.ai.document.Document;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 문단 우선 + 토큰 오버랩 기반 청킹을 수행합니다.
 */
@Component
public class RagTextSplitter {

    private static final String PARAGRAPH_SEPARATOR_REGEX = "\\n\\s*\\n";

    private final RagChunkingProperties properties;
    private final EncodingRegistry registry = Encodings.newLazyEncodingRegistry();
    private final Encoding encoding = registry.getEncoding(EncodingType.CL100K_BASE);

    public RagTextSplitter(RagChunkingProperties properties) {
        this.properties = properties;
    }

    public List<Document> split(Document document) {
        return split(document, null, null);
    }

    public List<Document> split(Document document, Integer chunkSizeOverride, Integer chunkOverlapTokensOverride) {
        if (document == null || document.getContent() == null || document.getContent().isBlank()) {
            return List.of();
        }
        List<String> chunks = splitText(document.getContent(), chunkSizeOverride, chunkOverlapTokensOverride);
        if (chunks.isEmpty()) {
            return List.of();
        }
        Map<String, Object> metadata = document.getMetadata();
        return chunks.stream()
            .map(content -> {
                Document chunk = new Document(content, metadata);
                chunk.setContentFormatter(document.getContentFormatter());
                return chunk;
            })
            .toList();
    }

    private List<String> splitText(String text, Integer chunkSizeOverride, Integer chunkOverlapTokensOverride) {
        int chunkSize = resolveChunkSize(chunkSizeOverride);
        int overlapTokens = resolveOverlapTokens(chunkOverlapTokensOverride);

        String[] paragraphs = text.split(PARAGRAPH_SEPARATOR_REGEX);
        List<String> packedChunks = packParagraphs(paragraphs, chunkSize);
        List<String> overlapped = applyOverlap(packedChunks, overlapTokens);

        List<String> results = new ArrayList<>();
        for (String chunk : overlapped) {
            if (chunk == null || chunk.isBlank()) {
                continue;
            }
            if (!properties.isKeepSeparator()) {
                chunk = chunk.replace("\n", " ").replaceAll(" +", " ").trim();
            }
            if (chunk.length() < properties.getMinChunkLengthToEmbed()) {
                continue;
            }
            results.add(chunk.trim());
            if (results.size() >= properties.getMaxNumChunks()) {
                break;
            }
        }
        return results;
    }

    private List<String> packParagraphs(String[] paragraphs, int chunkSize) {
        List<String> chunks = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int currentTokens = 0;

        for (String paragraph : paragraphs) {
            if (paragraph == null || paragraph.isBlank()) {
                continue;
            }
            String trimmed = paragraph.trim();
            if (trimmed.length() > properties.getParagraphMaxChars()) {
                if (current.length() > 0) {
                    chunks.add(current.toString().trim());
                    current.setLength(0);
                    currentTokens = 0;
                }
                chunks.addAll(splitByTokens(trimmed, chunkSize));
                continue;
            }

            int paraTokens = countTokens(trimmed);
            if (paraTokens > chunkSize) {
                if (current.length() > 0) {
                    chunks.add(current.toString().trim());
                    current.setLength(0);
                    currentTokens = 0;
                }
                chunks.addAll(splitByTokens(trimmed, chunkSize));
                continue;
            }
            int separatorTokens = current.length() == 0 ? 0 : countTokens("\n\n");
            if (currentTokens + separatorTokens + paraTokens <= chunkSize) {
                if (current.length() > 0) {
                    current.append("\n\n");
                }
                current.append(trimmed);
                currentTokens += separatorTokens + paraTokens;
            } else {
                if (current.length() > 0) {
                    chunks.add(current.toString().trim());
                }
                current.setLength(0);
                current.append(trimmed);
                currentTokens = paraTokens;
            }
        }

        if (current.length() > 0) {
            chunks.add(current.toString().trim());
        }
        return chunks;
    }

    private List<String> splitByTokens(String text, int chunkSize) {
        List<Integer> tokens = encoding.encode(text);
        List<String> chunks = new ArrayList<>();

        int start = 0;
        while (start < tokens.size()) {
            int end = Math.min(start + chunkSize, tokens.size());
            String chunk = decodeTokens(tokens.subList(start, end));
            if (!chunk.isBlank()) {
                chunks.add(chunk.trim());
            }
            start = end;
        }
        return chunks;
    }

    private List<String> applyOverlap(List<String> chunks, int overlapTokens) {
        if (overlapTokens <= 0 || chunks.isEmpty()) {
            return chunks;
        }

        List<String> results = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            String current = chunks.get(i);
            if (i == 0) {
                results.add(current);
                continue;
            }
            String prev = chunks.get(i - 1);
            String overlap = tailTokens(prev, overlapTokens);
            String merged = overlap.isBlank() ? current : (overlap + " " + current).trim();
            results.add(merged);
        }
        return results;
    }

    private int countTokens(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return encoding.countTokens(text);
    }

    private String tailTokens(String text, int overlapTokens) {
        List<Integer> tokens = encoding.encode(text);
        if (tokens.isEmpty()) {
            return "";
        }
        int start = Math.max(tokens.size() - overlapTokens, 0);
        return decodeTokens(tokens.subList(start, tokens.size())).trim();
    }

    private String decodeTokens(List<Integer> tokens) {
        return encoding.decode(tokens);
    }

    private int resolveChunkSize(Integer override) {
        if (override == null || override <= 0) {
            return properties.getChunkSize();
        }
        return override;
    }

    private int resolveOverlapTokens(Integer override) {
        if (override == null || override < 0) {
            return properties.getChunkOverlapTokens();
        }
        return override;
    }
}
