package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.dto.GatewayChatResponse;
import com.llm_ops.demo.gateway.dto.GatewayChatUsage;
import com.llm_ops.demo.keys.service.OrganizationApiKeyAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * 게이트웨이의 핵심 비즈니스 로직을 처리하는 서비스 클래스입니다.
 * API 키 인증, 프롬프트 렌더링, Spring AI를 통한 LLM 호출을 총괄합니다.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnBean(ChatModel.class) // ChatModel Bean이 있어야만 활성화됩니다 (테스트 환경 등에서 제어).
public class GatewayChatService {

    private final OrganizationApiKeyAuthService organizationApiKeyAuthService;
    private final ChatModel chatModel;

    /**
     * 인증된 사용자의 요청을 받아 LLM 응답을 생성하고 반환합니다.
     *
     * @param apiKey  X-API-Key 헤더로 받은 인증용 API 키
     * @param request 게이트웨이 채팅 요청 DTO
     * @return LLM의 답변 및 관련 메타데이터가 포함된 응답 DTO
     */
    @Transactional(readOnly = true)
    public GatewayChatResponse chat(String apiKey, GatewayChatRequest request) {
        // 1. API 키를 인증하여 조직 ID를 확인합니다.
        Long organizationId = organizationApiKeyAuthService.resolveOrganizationId(apiKey);
        // TODO: Validate workspaceId belongs to organizationId once workspace domain is available.

        // 2. 프롬프트 템플릿에 변수를 주입하여 최종 프롬프트를 생성합니다.
        String prompt = renderPrompt(request.promptKey(), request.variables());

        // 3. Spring AI의 ChatModel을 통해 LLM을 호출합니다.
        ChatResponse response = chatModel.call(new Prompt(new UserMessage(prompt)));

        // 4. LLM 응답을 파싱하고 최종 응답 DTO를 구성합니다.
        String answer = response.getResult().getOutput().getText();
        String usedModel = response.getMetadata() != null ? response.getMetadata().getModel() : null;

        String traceId = UUID.randomUUID().toString();
        return new GatewayChatResponse(
                traceId,
                answer,
                false, // TODO: Failover 로직 구현 시 동적으로 설정 필요
                usedModel,
                extractUsage(response)
        );
    }

    /**
     * 프롬프트 키(템플릿)와 변수 맵을 사용하여 최종 프롬프트 문자열을 생성(렌더링)합니다.
     */
    private String renderPrompt(String promptKey, Map<String, String> variables) {
        if (variables == null || variables.isEmpty()) {
            return promptKey;
        }

        String rendered = promptKey;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            String placeholder = "{{" + entry.getKey() + "}}";
            rendered = rendered.replace(placeholder, entry.getValue());
        }
        return rendered;
    }

    /**
     * Spring AI의 ChatResponse 메타데이터에서 토큰 사용량 정보를 추출합니다.
     */
    private GatewayChatUsage extractUsage(ChatResponse response) {
        if (response.getMetadata() == null || response.getMetadata().getUsage() == null) {
            return null;
        }
        Long totalTokens = response.getMetadata().getUsage().getTotalTokens();
        // TODO: Cost calculation logic needs to be implemented.
        return new GatewayChatUsage(totalTokens, null);
    }
}
