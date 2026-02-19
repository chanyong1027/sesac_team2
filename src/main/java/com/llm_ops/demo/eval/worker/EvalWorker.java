package com.llm_ops.demo.eval.worker;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.service.EvalExecutionService;
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

    public EvalWorker(
            EvalRunService evalRunService,
            EvalExecutionService evalExecutionService,
            EvalProperties evalProperties
    ) {
        this.evalRunService = evalRunService;
        this.evalExecutionService = evalExecutionService;
        this.evalProperties = evalProperties;
    }

    @Scheduled(fixedDelayString = "${eval.worker.poll-interval-ms:3000}")
    public void pollQueuedRuns() {
        int batchSize = Math.max(1, evalProperties.getWorker().getBatchSize());
        evalRunService.pickQueuedRuns(batchSize)
                .forEach(run -> {
                    try {
                        evalExecutionService.processRun(run.getId());
                    } catch (Exception e) {
                        log.error("Eval run processing failed. runId={}", run.getId(), e);
                    }
                });
    }
}
