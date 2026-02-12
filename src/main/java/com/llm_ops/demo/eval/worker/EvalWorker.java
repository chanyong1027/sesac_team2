package com.llm_ops.demo.eval.worker;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.service.EvalExecutionService;
import com.llm_ops.demo.eval.service.EvalRunService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class EvalWorker {

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
                .forEach(run -> evalExecutionService.processRun(run.getId()));
    }
}
