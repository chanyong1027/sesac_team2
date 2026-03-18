package com.llm_ops.demo.eval.config;

import com.llm_ops.demo.keys.domain.ProviderType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "eval")
@Validated
@Getter
@Setter
public class EvalProperties {

    @Positive
    private long runTimeoutMinutes = 30L;

    @Valid
    private Judge judge = new Judge();

    @Valid
    private Worker worker = new Worker();

    @Valid
    private Execution execution = new Execution();

    @Valid
    private Runner runner = new Runner();

    public long getRunTimeoutMinutes() {
        return runTimeoutMinutes;
    }

    public void setRunTimeoutMinutes(long runTimeoutMinutes) {
        this.runTimeoutMinutes = runTimeoutMinutes;
    }


    public Judge getJudge() {
        return judge;
    }

    public Worker getWorker() {
        return worker;
    }

    public Runner getRunner() {
        return runner;
    }

    public Execution getExecution() {
        return execution;
    }

    public static class Judge {
        @NotNull
        private ProviderType provider = ProviderType.OPENAI;

        @NotBlank
        private String model = "gpt-4.1-mini";

        @NotNull
        private Double temperature = 0.0;
        private boolean rejudgeOnFail = true;

        @Positive
        private int maxAttempts = 2;

        public ProviderType getProvider() {
            return provider;
        }

        public String getModel() {
            return model;
        }

        public Double getTemperature() {
            return temperature;
        }

        public boolean isRejudgeOnFail() {
            return rejudgeOnFail;
        }

        public int getMaxAttempts() {
            return maxAttempts;
        }

        public void setRejudgeOnFail(boolean rejudgeOnFail) {
            this.rejudgeOnFail = rejudgeOnFail;
        }

        public void setMaxAttempts(int maxAttempts) {
            this.maxAttempts = maxAttempts;
        }

        public void setProvider(ProviderType provider) {
            this.provider = provider;
        }

        public void setModel(String model) {
            this.model = model;
        }

        public void setTemperature(Double temperature) {
            this.temperature = temperature;
        }
    }

    @Getter
    @Setter
    public static class Worker {
        @Positive
        private long pollIntervalMs = 3000L;

        @Positive
        private int batchSize = 3;

        @Positive
        private int maxConcurrentRuns = 3;

        @Positive
        private int claimBatchSize = 3;

        @Positive
        private long claimLeaseSeconds = 30L;

        @Positive
        private long runLeaseSeconds = 900L;
    }

    @Getter
    @Setter
    public static class Execution {
        @Positive
        private int maxConcurrentCasesPerRun = 3;

        @Positive
        private int maxActiveCasesGlobal = 9;

        @Positive
        private int maxCaseQueueCapacity = 24;
    }

    @Getter
    @Setter
    public static class Runner {
        @Positive
        private long requestTimeoutMs = 20000L;

        @PositiveOrZero
        private int sameProviderRetryMaxAttempts = 1;

        @PositiveOrZero
        private long sameProviderRetryBackoffMs = 200L;

        @Valid
        private ProviderLimits providerLimits = new ProviderLimits();
    }

    @Getter
    @Setter
    public static class ProviderLimits {
        @Positive
        private int openaiMaxConcurrentCalls = 6;

        @Positive
        private int anthropicMaxConcurrentCalls = 3;

        @Positive
        private int geminiMaxConcurrentCalls = 3;
    }
}
