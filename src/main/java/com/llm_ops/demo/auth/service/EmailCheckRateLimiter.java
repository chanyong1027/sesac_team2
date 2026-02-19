package com.llm_ops.demo.auth.service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class EmailCheckRateLimiter {

    private static final int CLEANUP_INTERVAL = 128;

    private final int maxRequests;
    private final long windowMillis;
    private final ConcurrentHashMap<String, CounterWindow> counters = new ConcurrentHashMap<>();
    private final AtomicInteger requestCounter = new AtomicInteger();

    public EmailCheckRateLimiter(
            @Value("${auth.email-check.rate-limit.max-requests:20}") int maxRequests,
            @Value("${auth.email-check.rate-limit.window-seconds:60}") long windowSeconds
    ) {
        this.maxRequests = Math.max(1, maxRequests);
        this.windowMillis = Math.max(1L, windowSeconds) * 1000L;
    }

    public RateLimitDecision tryAcquire(String key) {
        long now = System.currentTimeMillis();
        evictExpiredIfNeeded(now);

        CounterWindow updated = counters.compute(normalizeKey(key), (k, current) -> {
            if (current == null || now - current.windowStartMillis >= windowMillis) {
                return new CounterWindow(now, 1);
            }
            return new CounterWindow(current.windowStartMillis, current.count + 1);
        });
        if (updated == null || updated.count <= maxRequests) {
            return new RateLimitDecision(true, 0L);
        }
        long remainingMillis = windowMillis - (now - updated.windowStartMillis);
        long retryAfterSeconds = Math.max(1L, (remainingMillis + 999L) / 1000L);
        return new RateLimitDecision(false, retryAfterSeconds);
    }

    public void clear() {
        counters.clear();
    }

    private void evictExpiredIfNeeded(long now) {
        int currentCount = requestCounter.incrementAndGet();
        if (currentCount % CLEANUP_INTERVAL != 0) {
            return;
        }

        counters.entrySet().removeIf(entry -> now - entry.getValue().windowStartMillis >= windowMillis);
    }

    private String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            return "unknown";
        }
        return key.trim();
    }

    public record RateLimitDecision(boolean allowed, long retryAfterSeconds) {
    }

    private record CounterWindow(long windowStartMillis, int count) {
    }
}
