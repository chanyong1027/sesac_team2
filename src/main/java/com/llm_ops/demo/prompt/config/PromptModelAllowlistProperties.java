package com.llm_ops.demo.prompt.config;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "prompt")
public class PromptModelAllowlistProperties {

    private Map<String, List<String>> modelAllowlist = new LinkedHashMap<>();

    public Map<String, List<String>> getModelAllowlist() {
        return modelAllowlist;
    }

    public void setModelAllowlist(Map<String, List<String>> modelAllowlist) {
        this.modelAllowlist = modelAllowlist;
    }
}
