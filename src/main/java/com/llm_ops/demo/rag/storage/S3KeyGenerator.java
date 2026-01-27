package com.llm_ops.demo.rag.storage;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Paths;
import java.util.UUID;

/**
 * S3 객체 키를 생성합니다.
 */
@Component
public class S3KeyGenerator {

    public String generateDocumentKey(Long workspaceId, String originalFilename) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new IllegalArgumentException("workspaceId가 올바르지 않습니다.");
        }
        String filename = normalizeFilename(originalFilename);
        String uuid = UUID.randomUUID().toString();
        return String.format("workspaces/%d/documents/%s-%s", workspaceId, uuid, filename);
    }

    private String normalizeFilename(String originalFilename) {
        if (!StringUtils.hasText(originalFilename)) {
            return "file";
        }
        String baseName = Paths.get(originalFilename).getFileName().toString();
        return StringUtils.hasText(baseName) ? baseName : "file";
    }
}
