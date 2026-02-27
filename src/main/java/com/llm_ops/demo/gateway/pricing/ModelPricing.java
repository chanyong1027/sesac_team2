package com.llm_ops.demo.gateway.pricing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * 모델별 가격 정보
 * TODO: 추후 DB나 설정 파일로 이동 가능
 */
public class ModelPricing {

    private static final Map<String, PriceInfo> PRICING_TABLE = new HashMap<>();
    private static final Map<String, String> MODEL_ALIASES = new HashMap<>();
    private static final String VERSION = "v2.0.0";

    static {
        // ============================================================
        // OpenAI — 2026-02 기준, per 1K tokens
        //   출처: https://costgoat.com/pricing/openai-api
        // ============================================================
        PRICING_TABLE.put("gpt-5.2",      new PriceInfo("0.00175", "0.014"));   // $1.75 / $14.00 per 1M
        PRICING_TABLE.put("gpt-4.1",      new PriceInfo("0.002",   "0.008"));   // $2.00 / $8.00  per 1M
        PRICING_TABLE.put("gpt-4.1-mini", new PriceInfo("0.0004",  "0.0016"));  // $0.40 / $1.60  per 1M
        PRICING_TABLE.put("o3",           new PriceInfo("0.002",   "0.008"));   // $2.00 / $8.00  per 1M
        PRICING_TABLE.put("o4-mini",      new PriceInfo("0.0011",  "0.0044"));  // $1.10 / $4.40  per 1M
        // legacy — allowlist에서 제거됐으나 기존 로그 비용 계산용으로 유지
        PRICING_TABLE.put("gpt-4o",       new PriceInfo("0.005",   "0.015"));
        PRICING_TABLE.put("gpt-4o-mini",  new PriceInfo("0.00015", "0.0006"));
        PRICING_TABLE.put("gpt-4.1-nano", new PriceInfo("0.0001",  "0.0004"));
        PRICING_TABLE.put("gpt-4",        new PriceInfo("0.03",    "0.06"));
        PRICING_TABLE.put("gpt-3.5-turbo",new PriceInfo("0.0005",  "0.0015"));

        // ============================================================
        // Anthropic — 2026-02 기준, per 1K tokens
        //   출처: https://platform.claude.com/docs/en/about-claude/pricing
        // ============================================================
        PRICING_TABLE.put("claude-opus-4-6",   new PriceInfo("0.005",  "0.025"));  // $5.00 / $25.00 per 1M
        PRICING_TABLE.put("claude-sonnet-4-6", new PriceInfo("0.003",  "0.015"));  // $3.00 / $15.00 per 1M
        PRICING_TABLE.put("claude-haiku-4-5",  new PriceInfo("0.001",  "0.005"));  // $1.00 / $5.00  per 1M
        // legacy
        PRICING_TABLE.put("claude-3-5-sonnet", new PriceInfo("0.003",   "0.015"));
        PRICING_TABLE.put("claude-3-5-haiku",  new PriceInfo("0.001",   "0.005"));
        PRICING_TABLE.put("claude-3-opus",     new PriceInfo("0.015",   "0.075"));
        PRICING_TABLE.put("claude-3-haiku",    new PriceInfo("0.00025", "0.00125"));

        // ============================================================
        // Google Gemini — 2026-02 기준, per 1K tokens
        //   출처: https://ai.google.dev/gemini-api/docs/pricing
        // ============================================================
        PRICING_TABLE.put("gemini-2.5-pro",       new PriceInfo("0.00125", "0.01"));    // $1.25 / $10.00 per 1M
        PRICING_TABLE.put("gemini-2.5-flash",      new PriceInfo("0.0003",  "0.0025")); // $0.30 / $2.50  per 1M
        PRICING_TABLE.put("gemini-2.5-flash-lite", new PriceInfo("0.0001",  "0.0004")); // $0.10 / $0.40  per 1M
        // legacy
        PRICING_TABLE.put("gemini-2.0-flash",      new PriceInfo("0.0001",  "0.0004"));

        // Aliases — 기존 로그에서 날짜 포함 모델명이 올 경우 대표 키로 접기
        // (날짜 패턴은 normalizeModelName() 에서 regex로 우선 제거됨)
        MODEL_ALIASES.put("gpt-4-turbo",         "gpt-4o");
        MODEL_ALIASES.put("gpt-4-turbo-preview",  "gpt-4o");
    }

