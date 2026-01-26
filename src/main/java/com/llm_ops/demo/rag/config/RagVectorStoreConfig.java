package com.llm_ops.demo.rag.config;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * PgVectorStore 빈을 구성합니다.
 */
/**
 * RAG(Retrieval-Augmented Generation) 파이프라인에서 사용할 {@link PgVectorStore} 빈을 구성하는 설정 클래스입니다.
 * PostgreSQL의 pgvector 확장을 활용하여 벡터 임베딩을 저장하고 검색합니다.
 */
@Configuration
public class RagVectorStoreConfig {

    /**
     * RAG를 위한 {@link PgVectorStore} 빈을 생성합니다.
     * 이 빈은 {@link EmbeddingModel}이 존재하고, 'rag.vectorstore.pgvector.enabled' 속성이 'true'일 때만 활성화됩니다.
     *
     * @param jdbcTemplate 데이터베이스 작업을 위한 JdbcTemplate
     * @param embeddingModel 문서 임베딩 생성에 사용될 EmbeddingModel
     * @param properties PgVectorStore 설정을 위한 {@link RagVectorStoreProperties}
     * @return 구성된 PgVectorStore 인스턴스
     */
    @Bean
    @ConditionalOnBean(EmbeddingModel.class) // EmbeddingModel 빈이 있을 때만 활성화
    @ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true") // 특정 프로퍼티 설정 시 활성화
    public PgVectorStore ragPgVectorStore(
            JdbcTemplate jdbcTemplate,
            EmbeddingModel embeddingModel,
            RagVectorStoreProperties properties
    ) {
        // RagVectorStoreProperties를 기반으로 PgVectorStore 빌더를 구성
        PgVectorStore.PgVectorStoreBuilder builder = PgVectorStore.builder(jdbcTemplate, embeddingModel)
                .schemaName(properties.getSchemaName())
                .vectorTableName(properties.getTableName())
                .distanceType(properties.getDistanceType())
                .indexType(properties.getIndexType())
                .initializeSchema(properties.isInitializeSchema())
                .maxDocumentBatchSize(properties.getMaxDocumentBatchSize());

        // 임베딩 차원이 설정되어 있으면 적용
        Integer dimensions = properties.getDimensions();
        if (dimensions != null && dimensions > 0) {
            builder.dimensions(dimensions);
        }

        return builder.build();
    }
}
