package com.llm_ops.demo.statistics.service;

import com.llm_ops.demo.gateway.log.dto.projection.ErrorDistributionProjection;
import com.llm_ops.demo.gateway.log.dto.projection.ModelUsageProjection;
import com.llm_ops.demo.gateway.log.dto.projection.OverviewStatsProjection;
import com.llm_ops.demo.gateway.log.dto.projection.PromptUsageProjection;
import com.llm_ops.demo.gateway.log.dto.projection.RagQualityProjection;
import com.llm_ops.demo.gateway.log.dto.projection.TimeseriesDataProjection;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import com.llm_ops.demo.statistics.dto.ErrorDistributionResponse;
import com.llm_ops.demo.statistics.dto.ModelUsageResponse;
import com.llm_ops.demo.statistics.dto.ModelUsageResponse.ModelUsageItem;
import com.llm_ops.demo.statistics.dto.OverviewResponse;
import com.llm_ops.demo.statistics.dto.PromptUsageResponse;
import com.llm_ops.demo.statistics.dto.PromptUsageResponse.PromptUsageItem;
import com.llm_ops.demo.statistics.dto.RagQualityResponse;
import com.llm_ops.demo.statistics.dto.TimeseriesResponse;
import com.llm_ops.demo.statistics.dto.TimeseriesResponse.TimeseriesDataPoint;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StatisticsService {

        private final RequestLogRepository requestLogRepository;

        /**
         * 개요 통계 조회 (요청수, 성공률, 토큰, latency, 비용 등)
         */
        @Transactional(readOnly = true)
        public OverviewResponse getOverview(
                        Long organizationId,
                        Long workspaceId,
                        String period,
                        LocalDateTime from,
                        LocalDateTime to) {

                // 기본값 설정 (from: 30일 전, to: 오늘)
                LocalDateTime currentFrom = from != null ? from : LocalDateTime.now().minusDays(30).with(LocalTime.MIN);
                LocalDateTime currentTo = to != null ? to : LocalDateTime.now().with(LocalTime.MAX);

                // 현재 기간 통계
                OverviewStatsProjection current = requestLogRepository.getOverviewStats(
                                organizationId, workspaceId, currentFrom, currentTo);

                // 이전 기간 계산 및 통계
                PeriodRange previousPeriod = calculatePreviousPeriod(period, currentFrom, currentTo);
                OverviewStatsProjection previous = requestLogRepository.getOverviewStats(
                                organizationId, workspaceId, previousPeriod.from(), previousPeriod.to());

                // 성공률 계산
                double successRate = current.getTotalRequests() > 0
                                ? (current.getSuccessCount() * 100.0 / current.getTotalRequests())
                                : 0.0;

                // 변화율 계산
                Double requestsChange = calculateChangeRate(
                                current.getTotalRequests(),
                                previous.getTotalRequests());

                Double tokensChange = calculateChangeRate(
                                current.getTotalTokens(),
                                previous.getTotalTokens());

                Double latencyChange = calculateChangeRate(
                                current.getAvgLatencyMs(),
                                previous.getAvgLatencyMs());

                Double costChange = calculateChangeRate(
                                current.getTotalCost(),
                                previous.getTotalCost());

                return new OverviewResponse(
                                current.getTotalRequests(),
                                requestsChange,
                                successRate,
                                current.getErrorCount(),
                                current.getTotalTokens(),
                                tokensChange,
                                current.getAvgLatencyMs(),
                                current.getP95LatencyMs(),
                                current.getP99LatencyMs(),
                                latencyChange,
                                current.getTotalCost(),
                                costChange);
        }

        /**
         * 시계열 데이터 조회 (날짜별 요청, 토큰, 비용)
         */
        @Transactional(readOnly = true)
        public TimeseriesResponse getTimeseries(
                        Long organizationId,
                        Long workspaceId,
                        String period,
                        LocalDateTime from,
                        LocalDateTime to) {

                LocalDateTime currentFrom = from != null ? from : LocalDateTime.now().minusDays(30).with(LocalTime.MIN);
                LocalDateTime currentTo = to != null ? to : LocalDateTime.now().with(LocalTime.MAX);

                // period에 따라 다른 쿼리 호출
                String normalizedPeriod = (period != null) ? period.toLowerCase() : "daily";
                List<TimeseriesDataProjection> projections = switch (normalizedPeriod) {
                        case "weekly" -> requestLogRepository.getTimeseriesDataWeekly(
                                        organizationId, workspaceId, currentFrom, currentTo);
                        case "monthly" -> requestLogRepository.getTimeseriesDataMonthly(
                                        organizationId, workspaceId, currentFrom, currentTo);
                        default -> requestLogRepository.getTimeseriesDataDaily(
                                        organizationId, workspaceId, currentFrom, currentTo);
                };

                List<TimeseriesDataPoint> dataPoints = projections.stream()
                                .map(p -> new TimeseriesDataPoint(
                                                p.getDate(),
                                                p.getRequests(),
                                                p.getTokens(),
                                                p.getCost()))
                                .toList();

                return new TimeseriesResponse(dataPoints);
        }

        /**
         * 모델별 사용량 조회
         */
        @Transactional(readOnly = true)
        public ModelUsageResponse getByModel(
                        Long organizationId,
                        Long workspaceId,
                        LocalDateTime from,
                        LocalDateTime to) {

                LocalDateTime currentFrom = from != null ? from : LocalDateTime.now().minusDays(30).with(LocalTime.MIN);
                LocalDateTime currentTo = to != null ? to : LocalDateTime.now().with(LocalTime.MAX);

                List<ModelUsageProjection> projections = requestLogRepository.getModelUsage(
                                organizationId, workspaceId, currentFrom, currentTo);

                // 전체 요청 수 (비율 계산용)
                long totalRequests = projections.stream()
                                .mapToLong(ModelUsageProjection::getRequests)
                                .sum();

                List<ModelUsageItem> items = projections.stream()
                                .map(p -> {
                                        double percentage = totalRequests > 0
                                                        ? (p.getRequests() * 100.0 / totalRequests)
                                                        : 0.0;
                                        return new ModelUsageItem(
                                                        p.getProvider(),
                                                        p.getModelName(),
                                                        p.getRequests(),
                                                        p.getTokens(),
                                                        p.getCost(),
                                                        percentage);
                                })
                                .toList();

                return new ModelUsageResponse(items);
        }

        /**
         * 프롬프트별 사용량 조회
         */
        @Transactional(readOnly = true)
        public PromptUsageResponse getByPrompt(
                        Long organizationId,
                        Long workspaceId,
                        LocalDateTime from,
                        LocalDateTime to) {

                LocalDateTime currentFrom = from != null ? from : LocalDateTime.now().minusDays(30).with(LocalTime.MIN);
                LocalDateTime currentTo = to != null ? to : LocalDateTime.now().with(LocalTime.MAX);

                List<PromptUsageProjection> projections = requestLogRepository.getPromptUsage(
                                organizationId, workspaceId, currentFrom, currentTo);

                List<PromptUsageItem> items = projections.stream()
                                .map(p -> new PromptUsageItem(
                                                p.getPromptId(),
                                                null, // name은 Prompt 테이블에서 조인 필요 (추후 개선)
                                                p.getPromptKey(),
                                                p.getRequests(),
                                                p.getTokens(),
                                                p.getCost()))
                                .toList();

                return new PromptUsageResponse(items);
        }

        /**
         * 에러 분포 통계 조회 (status + errorCode + failReason 3축)
         */
        @Transactional(readOnly = true)
        public ErrorDistributionResponse getErrorDistribution(
                        Long organizationId,
                        Long workspaceId,
                        LocalDateTime from,
                        LocalDateTime to) {

                LocalDateTime currentFrom = from != null ? from : LocalDateTime.now().minusDays(30).with(LocalTime.MIN);
                LocalDateTime currentTo = to != null ? to : LocalDateTime.now().with(LocalTime.MAX);

                List<ErrorDistributionProjection> projections = requestLogRepository.getErrorDistribution(
                                organizationId, workspaceId, currentFrom, currentTo);

                return ErrorDistributionResponse.from(projections);
        }

        /**
         * RAG 품질 통계 조회 (hitRate, avgSimilarity, truncation 등)
         */
        @Transactional(readOnly = true)
        public RagQualityResponse getRagQuality(
                        Long organizationId,
                        Long workspaceId,
                        LocalDateTime from,
                        LocalDateTime to) {

                LocalDateTime currentFrom = from != null ? from : LocalDateTime.now().minusDays(30).with(LocalTime.MIN);
                LocalDateTime currentTo = to != null ? to : LocalDateTime.now().with(LocalTime.MAX);

                RagQualityProjection projection = requestLogRepository.getRagQuality(
                                organizationId, workspaceId, currentFrom, currentTo);

                return RagQualityResponse.from(projection);
        }

        /**
         * 이전 기간 계산 - 현재 기간과 동일한 길이의 이전 기간 반환
         * prevTo = currentFrom, prevFrom = currentFrom - duration
         */
        private PeriodRange calculatePreviousPeriod(String period, LocalDateTime currentFrom, LocalDateTime currentTo) {
                // 현재 기간의 길이 계산
                java.time.Duration duration = java.time.Duration.between(currentFrom, currentTo);

                // 이전 기간: 현재 시작점 직전까지, 동일한 길이
                LocalDateTime prevTo = currentFrom;
                LocalDateTime prevFrom = currentFrom.minus(duration);

                return new PeriodRange(prevFrom, prevTo);
        }

        /**
         * 변화율 계산
         */
        private Double calculateChangeRate(Number current, Number previous) {
                if (current == null || previous == null) {
                        return 0.0;
                }

                double currentValue = current.doubleValue();
                double previousValue = previous.doubleValue();

                if (previousValue == 0) {
                        return currentValue > 0 ? 100.0 : 0.0;
                }

                return ((currentValue - previousValue) / previousValue) * 100;
        }

        /**
         * 변화율 계산 (BigDecimal)
         */
        private Double calculateChangeRate(BigDecimal current, BigDecimal previous) {
                if (current == null || previous == null) {
                        return 0.0;
                }

                if (previous.compareTo(BigDecimal.ZERO) == 0) {
                        return current.compareTo(BigDecimal.ZERO) > 0 ? 100.0 : 0.0;
                }

                BigDecimal change = current.subtract(previous)
                                .divide(previous, 4, RoundingMode.HALF_UP)
                                .multiply(BigDecimal.valueOf(100));

                return change.doubleValue();
        }

        private record PeriodRange(LocalDateTime from, LocalDateTime to) {
        }
}
