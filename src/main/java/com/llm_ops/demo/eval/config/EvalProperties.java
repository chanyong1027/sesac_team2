package com.llm_ops.demo.eval.config;

import com.llm_ops.demo.keys.domain.ProviderType;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "eval")
@Getter
@Setter
public class EvalProperties {

    private long runTimeoutMinutes = 30L;
    private Judge judge = new Judge();
    private Worker worker = new Worker();
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

    public static class Judge {
        private ProviderType provider = ProviderType.OPENAI;
        private String model = "gpt-4.1-mini";
        private Double temperature = 0.0;
        private boolean rejudgeOnFail = true;
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
        private long pollIntervalMs = 3000L;
        private int batchSize = 3;
    }

    @Getter
    @Setter
    public static class Runner {
        private long requestTimeoutMs = 20000L;
        private int sameProviderRetryMaxAttempts = 1;
        private long sameProviderRetryBackoffMs = 200L;
    }
}
