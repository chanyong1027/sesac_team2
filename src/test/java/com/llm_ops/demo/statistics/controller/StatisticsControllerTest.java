package com.llm_ops.demo.statistics.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.organization.service.OrganizationService;
import com.llm_ops.demo.statistics.dto.RagQualityTimeseriesResponse;
import com.llm_ops.demo.statistics.service.StatisticsService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(StatisticsController.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "mock-auth"})
@Import(TestSecurityConfig.class)
class StatisticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StatisticsService statisticsService;

    @MockitoBean
    private OrganizationService organizationService;

    @Test
    @DisplayName("RAG 품질 시계열 API는 period/workspaceId/from/to를 서비스로 전달한다")
    void getRagQualityTimeseriesPassesParams() throws Exception {
        Long orgId = 2L;
        Long userId = 99L;
        Long workspaceId = 2L;
        String period = "daily";
        LocalDateTime from = LocalDateTime.of(2026, 2, 20, 0, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 2, 21, 0, 0, 0);

        RagQualityTimeseriesResponse response = new RagQualityTimeseriesResponse(List.of(
                new RagQualityTimeseriesResponse.RagQualityDataPoint(
                        LocalDate.of(2026, 2, 20),
                        10L,
                        7L,
                        new BigDecimal("0.7000"),
                        new BigDecimal("0.6543"),
                        2L,
                        new BigDecimal("0.2000"),
                        19L,
                        new BigDecimal("81.4"))));

        when(statisticsService.getRagQualityTimeseries(orgId, workspaceId, period, from, to)).thenReturn(response);

        mockMvc.perform(get("/api/v1/organizations/{orgId}/stats/rag-quality/timeseries", orgId)
                .header("X-User-Id", userId)
                .param("period", period)
                .param("workspaceId", String.valueOf(workspaceId))
                .param("from", "2026-02-20T00:00:00")
                .param("to", "2026-02-21T00:00:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].date").value("2026-02-20"))
                .andExpect(jsonPath("$.data[0].ragTotalCount").value(10))
                .andExpect(jsonPath("$.data[0].ragHitCount").value(7));

        verify(organizationService).getDetail(orgId, userId);
        verify(statisticsService).getRagQualityTimeseries(orgId, workspaceId, period, from, to);
    }
}
