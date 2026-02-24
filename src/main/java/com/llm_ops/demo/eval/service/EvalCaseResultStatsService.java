package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import com.llm_ops.demo.eval.dto.EvalCaseResultStatsResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultTableListResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultTableRowResponse;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EvalCaseResultStatsService {

    private final EvalAccessService evalAccessService;
    private final EvalCaseResultRepository evalCaseResultRepository;

    public EvalCaseResultStatsService(
            EvalAccessService evalAccessService,
            EvalCaseResultRepository evalCaseResultRepository
    ) {
        this.evalAccessService = evalAccessService;
        this.evalCaseResultRepository = evalCaseResultRepository;
    }

    @Transactional(readOnly = true)
    public EvalCaseResultTableListResponse getCaseTable(
            Long workspaceId,
            Long promptId,
            Long runId,
            Long userId,
            int page,
            int size,
            EvalCaseStatus status,
            Boolean pass,
            EvalHumanReviewVerdict reviewVerdict,
            Boolean overridden
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        var run = evalAccessService.requireRun(scope.prompt(), runId);

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize);

        EvalHumanReviewVerdict effectiveReviewVerdict = Boolean.TRUE.equals(overridden)
                ? EvalHumanReviewVerdict.INCORRECT
                : reviewVerdict;

        Page<EvalCaseResultTableRowResponse> dtoPage = evalCaseResultRepository
                .findCaseTableRows(
                        run.getId(),
                        status != null ? status.name() : null,
                        pass,
                        effectiveReviewVerdict,
                        pageRequest
                )
                .map(this::toTableRow);

        return EvalCaseResultTableListResponse.from(dtoPage);
    }

    @Transactional(readOnly = true)
    public EvalCaseResultStatsResponse getCaseStats(
            Long workspaceId,
            Long promptId,
            Long runId,
            Long userId
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        var run = evalAccessService.requireRun(scope.prompt(), runId);

        long queued = 0L;
        long running = 0L;
        long ok = 0L;
        long error = 0L;

        long passTrue = 0L;
        long passFalse = 0L;
        long effectivePassTrue = 0L;
        long effectivePassFalse = 0L;

        long unreviewed = 0L;
        long correct = 0L;
        long incorrect = 0L;

        Map<String, Long> labelCounts = new HashMap<>();

        for (EvalCaseResultRepository.StatsRowProjection row : evalCaseResultRepository.findCaseStatsRows(run.getId())) {
            EvalCaseStatus caseStatus = parseStatus(row.getStatus());
            if (caseStatus == EvalCaseStatus.QUEUED) {
                queued++;
            } else if (caseStatus == EvalCaseStatus.RUNNING) {
                running++;
            } else if (caseStatus == EvalCaseStatus.OK) {
                ok++;
            } else if (caseStatus == EvalCaseStatus.ERROR) {
                error++;
            }

            if (row.getPass() != null) {
                if (Boolean.TRUE.equals(row.getPass())) {
                    passTrue++;
                } else {
                    passFalse++;
                }
            }

            EvalHumanReviewVerdict verdict = row.getHumanReviewVerdict() != null
                    ? row.getHumanReviewVerdict()
                    : EvalHumanReviewVerdict.UNREVIEWED;
            if (verdict == EvalHumanReviewVerdict.CORRECT) {
                correct++;
            } else if (verdict == EvalHumanReviewVerdict.INCORRECT) {
                incorrect++;
            } else {
                unreviewed++;
            }

            Boolean effectivePass = computeEffectivePass(row.getPass(), verdict, row.getHumanOverridePass());
            if (effectivePass != null) {
                if (Boolean.TRUE.equals(effectivePass)) {
                    effectivePassTrue++;
                } else {
                    effectivePassFalse++;
                }
            }

            if (caseStatus == EvalCaseStatus.OK) {
                for (String label : extractLabels(row.getJudgeOutputJson())) {
                    if (label == null || label.isBlank()) {
                        continue;
                    }
                    labelCounts.merge(label, 1L, Long::sum);
                }
            }
        }

        Map<String, Long> topLabelCounts = labelCounts.entrySet()
                .stream()
                .sorted(
                        Comparator.<Map.Entry<String, Long>>comparingLong(Map.Entry::getValue)
                                .reversed()
                                .thenComparing(Map.Entry::getKey)
                )
                .limit(10)
                .collect(
                        LinkedHashMap::new,
                        (acc, entry) -> acc.put(entry.getKey(), entry.getValue()),
                        LinkedHashMap::putAll
                );

        return new EvalCaseResultStatsResponse(
                queued,
                running,
                ok,
                error,
                passTrue,
                passFalse,
                effectivePassTrue,
                effectivePassFalse,
                unreviewed,
                correct,
                incorrect,
                topLabelCounts
        );
    }

    private EvalCaseResultTableRowResponse toTableRow(EvalCaseResultRepository.TableRowProjection row) {
        EvalCaseStatus status = parseStatus(row.getStatus());
        EvalHumanReviewVerdict verdict = row.getHumanReviewVerdict() != null
                ? row.getHumanReviewVerdict()
                : EvalHumanReviewVerdict.UNREVIEWED;

        Boolean effectivePass = computeEffectivePass(row.getPass(), verdict, row.getHumanOverridePass());
        List<String> labels = extractLabels(row.getJudgeOutputJson());
        String reason = extractReason(row.getJudgeOutputJson());

        return new EvalCaseResultTableRowResponse(
                row.getId(),
                row.getTestCaseId(),
                status,
                row.getOverallScore(),
                row.getPass(),
                effectivePass,
                verdict,
                labels,
                reason,
                row.getStartedAt(),
                row.getCompletedAt()
        );
    }

    private EvalCaseStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return EvalCaseStatus.valueOf(status);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private Boolean computeEffectivePass(Boolean pass, EvalHumanReviewVerdict verdict, Boolean overridePass) {
        EvalHumanReviewVerdict safeVerdict = verdict != null ? verdict : EvalHumanReviewVerdict.UNREVIEWED;
        if (safeVerdict == EvalHumanReviewVerdict.INCORRECT && overridePass != null) {
            return overridePass;
        }
        return pass;
    }

    private List<String> extractLabels(Map<String, Object> judgeOutputJson) {
        if (judgeOutputJson == null || judgeOutputJson.isEmpty()) {
            return List.of();
        }

        Object raw = judgeOutputJson.get("labels");
        if (raw == null) {
            return List.of();
        }

        if (raw instanceof List<?> list) {
            List<String> labels = new ArrayList<>();
            for (Object item : list) {
                if (item == null) {
                    continue;
                }
                String value = String.valueOf(item).trim();
                if (!value.isEmpty()) {
                    labels.add(value);
                }
            }
            return labels;
        }

        if (raw instanceof String text) {
            String trimmed = text.trim();
            return trimmed.isEmpty() ? List.of() : List.of(trimmed);
        }

        String fallback = String.valueOf(raw).trim();
        return fallback.isEmpty() ? List.of() : List.of(fallback);
    }

    private String extractReason(Map<String, Object> judgeOutputJson) {
        if (judgeOutputJson == null || judgeOutputJson.isEmpty()) {
            return null;
        }
        Object raw = judgeOutputJson.get("reason");
        if (raw == null) {
            return null;
        }
        String value = String.valueOf(raw).trim();
        return value.isEmpty() ? null : value;
    }
}
