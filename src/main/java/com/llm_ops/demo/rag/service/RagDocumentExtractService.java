package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import org.apache.tika.exception.TikaException;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RagDocumentExtractService {

    private static final String METADATA_WORKSPACE_ID = "workspace_id";

    public List<Document> extract(Long workspaceId, Resource resource) {
        validateInput(workspaceId, resource);

        List<Document> documents = readDocuments(resource);
        if (documents.isEmpty() || documents.stream().allMatch(document -> isBlank(document.getContent()))) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "문서에서 추출할 수 있는 내용이 없습니다.");
        }

        return documents.stream()
                .map(document -> applyWorkspaceMetadata(workspaceId, document))
                .toList();
    }

    private void validateInput(Long workspaceId, Resource resource) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        if (resource == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "문서 리소스가 필요합니다.");
        }
        if (!resource.exists() || !resource.isReadable()) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "문서 파일을 읽을 수 없습니다.");
        }
    }

    private List<Document> readDocuments(Resource resource) {
        try {
            return new TikaDocumentReader(resource).get();
        } catch (Exception ex) {
            throw classifyException(ex);
        }
    }

    private BusinessException classifyException(Exception ex) {
        Throwable rootCause = rootCauseOf(ex);
        if (rootCause instanceof IOException) {
            return new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "문서 읽기 중 IO 오류가 발생했습니다.");
        }
        if (rootCause instanceof IllegalArgumentException || rootCause instanceof TikaException || isInputIssueMessage(ex)) {
            return new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "문서에서 텍스트를 추출할 수 없습니다.");
        }
        return new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "문서 처리 중 오류가 발생했습니다.");
    }

    private boolean isInputIssueMessage(Exception ex) {
        String message = ex.getMessage();
        if (message == null) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("password")
                || normalized.contains("encrypted")
                || normalized.contains("unsupported")
                || normalized.contains("corrupt");
    }

    private Throwable rootCauseOf(Throwable throwable) {
        Throwable cursor = throwable;
        while (cursor.getCause() != null && cursor.getCause() != cursor) {
            cursor = cursor.getCause();
        }
        return cursor;
    }

    private Document applyWorkspaceMetadata(Long workspaceId, Document document) {
        Map<String, Object> metadata = new HashMap<>(document.getMetadata());
        metadata.put(METADATA_WORKSPACE_ID, workspaceId);
        return new Document(document.getContent(), metadata);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
