package com.llm_ops.demo.eval.worker;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.service.EvalExecutionService;
import com.llm_ops.demo.eval.service.EvalMetrics;
import com.llm_ops.demo.eval.service.EvalRunService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class EvalWorker {

    private static final Logger log = LoggerFactory.getLogger(EvalWorker.class);

    private final EvalRunService evalRunService;
    private final EvalExecutionService evalExecutionService;
    private final EvalProperties evalProperties;
    private final EvalMetrics evalMetrics;

    public EvalWorker(
            EvalRunService evalRunService,
            EvalExecutionService evalExecutionService,
            EvalProperties evalProperties,
            EvalMetrics evalMetrics
    ) {
        this.evalRunService = evalRunService;
        this.evalExecutionService = evalExecutionService;
        this.evalProperties = evalProperties;
        this.evalMetrics = evalMetrics;
    }

    @Scheduled(fixedDelayString = "${eval.worker.poll-interval-ms:3000}")
    public void pollQueuedRuns() {
        int batchSize = Math.max(1, evalProperties.getWorker().getBatchSize());
        evalRunService.pickQueuedRuns(batchSize)
                .forEach(run -> {
                    long startNanos = System.nanoTime();
                    try {
                        evalExecutionService.processRun(run.getId());
                        evalMetrics.recordRunExecution(
                                run.mode() != null ? run.mode().name() : "unknown",
                                "WORKER",
                                System.nanoTime() - startNanos);
                    } catch (Exception e) {
                        evalMetrics.recordRunExecution(
                                run.mode() != null ? run.mode().name() : "unknown",
                                "WORKER",
                                System.nanoTime() - startNanos);
                        log.error("Eval run processing failed. runId={}", run.getId(), e);
                    }
                });
    }
}
