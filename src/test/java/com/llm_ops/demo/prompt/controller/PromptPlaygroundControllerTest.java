package com.llm_ops.demo.prompt.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.dto.PlaygroundRunRequest;
import com.llm_ops.demo.prompt.dto.PlaygroundRunResponse;
import com.llm_ops.demo.prompt.dto.PlaygroundRunResponse.PlaygroundUsage;
import com.llm_ops.demo.prompt.dto.PlaygroundSaveVersionRequest;
import com.llm_ops.demo.prompt.dto.PlaygroundSaveVersionResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateResponse;
import com.llm_ops.demo.prompt.service.PromptPlaygroundService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PromptPlaygroundController.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "mock-auth"})
@Import(TestSecurityConfig.class)
class PromptPlaygroundControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private PromptPlaygroundService promptPlaygroundService;

    @Test
    @DisplayName("정상 요청이 주어졌을 때 플레이그라운드 실행하면 200과 응답을 반환한다")
    void 정상_요청이_주어졌을_때_플레이그라운드_실행하면_200과_응답을_반환한다() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PlaygroundRunRequest request = new PlaygroundRunRequest(
                ProviderType.OPENAI,
                "gpt-4o",
                "You are a helpful assistant.",
                "{{question}}",
                false,
                null,
                Map.of("question", "안녕하세요?"),
                null);

        PlaygroundRunResponse response = new PlaygroundRunResponse(
                "trace-123",
                "안녕하세요! 어떻게 도와드릴까요?",
                "gpt-4o-2024-05-13",
                new PlaygroundUsage(100, 50, 150, new BigDecimal("0.001")),
                1200,
                LocalDateTime.now());

        given(promptPlaygroundService.run(eq(promptId), eq(userId), any(PlaygroundRunRequest.class)))
                .willReturn(response);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/playground/run", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.traceId").value("trace-123"))
                .andExpect(jsonPath("$.answer").value("안녕하세요! 어떻게 도와드릴까요?"))
                .andExpect(jsonPath("$.usedModel").value("gpt-4o-2024-05-13"))
                .andExpect(jsonPath("$.usage.inputTokens").value(100))
                .andExpect(jsonPath("$.usage.outputTokens").value(50))
                .andExpect(jsonPath("$.latencyMs").value(1200));
    }

    @Test
    @DisplayName("Provider가 누락되었을 때 실행하면 400을 반환한다")
    void Provider가_누락되었을_때_실행하면_400을_반환한다() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PlaygroundRunRequest request = new PlaygroundRunRequest(
                null,
                "gpt-4o",
                null,
                "{{question}}",
                false,
                null,
                Map.of("question", "테스트"),
                null);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/playground/run", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("모델명이 빈값일 때 실행하면 400을 반환한다")
    void 모델명이_빈값일_때_실행하면_400을_반환한다() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PlaygroundRunRequest request = new PlaygroundRunRequest(
                ProviderType.OPENAI,
                "",
                null,
                "{{question}}",
                false,
                null,
                Map.of("question", "테스트"),
                null);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/playground/run", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("userTemplate이 빈값일 때 실행하면 400을 반환한다")
    void userTemplate이_빈값일_때_실행하면_400을_반환한다() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PlaygroundRunRequest request = new PlaygroundRunRequest(
                ProviderType.OPENAI,
                "gpt-4o",
                null,
                "",
                false,
                null,
                Map.of("question", "테스트"),
                null);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/playground/run", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("배포없이 저장 요청이 주어졌을 때 저장하면 201과 released=false를 반환한다")
    void 배포없이_저장_요청이_주어졌을_때_저장하면_201과_released_false를_반환한다() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PlaygroundSaveVersionRequest request = new PlaygroundSaveVersionRequest(
                "테스트 버전",
                ProviderType.OPENAI,
                "gpt-4o",
                null,
                null,
                "You are a helpful assistant.",
                "{{question}}",
                false,
                null,
                null,
                false);

        PromptVersionCreateResponse versionResponse = new PromptVersionCreateResponse(
                10L, promptId, 3, LocalDateTime.now());
        PlaygroundSaveVersionResponse response = new PlaygroundSaveVersionResponse(versionResponse, false);

        given(promptPlaygroundService.saveAsVersion(eq(promptId), eq(userId), any(PlaygroundSaveVersionRequest.class)))
                .willReturn(response);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/playground/save", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version.id").value(10L))
                .andExpect(jsonPath("$.version.promptId").value(promptId))
                .andExpect(jsonPath("$.version.versionNumber").value(3))
                .andExpect(jsonPath("$.released").value(false));
    }

    @Test
    @DisplayName("즉시배포 저장 요청이 주어졌을 때 저장하면 201과 released=true를 반환한다")
    void 즉시배포_저장_요청이_주어졌을_때_저장하면_201과_released_true를_반환한다() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PlaygroundSaveVersionRequest request = new PlaygroundSaveVersionRequest(
                "테스트 버전",
                ProviderType.OPENAI,
                "gpt-4o",
                null,
                null,
                "You are a helpful assistant.",
                "{{question}}",
                false,
                null,
                null,
                true);

        PromptVersionCreateResponse versionResponse = new PromptVersionCreateResponse(
                10L, promptId, 3, LocalDateTime.now());
        PlaygroundSaveVersionResponse response = new PlaygroundSaveVersionResponse(versionResponse, true);

        given(promptPlaygroundService.saveAsVersion(eq(promptId), eq(userId), any(PlaygroundSaveVersionRequest.class)))
                .willReturn(response);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/playground/save", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version.id").value(10L))
                .andExpect(jsonPath("$.released").value(true));
    }
}
