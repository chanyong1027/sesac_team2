package com.llm_ops.demo.budget.service;

import com.knuddels.jtokkit.Encodings;
import com.knuddels.jtokkit.api.Encoding;
import com.knuddels.jtokkit.api.EncodingRegistry;
import com.knuddels.jtokkit.api.EncodingType;
import com.llm_ops.demo.budget.config.BudgetReservationEstimationProperties;
import com.llm_ops.demo.gateway.pricing.ModelPricing;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BudgetReservationEstimatorTest {

    private final EncodingRegistry registry = Encodings.newLazyEncodingRegistry();
    private final Encoding encoding = registry.getEncoding(EncodingType.CL100K_BASE);

    @Test
    @DisplayName("알려진 모델과 effective maxTokens가 있으면 최대 비용 상한을 계산한다")
    void 알려진_모델과_effective_maxTokens가_있으면_최대_비용_상한을_계산한다() {
        // given
        BudgetReservationEstimationProperties properties = new BudgetReservationEstimationProperties();
        properties.setInputTokenSafetyMultiplier(new BigDecimal("1.10"));
        BudgetReservationEstimator estimator = new BudgetReservationEstimator(properties);
        String systemPrompt = "You are a helpful assistant.";
        String userPrompt = "Summarize the budget reservation design in one paragraph.";
        int rawInputTokens = encoding.countTokens(systemPrompt) + encoding.countTokens(userPrompt);
        int expectedInputTokens = BigDecimal.valueOf(rawInputTokens)
            .multiply(new BigDecimal("1.10"))
            .setScale(0, RoundingMode.CEILING)
            .intValueExact();

        // when
        BudgetReservationEstimate estimate = estimator.estimate(
            "gpt-4.1-mini",
            systemPrompt,
            userPrompt,
            512
        );

        // then
        assertThat(estimate.reservable()).isTrue();
        assertThat(estimate.pricingModel()).isEqualTo("gpt-4.1-mini");
        assertThat(estimate.reservedInputTokens()).isEqualTo(expectedInputTokens);
        assertThat(estimate.reservedOutputTokens()).isEqualTo(512);
        assertThat(estimate.reserveAmountUsd())
            .isEqualByComparingTo(ModelPricing.calculateCost("gpt-4.1-mini", expectedInputTokens, 512));
        assertThat(estimate.rejectionReason()).isNull();
    }

    @Test
    @DisplayName("effective maxTokens가 없으면 기본 출력 토큰 상한을 사용한다")
    void effective_maxTokens가_없으면_기본_출력_토큰_상한을_사용한다() {
        // given
        BudgetReservationEstimationProperties properties = new BudgetReservationEstimationProperties();
        properties.setDefaultMaxOutputTokens(1024);
        BudgetReservationEstimator estimator = new BudgetReservationEstimator(properties);

        // when
        BudgetReservationEstimate estimate = estimator.estimate(
            "gpt-4.1-mini",
            "System prompt",
            "User prompt",
            null
        );

        // then
        assertThat(estimate.reservable()).isTrue();
        assertThat(estimate.reservedOutputTokens()).isEqualTo(1024);
    }

    @Test
    @DisplayName("알 수 없는 모델이면 예약 불가 결과를 반환한다")
    void 알_수_없는_모델이면_예약_불가_결과를_반환한다() {
        // given
        BudgetReservationEstimator estimator = new BudgetReservationEstimator(new BudgetReservationEstimationProperties());

        // when
        BudgetReservationEstimate estimate = estimator.estimate(
            "unknown-model",
            "System prompt",
            "User prompt",
            256
        );

        // then
        assertThat(estimate.reservable()).isFalse();
        assertThat(estimate.rejectionReason()).isEqualTo(BudgetReservationEstimator.PRICING_UNAVAILABLE_REASON);
        assertThat(estimate.reserveAmountUsd()).isNull();
        assertThat(estimate.reservedInputTokens()).isNull();
        assertThat(estimate.reservedOutputTokens()).isNull();
    }

    @Test
    @DisplayName("설정값이 비정상이면 기본 안전계수와 기본 출력 토큰 상한을 사용한다")
    void 설정값이_비정상이면_기본_안전계수와_기본_출력_토큰_상한을_사용한다() {
        // given
        BudgetReservationEstimationProperties properties = new BudgetReservationEstimationProperties();
        properties.setInputTokenSafetyMultiplier(new BigDecimal("0.50"));
        properties.setDefaultMaxOutputTokens(0);
        BudgetReservationEstimator estimator = new BudgetReservationEstimator(properties);
        String userPrompt = "Fallback defaults should be applied.";
        int rawInputTokens = encoding.countTokens(userPrompt);
        int expectedInputTokens = BigDecimal.valueOf(rawInputTokens)
            .multiply(new BigDecimal("1.10"))
            .setScale(0, RoundingMode.CEILING)
            .intValueExact();

        // when
        BudgetReservationEstimate estimate = estimator.estimate(
            "gpt-4.1-mini",
            null,
            userPrompt,
            -1
        );

        // then
        assertThat(estimate.reservable()).isTrue();
        assertThat(estimate.reservedInputTokens()).isEqualTo(expectedInputTokens);
        assertThat(estimate.reservedOutputTokens()).isEqualTo(2048);
    }
}
