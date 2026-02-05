package com.llm_ops.demo.rag.rerank;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;

@Component
public class CohereRerankClient {

    private final CohereRerankProperties properties;
    private final RestClient restClient;

    public CohereRerankClient(CohereRerankProperties properties) {
        this.properties = properties;
        RestClient.Builder builder = RestClient.builder().baseUrl(properties.getBaseUrl());
        if (StringUtils.hasText(properties.getApiKey())) {
            builder.defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApiKey());
        }
        if (StringUtils.hasText(properties.getClientName())) {
            builder.defaultHeader("X-Client-Name", properties.getClientName());
        }
        this.restClient = builder.build();
    }

    public List<RerankResult> rerank(String query, List<String> documents, Integer topNOverride) {
        if (!properties.isEnabled()) {
            return List.of();
        }
        if (!StringUtils.hasText(properties.getApiKey())) {
            return List.of();
        }
        if (query == null || query.isBlank() || documents == null || documents.isEmpty()) {
            return List.of();
        }

        int maxDocs = Math.min(properties.getMaxDocuments(), documents.size());
        int topN = topNOverride != null ? Math.min(topNOverride, maxDocs) : Math.min(properties.getTopN(), maxDocs);
        List<String> limitedDocs = documents.subList(0, maxDocs);

        RerankRequest request = new RerankRequest(properties.getModel(), query, limitedDocs, topN);
        try {
            RerankResponse response = restClient.post()
                .uri("/v2/rerank")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(RerankResponse.class);

            if (response == null || response.results == null) {
                return List.of();
            }
            return response.results;
        } catch (Exception ex) {
            return List.of();
        }
    }

    public record RerankRequest(
        String model,
        String query,
        List<String> documents,
        Integer top_n
    ) {
    }

    public static class RerankResponse {
        public List<RerankResult> results;
    }

    public static class RerankResult {
        public int index;
        public double relevance_score;
    }
}
