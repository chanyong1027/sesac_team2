package com.llm_ops.demo.logs.domain;

import com.llm_ops.demo.workspace.domain.Workspace;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

/**
 * LLM 요청에 대한 로그를 저장하는 엔티티.
 * Gateway에서 LLM 호출 후 토큰 사용량, 비용, 지연시간 등을 기록한다.
 */
@Entity
@Table(name = "request_logs", indexes = {
        // 인덱싱 이유
        // trace_id : trace_id로 조회하는 경우가 많음
        // workspace_id : workspace_id로 조회하는 경우가 많음
        // created_at : created_at으로 조회하는 경우가 많음
        @Index(name = "idx_request_logs_trace_id", columnList = "trace_id"),
        @Index(name = "idx_request_logs_workspace_id", columnList = "workspace_id"),
        @Index(name = "idx_request_logs_created_at", columnList = "created_at")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RequestLog {

    /**
     * 요청 추적을 위한 고유 식별자 (UUID).
     * 분산 환경에서 충돌 없이 생성 가능하며, 시스템 전 구간 추적에 사용된다.
     */
    @Id
    @Column(name = "trace_id", columnDefinition = "uuid", updatable = false, nullable = false)
    // updatable = false : 트랜잭션이 종료되면 변경 불가능
    private UUID traceId;

    /**
     * 요청이 발생한 워크스페이스.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    /**
     * 사용된 프롬프트 버전 ID.
     * PromptVersion 엔티티가 아직 없으므로 ID만 저장 (Loose Coupling).
     */
    @Column(name = "prompt_version_id")
    private Long promptVersionId;

    /**
     * 총 사용된 토큰 수 (입력 + 출력).
     */
    @Column(name = "total_tokens")
    private Integer totalTokens;

    /**
     * 추정 비용 (USD 기준).
     */
    @Column(name = "estimated_cost", precision = 10, scale = 6)
    // precision = 10 : 소수점 포함 총 10자리
    // scale = 6 : 소수점 이하 6자리
    // 부동소수점 오차로 인해 부정확한 double, float 대신 사용
    // 근데 단위 고려해서 precision, scale 수정해야할 듯
    // 우선 API 호출시 예상 비용이 소수점으로 표시되는 것을 가정함
    private BigDecimal estimatedCost;

    /**
     * 요청 처리에 소요된 시간 (밀리초).
     */
    @Column(name = "latency_ms")
    private Integer latencyMs;

    /**
     * HTTP 상태 코드 (200, 500 등).
     */
    // controller와 service에서 커스텀 에러를 사용한다고 판단해서
    // 우선 클로드가 제시해주는 대로 statusCode와 errorCode를 사용했습니다.
    // 혹시 팀 컨벤션으로 정한 ErrorCode enum을 적용해야하는 거라면 리뷰 남겨주시면 감사하겠습니다.
    @Column(name = "status_code")
    private Integer statusCode;

    /**
     * 에러 발생 시 에러 코드.
     */
    @Column(name = "error_code", length = 50)
    private String errorCode;

    /**
     * 로그 생성 시각.
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public RequestLog(UUID traceId, Workspace workspace, Long promptVersionId,
            Integer totalTokens, BigDecimal estimatedCost, Integer latencyMs,
            Integer statusCode, String errorCode) {
        this.traceId = traceId;
        this.workspace = workspace;
        this.promptVersionId = promptVersionId;
        this.totalTokens = totalTokens;
        this.estimatedCost = estimatedCost;
        this.latencyMs = latencyMs;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }
}
