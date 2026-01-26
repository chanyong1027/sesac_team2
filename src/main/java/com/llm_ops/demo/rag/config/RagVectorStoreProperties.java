package com.llm_ops.demo.rag.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * RAG(Retrieval-Augmented Generation) 파이프라인에서 사용되는
 * {@link PgVectorStore}의 상세 설정을 외부 프로퍼티로부터 바인딩하는 클래스입니다.
 * 'rag.vectorstore.pgvector' 프리픽스로 시작하는 설정을 매핑합니다.
 */
@Component
@ConfigurationProperties(prefix = "rag.vectorstore.pgvector")
@Getter
@Setter
public class RagVectorStoreProperties {

    /**
     * 스키마 이름입니다.
     */
    private String schemaName = "public";

    /**
     * PgVectorStore 사용 여부입니다.
     */
    private boolean enabled = false;

    /**
     * 벡터 데이터를 저장할 테이블 이름입니다.
     */
    private String tableName = "doc_chunks";

    /**
     * 최초 구동 시 스키마/테이블을 자동 생성할지 여부입니다.
     */
    private boolean initializeSchema = false;

    /**
     * 임베딩 차원 수입니다. 지정하지 않으면 모델 기본값을 사용합니다.
     */
    private Integer dimensions;

    /**
     * 유사도 계산 방식입니다.
     */
    private PgVectorStore.PgDistanceType distanceType = PgVectorStore.PgDistanceType.COSINE_DISTANCE;

    /**
     * 인덱스 타입입니다.
     */
    private PgVectorStore.PgIndexType indexType = PgVectorStore.PgIndexType.HNSW;

    /**
     * 한 번에 저장할 문서의 최대 배치 크기입니다.
     */
    private int maxDocumentBatchSize = 10000;
}
