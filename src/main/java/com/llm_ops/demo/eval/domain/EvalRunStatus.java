package com.llm_ops.demo.eval.domain;

public enum EvalRunStatus {
    QUEUED,
    CLAIMED,
    RUNNING,
    CANCEL_REQUESTED,
    COMPLETED,
    FAILED,
    CANCELLED
}
