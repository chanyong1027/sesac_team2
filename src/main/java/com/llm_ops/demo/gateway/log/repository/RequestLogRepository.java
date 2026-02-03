package com.llm_ops.demo.gateway.log.repository;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.dto.projection.ModelUsageProjection;
import com.llm_ops.demo.gateway.log.dto.projection.OverviewStatsProjection;
import com.llm_ops.demo.gateway.log.dto.projection.PromptUsageProjection;
import com.llm_ops.demo.gateway.log.dto.projection.TimeseriesDataProjection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RequestLogRepository extends JpaRepository<RequestLog, UUID>, JpaSpecificationExecutor<RequestLog> {
    Optional<RequestLog> findByTraceId(String traceId);

    Optional<RequestLog> findByWorkspaceIdAndTraceId(Long workspaceId, String traceId);

    /**
     * Overview 통계 집계
     */
    @Query("""
        SELECT
            COUNT(*) as totalRequests,
            SUM(CASE WHEN r.status = 'SUCCESS' THEN 1 ELSE 0 END) as successCount,
            SUM(CASE WHEN r.status = 'FAIL' THEN 1 ELSE 0 END) as errorCount,
            COALESCE(SUM(r.totalTokens), 0) as totalTokens,
            CAST(COALESCE(AVG(r.latencyMs), 0) AS int) as avgLatencyMs,
            CAST(COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY r.latencyMs), 0) AS int) as p95LatencyMs,
            CAST(COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY r.latencyMs), 0) AS int) as p99LatencyMs,
            COALESCE(SUM(r.estimatedCost), 0) as totalCost
        FROM RequestLog r
        WHERE r.organizationId = :organizationId
          AND (:workspaceId IS NULL OR r.workspaceId = :workspaceId)
          AND r.createdAt BETWEEN :from AND :to
        """)
    OverviewStatsProjection getOverviewStats(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    /**
     * 시계열 데이터 집계
     */
    @Query("""
        SELECT
            CAST(r.createdAt AS date) as date,
            COUNT(*) as requests,
            COALESCE(SUM(r.totalTokens), 0) as tokens,
            COALESCE(SUM(r.estimatedCost), 0) as cost
        FROM RequestLog r
        WHERE r.organizationId = :organizationId
          AND (:workspaceId IS NULL OR r.workspaceId = :workspaceId)
          AND r.createdAt BETWEEN :from AND :to
        GROUP BY CAST(r.createdAt AS date)
        ORDER BY date
        """)
    List<TimeseriesDataProjection> getTimeseriesData(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    /**
     * 모델별 사용량 집계
     */
    @Query("""
        SELECT
            r.provider as provider,
            r.usedModel as modelName,
            COUNT(*) as requests,
            COALESCE(SUM(r.totalTokens), 0) as tokens,
            COALESCE(SUM(r.estimatedCost), 0) as cost
        FROM RequestLog r
        WHERE r.organizationId = :organizationId
          AND (:workspaceId IS NULL OR r.workspaceId = :workspaceId)
          AND r.createdAt BETWEEN :from AND :to
        GROUP BY r.provider, r.usedModel
        ORDER BY requests DESC
        """)
    List<ModelUsageProjection> getModelUsage(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    /**
     * 프롬프트별 사용량 집계
     */
    @Query("""
        SELECT
            r.promptId as promptId,
            r.promptKey as promptKey,
            COUNT(*) as requests,
            COALESCE(SUM(r.totalTokens), 0) as tokens,
            COALESCE(SUM(r.estimatedCost), 0) as cost
        FROM RequestLog r
        WHERE r.organizationId = :organizationId
          AND (:workspaceId IS NULL OR r.workspaceId = :workspaceId)
          AND r.createdAt BETWEEN :from AND :to
        GROUP BY r.promptId, r.promptKey
        ORDER BY requests DESC
        """)
    List<PromptUsageProjection> getPromptUsage(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );
}
