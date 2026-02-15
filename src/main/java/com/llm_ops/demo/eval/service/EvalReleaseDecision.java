package com.llm_ops.demo.eval.service;

import java.util.List;

public record EvalReleaseDecision(
        String releaseDecision,
        String riskLevel,
        List<String> reasons,
        String decisionBasis
) {
    public static final String SAFE_TO_DEPLOY = "SAFE_TO_DEPLOY";
    public static final String HOLD = "HOLD";
    public static final String BASIS_RUN_SNAPSHOT = "RUN_SNAPSHOT";
}
