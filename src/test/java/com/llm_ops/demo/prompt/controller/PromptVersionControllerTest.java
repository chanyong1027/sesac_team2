package com.llm_ops.demo.prompt.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateRequest;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionDetailResponse;
import com.llm_ops.demo.prompt.dto.PromptVersionSummaryResponse;
import com.llm_ops.demo.prompt.service.PromptVersionService;
import java.time.LocalDateTime;
import java.util.List;
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

@WebMvcTest(PromptVersionController.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "mock-auth"})
@Import(TestSecurityConfig.class)
class PromptVersionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private PromptVersionService promptVersionService;

    @Test
    @DisplayName("프롬프트 버전 생성 API 성공")
    void createVersion_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptVersionCreateRequest request = new PromptVersionCreateRequest(
                "버전 1",
                ProviderType.OPENAI,
                "gpt-4",
                "You are a helpful assistant.",
                "{{question}}",
                Map.of("temperature", 0.7)
        );

        PromptVersionCreateResponse response = new PromptVersionCreateResponse(
                1L, promptId, 1, LocalDateTime.now()
        );

        given(promptVersionService.create(eq(promptId), eq(userId), any(PromptVersionCreateRequest.class)))
                .willReturn(response);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/versions", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.promptId").value(promptId))
                .andExpect(jsonPath("$.versionNumber").value(1));
    }

    @Test
    @DisplayName("Provider 누락 시 검증 실패")
    void createVersion_NullProvider_ValidationFails() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptVersionCreateRequest request = new PromptVersionCreateRequest(
                "버전 1",
                null,
                "gpt-4",
                "You are a helpful assistant.",
                "{{question}}",
                null
        );

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/versions", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("모델명 누락 시 검증 실패")
    void createVersion_BlankModel_ValidationFails() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptVersionCreateRequest request = new PromptVersionCreateRequest(
                "버전 1",
                ProviderType.OPENAI,
                "",
                "You are a helpful assistant.",
                "{{question}}",
                null
        );

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/versions", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("제목 길이 초과 시 검증 실패")
    void createVersion_TitleTooLong_ValidationFails() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        String longTitle = "a".repeat(101);
        PromptVersionCreateRequest request = new PromptVersionCreateRequest(
                longTitle,
                ProviderType.OPENAI,
                "gpt-4",
                "You are a helpful assistant.",
                "{{question}}",
                null
        );

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/versions", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("허용되지 않은 모델이면 400 응답")
    void createVersion_InvalidModel_ReturnsBadRequest() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptVersionCreateRequest request = new PromptVersionCreateRequest(
                "버전 1",
                ProviderType.OPENAI,
                "invalid-model",
                "You are a helpful assistant.",
                "{{question}}",
                null
        );

        given(promptVersionService.create(eq(promptId), eq(userId), any(PromptVersionCreateRequest.class)))
                .willThrow(new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "지원하지 않는 모델입니다."));

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/versions", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("프롬프트 버전 상세 조회 API 성공")
    void getVersion_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long versionId = 1L;
        Long userId = 1L;

        PromptVersionDetailResponse response = new PromptVersionDetailResponse(
                versionId, promptId, 1, "버전 1",
                ProviderType.OPENAI, "gpt-4",
                "You are a helpful assistant.",
                "{{question}}",
                Map.of("temperature", 0.7),
                userId, "테스트 유저", LocalDateTime.now()
        );

        given(promptVersionService.getDetail(promptId, versionId, userId)).willReturn(response);

        // when & then
        mockMvc.perform(get("/api/v1/prompts/{promptId}/versions/{versionId}", promptId, versionId)
                        .header("X-User-Id", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(versionId))
                .andExpect(jsonPath("$.promptId").value(promptId))
                .andExpect(jsonPath("$.versionNumber").value(1))
                .andExpect(jsonPath("$.provider").value("OPENAI"))
                .andExpect(jsonPath("$.model").value("gpt-4"))
                .andExpect(jsonPath("$.systemPrompt").value("You are a helpful assistant."));
    }

    @Test
    @DisplayName("프롬프트 버전 목록 조회 API 성공")
    void getVersions_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        List<PromptVersionSummaryResponse> response = List.of(
                new PromptVersionSummaryResponse(2L, 2, "버전 2", ProviderType.OPENAI, "gpt-4", userId, "테스트 유저", LocalDateTime.now()),
                new PromptVersionSummaryResponse(1L, 1, "버전 1", ProviderType.OPENAI, "gpt-3.5-turbo", userId, "테스트 유저", LocalDateTime.now())
        );

        given(promptVersionService.getList(promptId, userId)).willReturn(response);

        // when & then
        mockMvc.perform(get("/api/v1/prompts/{promptId}/versions", promptId)
                        .header("X-User-Id", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].versionNumber").value(2))
                .andExpect(jsonPath("$[1].versionNumber").value(1));
    }

    @Test
    @DisplayName("버전이 없으면 빈 목록 반환")
    void getVersions_Empty_ReturnsEmptyList() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        given(promptVersionService.getList(promptId, userId)).willReturn(List.of());

        // when & then
        mockMvc.perform(get("/api/v1/prompts/{promptId}/versions", promptId)
                        .header("X-User-Id", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
