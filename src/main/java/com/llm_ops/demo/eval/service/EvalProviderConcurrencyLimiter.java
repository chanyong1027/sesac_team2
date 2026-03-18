package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.Semaphore;
import org.springframework.stereotype.Component;

@Component
public class EvalProviderConcurrencyLimiter {

    private final Map<ProviderType, Semaphore> permits = new EnumMap<>(ProviderType.class);

    public EvalProviderConcurrencyLimiter(EvalProperties evalProperties) {
        EvalProperties.ProviderLimits providerLimits = evalProperties.getRunner().getProviderLimits();
        permits.put(ProviderType.OPENAI, new Semaphore(Math.max(1, providerLimits.getOpenaiMaxConcurrentCalls()), true));
        permits.put(ProviderType.ANTHROPIC, new Semaphore(Math.max(1, providerLimits.getAnthropicMaxConcurrentCalls()), true));
        permits.put(ProviderType.GEMINI, new Semaphore(Math.max(1, providerLimits.getGeminiMaxConcurrentCalls()), true));
    }

    public Permit acquire(ProviderType providerType) {
        Semaphore semaphore = permits.get(providerType);
        if (semaphore == null) {
            return Permit.NOOP;
        }
        try {
            semaphore.acquire();
            return () -> semaphore.release();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BusinessException(
                    ErrorCode.INTERNAL_SERVER_ERROR,
                    providerType.name() + " provider 동시성 대기 중 인터럽트되었습니다."
            );
        }
    }

    @FunctionalInterface
    public interface Permit extends AutoCloseable {
        Permit NOOP = () -> {
        };

        @Override
        void close();
    }
}
