package com.llm_ops.demo.gateway.log.dto.projection;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * RAG 품질 시계열 데이터 집계 결과
 */
public interface RagQualityTimeseriesProjection {
    LocalDate getDate();

    Long getRagTotalCount();

    Long getRagHitCount();

    BigDecimal getAvgSimilarityThreshold();

    Long getTruncatedCount();

    Long getTotalChunks();

    BigDecimal getAvgRagLatencyMs();
}
