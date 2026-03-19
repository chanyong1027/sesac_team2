package com.llm_ops.demo.config;

import org.springframework.ai.chat.prompt.Prompt;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class TestChatModelState {

    private final AtomicReference<Prompt> lastPrompt = new AtomicReference<>();
    private final AtomicInteger callCount = new AtomicInteger();
    private final AtomicReference<CountDownLatch> providerCallStartedLatch = new AtomicReference<>(new CountDownLatch(0));
    private final AtomicReference<CountDownLatch> releaseResponsesLatch = new AtomicReference<>();

    public void record(Prompt prompt) {
        lastPrompt.set(prompt);
        callCount.incrementAndGet();
        providerCallStartedLatch.get().countDown();
    }

    public Prompt getLastPrompt() {
        return lastPrompt.get();
    }

    public int getCallCount() {
        return callCount.get();
    }

    public void prepareBlockingResponse() {
        providerCallStartedLatch.set(new CountDownLatch(1));
        releaseResponsesLatch.set(new CountDownLatch(1));
    }

    public boolean awaitProviderCallStarted(Duration timeout) throws InterruptedException {
        return providerCallStartedLatch.get().await(timeout.toMillis(), TimeUnit.MILLISECONDS);
    }

    public void awaitIfBlocked() {
        CountDownLatch latch = releaseResponsesLatch.get();
        if (latch == null) {
            return;
        }
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("테스트용 ChatModel 대기 중 인터럽트가 발생했습니다.", e);
        }
    }

    public void releaseBlockedResponses() {
        CountDownLatch latch = releaseResponsesLatch.getAndSet(null);
        if (latch != null) {
            latch.countDown();
        }
    }

    public void reset() {
        lastPrompt.set(null);
        callCount.set(0);
        providerCallStartedLatch.set(new CountDownLatch(0));
        releaseBlockedResponses();
    }
}
