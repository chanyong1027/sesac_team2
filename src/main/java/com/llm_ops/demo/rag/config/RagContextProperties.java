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
    private boolean includeSource = true;
    private boolean includeScore = false;
    private String separator = "\n\n---\n\n";
    private String truncatedMarker = "[TRUNCATED]";

    public int getMaxChunks() {
        return maxChunks;
    }

    public int getMaxContextChars() {
        return maxContextChars;
    }

    public boolean isIncludeSource() {
        return includeSource;
    }

    public boolean isIncludeScore() {
        return includeScore;
    }

    public String getSeparator() {
        return separator;
    }

    public String getTruncatedMarker() {
        return truncatedMarker;
    }
}
