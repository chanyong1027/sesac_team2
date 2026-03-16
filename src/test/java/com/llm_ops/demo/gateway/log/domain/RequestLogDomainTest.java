package com.llm_ops.demo.gateway.log.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RequestLogDomainTest {

    @Test
    @DisplayName("BLOCKED 상태가 된 로그는 이후 success/fail 업데이트로 덮어쓰지 않는다")
    void blocked_상태는_최종상태로_유지된다() {
        // given
        RequestLog requestLog = RequestLog.loggingStart(
                UUID.randomUUID(),
                "trace-blocked-final",
                10L,
                20L,
                30L,
                "prefix-blocked",
                "/v1/chat/completions",
                "POST",
                "prompt-key",
                false,
                "{\"messages\":[]}",
                "GATEWAY");
        LocalDateTime blockedAt = LocalDateTime.of(2026, 3, 16, 7, 0);
        requestLog.markBlocked(
                blockedAt,
                403,
                120,
                "GW-REQ-BUDGET_BLOCKED",
                "blocked",
                "BUDGET_EXCEEDED",
                "blocked payload");

        // when
        requestLog.markSuccess(blockedAt.plusSeconds(1), 200, 300, null, "ok payload");
        requestLog.markFail(
                blockedAt.plusSeconds(2),
                500,
                400,
                "GW-UP-UNAVAILABLE",
                "late failure",
                "HTTP_503",
                "error payload");

        // then
        assertThat(requestLog.getStatus()).isEqualTo(RequestLogStatus.BLOCKED);
        assertThat(requestLog.getHttpStatus()).isEqualTo(403);
        assertThat(requestLog.getLatencyMs()).isEqualTo(120);
        assertThat(requestLog.getErrorCode()).isEqualTo("GW-REQ-BUDGET_BLOCKED");
        assertThat(requestLog.getResponsePayload()).isEqualTo("blocked payload");
    }

    @Test
    @DisplayName("RequestLogAttempt.create는 NOT NULL 필드를 조기에 검증한다")
    void request_log_attempt_create는_필수필드를_검증한다() {
        // given
        RequestLog requestLog = RequestLog.loggingStart(
                UUID.randomUUID(),
                "trace-attempt-required",
                10L,
                20L,
                30L,
                "prefix-attempt",
                "/v1/chat/completions",
                "POST",
                "prompt-key",
                false,
                "{\"messages\":[]}",
                "GATEWAY");
        LocalDateTime startedAt = LocalDateTime.of(2026, 3, 16, 7, 0);
        LocalDateTime endedAt = startedAt.plusNanos(300_000_000L);

        // when // then
        assertThatThrownBy(() -> RequestLogAttempt.create(
                null,
                1,
                RequestLogAttemptRoute.PRIMARY,
                false,
                RequestLogAttemptResult.SUCCESS,
                "openai",
                "gpt-4o-mini",
                "gpt-4o-mini",
                startedAt,
                endedAt,
                300,
                200,
                null,
                null,
                null,
                null))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("requestLog는 필수입니다");

        assertThatThrownBy(() -> RequestLogAttempt.create(
                requestLog,
                null,
                RequestLogAttemptRoute.PRIMARY,
                false,
                RequestLogAttemptResult.SUCCESS,
                "openai",
                "gpt-4o-mini",
                "gpt-4o-mini",
                startedAt,
                endedAt,
                300,
                200,
                null,
                null,
                null,
                null))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("attemptNo는 필수입니다");

        assertThatThrownBy(() -> RequestLogAttempt.create(
                requestLog,
                1,
                null,
                false,
                RequestLogAttemptResult.SUCCESS,
                "openai",
                "gpt-4o-mini",
                "gpt-4o-mini",
                startedAt,
                endedAt,
                300,
                200,
                null,
                null,
                null,
                null))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("route는 필수입니다");

        assertThatThrownBy(() -> RequestLogAttempt.create(
                requestLog,
                1,
                RequestLogAttemptRoute.PRIMARY,
                false,
                null,
                "openai",
                "gpt-4o-mini",
                "gpt-4o-mini",
                startedAt,
                endedAt,
                300,
                200,
                null,
                null,
                null,
                null))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("result는 필수입니다");
    }
}
