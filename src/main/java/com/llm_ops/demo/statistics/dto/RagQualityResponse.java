package com.llm_ops.demo.statistics.dto;

import com.llm_ops.demo.gateway.log.dto.projection.RagQualityProjection;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * RAG 품질 통계 응답
 */
public record RagQualityResponse(
        long ragTotalCount,
        long ragHitCount,
        BigDecimal hitRate,
        BigDecimal avgSimilarityThreshold,
        BigDecimal avgRetrievedScore,
        long truncatedCount,
        BigDecimal truncationRate,
        long totalChunks,
        BigDecimal avgRagLatencyMs) {

    public static RagQualityResponse from(RagQualityProjection projection) {
        long total = projection.getRagTotalCount() != null ? projection.getRagTotalCount() : 0;
        long hit = projection.getRagHitCount() != null ? projection.getRagHitCount() : 0;
        long truncated = projection.getTruncatedCount() != null ? projection.getTruncatedCount() : 0;
        long chunks = projection.getTotalChunks() != null ? projection.getTotalChunks() : 0;

        BigDecimal hitRate = total > 0
                ? BigDecimal.valueOf(hit).divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal truncationRate = total > 0
                ? BigDecimal.valueOf(truncated).divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return new RagQualityResponse(
                total,
                hit,
                hitRate,
                projection.getAvgSimilarityThreshold() != null
                        ? projection.getAvgSimilarityThreshold().setScale(4, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO,
                projection.getAvgRetrievedScore() != null
                        ? projection.getAvgRetrievedScore().setScale(4, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO,
                truncated,
                truncationRate,
                chunks,
                projection.getAvgRagLatencyMs() != null
                        ? projection.getAvgRagLatencyMs().setScale(1, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO);
    }
}
