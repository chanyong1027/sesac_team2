package com.llm_ops.demo.rag.rerank;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "rag.rerank.cohere")
@Getter
@Setter
public class CohereRerankProperties {

    private boolean enabled = false;
    private String apiKey;
    private String baseUrl = "https://api.cohere.com";
    private String model = "rerank-v3.5";
    private int maxDocuments = 30;
    private int topN = 10;
    private String clientName = "luminaops";
}
