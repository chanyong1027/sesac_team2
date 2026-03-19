package com.llm_ops.demo.budget.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class BudgetReservationRecoveryJobTest {

    @Mock
    private BudgetReservationService budgetReservationService;

    @InjectMocks
    private BudgetReservationRecoveryJob budgetReservationRecoveryJob;

    @Test
    @DisplayName("스케줄러가 실행되면 stale reservation 복구를 위임한다")
    void 스케줄러가_실행되면_stale_reservation_복구를_위임한다() {
        // given

        // when
        budgetReservationRecoveryJob.expireStaleReservations();

        // then
        verify(budgetReservationService).expireStaleReservations();
    }
}
