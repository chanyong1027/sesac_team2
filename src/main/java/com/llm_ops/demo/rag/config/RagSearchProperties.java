package com.llm_ops.demo.rag.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * RAG 검색 옵션을 외부 프로퍼티로부터 바인딩합니다.
 */
@Component
@ConfigurationProperties(prefix = "rag.search")
@Getter
@Setter
public class RagSearchProperties {

    /**
     * 검색 결과 상위 N개를 반환합니다.
     */
    private int topK = SearchRequest.DEFAULT_TOP_K;

    /**
     * 유사도 점수 하한선입니다.
     */
    private double similarityThreshold = SearchRequest.SIMILARITY_THRESHOLD_ACCEPT_ALL;
}