    /**
     * 모델 사용량 기반 비용 계산
     *
     * @param modelName 모델명
     * @param inputTokens 입력 토큰 수
     * @param outputTokens 출력 토큰 수
     * @return 예상 비용 (USD)
     */
    public static BigDecimal calculateCost(String modelName, Integer inputTokens, Integer outputTokens) {
        if (modelName == null || inputTokens == null || outputTokens == null) {
            return BigDecimal.ZERO;
        }

        int safeInputTokens = Math.max(0, inputTokens);
        int safeOutputTokens = Math.max(0, outputTokens);

        // 모델명 정규화 (버전 번호 제거, 소문자 변환)
        String normalizedModelName = normalizeModelName(modelName);

        PriceInfo priceInfo = PRICING_TABLE.get(normalizedModelName);
        if (priceInfo == null) {
            // 알 수 없는 모델은 0으로 계산
            return BigDecimal.ZERO;
        }

        // 비용 = (입력 토큰 / 1000 * 입력 단가) + (출력 토큰 / 1000 * 출력 단가)
        BigDecimal inputCost = priceInfo.inputPricePer1k
                .multiply(BigDecimal.valueOf(safeInputTokens))
                .divide(BigDecimal.valueOf(1000), 8, RoundingMode.HALF_UP);

        BigDecimal outputCost = priceInfo.outputPricePer1k
                .multiply(BigDecimal.valueOf(safeOutputTokens))
                .divide(BigDecimal.valueOf(1000), 8, RoundingMode.HALF_UP);

        return inputCost.add(outputCost);
    }

    /**
     * 일부 프로바이더는 totalTokens만 반환합니다.
     * 이 경우 input/output를 비율로 추정하여 비용을 계산합니다.
     *
     * 기본 분해 비율: INPUT 70% / OUTPUT 30%
     */
    public static BigDecimal calculateCostFromTotalTokens(String modelName, Integer totalTokens) {
        if (modelName == null || totalTokens == null || totalTokens <= 0) {
            return BigDecimal.ZERO;
        }

        // INPUT 70% / OUTPUT 30% (하드코드 기본값)
        int inputTokens = (int) Math.round(totalTokens * 0.7);
        if (inputTokens < 0) {
            inputTokens = 0;
        }
        if (inputTokens > totalTokens) {
            inputTokens = totalTokens;
        }
        int outputTokens = totalTokens - inputTokens;

        return calculateCost(modelName, inputTokens, outputTokens);
    }

    /**
     * 가격 버전 반환
     */
    public static String getPricingVersion() {
        return VERSION;
    }

    /**
     * 가격표에 등록된(지원되는) 모델인지 여부
     *
     * NOTE: 알 수 없는 모델을 0원으로 표시하면 운영/UX에서 오해가 생기므로,
     * 호출자에서 "비용 미정"으로 처리할 수 있도록 별도 플래그를 제공합니다.
     */
    public static boolean isKnownModel(String modelName) {
        if (modelName == null || modelName.isBlank()) {
            return false;
        }
        String normalized = normalizeModelName(modelName);
        return PRICING_TABLE.containsKey(normalized);
    }

    /**
     * 모델명 정규화
     * 예: "gpt-4o-2024-05-13" -> "gpt-4o"
     */
    private static String normalizeModelName(String modelName) {
        if (modelName == null) {
            return "";
        }

        String normalized = modelName.toLowerCase().trim();

        // 날짜 패턴 제거 (예: -2024-05-13, -20240513)
        normalized = normalized.replaceAll("-\\d{4}-\\d{2}-\\d{2}$", "");
        normalized = normalized.replaceAll("-\\d{8}$", "");

        // 버전 번호 제거 (예: -v1, -v2)
        normalized = normalized.replaceAll("-v\\d+$", "");

        // alias 적용 (대표 키로 접기)
        return MODEL_ALIASES.getOrDefault(normalized, normalized);
    }

    /**
     * 가격 정보 클래스
     */
    private static class PriceInfo {
        final BigDecimal inputPricePer1k;  // $ per 1K tokens
        final BigDecimal outputPricePer1k; // $ per 1K tokens

        PriceInfo(String inputPrice, String outputPrice) {
            this.inputPricePer1k = new BigDecimal(inputPrice);
            this.outputPricePer1k = new BigDecimal(outputPrice);
        }
    }
}
