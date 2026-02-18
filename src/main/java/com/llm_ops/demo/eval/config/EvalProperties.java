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

    private Judge judge = new Judge();
    private Worker worker = new Worker();
    private Runner runner = new Runner();

    @Getter
    @Setter
    public static class Judge {
        private ProviderType provider = ProviderType.OPENAI;
        private String model = "gpt-4.1-mini";
        private Double temperature = 0.0;
        private boolean rejudgeOnFail = true;
        private int maxAttempts = 2;
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
    }
}
