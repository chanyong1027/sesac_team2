package com.llm_ops.demo.eval.dto;

import java.util.List;
import org.springframework.data.domain.Page;

public record EvalCaseResultListResponse(
        List<EvalCaseResultResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static EvalCaseResultListResponse from(Page<EvalCaseResultResponse> page) {
        return new EvalCaseResultListResponse(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}
