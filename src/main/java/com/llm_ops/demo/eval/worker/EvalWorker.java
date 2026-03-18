package com.llm_ops.demo.eval.worker;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.service.EvalExecutionService;
import com.llm_ops.demo.eval.service.EvalMetrics;
import com.llm_ops.demo.eval.service.EvalRunService;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class EvalWorker {

    private static final Logger log = LoggerFactory.getLogger(EvalWorker.class);

    private final EvalRunService evalRunService;
    private final EvalExecutionService evalExecutionService;
    private final EvalProperties evalProperties;
    private final EvalMetrics evalMetrics;
    private final ThreadPoolExecutor evalRunExecutor;
    private final String leaseOwner = "eval-worker-" + UUID.randomUUID();

    public EvalWorker(
            EvalRunService evalRunService,
            EvalExecutionService evalExecutionService,
            EvalProperties evalProperties,
            EvalMetrics evalMetrics,
            @Qualifier("evalRunExecutor") ThreadPoolExecutor evalRunExecutor
    ) {
        this.evalRunService = evalRunService;
        this.evalExecutionService = evalExecutionService;
        this.evalProperties = evalProperties;
        this.evalMetrics = evalMetrics;
        this.evalRunExecutor = evalRunExecutor;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartupRecovery() {
        long timeoutMinutes = evalProperties.getRunTimeoutMinutes();
        log.info("EvalWorker startup recovery initiated. Timeout: {} minutes", timeoutMinutes);
        try {
            int recovered = evalRunService.recoverStuckRuns(Duration.ofMinutes(timeoutMinutes));
            log.info("EvalWorker startup recovery completed. Recovered {} stuck runs", recovered);
        } catch (Exception e) {
            log.error("EvalWorker startup recovery failed. timeoutMinutes={}", timeoutMinutes, e);
        }
    }

    @Scheduled(fixedDelayString = "${eval.worker.poll-interval-ms:3000}")
    public void pollQueuedRuns() {
        int availableSlots = Math.max(0, evalRunExecutor.getMaximumPoolSize() - evalRunExecutor.getActiveCount());
        if (availableSlots == 0) {
            return;
        }

        Duration claimLeaseDuration = Duration.ofSeconds(Math.max(5L, evalProperties.getWorker().getClaimLeaseSeconds()));
        evalRunService.claimQueuedRuns(availableSlots, leaseOwner, claimLeaseDuration)
                .forEach(run -> {
                    try {
                        evalRunExecutor.submit(() -> {
                            long startNanos = System.nanoTime();
                            try {
                                evalExecutionService.processRun(run.getId());
                            } catch (Exception e) {
                                log.error("Eval run processing failed. runId={}", run.getId(), e);
                            } finally {
                                evalMetrics.recordRunExecution(
                                        run.mode() != null ? run.mode().name() : "unknown",
                                        "WORKER",
                                        System.nanoTime() - startNanos);
                            }
                        });
                    } catch (RejectedExecutionException exception) {
                        log.warn("Eval run executor rejected submission. runId={}", run.getId(), exception);
                        evalRunService.releaseClaimToQueue(run.getId(), leaseOwner);
                    }
                });
    }
}
