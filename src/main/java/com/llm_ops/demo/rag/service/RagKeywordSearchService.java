package com.llm_ops.demo.rag.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.rag.config.RagHybridSearchProperties;
import com.llm_ops.demo.rag.config.RagVectorStoreProperties;
import com.llm_ops.demo.rag.metadata.RagMetadataKeys;
import org.springframework.ai.document.Document;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@ConditionalOnBean(JdbcTemplate.class)
public class RagKeywordSearchService {

    private final JdbcTemplate jdbcTemplate;
    private final RagVectorStoreProperties vectorStoreProperties;
    private final RagHybridSearchProperties hybridProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RagKeywordSearchService(
        JdbcTemplate jdbcTemplate,
        RagVectorStoreProperties vectorStoreProperties,
        RagHybridSearchProperties hybridProperties
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.vectorStoreProperties = vectorStoreProperties;
        this.hybridProperties = hybridProperties;
    }

    public List<Document> search(Long workspaceId, String query, int limit) {
        if (workspaceId == null || workspaceId <= 0 || query == null || query.isBlank()) {
            return List.of();
        }
        if (limit <= 0) {
            return List.of();
        }

        List<Document> ftsResults = List.of();
        if (query.length() >= hybridProperties.getMinKeywordQueryLength()) {
            ftsResults = searchFts(workspaceId, query, limit);
        }

        if (!ftsResults.isEmpty()) {
            return ftsResults;
        }

        return searchTrigram(workspaceId, query, limit);
    }

    private List<Document> searchFts(Long workspaceId, String query, int limit) {
        String table = qualifiedTable();
        String sql = """
            SELECT id::text AS id, content, metadata::text AS metadata,
                   ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', ?)) AS score
            FROM %s
            WHERE metadata->>'%s' = ?
              AND to_tsvector('simple', content) @@ plainto_tsquery('simple', ?)
            ORDER BY score DESC
            LIMIT ?
            """.formatted(table, RagMetadataKeys.WORKSPACE_ID);

        try {
            return jdbcTemplate.query(sql, ps -> {
                ps.setString(1, query);
                ps.setString(2, workspaceId.toString());
                ps.setString(3, query);
                ps.setInt(4, limit);
            }, (rs, rowNum) -> mapRow(rs.getString("id"), rs.getString("content"), rs.getString("metadata"), rs.getDouble("score")));
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<Document> searchTrigram(Long workspaceId, String query, int limit) {
        String table = qualifiedTable();
        String sql = """
            SELECT id::text AS id, content, metadata::text AS metadata,
                   similarity(content, ?) AS score
            FROM %s
            WHERE metadata->>'%s' = ?
              AND content %% ?
            ORDER BY score DESC
            LIMIT ?
            """.formatted(table, RagMetadataKeys.WORKSPACE_ID);

        try {
            return jdbcTemplate.query(sql, ps -> {
                ps.setString(1, query);
                ps.setString(2, workspaceId.toString());
                ps.setString(3, query);
                ps.setInt(4, limit);
            }, (rs, rowNum) -> mapRow(rs.getString("id"), rs.getString("content"), rs.getString("metadata"), rs.getDouble("score")));
        } catch (Exception ex) {
            return List.of();
        }
    }

    private Document mapRow(String id, String content, String metadataJson, double score) {
        Map<String, Object> metadata = parseMetadata(metadataJson);
        return Document.builder()
            .id(id)
            .text(content)
            .metadata(metadata)
            .score(score)
            .build();
    }

    private Map<String, Object> parseMetadata(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(metadataJson, Map.class);
        } catch (JsonProcessingException ex) {
            return Map.of();
        }
    }

    private String qualifiedTable() {
        return vectorStoreProperties.getSchemaName() + "." + vectorStoreProperties.getTableName();
    }
}
