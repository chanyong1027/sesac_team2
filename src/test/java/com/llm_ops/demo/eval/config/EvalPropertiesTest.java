package com.llm_ops.demo.eval.config;

import com.llm_ops.demo.keys.domain.ProviderType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EvalPropertiesTest {

    @Test
    @DisplayName("EvalProperties 기본값이 올바르게 설정된다")
    void evalProperties_기본값_확인() {
        // given & when
        EvalProperties properties = new EvalProperties();

        // then
        assertThat(properties.getRunTimeoutMinutes()).isEqualTo(30L);
        assertThat(properties.getJudge()).isNotNull();
        assertThat(properties.getWorker()).isNotNull();
        assertThat(properties.getRunner()).isNotNull();
    }

    @Test
    @DisplayName("Judge 기본값이 올바르게 설정된다")
    void judge_기본값_확인() {
        // given & when
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
    void worker_기본값_확인() {
        // given & when
        EvalProperties properties = new EvalProperties();
        EvalProperties.Worker worker = properties.getWorker();

        // then
        assertThat(worker.getPollIntervalMs()).isEqualTo(3000L);
        assertThat(worker.getBatchSize()).isEqualTo(3);
    }

    @Test
    @DisplayName("Runner 기본값이 올바르게 설정된다")
    void runner_기본값_확인() {
        // given & when
        EvalProperties properties = new EvalProperties();
        EvalProperties.Runner runner = properties.getRunner();

        // then
        assertThat(runner.getRequestTimeoutMs()).isEqualTo(20000L);
        assertThat(runner.getSameProviderRetryMaxAttempts()).isEqualTo(2);
        assertThat(runner.getSameProviderRetryBackoffMs()).isEqualTo(200L);
    }

    @Test
    @DisplayName("EvalProperties runTimeoutMinutes를 변경할 수 있다")
    void runTimeoutMinutes_변경_가능() {
        // given
        EvalProperties properties = new EvalProperties();

        // when
        properties.setRunTimeoutMinutes(60L);

        // then
        assertThat(properties.getRunTimeoutMinutes()).isEqualTo(60L);
    }

    @Test
    @DisplayName("Judge 설정을 변경할 수 있다")
    void judge_설정_변경_가능() {
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
    void worker_설정_변경_가능() {
        // given
        EvalProperties properties = new EvalProperties();
        EvalProperties.Worker worker = properties.getWorker();

        // when
        worker.setPollIntervalMs(5000L);
        worker.setBatchSize(5);

        // then
        assertThat(worker.getPollIntervalMs()).isEqualTo(5000L);
        assertThat(worker.getBatchSize()).isEqualTo(5);
    }

    @Test
    @DisplayName("Runner 설정을 변경할 수 있다")
    void runner_설정_변경_가능() {
        // given
        EvalProperties properties = new EvalProperties();
        EvalProperties.Runner runner = properties.getRunner();

        // when
        runner.setRequestTimeoutMs(30000L);
        runner.setSameProviderRetryMaxAttempts(3);
        runner.setSameProviderRetryBackoffMs(500L);

        // then
        assertThat(runner.getRequestTimeoutMs()).isEqualTo(30000L);
        assertThat(runner.getSameProviderRetryMaxAttempts()).isEqualTo(3);
        assertThat(runner.getSameProviderRetryBackoffMs()).isEqualTo(500L);
    }
}