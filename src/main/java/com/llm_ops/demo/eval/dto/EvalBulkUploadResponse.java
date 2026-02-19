package com.llm_ops.demo.eval.dto;

public record EvalBulkUploadResponse(
        Long datasetId,
        int uploadedCount
) {
}
