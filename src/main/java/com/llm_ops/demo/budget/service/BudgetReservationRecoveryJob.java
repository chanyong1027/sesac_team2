package com.llm_ops.demo.budget.service;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("!test")
@RequiredArgsConstructor
public class BudgetReservationRecoveryJob {

    private final BudgetReservationService budgetReservationService;

    @Scheduled(fixedDelayString = "${budget.reservation.expire-sweep-fixed-delay-ms:30000}")
    public void expireStaleReservations() {
        budgetReservationService.expireStaleReservations();
    }
}
