package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.config.RagVectorStoreProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * 벡터 스토어에 저장된 문서 청크를 삭제합니다.
 */
@Service
@ConditionalOnBean(JdbcTemplate.class)
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagDocumentVectorStoreDeleteService {

    private final JdbcTemplate jdbcTemplate;
    private final RagVectorStoreProperties properties;

    public RagDocumentVectorStoreDeleteService(JdbcTemplate jdbcTemplate, RagVectorStoreProperties properties) {
        this.jdbcTemplate = jdbcTemplate;
        this.properties = properties;
    }

    public int deleteByDocumentId(Long documentId) {
        if (documentId == null || documentId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "documentId가 필요합니다.");
        }

        String table = properties.getSchemaName() + "." + properties.getTableName();
        String sql = "DELETE FROM " + table + " WHERE metadata->>'document_id' = ?";
        return jdbcTemplate.update(sql, documentId.toString());
    }
}
