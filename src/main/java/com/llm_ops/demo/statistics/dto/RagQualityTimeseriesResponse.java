package com.llm_ops.demo.statistics.dto;

import com.llm_ops.demo.gateway.log.dto.projection.RagQualityTimeseriesProjection;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/**
 * RAG 품질 시계열 응답
 */
public record RagQualityTimeseriesResponse(
        List<RagQualityDataPoint> data) {

    public record RagQualityDataPoint(
            LocalDate date,
            long ragTotalCount,
            long ragHitCount,
            BigDecimal hitRate,
            BigDecimal avgSimilarityThreshold,
            BigDecimal avgRetrievedScore,
            long truncatedCount,
            BigDecimal truncationRate,
            long totalChunks,
            BigDecimal avgRagLatencyMs) {
    }

    public static RagQualityTimeseriesResponse from(List<RagQualityTimeseriesProjection> projections) {
        List<RagQualityDataPoint> points = projections.stream()
                .map(p -> {
                    long total = p.getRagTotalCount() != null ? p.getRagTotalCount() : 0;
                    long hit = p.getRagHitCount() != null ? p.getRagHitCount() : 0;
                    long truncated = p.getTruncatedCount() != null ? p.getTruncatedCount() : 0;
                    long chunks = p.getTotalChunks() != null ? p.getTotalChunks() : 0;

                    BigDecimal hitRate = total > 0
                            ? BigDecimal.valueOf(hit).divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;

                    BigDecimal truncationRate = total > 0
                            ? BigDecimal.valueOf(truncated).divide(BigDecimal.valueOf(total), 4, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;

                    return new RagQualityDataPoint(
                            p.getDate(),
                            total,
                            hit,
                            hitRate,
                            p.getAvgSimilarityThreshold() != null
                                    ? p.getAvgSimilarityThreshold().setScale(4, RoundingMode.HALF_UP)
                                    : BigDecimal.ZERO,
                            p.getAvgRetrievedScore() != null
                                    ? p.getAvgRetrievedScore().setScale(4, RoundingMode.HALF_UP)
                                    : BigDecimal.ZERO,
                            truncated,
                            truncationRate,
                            chunks,
                            p.getAvgRagLatencyMs() != null
                                    ? p.getAvgRagLatencyMs().setScale(1, RoundingMode.HALF_UP)
                                    : BigDecimal.ZERO);
                })
                .toList();

        return new RagQualityTimeseriesResponse(points);
    }
}
