package com.llm_ops.demo.gateway.log.dto;

import java.util.List;

public record RequestLogAttemptTimelineResponse(
        RequestLogAttemptCollectionMode collectionMode,
        List<RequestLogAttemptResponse> attempts) {
}

