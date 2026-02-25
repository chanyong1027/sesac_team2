package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalRun;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EvalRunRepository extends JpaRepository<EvalRun, Long> {

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    List<EvalRun> findByPromptIdOrderByCreatedAtDesc(Long promptId);

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    Optional<EvalRun> findByIdAndPromptId(Long id, Long promptId);

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    List<EvalRun> findTop10ByStatusOrderByCreatedAtAsc(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT r
            FROM EvalRun r
            WHERE r.status = :status
            ORDER BY r.createdAt ASC
            """)
    List<EvalRun> findQueuedRunsForUpdate(
            @Param("status") String status,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    Optional<EvalRun> findById(Long id);

    long countByStatus(String status);


    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT r
            FROM EvalRun r
            WHERE r.status = :status
              AND r.startedAt < :cutoffTime
            ORDER BY r.createdAt ASC
            """)
    List<EvalRun> findStuckRunsForUpdate(
            @Param("status") String status,
            @Param("cutoffTime") LocalDateTime cutoffTime,
            Pageable pageable
    );

}