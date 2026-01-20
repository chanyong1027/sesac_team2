package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.beans.factory.annotation.Autowired;

@SpringBootTest
@ActiveProfiles("test")
class GatewayChatServiceTest {

    @Autowired
    private GatewayChatService gatewayChatService;

    @Autowired
    private OrganizationApiKeyCreateService organizationApiKeyCreateService;

    @Autowired
    private OrganizationApiKeyRepository organizationApiKeyRepository;

    @BeforeEach
    void setUp() {
        organizationApiKeyRepository.deleteAll();
    }

    @Test
    @DisplayName("변수 치환된 프롬프트가 모델 호출에 사용된다")
    void 변수_치환된_프롬프트로_응답을_받는다() {
        // given
        OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        GatewayChatRequest request = new GatewayChatRequest(
                1L,
                "hello {{name}}",
                Map.of("name", "lumina")
        );

        // when
        var chatResponse = gatewayChatService.chat(response.apiKey(), request);

        // then
        assertThat(chatResponse.answer()).isEqualTo("hello lumina");
        assertThat(chatResponse.isFailover()).isFalse();
        assertThat(chatResponse.usage()).isNotNull();
        assertThat(chatResponse.usage().totalTokens()).isEqualTo(0L);
        assertThat(chatResponse.traceId()).isNotBlank();
    }
}
