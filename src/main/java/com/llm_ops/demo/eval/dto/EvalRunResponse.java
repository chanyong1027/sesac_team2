package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.domain.EvalRunStatus;
import com.llm_ops.demo.eval.domain.EvalTriggerType;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import java.time.LocalDateTime;
import java.util.Map;

public record EvalRunResponse(
        Long id,
        Long promptId,
        Long promptVersionId,
        Long workspaceId,
        Long datasetId,
        EvalMode mode,
        EvalTriggerType triggerType,
        RubricTemplateCode rubricTemplateCode,
        Map<String, Object> rubricOverrides,
        String candidateProvider,
        String candidateModel,
        String judgeProvider,
        String judgeModel,
        EvalRunStatus status,
        int totalCases,
        int processedCases,
        int passedCases,
        int failedCases,
        int errorCases,
        Map<String, Object> summary,
        Map<String, Object> cost,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        LocalDateTime createdAt
) {

    public static EvalRunResponse from(EvalRun run) {
        return new EvalRunResponse(
                run.getId(),
                run.getPrompt().getId(),
                run.getPromptVersion().getId(),
                run.getWorkspaceId(),
                run.getDataset().getId(),
                run.mode(),
                EvalTriggerType.valueOf(run.getTriggerType()),
                run.rubricTemplateCode(),
                run.getRubricOverridesJson(),
                run.getCandidateProvider(),
                run.getCandidateModel(),
                run.getJudgeProvider(),
                run.getJudgeModel(),
                run.status(),
                run.getTotalCases(),
                run.getProcessedCases(),
                run.getPassedCases(),
                run.getFailedCases(),
                run.getErrorCases(),
                run.getSummaryJson(),
                run.getCostJson(),
                run.getStartedAt(),
                run.getCompletedAt(),
                run.getCreatedAt()
        );
    }
}
