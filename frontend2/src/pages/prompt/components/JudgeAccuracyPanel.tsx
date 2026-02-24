import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EvalJudgeAccuracyMetricsResponse, EvalJudgeAccuracyRollupResponse } from '@/types/api.types';
import { promptApi } from '@/api/prompt.api';

interface JudgeAccuracyPanelProps {
    workspaceId: number;
    promptId: number;
    runId?: number;
}

export function JudgeAccuracyPanel({ workspaceId, promptId, runId }: JudgeAccuracyPanelProps) {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    // Run-specific metrics
    const { data: runMetrics, isLoading: isLoadingRun } = useQuery<EvalJudgeAccuracyMetricsResponse>({
        queryKey: ['evalRunJudgeAccuracy', workspaceId, promptId, runId],
        queryFn: async () => {
            if (!runId) throw new Error('Run ID required');
            return (await promptApi.getEvalRunJudgeAccuracy(workspaceId, promptId, runId)).data;
        },
        enabled: !!runId,
    });

    // Rollup metrics
    const { data: rollupMetrics, isLoading: isLoadingRollup } = useQuery<EvalJudgeAccuracyRollupResponse>({
        queryKey: ['promptJudgeAccuracyRollup', workspaceId, promptId, from, to],
        queryFn: async () => {
            return (await promptApi.getPromptJudgeAccuracyRollup(workspaceId, promptId, {
                from: from || undefined,
                to: to || undefined,
            })).data;
        },
        enabled: !runId,
    });

    const isLoading = isLoadingRun || (!runId && isLoadingRollup);
    const metrics = runMetrics ?? rollupMetrics;

    if (isLoading) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm">
                로딩 중...
            </div>
        );
    }

    if (!metrics && !rollupMetrics) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm">
                데이터를 불러올 수 없습니다.
            </div>
        );
    }

    const confusionMatrix = metrics ? [
        ['TP (True Positive)', metrics.tp, 'AI가 통과라고 했고 실제로 통과'],
        ['TN (True Negative)', metrics.tn, 'AI가 실패라고 했고 실제로 실패'],
        ['FP (False Positive)', metrics.fp, 'AI가 통과라고 했지만 실제로 실패'],
        ['FN (False Negative)', metrics.fn, 'AI가 실패라고 했지만 실제로 통과'],
    ] : [];

    return (
        <div className="space-y-4">
            {/* Date Range Filter for Rollup */}
            {!runId && (
                <div className="flex gap-4 p-3 bg-black/20 rounded-lg border border-white/10">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">시작일:</span>
                        <input
                            type="datetime-local"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="px-2 py-1 bg-black/30 border border-white/10 rounded text-xs text-white"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">종료일:</span>
                        <input
                            type="datetime-local"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="px-2 py-1 bg-black/30 border border-white/10 rounded text-xs text-white"
                        />
                    </div>
                    <button
                        onClick={() => { setFrom(''); setTo(''); }}
                        className="px-3 py-1 text-xs text-gray-400 hover:text-white"
                    >
                        초기화
                    </button>
                </div>
            )}

            {/* Overview Cards */}
            <div className="grid grid-cols-4 gap-4">
                <MetricCard
                    title="정확도"
                    value={metrics?.accuracy}
                    suffix="%"
                    description="AI 판정의 전반적인 정확성"
                    color="emerald"
                />
                <MetricCard
                    title="재정의율"
                    value={metrics?.overrideRate}
                    suffix="%"
                    description="휴먼 리뷰로 수정된 비율"
                    color="amber"
                />
                <MetricCard
                    title="Precision"
                    value={metrics?.precision}
                    suffix="%"
                    description="통과 예측 중 실제 통과 비율"
                    color="blue"
                />
                <MetricCard
                    title="Recall"
                    value={metrics?.recall}
                    suffix="%"
                    description="실제 통과 중 AI가 통과로 예측한 비율"
                    color="purple"
                />
            </div>

            {/* Confusion Matrix */}
            {metrics && (
                <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                    <h4 className="text-sm font-bold text-white mb-3">혼동 행렬 (Confusion Matrix)</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {confusionMatrix.map(([label, value, desc]) => (
                            <div key={label} className="bg-black/30 rounded-lg p-3">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold text-gray-300">{label}</span>
                                    <span className="text-2xl font-bold text-white">{value}</span>
                                </div>
                                <p className="mt-1 text-[10px] text-gray-500">{desc}</p>
                            </div>
                        ))}
                    </div>                </div>
            )}

            {/* Additional Metrics */}
            {metrics && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-black/20 rounded-xl p-4 border border-white/10 text-center">
                        <div className="text-3xl font-bold text-white">{formatPercent(metrics.f1)}</div>
                        <div className="text-xs text-gray-400">F1 Score</div>
                        <p className="mt-1 text-[10px] text-gray-500">Precision과 Recall의 조화 평균</p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4 border border-white/10 text-center">
                        <div className="text-3xl font-bold text-white">{formatPercent(metrics.specificity)}</div>
                        <div className="text-xs text-gray-400">Specificity</div>
                        <p className="mt-1 text-[10px] text-gray-500">실제 실패 중 AI가 실패로 예측한 비율</p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4 border border-white/10 text-center">
                        <div className="text-3xl font-bold text-white">{formatPercent(metrics.balancedAccuracy)}</div>
                        <div className="text-xs text-gray-400">Balanced Accuracy</div>
                        <p className="mt-1 text-[10px] text-gray-500">Recall과 Specificity의 평균</p>
                    </div>
                </div>
            )}

            {/* Summary Note */}
            {metrics?.note && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200">
                    ℹ️ {metrics.note}
                </div>
            )}

            {/* Reviewed Subset Info */}
            {metrics && (
                <div className="text-xs text-gray-400 text-center">
                    검토된 케이스: {metrics.reviewedCount}개 / 전체: {metrics.totalCases}개
                    {metrics.reviewedCount > 0 && (
                        <span className="ml-2">
                            (정확: {metrics.correctCount}개 / 수정: {metrics.incorrectCount}개)
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

function MetricCard({
    title,
    value,
    suffix,
    description,
    color,
}: {
    title: string;
    value: number | null | undefined;
    suffix: string;
    description: string;
    color: 'emerald' | 'amber' | 'blue' | 'purple';
}) {
    const colorClasses = {
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
    };

    return (
        <div className="bg-black/20 rounded-xl p-4 border border-white/10">
            <div className={`text-3xl font-bold ${colorClasses[color]}`}>
                {value != null ? `${value.toFixed(1)}${suffix}` : '-'}
            </div>
            <div className="text-sm font-bold text-white mt-1">{title}</div>
            <p className="text-[10px] text-gray-500 mt-1">{description}</p>
        </div>
    );
}

function formatPercent(value: number | null): string {
    if (value == null) return '-';
    return `${value.toFixed(1)}%`;
}
