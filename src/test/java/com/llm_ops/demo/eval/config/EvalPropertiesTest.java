package com.llm_ops.demo.eval.config;

import com.llm_ops.demo.keys.domain.ProviderType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EvalPropertiesTest {

    @Test
    @DisplayName("EvalProperties 기본 객체를 생성한다")
    void evalProperties_기본_객체를_생성한다() {
        // given

        // when
        EvalProperties properties = new EvalProperties();

        // then
        assertThat(properties.getJudge()).isNotNull();
        assertThat(properties.getWorker()).isNotNull();
        assertThat(properties.getExecution()).isNotNull();
        assertThat(properties.getRunner()).isNotNull();
    }

    @Test
    @DisplayName("Judge 기본값이 올바르게 설정된다")
    void judge_기본값을_확인한다() {
        // given

        // when
        EvalProperties properties = new EvalProperties();
        EvalProperties.Judge judge = properties.getJudge();

        // then
        assertThat(judge.getProvider()).isEqualTo(ProviderType.OPENAI);
        assertThat(judge.getModel()).isEqualTo("gpt-4.1-mini");
        assertThat(judge.getTemperature()).isEqualTo(0.0);
        assertThat(judge.isRejudgeOnFail()).isTrue();
        assertThat(judge.getMaxAttempts()).isEqualTo(2);
    }

    @Test
    @DisplayName("Worker 기본값이 올바르게 설정된다")
    void worker_기본값을_확인한다() {
        // given

        // when
        EvalProperties properties = new EvalProperties();
        EvalProperties.Worker worker = properties.getWorker();

        // then
        assertThat(worker.getPollIntervalMs()).isEqualTo(3000L);
        assertThat(worker.getBatchSize()).isEqualTo(3);
        assertThat(worker.getMaxConcurrentRuns()).isEqualTo(2);
        assertThat(worker.getClaimBatchSize()).isEqualTo(2);
        assertThat(worker.getClaimLeaseSeconds()).isEqualTo(30L);
        assertThat(worker.getRunLeaseSeconds()).isEqualTo(900L);
    }

    @Test
    @DisplayName("Execution 기본값이 올바르게 설정된다")
    void execution_기본값을_확인한다() {
        // given

        // when
        EvalProperties properties = new EvalProperties();
        EvalProperties.Execution execution = properties.getExecution();

        // then
        assertThat(execution.getMaxConcurrentCasesPerRun()).isEqualTo(2);
        assertThat(execution.getMaxActiveCasesGlobal()).isEqualTo(6);
        assertThat(execution.getMaxCaseQueueCapacity()).isEqualTo(24);
    }

    @Test
    @DisplayName("Runner 기본값이 올바르게 설정된다")
    void runner_기본값을_확인한다() {
        // given

        // when
        EvalProperties properties = new EvalProperties();
        EvalProperties.Runner runner = properties.getRunner();

        // then
        assertThat(runner.getRequestTimeoutMs()).isEqualTo(20000L);
        assertThat(runner.getProviderLimits().getOpenaiMaxConcurrentCalls()).isEqualTo(4);
        assertThat(runner.getProviderLimits().getAnthropicMaxConcurrentCalls()).isEqualTo(3);
        assertThat(runner.getProviderLimits().getGeminiMaxConcurrentCalls()).isEqualTo(3);
    }

    @Test
    @DisplayName("Judge 설정을 변경할 수 있다")
    void judge_설정을_변경한다() {
        // given
        EvalProperties properties = new EvalProperties();
        EvalProperties.Judge judge = properties.getJudge();

        // when
        judge.setProvider(ProviderType.ANTHROPIC);
        judge.setModel("claude-3-5-sonnet-20241022");
        judge.setTemperature(0.5);
        judge.setRejudgeOnFail(false);
        judge.setMaxAttempts(3);

        // then
        assertThat(judge.getProvider()).isEqualTo(ProviderType.ANTHROPIC);
        assertThat(judge.getModel()).isEqualTo("claude-3-5-sonnet-20241022");
        assertThat(judge.getTemperature()).isEqualTo(0.5);
        assertThat(judge.isRejudgeOnFail()).isFalse();
        assertThat(judge.getMaxAttempts()).isEqualTo(3);
    }

    @Test
    @DisplayName("Worker 설정을 변경할 수 있다")
    void worker_설정을_변경한다() {
        // given
        EvalProperties properties = new EvalProperties();
        EvalProperties.Worker worker = properties.getWorker();

        // when
        worker.setPollIntervalMs(5000L);
        worker.setBatchSize(5);
        worker.setMaxConcurrentRuns(4);
        worker.setClaimBatchSize(6);
        worker.setClaimLeaseSeconds(45L);
        worker.setRunLeaseSeconds(1200L);

        // then
        assertThat(worker.getPollIntervalMs()).isEqualTo(5000L);
        assertThat(worker.getBatchSize()).isEqualTo(5);
        assertThat(worker.getMaxConcurrentRuns()).isEqualTo(4);
        assertThat(worker.getClaimBatchSize()).isEqualTo(6);
        assertThat(worker.getClaimLeaseSeconds()).isEqualTo(45L);
        assertThat(worker.getRunLeaseSeconds()).isEqualTo(1200L);
    }

    @Test
    @DisplayName("Execution 설정을 변경할 수 있다")
    void execution_설정을_변경한다() {
        // given
        EvalProperties properties = new EvalProperties();
        EvalProperties.Execution execution = properties.getExecution();

        // when
        execution.setMaxConcurrentCasesPerRun(4);
        execution.setMaxActiveCasesGlobal(10);
        execution.setMaxCaseQueueCapacity(40);

        // then
        assertThat(execution.getMaxConcurrentCasesPerRun()).isEqualTo(4);
        assertThat(execution.getMaxActiveCasesGlobal()).isEqualTo(10);
        assertThat(execution.getMaxCaseQueueCapacity()).isEqualTo(40);
    }

    @Test
    @DisplayName("Runner 설정을 변경할 수 있다")
    void runner_설정을_변경한다() {
        // given
        EvalProperties properties = new EvalProperties();
        EvalProperties.Runner runner = properties.getRunner();

        // when
        runner.setRequestTimeoutMs(30000L);
        runner.getProviderLimits().setOpenaiMaxConcurrentCalls(6);
        runner.getProviderLimits().setAnthropicMaxConcurrentCalls(4);
        runner.getProviderLimits().setGeminiMaxConcurrentCalls(5);

        // then
        assertThat(runner.getRequestTimeoutMs()).isEqualTo(30000L);
        assertThat(runner.getProviderLimits().getOpenaiMaxConcurrentCalls()).isEqualTo(6);
        assertThat(runner.getProviderLimits().getAnthropicMaxConcurrentCalls()).isEqualTo(4);
        assertThat(runner.getProviderLimits().getGeminiMaxConcurrentCalls()).isEqualTo(5);
    }
}
