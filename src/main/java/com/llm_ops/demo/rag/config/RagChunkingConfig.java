package com.llm_ops.demo.rag.config;

import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RAG 청킹을 위한 TokenTextSplitter 빈을 생성합니다.
 */
@Configuration
public class RagChunkingConfig {

    @Bean
    public TokenTextSplitter tokenTextSplitter(RagChunkingProperties properties) {
        return TokenTextSplitter.builder()
                .withChunkSize(properties.getChunkSize())
                .withMinChunkSizeChars(properties.getMinChunkSizeChars())
                .withMinChunkLengthToEmbed(properties.getMinChunkLengthToEmbed())
                .withMaxNumChunks(properties.getMaxNumChunks())
                .withKeepSeparator(properties.isKeepSeparator())
                .build();
    }
}
