package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalRun;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EvalRunRepository extends JpaRepository<EvalRun, Long> {

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    List<EvalRun> findByPromptIdOrderByCreatedAtDesc(Long promptId);

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    Optional<EvalRun> findByIdAndPromptId(Long id, Long promptId);

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    List<EvalRun> findTop10ByStatusOrderByCreatedAtAsc(String status);

    @Query(
            value = """
                    SELECT id
                    FROM eval_runs
                    WHERE status = :status
                    ORDER BY created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT :limit
                    """,
            nativeQuery = true
    )
    List<Long> findQueuedRunIdsForClaim(
            @Param("status") String status,
            @Param("limit") int limit
    );

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    Optional<EvalRun> findById(Long id);

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    List<EvalRun> findByIdInOrderByCreatedAtAsc(Collection<Long> ids);

    long countByStatus(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT r
            FROM EvalRun r
            WHERE r.status IN :statuses
              AND (
                    (r.status = 'CLAIMED' AND r.leaseExpiresAt < :cutoffTime)
                 OR (r.status IN ('RUNNING', 'CANCEL_REQUESTED') AND r.startedAt < :runTimeoutCutoff)
              )
            ORDER BY r.createdAt ASC
            """)
    List<EvalRun> findRecoverableRunsForUpdate(
            @Param("statuses") List<String> statuses,
            @Param("cutoffTime") LocalDateTime cutoffTime,
            @Param("runTimeoutCutoff") LocalDateTime runTimeoutCutoff,
            Pageable pageable
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE EvalRun r
            SET r.processedCases = r.processedCases + 1,
                r.passedCases = r.passedCases + :passedIncrement,
                r.failedCases = r.failedCases + :failedIncrement,
                r.errorCases = r.errorCases + :errorIncrement,
                r.lastHeartbeatAt = :heartbeatAt,
                r.leaseExpiresAt = :leaseExpiresAt
            WHERE r.id = :runId
              AND r.status IN :statuses
            """)
    int incrementProgress(
            @Param("runId") Long runId,
            @Param("passedIncrement") int passedIncrement,
            @Param("failedIncrement") int failedIncrement,
            @Param("errorIncrement") int errorIncrement,
            @Param("heartbeatAt") LocalDateTime heartbeatAt,
            @Param("leaseExpiresAt") LocalDateTime leaseExpiresAt,
            @Param("statuses") List<String> statuses
    );

}
