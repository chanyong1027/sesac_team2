package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EvalCaseResultRepository extends JpaRepository<EvalCaseResult, Long> {

    interface PassProjection {
        Boolean getPass();
    }

    interface TableRowProjection {
        Long getId();

        Long getTestCaseId();

        String getStatus();

        Double getOverallScore();

        Boolean getPass();

        EvalHumanReviewVerdict getHumanReviewVerdict();

        Boolean getHumanOverridePass();

        Map<String, Object> getJudgeOutputJson();

        LocalDateTime getStartedAt();

        LocalDateTime getCompletedAt();
    }

    interface StatsRowProjection {
        String getStatus();

        Boolean getPass();

        EvalHumanReviewVerdict getHumanReviewVerdict();

        Boolean getHumanOverridePass();

        Map<String, Object> getJudgeOutputJson();
    }

    interface JudgeAccuracyRowProjection {
        Boolean getPass();

        EvalHumanReviewVerdict getHumanReviewVerdict();

        Boolean getHumanOverridePass();
    }

    @Query(
            """
                    select
                      r.pass as pass,
                      r.humanReviewVerdict as humanReviewVerdict,
                      r.humanOverridePass as humanOverridePass
                    from EvalCaseResult r
                    where r.evalRunId = :evalRunId
                    """
    )
    List<JudgeAccuracyRowProjection> findJudgeAccuracyRowsByRunId(@Param("evalRunId") Long evalRunId);

    @EntityGraph(attributePaths = {"evalRun", "evalRun.prompt", "evalRun.promptVersion", "testCase"})
    List<EvalCaseResult> findByEvalRunIdOrderByIdAsc(Long evalRunId);

    @EntityGraph(attributePaths = {"evalRun", "evalRun.prompt", "evalRun.promptVersion", "testCase"})
    Page<EvalCaseResult> findByEvalRunIdOrderByIdAsc(Long evalRunId, Pageable pageable);

    @EntityGraph(attributePaths = {"evalRun", "evalRun.prompt", "evalRun.promptVersion", "testCase"})
    Optional<EvalCaseResult> findByIdAndEvalRunId(Long id, Long evalRunId);

    Optional<PassProjection> findPassProjectionByIdAndEvalRunId(Long id, Long evalRunId);

    @EntityGraph(attributePaths = {"evalRun", "evalRun.prompt", "evalRun.promptVersion", "testCase"})
    List<EvalCaseResult> findByEvalRunIdAndStatusOrderByIdAsc(Long evalRunId, String status);

    @Query(
            value = """
                    select
                      r.id as id,
                      r.testCaseId as testCaseId,
                      r.status as status,
                      r.overallScore as overallScore,
                      r.pass as pass,
                      r.humanReviewVerdict as humanReviewVerdict,
                      r.humanOverridePass as humanOverridePass,
                      r.judgeOutputJson as judgeOutputJson,
                      r.startedAt as startedAt,
                      r.completedAt as completedAt
                    from EvalCaseResult r
                    where r.evalRunId = :evalRunId
                      and (:status is null or r.status = :status)
                      and (:pass is null or r.pass = :pass)
                      and (:reviewVerdict is null or r.humanReviewVerdict = :reviewVerdict)
                    order by r.id asc
                    """,
            countQuery = """
                    select count(r)
                    from EvalCaseResult r
                    where r.evalRunId = :evalRunId
                      and (:status is null or r.status = :status)
                      and (:pass is null or r.pass = :pass)
                      and (:reviewVerdict is null or r.humanReviewVerdict = :reviewVerdict)
                    """
    )
    Page<TableRowProjection> findCaseTableRows(
            @Param("evalRunId") Long evalRunId,
            @Param("status") String status,
            @Param("pass") Boolean pass,
            @Param("reviewVerdict") EvalHumanReviewVerdict reviewVerdict,
            Pageable pageable
    );

    @Query(
             """
                    select
                      r.status as status,
                      r.pass as pass,
                      r.humanReviewVerdict as humanReviewVerdict,
                      r.humanOverridePass as humanOverridePass,
                      r.judgeOutputJson as judgeOutputJson
                    from EvalCaseResult r
                    where r.evalRunId = :evalRunId
                    """
    )
    List<StatsRowProjection> findCaseStatsRows(@Param("evalRunId") Long evalRunId);

    @Query(
            """
                    select
                      r.pass as pass,
                      r.humanReviewVerdict as humanReviewVerdict,
                      r.humanOverridePass as humanOverridePass
                    from EvalCaseResult r
                      join r.evalRun run
                    where run.workspaceId = :workspaceId
                      and run.prompt.id = :promptId
                      and (:promptVersionId is null or run.promptVersion.id = :promptVersionId)
                      and (:from is null or run.createdAt >= :from)
                      and (:to is null or run.createdAt <= :to)
                    """
    )
    List<JudgeAccuracyRowProjection> findJudgeAccuracyRowsForPrompt(
            @Param("workspaceId") Long workspaceId,
            @Param("promptId") Long promptId,
            @Param("promptVersionId") Long promptVersionId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );
}
