package com.llm_ops.demo.gateway.controller;

import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.dto.GatewayChatResponse;
import com.llm_ops.demo.gateway.service.GatewayChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 외부 서비스에 LLM 추론 기능을 제공하는 메인 게이트웨이 컨트롤러입니다.
 * X-API-Key 헤더를 통해 인증을 처리합니다.
 */
@RestController
@RequestMapping("/v1/chat")
@RequiredArgsConstructor
public class GatewayChatController {

    private final GatewayChatService gatewayChatService;

    /**
     * 외부 시스템의 LLM 채팅 요청을 처리하는 엔드포인트입니다.
     *
     * @param apiKey  인증을 위한 API 키. {@code X-API-Key} 헤더에서 추출됩니다.
     * @param request 채팅 요청의 상세 정보 (워크스페이스 ID, 프롬프트 키, 변수 등)
     * @return LLM의 답변 및 처리 결과
     */
    @PostMapping("/completions")
    public ResponseEntity<GatewayChatResponse> chat(
            @RequestHeader(name = "X-API-Key", required = false) String apiKey,
            @Valid @RequestBody GatewayChatRequest request
    ) {
        return ResponseEntity.ok(gatewayChatService.chat(apiKey, request));
    }
}
