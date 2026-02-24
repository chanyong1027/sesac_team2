import { describe, expect, it } from 'vitest';
import { filterRunTrendPoints, resolveReasonDrivenCaseFilter } from './PromptEvalStudio';

describe('PromptEvalStudio trend helpers', () => {
    it('keeps chronological order after filtering latest window', () => {
        const points = [
            { runId: 3, createdAt: '2026-02-23T12:00:00Z', mode: 'CANDIDATE_ONLY' as const, promptVersionId: 20, passRate: 95, avgOverallScore: 88, errorRate: 0, avgLatencyMs: 950, totalCostUsd: 0.03 },
            { runId: 1, createdAt: '2026-02-23T10:00:00Z', mode: 'CANDIDATE_ONLY' as const, promptVersionId: 10, passRate: 90, avgOverallScore: 80, errorRate: 1, avgLatencyMs: 1000, totalCostUsd: 0.01 },
            { runId: 4, createdAt: '2026-02-23T13:00:00Z', mode: 'CANDIDATE_ONLY' as const, promptVersionId: 20, passRate: 97, avgOverallScore: 90, errorRate: 0, avgLatencyMs: 900, totalCostUsd: 0.04 },
            { runId: 2, createdAt: '2026-02-23T11:00:00Z', mode: 'COMPARE_ACTIVE' as const, promptVersionId: 10, passRate: 80, avgOverallScore: 78, errorRate: 2, avgLatencyMs: 1100, totalCostUsd: 0.02 },
        ];

        const result = filterRunTrendPoints(points, 'ALL', 'ALL', 10);

        expect(result.map((item) => item.runId)).toEqual([1, 2, 3, 4]);
    });

    it('filters by mode and version', () => {
        const points = [
            { runId: 1, createdAt: '2026-02-23T10:00:00Z', mode: 'CANDIDATE_ONLY' as const, promptVersionId: 10, passRate: 90, avgOverallScore: 80, errorRate: 1, avgLatencyMs: 1000, totalCostUsd: 0.01 },
            { runId: 2, createdAt: '2026-02-23T11:00:00Z', mode: 'COMPARE_ACTIVE' as const, promptVersionId: 10, passRate: 80, avgOverallScore: 78, errorRate: 2, avgLatencyMs: 1100, totalCostUsd: 0.02 },
            { runId: 3, createdAt: '2026-02-23T12:00:00Z', mode: 'COMPARE_ACTIVE' as const, promptVersionId: 20, passRate: 85, avgOverallScore: 82, errorRate: 1, avgLatencyMs: 980, totalCostUsd: 0.03 },
        ];

        const result = filterRunTrendPoints(points, 'COMPARE_ACTIVE', 10, 10);

        expect(result).toHaveLength(1);
        expect(result[0].runId).toBe(2);
    });

    it('applies 10-run window limit', () => {
        const points = Array.from({ length: 12 }, (_, index) => ({
            runId: index + 1,
            createdAt: `2026-02-23T${String(index).padStart(2, '0')}:00:00Z`,
            mode: 'CANDIDATE_ONLY' as const,
            promptVersionId: 10,
            passRate: 90,
            avgOverallScore: 80,
            errorRate: 1,
            avgLatencyMs: 1000,
            totalCostUsd: 0.01,
        }));

        const result = filterRunTrendPoints(points, 'ALL', 'ALL', 10);

        expect(result).toHaveLength(10);
        expect(result[0].runId).toBe(3);
        expect(result[9].runId).toBe(12);
    });
});

describe('PromptEvalStudio reason filter helper', () => {
    it('returns FAIL in single mode', () => {
        expect(resolveReasonDrivenCaseFilter('패스율 기준 미달', 'BASELINE', false)).toBe('FAIL');
    });

    it('returns WORSE when regression hint exists', () => {
        expect(resolveReasonDrivenCaseFilter('COMPARE_REGRESSION_DETECTED', 'TIE', true)).toBe('WORSE');
    });

    it('returns FAIL for fail/error hints', () => {
        expect(resolveReasonDrivenCaseFilter('must_include 실패', 'CANDIDATE', true)).toBe('FAIL');
    });
});
