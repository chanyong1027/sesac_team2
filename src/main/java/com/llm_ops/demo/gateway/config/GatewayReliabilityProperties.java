package com.llm_ops.demo.gateway.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 게이트웨이 장애 대응(전역 시간예산/재시도/Failover) 관련 설정입니다.
 */
@Component
@ConfigurationProperties(prefix = "gateway.reliability")
@Getter
@Setter
public class GatewayReliabilityProperties {

    private static final long DEFAULT_REQUEST_TIMEOUT_MS = 20_000L;
    private static final long DEFAULT_RETRY_BACKOFF_MS = 200L;
    private static final long DEFAULT_MIN_RETRY_BUDGET_MS = 1_200L;
    private static final long DEFAULT_MIN_FAILOVER_BUDGET_MS = 1_200L;
    private static final int DEFAULT_PROVIDER_CALL_MAX_THREADS = 16;
    private static final int DEFAULT_PROVIDER_CALL_QUEUE_CAPACITY = 256;

    private long requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;
    private long retryBackoffMs = DEFAULT_RETRY_BACKOFF_MS;
    private long minRetryBudgetMs = DEFAULT_MIN_RETRY_BUDGET_MS;
    private long minFailoverBudgetMs = DEFAULT_MIN_FAILOVER_BUDGET_MS;
    private int providerCallMaxThreads = DEFAULT_PROVIDER_CALL_MAX_THREADS;
    private int providerCallQueueCapacity = DEFAULT_PROVIDER_CALL_QUEUE_CAPACITY;

    public long resolvedRequestTimeoutMs() {
        return requestTimeoutMs > 0 ? requestTimeoutMs : DEFAULT_REQUEST_TIMEOUT_MS;
    }

    public long resolvedRetryBackoffMs() {
        return retryBackoffMs >= 0 ? retryBackoffMs : DEFAULT_RETRY_BACKOFF_MS;
    }

    public long resolvedMinRetryBudgetMs() {
        return minRetryBudgetMs > 0 ? minRetryBudgetMs : DEFAULT_MIN_RETRY_BUDGET_MS;
    }

    public long resolvedMinFailoverBudgetMs() {
        return minFailoverBudgetMs > 0 ? minFailoverBudgetMs : DEFAULT_MIN_FAILOVER_BUDGET_MS;
    }

    public int resolvedProviderCallMaxThreads() {
        return providerCallMaxThreads > 0 ? providerCallMaxThreads : DEFAULT_PROVIDER_CALL_MAX_THREADS;
    }

    public int resolvedProviderCallQueueCapacity() {
        return providerCallQueueCapacity > 0 ? providerCallQueueCapacity : DEFAULT_PROVIDER_CALL_QUEUE_CAPACITY;
    }
}
