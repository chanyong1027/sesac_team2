package com.llm_ops.demo.auth.dto.response;

public record EmailAvailabilityResponse(
        boolean available,
        String message
) {
}
