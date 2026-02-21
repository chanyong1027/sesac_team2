package com.llm_ops.demo.statistics.dto;

import com.llm_ops.demo.gateway.log.dto.projection.ErrorDistributionProjection;
import java.util.List;

/**
 * 에러 분포 통계 응답
 */
public record ErrorDistributionResponse(
        List<ErrorItem> items,
        long totalErrors) {

    public record ErrorItem(
            String status,
            String errorCode,
            String failReason,
            long count) {

        public static ErrorItem from(ErrorDistributionProjection projection) {
            return new ErrorItem(
                    projection.getStatus(),
                    projection.getErrorCode(),
                    projection.getFailReason(),
                    projection.getCount() != null ? projection.getCount() : 0);
        }
    }

    public static ErrorDistributionResponse from(List<ErrorDistributionProjection> projections) {
        List<ErrorItem> items = projections.stream()
                .map(ErrorItem::from)
                .toList();
        long totalErrors = items.stream().mapToLong(ErrorItem::count).sum();
        return new ErrorDistributionResponse(items, totalErrors);
    }
}
