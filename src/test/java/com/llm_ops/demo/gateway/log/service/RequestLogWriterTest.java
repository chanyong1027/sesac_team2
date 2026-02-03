package com.llm_ops.demo.gateway.log.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.domain.RequestLogStatus;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@Import(RequestLogWriter.class)
@ActiveProfiles("test")
class RequestLogWriterTest {

    @Autowired
    private RequestLogWriter requestLogWriter;

    @Autowired
    private RequestLogRepository requestLogRepository;

    @Test
    void start_then_markSuccess_updatesStatusAndHttpFields() {
        UUID requestId = requestLogWriter.start(new RequestLogWriter.StartRequest(
                null,
                "trace-123",
                10L,
                20L,
                30L,
                "prefix-123",
                "/v1/chat/completions",
                "POST",
                "prompt-key",
                false
        ));

        requestLogWriter.markSuccess(requestId, new RequestLogWriter.SuccessUpdate(
                200,
                123,
                "openai",
                "gpt-4o-mini",
                "gpt-4o-mini",
                false,
                5,
                7,
                12,
                new java.math.BigDecimal("0.00100000"),
                "USD",
                "test",
                3,
                0.3,
                50,
                2,
                1234,
                true,
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        ));

        RequestLog saved = requestLogRepository.findById(requestId).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(RequestLogStatus.SUCCESS);
        assertThat(saved.getHttpStatus()).isEqualTo(200);
        assertThat(saved.getLatencyMs()).isEqualTo(123);
        assertThat(saved.getProvider()).isEqualTo("openai");
        assertThat(saved.getTotalTokens()).isEqualTo(12);
        assertThat(saved.getFinishedAt()).isNotNull();
        assertThat(saved.getApiKeyId()).isEqualTo(30L);
        assertThat(saved.getApiKeyPrefix()).isEqualTo("prefix-123");
        assertThat(saved.getRagLatencyMs()).isEqualTo(50);
        assertThat(saved.getRagChunksCount()).isEqualTo(2);
        assertThat(saved.getRagContextChars()).isEqualTo(1234);
        assertThat(saved.getRagContextTruncated()).isTrue();
        assertThat(saved.getRagContextHash()).isEqualTo("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    }

    @Test
    void start_then_markFail_updatesStatusAndErrorFields() {
        UUID requestId = requestLogWriter.start(new RequestLogWriter.StartRequest(
                null,
                "trace-err",
                10L,
                20L,
                30L,
                "prefix-err",
                "/v1/chat/completions",
                "POST",
                "prompt-key",
                false
        ));

        requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                502,
                999,
                "openai",
                "gpt-4o-mini",
                "gpt-4o-mini",
                false,
                null,
                null,
                null,
                "UPSTREAM_5XX",
                "bad gateway",
                "UPSTREAM_5XX",
                null,
                null,
                null,
                3,
                0.3,
                77,
                0,
                0,
                false,
                null
        ));

        RequestLog saved = requestLogRepository.findById(requestId).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(RequestLogStatus.FAIL);
        assertThat(saved.getHttpStatus()).isEqualTo(502);
        assertThat(saved.getErrorCode()).isEqualTo("UPSTREAM_5XX");
        assertThat(saved.getFailReason()).isEqualTo("UPSTREAM_5XX");
        assertThat(saved.getFinishedAt()).isNotNull();
        assertThat(saved.getApiKeyId()).isEqualTo(30L);
        assertThat(saved.getApiKeyPrefix()).isEqualTo("prefix-err");
        assertThat(saved.getRagLatencyMs()).isEqualTo(77);
        assertThat(saved.getRagChunksCount()).isEqualTo(0);
        assertThat(saved.getRagContextChars()).isEqualTo(0);
        assertThat(saved.getRagContextTruncated()).isFalse();
        assertThat(saved.getRagContextHash()).isNull();
    }
}
