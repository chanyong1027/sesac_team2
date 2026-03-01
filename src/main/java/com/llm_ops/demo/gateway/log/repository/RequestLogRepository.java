package com.llm_ops.demo.gateway.log.repository;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.dto.projection.ErrorDistributionProjection;
import com.llm_ops.demo.gateway.log.dto.projection.ModelUsageProjection;
import com.llm_ops.demo.gateway.log.dto.projection.OverviewStatsProjection;
import com.llm_ops.demo.gateway.log.dto.projection.PromptUsageProjection;
import com.llm_ops.demo.gateway.log.dto.projection.RagQualityProjection;
import com.llm_ops.demo.gateway.log.dto.projection.RagQualityTimeseriesProjection;
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
     * Overview 통계 집계 (PostgreSQL Native Query - PERCENTILE_CONT 사용)
     */
    @Query(value = """
            SELECT
                COUNT(*) as totalRequests,
                COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END), 0) as successCount,
                COALESCE(SUM(CASE WHEN status IN ('FAIL', 'BLOCKED') THEN 1 ELSE 0 END), 0) as errorCount,
                COALESCE(SUM(total_tokens), 0) as totalTokens,
                CAST(COALESCE(AVG(latency_ms), 0) AS int) as avgLatencyMs,
                CAST(COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) AS int) as p95LatencyMs,
                CAST(COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 0) AS int) as p99LatencyMs,
                COALESCE(SUM(estimated_cost), 0) as totalCost
            FROM request_logs
            WHERE organization_id = :organizationId
              AND (:workspaceId IS NULL OR workspace_id = :workspaceId)
              AND created_at BETWEEN :from AND :to
            """, nativeQuery = true)
    OverviewStatsProjection getOverviewStats(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /**
     * 시계열 데이터 집계 - 일별 (Daily)
     */
    @Query(value = """
            SELECT
                CAST(created_at AS date) as date,
                COUNT(*) as requests,
                SUM(CASE WHEN status IN ('FAIL', 'BLOCKED') THEN 1 ELSE 0 END) as errorCount,
                COALESCE(SUM(total_tokens), 0) as tokens,
                COALESCE(SUM(estimated_cost), 0) as cost
            FROM request_logs
            WHERE organization_id = :organizationId
              AND (:workspaceId IS NULL OR workspace_id = :workspaceId)
              AND created_at BETWEEN :from AND :to
            GROUP BY CAST(created_at AS date)
            ORDER BY date
            """, nativeQuery = true)
    List<TimeseriesDataProjection> getTimeseriesDataDaily(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /**
     * 시계열 데이터 집계 - 주별 (Weekly)
     */
    @Query(value = """
            SELECT
                DATE_TRUNC('week', created_at)::date as date,
                COUNT(*) as requests,
                SUM(CASE WHEN status IN ('FAIL', 'BLOCKED') THEN 1 ELSE 0 END) as errorCount,
                COALESCE(SUM(total_tokens), 0) as tokens,
                COALESCE(SUM(estimated_cost), 0) as cost
            FROM request_logs
            WHERE organization_id = :organizationId
              AND (:workspaceId IS NULL OR workspace_id = :workspaceId)
              AND created_at BETWEEN :from AND :to
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY date
            """, nativeQuery = true)
    List<TimeseriesDataProjection> getTimeseriesDataWeekly(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /**
     * 시계열 데이터 집계 - 월별 (Monthly)
     */
    @Query(value = """
            SELECT
                DATE_TRUNC('month', created_at)::date as date,
                COUNT(*) as requests,
                SUM(CASE WHEN status IN ('FAIL', 'BLOCKED') THEN 1 ELSE 0 END) as errorCount,
                COALESCE(SUM(total_tokens), 0) as tokens,
                COALESCE(SUM(estimated_cost), 0) as cost
            FROM request_logs
            WHERE organization_id = :organizationId
              AND (:workspaceId IS NULL OR workspace_id = :workspaceId)
              AND created_at BETWEEN :from AND :to
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY date
            """, nativeQuery = true)
    List<TimeseriesDataProjection> getTimeseriesDataMonthly(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /**
     * 모델별 사용량 집계
     */
    @Query("""
            SELECT
                r.provider as provider,
                r.usedModel as modelName,
                COUNT(*) as requests,
                COALESCE(SUM(r.totalTokens), 0) as tokens,
                COALESCE(SUM(r.estimatedCost), 0) as cost,
                CAST(AVG(r.latencyMs) AS int) as avgLatencyMs
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
            @Param("to") LocalDateTime to);

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
            @Param("to") LocalDateTime to);

    /**
     * 에러 분포 집계 (status + error_code + fail_reason 3축)
     */
    @Query(value = """
            SELECT status, error_code AS errorCode, fail_reason AS failReason, COUNT(*) AS count
            FROM request_logs
            WHERE organization_id = :organizationId
              AND (:workspaceId IS NULL OR workspace_id = :workspaceId)
              AND created_at BETWEEN :from AND :to
              AND status IN ('FAIL', 'BLOCKED')
            GROUP BY status, error_code, fail_reason
            ORDER BY count DESC
            """, nativeQuery = true)
    List<ErrorDistributionProjection> getErrorDistribution(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /**
     * RAG 품질 집계
     */
    @Query(value = """
            WITH base AS (
                SELECT
                    COUNT(CASE WHEN rl.rag_chunks_count > 0 THEN 1 END) AS ragHitCount,
                    COUNT(*) AS ragTotalCount,
                    AVG(rl.rag_similarity_threshold) AS avgSimilarityThreshold,
                    SUM(CASE WHEN rl.rag_context_truncated THEN 1 ELSE 0 END) AS truncatedCount,
                    COALESCE(SUM(rl.rag_chunks_count), 0) AS totalChunks,
                    AVG(rl.rag_latency_ms) AS avgRagLatencyMs
                FROM request_logs rl
                WHERE rl.organization_id = :organizationId
                  AND (:workspaceId IS NULL OR rl.workspace_id = :workspaceId)
                  AND rl.rag_enabled = true
                  AND rl.created_at BETWEEN :from AND :to
            ),
            score AS (
                SELECT AVG(rd.score) AS avgRetrievedScore
                FROM retrieved_documents rd
                JOIN request_logs rl ON rl.request_id = rd.request_id
                WHERE rl.organization_id = :organizationId
                  AND (:workspaceId IS NULL OR rl.workspace_id = :workspaceId)
                  AND rl.rag_enabled = true
                  AND rl.created_at BETWEEN :from AND :to
            )
            SELECT
                base.ragHitCount,
                base.ragTotalCount,
                base.avgSimilarityThreshold,
                base.truncatedCount,
                base.totalChunks,
                base.avgRagLatencyMs,
                score.avgRetrievedScore
            FROM base
            CROSS JOIN score
            """, nativeQuery = true)
    RagQualityProjection getRagQuality(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /**
     * RAG 품질 시계열 집계 (일별)
     */
    @Query(value = """
            WITH base AS (
                SELECT
                    CAST(rl.created_at AS date) AS date,
                    COUNT(*) AS ragTotalCount,
                    COUNT(CASE WHEN rl.rag_chunks_count > 0 THEN 1 END) AS ragHitCount,
                    AVG(rl.rag_similarity_threshold) AS avgSimilarityThreshold,
                    SUM(CASE WHEN rl.rag_context_truncated THEN 1 ELSE 0 END) AS truncatedCount,
                    COALESCE(SUM(rl.rag_chunks_count), 0) AS totalChunks,
                    AVG(rl.rag_latency_ms) AS avgRagLatencyMs
                FROM request_logs rl
                WHERE rl.organization_id = :organizationId
                  AND (:workspaceId IS NULL OR rl.workspace_id = :workspaceId)
                  AND rl.rag_enabled = true
                  AND rl.created_at BETWEEN :from AND :to
                GROUP BY CAST(rl.created_at AS date)
            ),
            score AS (
                SELECT
                    CAST(rl.created_at AS date) AS date,
                    AVG(rd.score) AS avgRetrievedScore
                FROM request_logs rl
                JOIN retrieved_documents rd ON rl.request_id = rd.request_id
                WHERE rl.organization_id = :organizationId
                  AND (:workspaceId IS NULL OR rl.workspace_id = :workspaceId)
                  AND rl.rag_enabled = true
                  AND rl.created_at BETWEEN :from AND :to
                GROUP BY CAST(rl.created_at AS date)
            )
            SELECT
                base.date AS date,
                base.ragTotalCount AS ragTotalCount,
                base.ragHitCount AS ragHitCount,
                base.avgSimilarityThreshold AS avgSimilarityThreshold,
                base.truncatedCount AS truncatedCount,
                base.totalChunks AS totalChunks,
                base.avgRagLatencyMs AS avgRagLatencyMs,
                score.avgRetrievedScore AS avgRetrievedScore
            FROM base
            LEFT JOIN score ON score.date = base.date
            ORDER BY base.date
            """, nativeQuery = true)
    List<RagQualityTimeseriesProjection> getRagQualityTimeseries(
            @Param("organizationId") Long organizationId,
            @Param("workspaceId") Long workspaceId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);
}
