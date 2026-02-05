package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.rag.config.RagContextProperties;
import com.llm_ops.demo.rag.dto.ChunkDetailResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RagContextBuilderTest {

    private final RagContextProperties properties = new RagContextProperties();
    private final RagContextBuilder builder = new RagContextBuilder(properties);

    @Test
    @DisplayName("RAG 컨텍스트 빌드 시 chunks/char/truncated 메트릭이 계산된다")
    void rag_context_metrics() {
        List<ChunkDetailResponse> chunks = List.of(
            new ChunkDetailResponse("서울의 오늘 날씨는 맑음입니다.", 0.95, 10L, "weather.txt"),
            new ChunkDetailResponse("기온은 25도입니다.", 0.90, 10L, "weather.txt")
        );

        RagContextBuilder.RagContextResult result = builder.build(chunks, 3, 4000);

        assertThat(result.context()).contains("서울의 오늘 날씨는 맑음입니다.");
        assertThat(result.context()).contains("기온은 25도입니다.");
        assertThat(result.chunksIncluded()).isEqualTo(2);
        assertThat(result.contextChars()).isGreaterThan(0);
        assertThat(result.truncated()).isFalse();
    }

    @Test
    @DisplayName("빈 chunks면 컨텍스트는 비고 메트릭은 0/false")
    void rag_empty_chunks() {
        RagContextBuilder.RagContextResult result = builder.build(List.of(), 3, 4000);
        assertThat(result.context()).isEqualTo("");
        assertThat(result.chunksIncluded()).isEqualTo(0);
        assertThat(result.contextChars()).isEqualTo(0);
        assertThat(result.truncated()).isFalse();
    }
}
