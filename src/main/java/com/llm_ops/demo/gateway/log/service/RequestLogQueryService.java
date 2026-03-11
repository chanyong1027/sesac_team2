package com.llm_ops.demo.gateway.log.service;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.dto.RequestLogAttemptCollectionMode;
import com.llm_ops.demo.gateway.log.dto.RequestLogAttemptResponse;
import com.llm_ops.demo.gateway.log.dto.RequestLogAttemptTimelineResponse;
import com.llm_ops.demo.gateway.log.dto.RequestLogListResponse;
import com.llm_ops.demo.gateway.log.dto.RequestLogResponse;
import com.llm_ops.demo.gateway.log.dto.RequestLogSearchCondition;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import com.llm_ops.demo.gateway.log.repository.RequestLogSpecification;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그 조회 서비스
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RequestLogQueryService {

    private final RequestLogRepository requestLogRepository;

    /**
     * 단건 조회 - traceId로 조회
     */
    public RequestLogResponse findByTraceId(Long workspaceId, String traceId) {
        RequestLog log = requestLogRepository.findByWorkspaceIdAndTraceId(workspaceId, traceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        return RequestLogResponse.fromDetail(log);
    }

    public RequestLogAttemptTimelineResponse findAttemptTimeline(Long workspaceId, String traceId) {
        RequestLog log = requestLogRepository.findWithAttemptsByWorkspaceIdAndTraceId(workspaceId, traceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (log.getRequestSource() != null && !"GATEWAY".equalsIgnoreCase(log.getRequestSource())) {
            return new RequestLogAttemptTimelineResponse(
                    RequestLogAttemptCollectionMode.DERIVED_SINGLE,
                    List.of(RequestLogAttemptResponse.derivedSingle(log)));
        }

        if (log.getAttempts() == null || log.getAttempts().isEmpty()) {
            return new RequestLogAttemptTimelineResponse(RequestLogAttemptCollectionMode.MISSING, List.of());
        }

        List<RequestLogAttemptResponse> attempts = log.getAttempts().stream()
                .sorted(Comparator.comparingInt(attempt -> attempt.getAttemptNo() != null ? attempt.getAttemptNo() : Integer.MAX_VALUE))
                .map(RequestLogAttemptResponse::from)
                .toList();
        return new RequestLogAttemptTimelineResponse(RequestLogAttemptCollectionMode.RECORDED, attempts);
    }

    /**
     * 목록 조회 - 검색 조건 + 페이징
     */
    public RequestLogListResponse search(Long workspaceId, RequestLogSearchCondition condition, Pageable pageable) {
        RequestLogSearchCondition safeCondition = condition != null ? condition : RequestLogSearchCondition.empty();
        Page<RequestLog> page = requestLogRepository.findAll(
                RequestLogSpecification.searchByCondition(workspaceId, safeCondition),
                pageable);
        Page<RequestLogResponse> responsePage = page.map(RequestLogResponse::fromSummary);
        return RequestLogListResponse.from(responsePage);
    }
}
