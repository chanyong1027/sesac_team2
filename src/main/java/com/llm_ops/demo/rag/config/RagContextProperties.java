package com.llm_ops.demo.rag.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "rag.context")
@Getter
@Setter
public class RagContextProperties {

    private int maxChunks = 10;
    private int maxContextChars = 4000;

    public int getMaxChunks() {
        return maxChunks;
    }

    public int getMaxContextChars() {
        return maxContextChars;
    }
}
