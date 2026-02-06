package com.llm_ops.demo.rag.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "rag.hybrid")
@Getter
@Setter
public class RagHybridSearchProperties {

    private boolean enabled = true;

    private int vectorTopK = 20;
    private int keywordTopK = 20;
    private int candidateTopK = 30;
    private int rrfK = 60;
    private int minKeywordQueryLength = 3;
}
