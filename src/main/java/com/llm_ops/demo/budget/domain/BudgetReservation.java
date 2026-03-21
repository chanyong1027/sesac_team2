package com.llm_ops.demo.budget.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Getter
@Table(
    name = "budget_reservations",
    uniqueConstraints = @UniqueConstraint(columnNames = {"trace_id", "scope_type", "scope_id"})
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BudgetReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_log_id")
    private UUID requestLogId;

    @Column(name = "trace_id", nullable = false, length = 64)
    private String traceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope_type", nullable = false, length = 32)
    private BudgetScopeType scopeType;

    @Column(name = "scope_id", nullable = false)
    private Long scopeId;

    @Column(name = "year_month", nullable = false)
    private Integer yearMonth;

    @Column(name = "provider", length = 32)
    private String provider;

    @Column(name = "model", length = 128)
    private String model;

    @Column(name = "reserved_cost_usd", nullable = false, precision = 18, scale = 8)
    private BigDecimal reservedCostUsd;

    @Column(name = "settled_cost_usd", precision = 18, scale = 8)
    private BigDecimal settledCostUsd;

    @Column(name = "reserved_input_tokens")
    private Integer reservedInputTokens;

    @Column(name = "reserved_output_tokens")
    private Integer reservedOutputTokens;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private BudgetReservationStatus status;

    @Column(name = "release_reason", length = 64)
    private String releaseReason;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static BudgetReservation reserve(
        UUID requestLogId,
        String traceId,
        BudgetScopeType scopeType,
        Long scopeId,
        Integer yearMonth,
        String provider,
        String model,
        BigDecimal reservedCostUsd,
        Integer reservedInputTokens,
        Integer reservedOutputTokens,
        LocalDateTime expiresAt
    ) {
        BudgetReservation reservation = new BudgetReservation();
        reservation.requestLogId = requestLogId;
        reservation.traceId = traceId;
        reservation.scopeType = scopeType;
        reservation.scopeId = scopeId;
        reservation.yearMonth = yearMonth;
        reservation.provider = provider;
        reservation.model = model;
        reservation.reservedCostUsd = reservedCostUsd != null ? reservedCostUsd : BigDecimal.ZERO;
        reservation.settledCostUsd = null;
        reservation.reservedInputTokens = reservedInputTokens;
        reservation.reservedOutputTokens = reservedOutputTokens;
        reservation.status = BudgetReservationStatus.RESERVED;
        reservation.releaseReason = null;
        reservation.expiresAt = expiresAt;
        return reservation;
    }

    public boolean isReserved() {
        return status == BudgetReservationStatus.RESERVED;
    }

    public void markSettled(BigDecimal settledCostUsd) {
        if (!isReserved()) {
            return;
        }
        this.status = BudgetReservationStatus.SETTLED;
        this.settledCostUsd = settledCostUsd != null ? settledCostUsd : BigDecimal.ZERO;
        this.releaseReason = null;
    }

    public void markReleased(String releaseReason) {
        if (!isReserved()) {
            return;
        }
        this.status = BudgetReservationStatus.RELEASED;
        this.releaseReason = releaseReason;
    }

    public void markExpired() {
        if (!isReserved()) {
            return;
        }
        this.status = BudgetReservationStatus.EXPIRED;
        this.releaseReason = "RESERVATION_EXPIRED";
    }
}
