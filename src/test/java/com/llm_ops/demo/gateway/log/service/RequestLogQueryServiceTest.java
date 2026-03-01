package com.llm_ops.demo.gateway.log.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.domain.RequestLogStatus;
import com.llm_ops.demo.gateway.log.dto.RequestLogListResponse;
import com.llm_ops.demo.gateway.log.dto.RequestLogResponse;
import com.llm_ops.demo.gateway.log.dto.RequestLogSearchCondition;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import com.llm_ops.demo.global.error.BusinessException;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class RequestLogQueryServiceTest {

    @Autowired
    private RequestLogQueryService requestLogQueryService;

    @Autowired
    private RequestLogRepository requestLogRepository;

    private static final Long WORKSPACE_ID = 100L;

    @AfterEach
    void cleanup() {
        requestLogRepository.deleteAll();
    }

    @Nested
    @DisplayName("단건 조회")
    class FindByTraceIdTest {

        @Test
        @DisplayName("traceId로 로그를 조회한다")
        void traceId로_로그를_조회한다() {
            // given
            String traceId = "trace-single-test";
            RequestLog log = createLog(traceId, WORKSPACE_ID, RequestLogStatus.SUCCESS);
            requestLogRepository.save(log);

            // when
            RequestLogResponse response = requestLogQueryService.findByTraceId(WORKSPACE_ID, traceId);

            // then
            assertThat(response.traceId()).isEqualTo(traceId);
            assertThat(response.status()).isEqualTo(RequestLogStatus.SUCCESS);
        }

        @Test
        @DisplayName("존재하지_않는_traceId면_예외가_발생한다")
        void 존재하지_않는_traceId면_예외가_발생한다() {
            // given
            String nonExistentTraceId = "non-existent";

            // when & then
            assertThatThrownBy(() -> requestLogQueryService.findByTraceId(WORKSPACE_ID, nonExistentTraceId))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("다른_워크스페이스의_로그는_조회되지_않는다")
        void 다른_워크스페이스의_로그는_조회되지_않는다() {
            // given
            String traceId = "trace-other-ws";
            RequestLog log = createLog(traceId, 999L, RequestLogStatus.SUCCESS);
            requestLogRepository.save(log);

            // when & then
            assertThatThrownBy(() -> requestLogQueryService.findByTraceId(WORKSPACE_ID, traceId))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("상세_조회_응답에_비용이_포함된다")
        void 상세_조회_응답에_비용이_포함된다() {
            // given
            String traceId = "trace-cost-detail";
            BigDecimal estimatedCost = new BigDecimal("0.00123456");
            RequestLog log = createLog(traceId, WORKSPACE_ID, RequestLogStatus.SUCCESS);
            log.fillModelUsage("openai", "gpt-4.1-mini", "gpt-4.1-mini", false, 10, 20, 30, estimatedCost, "v1");
            requestLogRepository.save(log);

            // when
            RequestLogResponse response = requestLogQueryService.findByTraceId(WORKSPACE_ID, traceId);

            // then
            assertThat(response.cost()).isEqualByComparingTo(estimatedCost);
        }
    }

    @Nested
    @DisplayName("목록 조회")
    class SearchTest {

        @BeforeEach
        void setUp() {
            // SUCCESS 로그 3개 (OpenAI)
            for (int i = 0; i < 3; i++) {
                RequestLog log = createLog("trace-success-" + i, WORKSPACE_ID, RequestLogStatus.SUCCESS);
                log = fillProviderInfo(log, "openai", "gpt-4"); // provider 설정
                requestLogRepository.save(log);
            }
            // FAIL 로그 2개 (Anthropic)
            for (int i = 0; i < 2; i++) {
                RequestLog log = createLog("trace-fail-" + i, WORKSPACE_ID, RequestLogStatus.FAIL);
                log = fillProviderInfo(log, "anthropic", "claude-3"); // provider 설정
                requestLogRepository.save(log);
            }
        }

        @Test
        @DisplayName("워크스페이스의_전체_로그를_조회한다")
        void 워크스페이스의_전체_로그를_조회한다() {
            // given
            RequestLogSearchCondition condition = RequestLogSearchCondition.empty();
            PageRequest pageable = PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt"));

            // when
            RequestLogListResponse response = requestLogQueryService.search(WORKSPACE_ID, condition, pageable);

            // then
            assertThat(response.totalElements()).isEqualTo(5);
            assertThat(response.content()).hasSize(5);
        }

        @Test
        @DisplayName("상태_필터로_SUCCESS만_조회한다")
        void 상태_필터로_SUCCESS만_조회한다() {
            // given
            RequestLogSearchCondition condition = new RequestLogSearchCondition(
                    null, null, RequestLogStatus.SUCCESS, null, null, null, null, null, null, null, null);
            PageRequest pageable = PageRequest.of(0, 20);

            // when
            RequestLogListResponse response = requestLogQueryService.search(WORKSPACE_ID, condition, pageable);

            // then
            assertThat(response.totalElements()).isEqualTo(3);
            assertThat(response.content()).allMatch(log -> log.status() == RequestLogStatus.SUCCESS);
        }

        @Test
        @DisplayName("페이징이_정상_동작한다")
        void 페이징이_정상_동작한다() {
            // given
            RequestLogSearchCondition condition = RequestLogSearchCondition.empty();
            PageRequest pageable = PageRequest.of(0, 2);

            // when
            RequestLogListResponse response = requestLogQueryService.search(WORKSPACE_ID, condition, pageable);

            // then
            assertThat(response.size()).isEqualTo(2);
            assertThat(response.content()).hasSize(2);
            assertThat(response.totalPages()).isEqualTo(3);
        }

        @Test
        @DisplayName("복합_필터로_검색한다")
        void 복합_필터로_검색한다() {
            // given: SUCCESS + openai 조합 검색
            RequestLogSearchCondition condition = new RequestLogSearchCondition(
                    null, null, RequestLogStatus.SUCCESS, null, "openai", null, null, null, null, null, null);
            PageRequest pageable = PageRequest.of(0, 20);

            // when
            RequestLogListResponse response = requestLogQueryService.search(WORKSPACE_ID, condition, pageable);

            // then
            assertThat(response.totalElements()).isEqualTo(3);
            assertThat(response.content())
                    .allMatch(log -> log.status() == RequestLogStatus.SUCCESS && "openai".equals(log.provider()));
        }

        @Test
        @DisplayName("errorCode_필터로_FAIL_로그를_검색한다")
        void errorCode_필터로_FAIL_로그를_검색한다() {
            // given
            RequestLogSearchCondition condition = new RequestLogSearchCondition(
                    null, null, null, null, null, null, null, null, null, "ERROR", null);
            PageRequest pageable = PageRequest.of(0, 20);

            // when
            RequestLogListResponse response = requestLogQueryService.search(WORKSPACE_ID, condition, pageable);

            // then
            assertThat(response.totalElements()).isEqualTo(2);
            assertThat(response.content()).allMatch(log -> "ERROR".equals(log.errorCode()));
        }

        @Test
        @DisplayName("requestSource_필터로_조회한다")
        void requestSource_필터로_조회한다() {
            // given
            RequestLog playgroundFailLog = createFailLog(
                    "trace-playground-only",
                    WORKSPACE_ID,
                    "PLAYGROUND_ERROR",
                    "PLAYGROUND");
            requestLogRepository.save(playgroundFailLog);

            RequestLogSearchCondition condition = new RequestLogSearchCondition(
                    null, null, null, null, null, null, null, null, null, null, "PLAYGROUND");
            PageRequest pageable = PageRequest.of(0, 20);

            // when
            RequestLogListResponse response = requestLogQueryService.search(WORKSPACE_ID, condition, pageable);

            // then
            assertThat(response.totalElements()).isEqualTo(1);
            assertThat(response.content()).allMatch(log -> "PLAYGROUND".equals(log.requestSource()));
            assertThat(response.content().get(0).traceId()).isEqualTo("trace-playground-only");
        }

        @Test
        @DisplayName("errorCode와_requestSource_복합_필터로_정확히_조회한다")
        void errorCode와_requestSource_복합_필터로_정확히_조회한다() {
            // given
            requestLogRepository.save(createFailLog(
                    "trace-combined-match",
                    WORKSPACE_ID,
                    "FILTER_MATCH",
                    "PLAYGROUND"));
            requestLogRepository.save(createFailLog(
                    "trace-combined-error-only",
                    WORKSPACE_ID,
                    "FILTER_MATCH",
                    "GATEWAY"));
            requestLogRepository.save(createFailLog(
                    "trace-combined-source-only",
                    WORKSPACE_ID,
                    "OTHER_ERROR",
                    "PLAYGROUND"));

            RequestLogSearchCondition condition = new RequestLogSearchCondition(
                    null, null, null, null, null, null, null, null, null, "FILTER_MATCH", "PLAYGROUND");
            PageRequest pageable = PageRequest.of(0, 20);

            // when
            RequestLogListResponse response = requestLogQueryService.search(WORKSPACE_ID, condition, pageable);

            // then
            assertThat(response.totalElements()).isEqualTo(1);
            assertThat(response.content().get(0).traceId()).isEqualTo("trace-combined-match");
            assertThat(response.content().get(0).errorCode()).isEqualTo("FILTER_MATCH");
            assertThat(response.content().get(0).requestSource()).isEqualTo("PLAYGROUND");
        }

        @Test
        @DisplayName("null_condition이면_전체_조회된다")
        void null_condition이면_전체_조회된다() {
            // given
            PageRequest pageable = PageRequest.of(0, 20);

            // when
            RequestLogListResponse response = requestLogQueryService.search(WORKSPACE_ID, null, pageable);

            // then
            assertThat(response.totalElements()).isEqualTo(5);
        }

        @Test
        @DisplayName("목록_조회_응답에서는_payload를_노출하지_않는다")
        void 목록_조회_응답에서는_payload를_노출하지_않는다() {
            // given
            String traceId = "trace-payload-hidden";
            RequestLog log = RequestLog.loggingStart(
                    UUID.randomUUID(),
                    traceId,
                    1L,
                    WORKSPACE_ID,
                    1L,
                    "prefix",
                    "/v1/chat",
                    "POST",
                    "test-prompt",
                    false,
                    "{\"question\":\"secret\"}",
                    "GATEWAY");
            log.markSuccess(java.time.LocalDateTime.now(), 200, 100, null, "{\"answer\":\"ok\"}");
            requestLogRepository.save(log);

            RequestLogSearchCondition condition = RequestLogSearchCondition.empty();
            PageRequest pageable = PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt"));

            // when
            RequestLogListResponse response = requestLogQueryService.search(WORKSPACE_ID, condition, pageable);

            // then
            RequestLogResponse summary = response.content().stream()
                    .filter(item -> traceId.equals(item.traceId()))
                    .findFirst()
                    .orElseThrow();
            assertThat(summary.requestPayload()).isNull();
            assertThat(summary.responsePayload()).isNull();
        }
    }

    private RequestLog fillProviderInfo(RequestLog log, String provider, String model) {
        log.fillModelUsage(provider, model, model, false, 10, 20, 30, null, null);
        return log;
    }

    private RequestLog createLog(String traceId, Long workspaceId, RequestLogStatus status) {
        RequestLog log = RequestLog.loggingStart(
                UUID.randomUUID(),
                traceId,
                1L,
                workspaceId,
                1L,
                "prefix",
                "/v1/chat",
                "POST",
                "test-prompt",
                false,
                null,
                "GATEWAY");
        if (status == RequestLogStatus.SUCCESS) {
            log.markSuccess(java.time.LocalDateTime.now(), 200, 100, null, null);
        } else if (status == RequestLogStatus.FAIL) {
            log.markFail(java.time.LocalDateTime.now(), 500, 100, "ERROR", "error message", "INTERNAL_ERROR", null);
        }
        return log;
    }

    private RequestLog createFailLog(String traceId, Long workspaceId, String errorCode, String requestSource) {
        RequestLog log = RequestLog.loggingStart(
                UUID.randomUUID(),
                traceId,
                1L,
                workspaceId,
                1L,
                "prefix",
                "/v1/chat",
                "POST",
                "test-prompt",
                false,
                null,
                requestSource);
        log.markFail(
                java.time.LocalDateTime.now(),
                500,
                100,
                errorCode,
                "error message",
                "INTERNAL_ERROR",
                null);
        return log;
    }
}
