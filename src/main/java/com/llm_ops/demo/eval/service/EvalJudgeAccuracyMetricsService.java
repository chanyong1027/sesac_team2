package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import com.llm_ops.demo.eval.dto.EvalJudgeAccuracyMetricsResponse;
import com.llm_ops.demo.eval.dto.EvalJudgeAccuracyRollupResponse;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EvalJudgeAccuracyMetricsService {

    private static final String NOTE_REVIEWED_SUBSET = "metrics computed on reviewed subset";

    private final EvalAccessService evalAccessService;
    private final EvalCaseResultRepository evalCaseResultRepository;

    public EvalJudgeAccuracyMetricsService(
            EvalAccessService evalAccessService,
            EvalCaseResultRepository evalCaseResultRepository
    ) {
        this.evalAccessService = evalAccessService;
        this.evalCaseResultRepository = evalCaseResultRepository;
    }

    @Transactional(readOnly = true)
    public EvalJudgeAccuracyMetricsResponse getRunMetrics(
            Long workspaceId,
            Long promptId,
            Long runId,
            Long userId
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        var run = evalAccessService.requireRun(scope.prompt(), runId);

        List<EvalCaseResultRepository.JudgeAccuracyRowProjection> projections = evalCaseResultRepository
                .findJudgeAccuracyRowsByRunId(run.getId());
        List<Row> rows = projections.stream()
                .map(p -> new Row(p.getPass(), p.getHumanReviewVerdict(), p.getHumanOverridePass()))
                .toList();

        return compute(rows, run.getId());
    }

    @Transactional(readOnly = true)
    public EvalJudgeAccuracyRollupResponse getPromptRollup(
            Long workspaceId,
            Long promptId,
            Long userId,
            LocalDateTime from,
            LocalDateTime to,
            Long promptVersionId
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        if (promptVersionId != null) {
            evalAccessService.requirePromptVersion(scope.prompt(), promptVersionId);
        }

        List<EvalCaseResultRepository.JudgeAccuracyRowProjection> projections = evalCaseResultRepository
                .findJudgeAccuracyRowsForPrompt(workspaceId, promptId, promptVersionId, from, to);

        List<Row> rows = projections.stream()
                .map(p -> new Row(p.getPass(), p.getHumanReviewVerdict(), p.getHumanOverridePass()))
                .toList();

        EvalJudgeAccuracyMetricsResponse metrics = compute(rows, null);

        return new EvalJudgeAccuracyRollupResponse(
                promptId,
                promptVersionId,
                from,
                to,
                metrics.totalCases(),
                metrics.reviewedCount(),
                metrics.correctCount(),
                metrics.incorrectCount(),
                metrics.accuracy(),
                metrics.overrideRate(),
                metrics.tp(),
                metrics.tn(),
                metrics.fp(),
                metrics.fn(),
                metrics.precision(),
                metrics.recall(),
                metrics.f1(),
                metrics.specificity(),
                metrics.balancedAccuracy(),
                metrics.note()
        );
    }

    private EvalJudgeAccuracyMetricsResponse compute(List<Row> rows, Long runId) {
        long totalCases = rows.size();
        long reviewedCount = 0L;
        long correctCount = 0L;
        long incorrectCount = 0L;

        long tp = 0L;
        long tn = 0L;
        long fp = 0L;
        long fn = 0L;

        for (Row row : rows) {
            EvalHumanReviewVerdict verdict = row.verdict() != null ? row.verdict() : EvalHumanReviewVerdict.UNREVIEWED;
            if (verdict == EvalHumanReviewVerdict.UNREVIEWED) {
                continue;
            }

            reviewedCount++;
            if (verdict == EvalHumanReviewVerdict.CORRECT) {
                correctCount++;
            } else if (verdict == EvalHumanReviewVerdict.INCORRECT) {
                incorrectCount++;
            }

            Boolean predicted = row.pass();
            Boolean truth = resolveTruth(predicted, verdict, row.overridePass());
            if (predicted == null || truth == null) {
                continue;
            }

            if (Boolean.TRUE.equals(predicted) && Boolean.TRUE.equals(truth)) {
                tp++;
            } else if (Boolean.FALSE.equals(predicted) && Boolean.FALSE.equals(truth)) {
                tn++;
            } else if (Boolean.TRUE.equals(predicted) && Boolean.FALSE.equals(truth)) {
                fp++;
            } else if (Boolean.FALSE.equals(predicted) && Boolean.TRUE.equals(truth)) {
                fn++;
            }
        }

        Double accuracy = safeDivideOrNull(correctCount, reviewedCount);
        Double overrideRate = safeDivideOrNull(incorrectCount, reviewedCount);

        Double precision = safeDivideOrNull(tp, tp + fp);
        Double recall = safeDivideOrNull(tp, tp + fn);
        Double f1 = null;
        if (precision != null && recall != null) {
            double denominator = precision + recall;
            f1 = denominator == 0.0d ? 0.0d : (2.0d * precision * recall) / denominator;
        }
        Double specificity = safeDivideOrNull(tn, tn + fp);
        Double balancedAccuracy = (recall != null && specificity != null)
                ? (recall + specificity) / 2.0d
                : null;

        return new EvalJudgeAccuracyMetricsResponse(
                runId,
                totalCases,
                reviewedCount,
                correctCount,
                incorrectCount,
                accuracy,
                overrideRate,
                tp,
                tn,
                fp,
                fn,
                precision,
                recall,
                f1,
                specificity,
                balancedAccuracy,
                NOTE_REVIEWED_SUBSET
        );
    }

    private static Double safeDivideOrNull(long numerator, long denominator) {
        if (denominator <= 0L) {
            return null;
        }
        return (double) numerator / (double) denominator;
    }

    private static Boolean resolveTruth(Boolean pass, EvalHumanReviewVerdict verdict, Boolean overridePass) {
        if (verdict == EvalHumanReviewVerdict.INCORRECT) {
            return overridePass;
        }
        return pass;
    }

    private record Row(Boolean pass, EvalHumanReviewVerdict verdict, Boolean overridePass) {
    }
}
