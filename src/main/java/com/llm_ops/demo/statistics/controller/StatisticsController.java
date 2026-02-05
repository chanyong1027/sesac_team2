package com.llm_ops.demo.statistics.controller;

import com.llm_ops.demo.organization.service.OrganizationService;
import com.llm_ops.demo.statistics.dto.ModelUsageResponse;
import com.llm_ops.demo.statistics.dto.OverviewResponse;
import com.llm_ops.demo.statistics.dto.PromptUsageResponse;
import com.llm_ops.demo.statistics.dto.TimeseriesResponse;
import com.llm_ops.demo.statistics.service.StatisticsService;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 통계 대시보드 API 컨트롤러
 */
@RestController
@RequestMapping("/api/v1/organizations/{orgId}/stats")
@RequiredArgsConstructor
public class StatisticsController {

    private final StatisticsService statisticsService;
    private final OrganizationService organizationService;

    /**
     * 개요 통계 조회
     * GET /api/v1/organizations/{orgId}/stats/overview
     *
     * @param orgId 조직 ID
     * @param userId 인증된 사용자 ID
     * @param period 기간 (daily, weekly, monthly)
     * @param workspaceId 워크스페이스 필터 (optional)
     * @param from 시작일 (optional, 기본: 30일 전)
     * @param to 종료일 (optional, 기본: 오늘)
     * @return 개요 통계 (요청수, 성공률, 토큰, latency, 비용)
     */
    @GetMapping("/overview")
    public ResponseEntity<OverviewResponse> getOverview(
            @PathVariable Long orgId,
            @AuthenticationPrincipal Long userId,
            @RequestParam String period,
            @RequestParam(required = false) Long workspaceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {

        // 조직 권한 검증
        organizationService.getDetail(orgId, userId);

        OverviewResponse response = statisticsService.getOverview(orgId, workspaceId, period, from, to);
        return ResponseEntity.ok(response);
    }

    /**
     * 시계열 데이터 조회
     * GET /api/v1/organizations/{orgId}/stats/timeseries
     *
     * @param orgId 조직 ID
     * @param userId 인증된 사용자 ID
     * @param period 기간 (daily, weekly, monthly)
     * @param workspaceId 워크스페이스 필터 (optional)
     * @param from 시작일 (optional, 기본: 30일 전)
     * @param to 종료일 (optional, 기본: 오늘)
     * @return 날짜별 요청, 토큰, 비용
     */
    @GetMapping("/timeseries")
    public ResponseEntity<TimeseriesResponse> getTimeseries(
            @PathVariable Long orgId,
            @AuthenticationPrincipal Long userId,
            @RequestParam String period,
            @RequestParam(required = false) Long workspaceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {

        // 조직 권한 검증
        organizationService.getDetail(orgId, userId);

        TimeseriesResponse response = statisticsService.getTimeseries(orgId, workspaceId, period, from, to);
        return ResponseEntity.ok(response);
    }

    /**
     * 모델별 사용량 조회
     * GET /api/v1/organizations/{orgId}/stats/by-model
     *
     * @param orgId 조직 ID
     * @param userId 인증된 사용자 ID
     * @param workspaceId 워크스페이스 필터 (optional)
     * @param from 시작일 (optional, 기본: 30일 전)
     * @param to 종료일 (optional, 기본: 오늘)
     * @return 모델별 요청, 토큰, 비용, 비율
     */
    @GetMapping("/by-model")
    public ResponseEntity<ModelUsageResponse> getByModel(
            @PathVariable Long orgId,
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Long workspaceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {

        // 조직 권한 검증
        organizationService.getDetail(orgId, userId);

        ModelUsageResponse response = statisticsService.getByModel(orgId, workspaceId, from, to);
        return ResponseEntity.ok(response);
    }

    /**
     * 프롬프트별 사용량 조회
     * GET /api/v1/organizations/{orgId}/stats/by-prompt
     *
     * @param orgId 조직 ID
     * @param userId 인증된 사용자 ID
     * @param workspaceId 워크스페이스 필터 (optional)
     * @param from 시작일 (optional, 기본: 30일 전)
     * @param to 종료일 (optional, 기본: 오늘)
     * @return 프롬프트별 요청, 토큰, 비용
     */
    @GetMapping("/by-prompt")
    public ResponseEntity<PromptUsageResponse> getByPrompt(
            @PathVariable Long orgId,
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) Long workspaceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {

        // 조직 권한 검증
        organizationService.getDetail(orgId, userId);

        PromptUsageResponse response = statisticsService.getByPrompt(orgId, workspaceId, from, to);
        return ResponseEntity.ok(response);
    }
}
