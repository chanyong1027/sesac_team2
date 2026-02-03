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
    private static final String VERSION = "v1.0.0";

    static {
        // OpenAI
        PRICING_TABLE.put("gpt-4o", new PriceInfo("0.005", "0.015"));
        PRICING_TABLE.put("gpt-4o-mini", new PriceInfo("0.00015", "0.0006"));
        PRICING_TABLE.put("gpt-4", new PriceInfo("0.03", "0.06"));
        PRICING_TABLE.put("gpt-3.5-turbo", new PriceInfo("0.0005", "0.0015"));

        // Anthropic
        PRICING_TABLE.put("claude-3-5-sonnet", new PriceInfo("0.003", "0.015"));
        PRICING_TABLE.put("claude-3-5-haiku", new PriceInfo("0.001", "0.005"));
        PRICING_TABLE.put("claude-3-opus", new PriceInfo("0.015", "0.075"));
        PRICING_TABLE.put("claude-3-sonnet", new PriceInfo("0.003", "0.015"));
        PRICING_TABLE.put("claude-3-haiku", new PriceInfo("0.00025", "0.00125"));

        // Google Gemini
        PRICING_TABLE.put("gemini-1.5-pro", new PriceInfo("0.00125", "0.005"));
        PRICING_TABLE.put("gemini-2.0-flash", new PriceInfo("0.0001", "0.0004"));
        PRICING_TABLE.put("gemini-2.5-flash-lite", new PriceInfo("0.00005", "0.0002"));
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

        // 모델명 정규화 (버전 번호 제거, 소문자 변환)
        String normalizedModelName = normalizeModelName(modelName);

        PriceInfo priceInfo = PRICING_TABLE.get(normalizedModelName);
        if (priceInfo == null) {
            // 알 수 없는 모델은 0으로 계산
            return BigDecimal.ZERO;
        }

        // 비용 = (입력 토큰 / 1000 * 입력 단가) + (출력 토큰 / 1000 * 출력 단가)
        BigDecimal inputCost = priceInfo.inputPricePer1k
                .multiply(BigDecimal.valueOf(inputTokens))
                .divide(BigDecimal.valueOf(1000), 8, RoundingMode.HALF_UP);

        BigDecimal outputCost = priceInfo.outputPricePer1k
                .multiply(BigDecimal.valueOf(outputTokens))
                .divide(BigDecimal.valueOf(1000), 8, RoundingMode.HALF_UP);

        return inputCost.add(outputCost);
    }

    /**
     * 가격 버전 반환
     */
    public static String getPricingVersion() {
        return VERSION;
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

        return normalized;
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
