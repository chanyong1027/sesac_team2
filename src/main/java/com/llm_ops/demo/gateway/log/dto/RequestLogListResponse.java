package com.llm_ops.demo.gateway.log.dto;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * 로그 목록 조회 응답 DTO (페이징 포함)
 */
public record RequestLogListResponse(
        List<RequestLogResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {
    public static RequestLogListResponse from(Page<RequestLogResponse> page) {
        return new RequestLogListResponse(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }
}
