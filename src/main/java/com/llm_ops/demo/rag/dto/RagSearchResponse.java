package com.llm_ops.demo.rag.dto;

import java.util.List;

public record RagSearchResponse(
        List<ChunkDetailResponse> chunks
) {
}
