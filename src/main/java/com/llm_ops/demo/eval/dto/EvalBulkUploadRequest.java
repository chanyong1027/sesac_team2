package com.llm_ops.demo.eval.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record EvalBulkUploadRequest(
        @NotEmpty @Valid List<EvalTestCaseCreateRequest> testCases,
        Boolean replaceExisting
) {
    public boolean isReplaceExisting() {
        return Boolean.TRUE.equals(replaceExisting);
    }
}
