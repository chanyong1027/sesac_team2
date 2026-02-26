package com.llm_ops.demo.statistics.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.gateway.log.dto.projection.RagQualityTimeseriesProjection;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StatisticsServiceTest {

    @Mock
    private RequestLogRepository requestLogRepository;

    @InjectMocks
    private StatisticsService statisticsService;

    @Test
    @DisplayName("RAG 시계열 daily 조회 시 daily 쿼리를 사용하고 응답을 매핑한다")
    void ragTimeseriesDailyMapsAndUsesDailyQuery() {
        Long organizationId = 2L;
        Long workspaceId = 2L;
        LocalDateTime from = LocalDateTime.of(2026, 2, 20, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 2, 21, 0, 0);

        RagQualityTimeseriesProjection projection = mock(RagQualityTimeseriesProjection.class);
        when(projection.getDate()).thenReturn(LocalDate.of(2026, 2, 20));
        when(projection.getRagTotalCount()).thenReturn(10L);
        when(projection.getRagHitCount()).thenReturn(7L);
        when(projection.getAvgSimilarityThreshold()).thenReturn(new BigDecimal("0.654321"));
        when(projection.getTruncatedCount()).thenReturn(2L);
        when(projection.getTotalChunks()).thenReturn(19L);
        when(projection.getAvgRagLatencyMs()).thenReturn(new BigDecimal("81.44"));

        when(requestLogRepository.getRagQualityTimeseriesDaily(organizationId, workspaceId, from, to))
                .thenReturn(List.of(projection));

        var response = statisticsService.getRagQualityTimeseries(organizationId, workspaceId, "daily", from, to);

        assertThat(response.data()).hasSize(1);
        var point = response.data().get(0);
        assertThat(point.date()).isEqualTo(LocalDate.of(2026, 2, 20));
        assertThat(point.ragTotalCount()).isEqualTo(10L);
        assertThat(point.ragHitCount()).isEqualTo(7L);
        assertThat(point.hitRate()).isEqualByComparingTo("0.7000");
        assertThat(point.avgSimilarityThreshold()).isEqualByComparingTo("0.6543");
        assertThat(point.truncatedCount()).isEqualTo(2L);
        assertThat(point.truncationRate()).isEqualByComparingTo("0.2000");
        assertThat(point.totalChunks()).isEqualTo(19L);
        assertThat(point.avgRagLatencyMs()).isEqualByComparingTo("81.4");

        verify(requestLogRepository).getRagQualityTimeseriesDaily(organizationId, workspaceId, from, to);
        verify(requestLogRepository, never()).getRagQualityTimeseriesWeekly(any(), any(), any(), any());
        verify(requestLogRepository, never()).getRagQualityTimeseriesMonthly(any(), any(), any(), any());
    }

    @Test
    @DisplayName("RAG 시계열 weekly 조회 시 weekly 쿼리를 사용한다")
    void ragTimeseriesWeeklyUsesWeeklyQuery() {
        Long organizationId = 2L;
        Long workspaceId = 2L;
        LocalDateTime from = LocalDateTime.of(2026, 2, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 2, 21, 0, 0);

        when(requestLogRepository.getRagQualityTimeseriesWeekly(organizationId, workspaceId, from, to))
                .thenReturn(List.of());

        var response = statisticsService.getRagQualityTimeseries(organizationId, workspaceId, "weekly", from, to);

        assertThat(response.data()).isEmpty();
        verify(requestLogRepository).getRagQualityTimeseriesWeekly(organizationId, workspaceId, from, to);
        verify(requestLogRepository, never()).getRagQualityTimeseriesDaily(any(), any(), any(), any());
        verify(requestLogRepository, never()).getRagQualityTimeseriesMonthly(any(), any(), any(), any());
    }

    @Test
    @DisplayName("RAG 시계열 monthly 조회 시 monthly 쿼리를 사용한다")
    void ragTimeseriesMonthlyUsesMonthlyQuery() {
        Long organizationId = 2L;
        Long workspaceId = 2L;
        LocalDateTime from = LocalDateTime.of(2025, 11, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2026, 2, 21, 0, 0);

        when(requestLogRepository.getRagQualityTimeseriesMonthly(organizationId, workspaceId, from, to))
                .thenReturn(List.of());

        var response = statisticsService.getRagQualityTimeseries(organizationId, workspaceId, "monthly", from, to);

        assertThat(response.data()).isEmpty();
        verify(requestLogRepository).getRagQualityTimeseriesMonthly(organizationId, workspaceId, from, to);
        verify(requestLogRepository, never()).getRagQualityTimeseriesDaily(any(), any(), any(), any());
        verify(requestLogRepository, never()).getRagQualityTimeseriesWeekly(any(), any(), any(), any());
    }

    @Test
    @DisplayName("period가 null이면 daily 쿼리를 기본 사용한다")
    void ragTimeseriesDefaultsToDailyWhenPeriodIsNull() {
        Long organizationId = 2L;
        Long workspaceId = 2L;

        when(requestLogRepository.getRagQualityTimeseriesDaily(eq(organizationId), eq(workspaceId), any(), any()))
                .thenReturn(List.of());

        var response = statisticsService.getRagQualityTimeseries(organizationId, workspaceId, null, null, null);

        assertThat(response.data()).isEmpty();
        verify(requestLogRepository).getRagQualityTimeseriesDaily(eq(organizationId), eq(workspaceId), any(), any());
        verify(requestLogRepository, never()).getRagQualityTimeseriesWeekly(any(), any(), any(), any());
        verify(requestLogRepository, never()).getRagQualityTimeseriesMonthly(any(), any(), any(), any());
    }
}
