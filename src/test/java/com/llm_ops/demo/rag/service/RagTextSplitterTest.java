package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.rag.config.RagChunkingProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.document.Document;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RagTextSplitterTest {

    @Test
    @DisplayName("토큰 오버랩이 적용되어 다음 청크에 이전 꼬리가 포함된다")
    void token_overlap_applied() {
        RagChunkingProperties properties = new RagChunkingProperties();
        properties.setChunkSize(3);
        properties.setChunkOverlapTokens(1);
        properties.setMinChunkLengthToEmbed(1);
        properties.setMaxNumChunks(10);
        properties.setParagraphMaxChars(1000);

        RagTextSplitter splitter = new RagTextSplitter(properties);
        Document doc = new Document("A B C D E F", Map.of());

        List<Document> chunks = splitter.split(doc);

        assertThat(chunks.size()).isGreaterThan(1);
        assertThat(chunks.get(0).getContent()).contains("A");
        assertThat(chunks.get(1).getContent()).contains("C");
    }
}
