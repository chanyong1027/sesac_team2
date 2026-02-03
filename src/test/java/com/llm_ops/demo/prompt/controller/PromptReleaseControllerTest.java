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
import com.llm_ops.demo.prompt.domain.ChangeType;
import com.llm_ops.demo.prompt.dto.PromptReleaseHistoryResponse;
import com.llm_ops.demo.prompt.dto.PromptReleaseRequest;
import com.llm_ops.demo.prompt.dto.PromptReleaseResponse;
import com.llm_ops.demo.prompt.dto.PromptRollbackRequest;
import com.llm_ops.demo.prompt.service.PromptReleaseService;
import java.time.LocalDateTime;
import java.util.List;
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

@WebMvcTest(PromptReleaseController.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "mock-auth"})
@Import(TestSecurityConfig.class)
class PromptReleaseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private PromptReleaseService promptReleaseService;

    @Test
    @DisplayName("릴리스 API 성공")
    void release_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        Long versionId = 1L;
        PromptReleaseRequest request = new PromptReleaseRequest(versionId, "첫 릴리스");

        PromptReleaseResponse response = new PromptReleaseResponse(
                promptId, versionId, 1, LocalDateTime.now()
        );

        given(promptReleaseService.release(eq(promptId), eq(userId), any(PromptReleaseRequest.class)))
                .willReturn(response);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/release", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.promptId").value(promptId))
                .andExpect(jsonPath("$.activeVersionId").value(versionId))
                .andExpect(jsonPath("$.activeVersionNo").value(1));
    }

    @Test
    @DisplayName("버전 ID 누락 시 검증 실패")
    void release_NullVersionId_ValidationFails() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptReleaseRequest request = new PromptReleaseRequest(null, "릴리스");

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/release", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("사유 길이 초과 시 검증 실패")
    void release_ReasonTooLong_ValidationFails() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        String longReason = "a".repeat(501);
        PromptReleaseRequest request = new PromptReleaseRequest(1L, longReason);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/release", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("히스토리 조회 API 성공")
    void getHistory_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        List<PromptReleaseHistoryResponse> response = List.of(
                new PromptReleaseHistoryResponse(
                        2L, promptId, 1L, 1, 2L, 2,
                        ChangeType.RELEASE, "버전 업데이트", userId, "테스트유저", LocalDateTime.now()
                ),
                new PromptReleaseHistoryResponse(
                        1L, promptId, null, null, 1L, 1,
                        ChangeType.RELEASE, "첫 릴리스", userId, "테스트유저", LocalDateTime.now()
                )
        );

        given(promptReleaseService.getHistory(promptId, userId)).willReturn(response);

        // when & then
        mockMvc.perform(get("/api/v1/prompts/{promptId}/history", promptId)
                        .header("X-User-Id", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].toVersionNo").value(2))
                .andExpect(jsonPath("$[0].changeType").value("RELEASE"))
                .andExpect(jsonPath("$[1].fromVersionId").isEmpty());
    }

    @Test
    @DisplayName("히스토리가 없으면 빈 목록 반환")
    void getHistory_Empty_ReturnsEmptyList() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;

        given(promptReleaseService.getHistory(promptId, userId)).willReturn(List.of());

        // when & then
        mockMvc.perform(get("/api/v1/prompts/{promptId}/history", promptId)
                        .header("X-User-Id", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("롤백 API 성공")
    void rollback_Success() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        Long targetVersionId = 1L;
        PromptRollbackRequest request = new PromptRollbackRequest(targetVersionId, "버그 발견으로 롤백");

        PromptReleaseResponse response = new PromptReleaseResponse(
                promptId, targetVersionId, 1, LocalDateTime.now()
        );

        given(promptReleaseService.rollback(eq(promptId), eq(userId), any(PromptRollbackRequest.class)))
                .willReturn(response);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/rollback", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.promptId").value(promptId))
                .andExpect(jsonPath("$.activeVersionId").value(targetVersionId))
                .andExpect(jsonPath("$.activeVersionNo").value(1));
    }

    @Test
    @DisplayName("롤백 시 버전 ID 누락하면 검증 실패")
    void rollback_NullVersionId_ValidationFails() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        PromptRollbackRequest request = new PromptRollbackRequest(null, "롤백");

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/rollback", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("롤백 시 사유 길이 초과하면 검증 실패")
    void rollback_ReasonTooLong_ValidationFails() throws Exception {
        // given
        Long promptId = 1L;
        Long userId = 1L;
        String longReason = "a".repeat(501);
        PromptRollbackRequest request = new PromptRollbackRequest(1L, longReason);

        // when & then
        mockMvc.perform(post("/api/v1/prompts/{promptId}/rollback", promptId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }
}
