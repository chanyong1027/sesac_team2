package com.llm_ops.demo.eval.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalCaseResultHumanReviewAudit;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.domain.EvalTestCase;
import com.llm_ops.demo.eval.dto.EvalCaseResultTableListResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultTableRowResponse;
import com.llm_ops.demo.eval.service.EvalCaseResultStatsService;
import com.llm_ops.demo.eval.service.EvalDatasetService;
import com.llm_ops.demo.eval.service.EvalHumanReviewService;
import com.llm_ops.demo.eval.service.EvalJudgeAccuracyMetricsService;
import com.llm_ops.demo.eval.service.EvalRunService;
import com.llm_ops.demo.eval.service.PromptEvalDefaultDraftService;
import com.llm_ops.demo.eval.service.PromptEvalDefaultService;
import java.time.OffsetDateTime;
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

@WebMvcTest(EvalController.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "mock-auth"})
@Import(TestSecurityConfig.class)
class EvalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private EvalDatasetService evalDatasetService;

    @MockitoBean
    private PromptEvalDefaultService promptEvalDefaultService;

    @MockitoBean
    private PromptEvalDefaultDraftService promptEvalDefaultDraftService;

    @MockitoBean
    private EvalRunService evalRunService;

    @MockitoBean
    private EvalHumanReviewService evalHumanReviewService;

    @MockitoBean
    private EvalCaseResultStatsService evalCaseResultStatsService;

    @MockitoBean
    private EvalJudgeAccuracyMetricsService evalJudgeAccuracyMetricsService;

    @Test
    @DisplayName("휴먼리뷰 override 요청이 유효하면 200과 확장 필드를 반환한다")
    void 휴먼리뷰_override_요청이_유효하면_200과_확장_필드를_반환한다() throws Exception {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long caseResultId = 4L;
        Long userId = 9L;

        EvalCaseResult caseResult = org.mockito.Mockito.mock(EvalCaseResult.class);
        OffsetDateTime reviewedAt = OffsetDateTime.parse("2026-02-24T03:10:00+09:00");
        given(caseResult.getId()).willReturn(caseResultId);
        given(caseResult.getEvalRunId()).willReturn(runId);
        given(caseResult.getTestCaseId()).willReturn(11L);
        given(caseResult.status()).willReturn(EvalCaseStatus.OK);
        given(caseResult.getOverallScore()).willReturn(4.7d);
        given(caseResult.getPass()).willReturn(false);
        given(caseResult.getHumanReviewVerdict()).willReturn(EvalHumanReviewVerdict.INCORRECT);
        given(caseResult.getHumanOverridePass()).willReturn(true);
        given(caseResult.getHumanReviewComment()).willReturn("manual fix");
        given(caseResult.getHumanReviewCategory()).willReturn("safety");
        given(caseResult.getHumanReviewedBy()).willReturn(userId);
        given(caseResult.getHumanReviewedAt()).willReturn(reviewedAt);
        given(caseResult.effectivePass()).willReturn(true);

        given(evalHumanReviewService.upsertReview(
                eq(workspaceId),
                eq(promptId),
                eq(runId),
                eq(caseResultId),
                eq(userId),
                eq(EvalHumanReviewVerdict.INCORRECT),
                eq(true),
                eq("manual fix"),
                eq("safety"),
                eq("req-1")
        )).willReturn(caseResult);

        var request = new java.util.LinkedHashMap<String, Object>();
        request.put("verdict", "INCORRECT");
        request.put("overridePass", true);
        request.put("comment", "manual fix");
        request.put("category", "safety");
        request.put("requestId", "req-1");

        // when & then
        mockMvc.perform(put("/api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval/runs/{runId}/cases/{caseResultId}/human-review",
                        workspaceId,
                        promptId,
                        runId,
                        caseResultId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(caseResultId))
                .andExpect(jsonPath("$.humanReviewVerdict").value("INCORRECT"))
                .andExpect(jsonPath("$.humanOverridePass").value(true))
                .andExpect(jsonPath("$.humanReviewCategory").value("safety"))
                .andExpect(jsonPath("$.effectivePass").value(true));
    }

    @Test
    @DisplayName("휴먼리뷰 요청에서 verdict가 없으면 400을 반환한다")
    void 휴먼리뷰_요청에서_verdict가_없으면_400을_반환한다() throws Exception {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long caseResultId = 4L;
        Long userId = 9L;

        // when & then
        mockMvc.perform(put("/api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval/runs/{runId}/cases/{caseResultId}/human-review",
                        workspaceId,
                        promptId,
                        runId,
                        caseResultId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("휴먼리뷰 history 조회 시 최신순 목록을 반환한다")
    void 휴먼리뷰_history_조회시_최신순_목록을_반환한다() throws Exception {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long caseResultId = 4L;
        Long userId = 9L;

        EvalCaseResult caseResult = EvalCaseResult.queue(org.mockito.Mockito.mock(EvalRun.class), org.mockito.Mockito.mock(EvalTestCase.class));
        EvalCaseResultHumanReviewAudit audit = EvalCaseResultHumanReviewAudit.create(
                workspaceId,
                org.mockito.Mockito.mock(EvalRun.class),
                caseResult,
                EvalHumanReviewVerdict.CORRECT,
                null,
                "looks good",
                "quality",
                "req-2",
                userId
        );

        given(evalHumanReviewService.listReviewHistory(workspaceId, promptId, runId, caseResultId, userId))
                .willReturn(List.of(audit));

        // when & then
        mockMvc.perform(get("/api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval/runs/{runId}/cases/{caseResultId}/human-review/history",
                        workspaceId,
                        promptId,
                        runId,
                        caseResultId)
                        .header("X-User-Id", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].verdict").value("CORRECT"))
                .andExpect(jsonPath("$[0].category").value("quality"));
    }

    @Test
    @DisplayName("cases table 조회 시 가벼운 row payload를 반환한다")
    void cases_table_조회시_가벼운_row_payload를_반환한다() throws Exception {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long userId = 9L;

        EvalCaseResultTableRowResponse row = new EvalCaseResultTableRowResponse(
                101L,
                201L,
                EvalCaseStatus.OK,
                4.2d,
                false,
                true,
                EvalHumanReviewVerdict.INCORRECT,
                List.of("format", "safety"),
                "manual override applied",
                null,
                null
        );
        EvalCaseResultTableListResponse response = new EvalCaseResultTableListResponse(List.of(row), 0, 20, 1L, 1);

        given(evalCaseResultStatsService.getCaseTable(
                eq(workspaceId),
                eq(promptId),
                eq(runId),
                eq(userId),
                eq(0),
                eq(20),
                eq(EvalCaseStatus.OK),
                eq(false),
                eq(EvalHumanReviewVerdict.INCORRECT),
                eq(true)
        )).willReturn(response);

        // when & then
        mockMvc.perform(get("/api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval/runs/{runId}/cases:table",
                        workspaceId,
                        promptId,
                        runId)
                        .header("X-User-Id", userId)
                        .param("status", "OK")
                        .param("pass", "false")
                        .param("reviewVerdict", "INCORRECT")
                        .param("overridden", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(101L))
                .andExpect(jsonPath("$.content[0].labels[0]").value("format"))
                .andExpect(jsonPath("$.content[0].effectivePass").value(true));
    }
}
