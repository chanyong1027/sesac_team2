package com.llm_ops.demo.gateway.log.dto.projection;

import java.math.BigDecimal;

/**
 * RAG 품질 집계 결과
 */
public interface RagQualityProjection {
    Long getRagHitCount();

    Long getRagTotalCount();

    BigDecimal getAvgSimilarityThreshold();

    Long getTruncatedCount();

    Long getTotalChunks();

    BigDecimal getAvgRagLatencyMs();
}
