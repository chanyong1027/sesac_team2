package com.llm_ops.demo.logs.service;

// TODO: [레거시 코드] 이 파일은 gateway/log/ 패키지로 이전되었습니다.
// 새로운 RequestLogWriter를 사용하세요.
// 추후 삭제 예정입니다.

/*
 * import com.llm_ops.demo.logs.domain.RequestLog;
 * import com.llm_ops.demo.logs.repository.RequestLogRepository;
 * import com.llm_ops.demo.workspace.domain.Workspace;
 * import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
 * import java.math.BigDecimal;
 * import java.util.UUID;
 * import lombok.RequiredArgsConstructor;
 * import lombok.extern.slf4j.Slf4j;
 * import org.springframework.stereotype.Service;
 * import org.springframework.transaction.annotation.Transactional;
 * 
 * @Slf4j
 * 
 * @Service
 * 
 * @RequiredArgsConstructor
 * public class RequestLogSaveService {
 * 
 * private final RequestLogRepository requestLogRepository;
 * private final WorkspaceRepository workspaceRepository;
 * 
 * @Transactional
 * public RequestLog save(
 * UUID traceId,
 * Long workspaceId,
 * Long promptVersionId,
 * Integer totalTokens,
 * BigDecimal estimatedCost,
 * Integer latencyMs,
 * Integer statusCode,
 * String errorCode) {
 * Workspace workspace = workspaceRepository.findById(workspaceId)
 * .orElseThrow(() -> new IllegalArgumentException(
 * "Workspace not found: " + workspaceId));
 * 
 * RequestLog requestLog = RequestLog.builder()
 * .traceId(traceId)
 * .workspace(workspace)
 * .promptVersionId(promptVersionId)
 * .totalTokens(totalTokens)
 * .estimatedCost(estimatedCost)
 * .latencyMs(latencyMs)
 * .statusCode(statusCode)
 * .errorCode(errorCode)
 * .build();
 * 
 * RequestLog saved = requestLogRepository.save(requestLog);
 * log.
 * debug("RequestLog saved: traceId={}, workspaceId={}, tokens={}, latency={}ms"
 * ,
 * traceId, workspaceId, totalTokens, latencyMs);
 * 
 * return saved;
 * }
 * 
 * @Transactional
 * public RequestLog saveSuccess(
 * UUID traceId,
 * Long workspaceId,
 * Long promptVersionId,
 * Integer totalTokens,
 * BigDecimal estimatedCost,
 * Integer latencyMs) {
 * return save(traceId, workspaceId, promptVersionId,
 * totalTokens, estimatedCost, latencyMs, 200, null);
 * }
 * 
 * @Transactional
 * public RequestLog saveFailure(
 * UUID traceId,
 * Long workspaceId,
 * Long promptVersionId,
 * Integer latencyMs,
 * Integer statusCode,
 * String errorCode) {
 * return save(traceId, workspaceId, promptVersionId,
 * 0, BigDecimal.ZERO, latencyMs, statusCode, errorCode);
 * }
 * }
 */
