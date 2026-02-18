package com.llm_ops.demo.auth.service;

import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class EmailCheckRateLimiter {

    private final int maxRequests;
    private final long windowMillis;
    private final ConcurrentHashMap<String, CounterWindow> counters = new ConcurrentHashMap<>();

    public EmailCheckRateLimiter(
            @Value("${auth.email-check.rate-limit.max-requests:20}") int maxRequests,
            @Value("${auth.email-check.rate-limit.window-seconds:60}") long windowSeconds
    ) {
        this.maxRequests = Math.max(1, maxRequests);
        this.windowMillis = Math.max(1L, windowSeconds) * 1000L;
    }

    public boolean tryAcquire(String key) {
        long now = System.currentTimeMillis();
        CounterWindow updated = counters.compute(key, (k, current) -> {
            if (current == null || now - current.windowStartMillis >= windowMillis) {
                return new CounterWindow(now, 1);
            }
            return new CounterWindow(current.windowStartMillis, current.count + 1);
        });
        return updated != null && updated.count <= maxRequests;
    }

    private record CounterWindow(long windowStartMillis, int count) {
    }
}
