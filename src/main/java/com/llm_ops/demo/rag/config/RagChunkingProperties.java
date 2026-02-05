package com.llm_ops.demo.rag.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * RAG 문서 청킹을 위한 설정을 외부 프로퍼티로부터 바인딩합니다.
 */
@Component
@ConfigurationProperties(prefix = "rag.chunking")
@Getter
@Setter
public class RagChunkingProperties {

    /**
     * 한 청크에 포함될 최대 토큰 수입니다.
     */
    private int chunkSize = 500;

    /**
     * 문장 경계 분할 시 최소 보장할 문자 수입니다.
     */
    private int minChunkSizeChars = 200;

    /**
     * 임베딩 대상이 될 최소 텍스트 길이(문자 수)입니다.
     */
    private int minChunkLengthToEmbed = 80;

    /**
     * 생성 가능한 최대 청크 수입니다.
     */
    private int maxNumChunks = 10000;

    /**
     * 청킹 시 겹칠 토큰 수입니다.
     */
    private int chunkOverlapTokens = 50;

    /**
     * 문단 단위 분할 시 하나의 문단으로 허용할 최대 문자 수입니다.
     */
    private int paragraphMaxChars = 2000;

    /**
     * 문장 구분자를 유지할지 여부입니다.
     */
    private boolean keepSeparator = true;
}
