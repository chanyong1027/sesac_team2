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
                "lum_abc123",
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
                12
        ));

        RequestLog saved = requestLogRepository.findById(requestId).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(RequestLogStatus.SUCCESS);
        assertThat(saved.getHttpStatus()).isEqualTo(200);
        assertThat(saved.getLatencyMs()).isEqualTo(123);
        assertThat(saved.getProvider()).isEqualTo("openai");
        assertThat(saved.getTotalTokens()).isEqualTo(12);
        assertThat(saved.getFinishedAt()).isNotNull();
    }

    @Test
    void start_then_markFail_updatesStatusAndErrorFields() {
        UUID requestId = requestLogWriter.start(new RequestLogWriter.StartRequest(
                null,
                "trace-err",
                10L,
                20L,
                30L,
                "lum_abc123",
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
                "UPSTREAM_5XX"
        ));

        RequestLog saved = requestLogRepository.findById(requestId).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(RequestLogStatus.FAIL);
        assertThat(saved.getHttpStatus()).isEqualTo(502);
        assertThat(saved.getErrorCode()).isEqualTo("UPSTREAM_5XX");
        assertThat(saved.getFailReason()).isEqualTo("UPSTREAM_5XX");
        assertThat(saved.getFinishedAt()).isNotNull();
    }
}
