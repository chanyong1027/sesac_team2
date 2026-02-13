package com.llm_ops.demo.gateway.log.service;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.domain.RetrievedDocument;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class RequestLogWriter {

        private final RequestLogRepository requestLogRepository;
        private final Clock clock = Clock.systemUTC();

        public RequestLogWriter(RequestLogRepository requestLogRepository) {
                this.requestLogRepository = requestLogRepository;
        }

        /**
         * 로그 시작을 동기로 저장합니다.
         * requestId를 반환해야 하므로 동기로 유지합니다.
         */
        @Transactional
        public UUID start(StartRequest request) {
                UUID requestId = request.requestId() != null ? request.requestId() : UUID.randomUUID();
                RequestLog requestLog = RequestLog.loggingStart(
                                requestId,
                                request.traceId(),
                                request.organizationId(),
                                request.workspaceId(),
                                request.apiKeyId(),
                                request.apiKeyPrefix(),
                                request.requestPath(),
                                request.httpMethod(),
                                request.promptKey(),
                                request.ragEnabled(),
                                request.requestPayload(),
                                request.requestSource());
                requestLogRepository.save(requestLog);
                return requestId;
        }

        /**
         * 성공 로그를 비동기로 업데이트합니다.
         * API 응답 시간에 영향을 주지 않도록 별도 스레드에서 처리합니다.
         */
        @Async("logExecutor")
        @Transactional
        public void markSuccess(UUID requestId, SuccessUpdate update) {
                try {
                        RequestLog requestLog = requestLogRepository.findById(requestId).orElse(null);
                        if (requestLog == null) {
                                log.error("RequestLog를 찾을 수 없음: requestId={}", requestId);
                                return;
                        }
                        requestLog.fillPromptInfo(update.promptId(), update.promptVersionId());
                        requestLog.fillModelUsage(
                                        update.provider(),
                                        update.requestedModel(),
                                        update.usedModel(),
                                        update.isFailover(),
                                        update.inputTokens(),
                                        update.outputTokens(),
                                        update.totalTokens(),
                                        update.estimatedCost(),
                                        update.pricingVersion());
                        requestLog.fillRagMetrics(
                                        update.ragLatencyMs(),
                                        update.ragChunksCount(),
                                        update.ragContextChars(),
                                        update.ragContextTruncated(),
                                        update.ragContextHash(),
                                        update.ragTopK(),
                                        update.ragSimilarityThreshold());

                        requestLog.markSuccess(LocalDateTime.now(clock), update.httpStatus(), update.latencyMs(),
                                        update.responsePayload());

                        // RetrievedDocument 저장
                        saveRetrievedDocuments(requestLog, update.retrievedDocuments());
                } catch (Exception e) {
                        log.error("로그 성공 기록 실패: requestId={}", requestId, e);
                }
        }

        /**
         * 실패 로그를 비동기로 업데이트합니다.
         * API 응답 시간에 영향을 주지 않도록 별도 스레드에서 처리합니다.
         */
        @Async("logExecutor")
        @Transactional
        public void markFail(UUID requestId, FailUpdate update) {
                try {
                        RequestLog requestLog = requestLogRepository.findById(requestId).orElse(null);
                        if (requestLog == null) {
                                log.error("RequestLog를 찾을 수 없음: requestId={}", requestId);
                                return;
                        }
                        requestLog.fillPromptInfo(update.promptId(), update.promptVersionId());
                        requestLog.fillModelUsage(
                                        update.provider(),
                                        update.requestedModel(),
                                        update.usedModel(),
                                        update.isFailover(),
                                        update.inputTokens(),
                                        update.outputTokens(),
                                        update.totalTokens(),
                                        update.estimatedCost(),
                                        update.pricingVersion());
                        requestLog.fillRagMetrics(
                                        update.ragLatencyMs(),
                                        update.ragChunksCount(),
                                        update.ragContextChars(),
                                        update.ragContextTruncated(),
                                        update.ragContextHash(),
                                        update.ragTopK(),
                                        update.ragSimilarityThreshold());

                        requestLog.markFail(
                                        LocalDateTime.now(clock),
                                        update.httpStatus(),
                                        update.latencyMs(),
                                        update.errorCode(),
                                        update.errorMessage(),
                                        update.failReason(),
                                        update.responsePayload());

                        // RetrievedDocument 저장
                        saveRetrievedDocuments(requestLog, update.retrievedDocuments());
                } catch (Exception e) {
                        log.error("로그 실패 기록 실패: requestId={}", requestId, e);
                }
        }

        /**
         * 차단 로그를 비동기로 업데이트합니다.
         * (예: 예산 초과 등)
         */
        @Async("logExecutor")
        @Transactional
        public void markBlocked(UUID requestId, BlockUpdate update) {
                try {
                        RequestLog requestLog = requestLogRepository.findById(requestId).orElse(null);
                        if (requestLog == null) {
                                log.error("RequestLog를 찾을 수 없음: requestId={}", requestId);
                                return;
                        }
                        requestLog.fillPromptInfo(update.promptId(), update.promptVersionId());
                        requestLog.fillModelUsage(
                                        update.provider(),
                                        update.requestedModel(),
                                        update.usedModel(),
                                        update.isFailover(),
                                        update.inputTokens(),
                                        update.outputTokens(),
                                        update.totalTokens(),
                                        update.estimatedCost(),
                                        update.pricingVersion());
                        requestLog.fillRagMetrics(
                                        update.ragLatencyMs(),
                                        update.ragChunksCount(),
                                        update.ragContextChars(),
                                        update.ragContextTruncated(),
                                        update.ragContextHash(),
                                        update.ragTopK(),
                                        update.ragSimilarityThreshold());

                        requestLog.markBlocked(
                                        LocalDateTime.now(clock),
                                        update.httpStatus(),
                                        update.latencyMs(),
                                        update.errorCode(),
                                        update.errorMessage(),
                                        update.failReason(),
                                        update.responsePayload());
                } catch (Exception e) {
                        log.error("로그 차단 기록 실패: requestId={}", requestId, e);
                }
        }

        /**
         * RAG 검색 결과 문서를 RequestLog에 연결하여 저장합니다.
         */
        private void saveRetrievedDocuments(RequestLog requestLog, List<RetrievedDocumentInfo> documents) {
                if (documents == null || documents.isEmpty()) {
                        return;
                }
                List<RetrievedDocument> entities = documents.stream()
                                .map(info -> RetrievedDocument.create(
                                                requestLog,
                                                info.documentName(),
                                                info.score(),
                                                info.content(),
                                                info.durationMs(),
                                                info.ranking()))
                                .toList();
                requestLog.addRetrievedDocuments(entities);
        }

        // ===== Inner Records =====

        public record StartRequest(
                        UUID requestId,
                        String traceId,
                        Long organizationId,
                        Long workspaceId,
                        Long apiKeyId,
                        String apiKeyPrefix,
                        String requestPath,
                        String httpMethod,
                        String promptKey,
                        boolean ragEnabled,
                        String requestPayload,
                        String requestSource) {
        }

        public record SuccessUpdate(
                        Integer httpStatus,
                        Integer latencyMs,
                        Long promptId,
                        Long promptVersionId,
                        String provider,
                        String requestedModel,
                        String usedModel,
                        boolean isFailover,
                        Integer inputTokens,
                        Integer outputTokens,
                        Integer totalTokens,
                        java.math.BigDecimal estimatedCost,
                        String pricingVersion,
                        Integer ragLatencyMs,
                        Integer ragChunksCount,
                        Integer ragContextChars,
                        Boolean ragContextTruncated,
                        String ragContextHash,
                        Integer ragTopK,
                        Double ragSimilarityThreshold,
                        String responsePayload,
                        List<RetrievedDocumentInfo> retrievedDocuments) {
        }

        public record FailUpdate(
                        Integer httpStatus,
                        Integer latencyMs,
                        Long promptId,
                        Long promptVersionId,
                        String provider,
                        String requestedModel,
                        String usedModel,
                        boolean isFailover,
                        Integer inputTokens,
                        Integer outputTokens,
                        Integer totalTokens,
                        java.math.BigDecimal estimatedCost,
                        String pricingVersion,
                        String errorCode,
                        String errorMessage,
                        String failReason,
                        Integer ragLatencyMs,
                        Integer ragChunksCount,
                        Integer ragContextChars,
                        Boolean ragContextTruncated,
                        String ragContextHash,
                        Integer ragTopK,
                        Double ragSimilarityThreshold,
                        String responsePayload,
                        List<RetrievedDocumentInfo> retrievedDocuments) {
        }

        public record BlockUpdate(
                        Integer httpStatus,
                        Integer latencyMs,
                        Long promptId,
                        Long promptVersionId,
                        String provider,
                        String requestedModel,
                        String usedModel,
                        boolean isFailover,
                        Integer inputTokens,
                        Integer outputTokens,
                        Integer totalTokens,
                        java.math.BigDecimal estimatedCost,
                        String pricingVersion,
                        String errorCode,
                        String errorMessage,
                        String failReason,
                        Integer ragLatencyMs,
                        Integer ragChunksCount,
                        Integer ragContextChars,
                        Boolean ragContextTruncated,
                        String ragContextHash,
                        Integer ragTopK,
                        Double ragSimilarityThreshold,
                        String responsePayload) {
        }

        /**
         * RAG 검색 결과 문서 정보를 전달하기 위한 DTO
         */
        public record RetrievedDocumentInfo(
                        String documentName,
                        Double score,
                        String content,
                        Integer durationMs,
                        Integer ranking) {
        }
}
