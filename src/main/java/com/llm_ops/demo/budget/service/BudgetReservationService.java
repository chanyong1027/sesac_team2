package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetReservation;
import com.llm_ops.demo.budget.domain.BudgetReservationStatus;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.repository.BudgetMonthlyUsageRepository;
import com.llm_ops.demo.budget.repository.BudgetReservationRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BudgetReservationService {

    private static final Duration DEFAULT_RESERVATION_TTL = Duration.ofSeconds(70);
    private static final String EXPIRED_REASON = "RESERVATION_EXPIRED";

    private final BudgetMonthlyUsageRepository budgetMonthlyUsageRepository;
    private final BudgetReservationRepository budgetReservationRepository;
    private final BudgetReservationCommandService budgetReservationCommandService;
    private final BudgetReservationMetrics budgetReservationMetrics;
    private final Clock clock = Clock.systemUTC();

    @Transactional
    public Optional<BudgetReservation> reserve(
        UUID requestLogId,
        String traceId,
        BudgetScopeType scopeType,
        Long scopeId,
        YearMonth yearMonth,
        BigDecimal monthLimitUsd,
        BigDecimal reserveAmount,
        String provider,
        String model,
        Integer reservedInputTokens,
        Integer reservedOutputTokens,
        Duration ttl
    ) {
        if (traceId == null || traceId.isBlank() || scopeType == null || scopeId == null || scopeId <= 0 || yearMonth == null) {
            return Optional.empty();
        }
        if (monthLimitUsd == null || monthLimitUsd.signum() <= 0) {
            return Optional.empty();
        }

        BigDecimal normalizedReserveAmount = normalizeUsd(reserveAmount);
        if (normalizedReserveAmount.signum() <= 0) {
            return Optional.empty();
        }

        try {
            return budgetReservationCommandService.reserve(
                requestLogId,
                traceId,
                scopeType,
                scopeId,
                BudgetUsageService.toYearMonthInt(yearMonth),
                monthLimitUsd,
                normalizedReserveAmount,
                provider,
                model,
                reservedInputTokens,
                reservedOutputTokens,
                now().plus(resolveTtl(ttl))
            );
        } catch (DataIntegrityViolationException exception) {
            Optional<BudgetReservation> existingReservation = budgetReservationRepository.findByTraceIdAndScopeTypeAndScopeId(
                traceId,
                scopeType,
                scopeId
            );
            if (existingReservation.isPresent()) {
                return existingReservation;
            }
            throw exception;
        }
    }

    @Transactional
    public void settle(Long reservationId, BigDecimal actualCostUsd, Long totalTokensDelta) {
        BudgetReservation reservation = getReservationOrThrow(reservationId);
        if (!reservation.isReserved()) {
            return;
        }

        BigDecimal normalizedActualCost = normalizeUsd(actualCostUsd);
        long normalizedTokens = totalTokensDelta != null ? Math.max(0L, totalTokensDelta) : 0L;
        int transitioned = budgetReservationRepository.markSettledIfReserved(reservationId, normalizedActualCost);
        if (transitioned <= 0) {
            if (isAlreadyFinalized(reservationId)) {
                return;
            }
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "예산 예약 정산 상태 전이에 실패했습니다.");
        }

        int updated = budgetMonthlyUsageRepository.settleReservation(
            reservation.getScopeType().name(),
            reservation.getScopeId(),
            reservation.getYearMonth(),
            reservation.getReservedCostUsd(),
            normalizedActualCost,
            normalizedTokens,
            1L
        );
        if (updated <= 0) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "예산 예약 정산에 실패했습니다.");
        }
        budgetReservationMetrics.incrementSettle(reservation.getScopeType());
    }

    @Transactional
    public void release(Long reservationId, String releaseReason) {
        BudgetReservation reservation = getReservationOrThrow(reservationId);
        releaseReservation(reservation, releaseReason);
    }

    @Transactional
    public int expireStaleReservations() {
        List<BudgetReservation> staleReservations = budgetReservationRepository
            .findTop100ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(BudgetReservationStatus.RESERVED, now());
        if (staleReservations.isEmpty()) {
            return 0;
        }

        int expiredCount = 0;
        for (BudgetReservation reservation : staleReservations) {
            if (!reservation.isReserved()) {
                continue;
            }
            int transitioned = budgetReservationRepository.markExpiredIfReserved(reservation.getId(), EXPIRED_REASON);
            if (transitioned <= 0) {
                if (isAlreadyFinalized(reservation.getId())) {
                    continue;
                }
                throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "만료된 예산 예약 상태 전이에 실패했습니다.");
            }
            int updated = budgetMonthlyUsageRepository.releaseReservedCost(
                reservation.getScopeType().name(),
                reservation.getScopeId(),
                reservation.getYearMonth(),
                reservation.getReservedCostUsd()
            );
            if (updated <= 0) {
                throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "만료된 예산 예약 복구에 실패했습니다.");
            }
            budgetReservationMetrics.incrementExpired(reservation.getScopeType());
            expiredCount++;
        }
        return expiredCount;
    }

    @Transactional(readOnly = true)
    public Optional<BudgetReservation> findByTraceIdAndScopeTypeAndScopeId(
        String traceId,
        BudgetScopeType scopeType,
        Long scopeId
    ) {
        if (traceId == null || traceId.isBlank() || scopeType == null || scopeId == null || scopeId <= 0) {
            return Optional.empty();
        }
        return budgetReservationRepository.findByTraceIdAndScopeTypeAndScopeId(traceId, scopeType, scopeId);
    }

    private void releaseReservation(BudgetReservation reservation, String releaseReason) {
        if (reservation == null || !reservation.isReserved()) {
            return;
        }

        int transitioned = budgetReservationRepository.markReleasedIfReserved(reservation.getId(), releaseReason);
        if (transitioned <= 0) {
            if (isAlreadyFinalized(reservation.getId())) {
                return;
            }
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "예산 예약 반환 상태 전이에 실패했습니다.");
        }

        int updated = budgetMonthlyUsageRepository.releaseReservedCost(
            reservation.getScopeType().name(),
            reservation.getScopeId(),
            reservation.getYearMonth(),
            reservation.getReservedCostUsd()
        );
        if (updated <= 0) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "예산 예약 반환에 실패했습니다.");
        }
        budgetReservationMetrics.incrementRelease(reservation.getScopeType(), releaseReason);
    }

    private boolean isAlreadyFinalized(Long reservationId) {
        return budgetReservationRepository.findById(reservationId)
            .map(BudgetReservation::getStatus)
            .filter(status -> status == BudgetReservationStatus.SETTLED
                || status == BudgetReservationStatus.RELEASED
                || status == BudgetReservationStatus.EXPIRED)
            .isPresent();
    }

    private BudgetReservation getReservationOrThrow(Long reservationId) {
        if (reservationId == null || reservationId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "reservationId가 올바르지 않습니다.");
        }
        return budgetReservationRepository.findById(reservationId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "예산 예약을 찾을 수 없습니다."));
    }

    private Duration resolveTtl(Duration ttl) {
        if (ttl == null || ttl.isNegative() || ttl.isZero()) {
            return DEFAULT_RESERVATION_TTL;
        }
        return ttl;
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(Instant.now(clock), ZoneOffset.UTC);
    }

    private BigDecimal normalizeUsd(BigDecimal amount) {
        return amount != null ? amount.max(BigDecimal.ZERO) : BigDecimal.ZERO;
    }
}
