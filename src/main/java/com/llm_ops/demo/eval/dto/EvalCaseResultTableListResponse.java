package com.llm_ops.demo.eval.dto;

import java.util.List;
import org.springframework.data.domain.Page;

public record EvalCaseResultTableListResponse(
        List<EvalCaseResultTableRowResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static EvalCaseResultTableListResponse from(Page<EvalCaseResultTableRowResponse> page) {
        return new EvalCaseResultTableListResponse(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}
