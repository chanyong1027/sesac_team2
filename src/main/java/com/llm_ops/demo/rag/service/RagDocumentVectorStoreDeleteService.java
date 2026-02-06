package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.config.RagVectorStoreProperties;
import com.llm_ops.demo.rag.metadata.RagMetadataKeys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@ConditionalOnBean(JdbcTemplate.class)
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagDocumentVectorStoreDeleteService {

    private final JdbcTemplate jdbcTemplate;
    private final RagVectorStoreProperties properties;

    @PostConstruct
    public void validateConfiguration() {
        validateIdentifier(properties.getSchemaName(), "schemaName");
        validateIdentifier(properties.getTableName(), "tableName");
    }

    public int deleteByDocumentId(Long documentId) {
        if (documentId == null || documentId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "documentId가 필요합니다.");
        }

        String table = properties.getSchemaName() + "." + properties.getTableName();
        String sql = "DELETE FROM " + table + " WHERE metadata->>'" + RagMetadataKeys.DOCUMENT_ID + "' = ?";
        return jdbcTemplate.update(sql, documentId.toString());
    }

    public int deleteForDocument(Long workspaceId, Long documentId, String documentName) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        int deleted = deleteByDocumentId(documentId);
        if (deleted > 0) {
            return deleted;
        }
        if (documentName == null || documentName.isBlank()) {
            return 0;
        }
        String table = properties.getSchemaName() + "." + properties.getTableName();
        String sql = "DELETE FROM " + table
            + " WHERE metadata->>'" + RagMetadataKeys.WORKSPACE_ID + "' = ? AND (metadata->>'" + RagMetadataKeys.DOCUMENT_NAME + "' = ? OR metadata->>'file_name' = ? OR metadata->>'resourceName' = ? OR metadata->>'filename' = ?)";
        return jdbcTemplate.update(sql,
            workspaceId.toString(),
            documentName,
            documentName,
            documentName,
            documentName
        );
    }

    private void validateIdentifier(String identifier, String fieldName) {
        if (identifier == null || identifier.trim().isEmpty()) {
            throw new IllegalArgumentException(fieldName + " must not be null or empty");
        }
        if (!identifier.matches("^[a-zA-Z0-9_]+$")) {
            throw new IllegalArgumentException(
                fieldName + " contains invalid characters: " + identifier
            );
        }
    }
}
