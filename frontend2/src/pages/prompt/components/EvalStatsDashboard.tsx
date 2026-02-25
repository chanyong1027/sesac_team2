import { useQuery } from '@tanstack/react-query';
import type { EvalCaseResultStatsResponse } from '@/types/api.types';
import { promptApi } from '@/api/prompt.api';

interface EvalStatsDashboardProps {
    workspaceId: number;
    promptId: number;
    runId: number;
}

export function EvalStatsDashboard({ workspaceId, promptId, runId }: EvalStatsDashboardProps) {
    const { data: stats, isLoading } = useQuery<EvalCaseResultStatsResponse>({
        queryKey: ['evalRunCasesStats', workspaceId, promptId, runId],
        queryFn: async () => {
            return (await promptApi.getEvalRunCasesStats(workspaceId, promptId, runId)).data;
        },
    });

    if (isLoading) {
        return (
            <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
                로딩 중...
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
                데이터를 불러올 수 없습니다.
            </div>
        );
    }

    const totalCases = stats.okCount + stats.runningCount + stats.errorCount;

    return (
        <div className="space-y-4">
            {/* Status Overview */}
            <div className="grid grid-cols-3 gap-4">
                <StatCard
                    title="완료"
                    value={stats.okCount}
                    total={totalCases}
                    color="emerald"
                    icon="check_circle"
                />
                <StatCard
                    title="실행중"
                    value={stats.runningCount}
                    total={totalCases}
                    color="blue"
                    icon="sync"
                />
                <StatCard
                    title="오류"
                    value={stats.errorCount}
                    total={totalCases}
                    color="rose"
                    icon="error"
                />
            </div>

            {/* Pass/Effective Pass */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--background-card)] rounded-xl p-4 border border-[var(--border)] shadow-sm">
                    <h4 className="text-sm font-bold text-[var(--foreground)] mb-3">AI 판정 결과</h4>
                    <div className="space-y-2">
                        <PassBar
                            label="통과"
                            count={stats.passTrueCount}
                            total={stats.passTrueCount + stats.passFalseCount}
                            color="emerald"
                        />
                        <PassBar
                            label="실패"
                            count={stats.passFalseCount}
                            total={stats.passTrueCount + stats.passFalseCount}
                            color="rose"
                        />
                    </div>
                </div>

                <div className="bg-[var(--background-card)] rounded-xl p-4 border border-[var(--border)] shadow-sm">
                    <h4 className="text-sm font-bold text-[var(--foreground)] mb-3">최종 결과 (재정의 반영)</h4>
                    <div className="space-y-2">
                        <PassBar
                            label="통과"
                            count={stats.effectivePassTrueCount}
                            total={stats.effectivePassTrueCount + stats.effectivePassFalseCount}
                            color="emerald"
                        />
                        <PassBar
                            label="실패"
                            count={stats.effectivePassFalseCount}
                            total={stats.effectivePassTrueCount + stats.effectivePassFalseCount}
                            color="rose"
                        />
                    </div>
                    {stats.effectivePassTrueCount !== stats.passTrueCount && (
                        <p className="mt-2 text-xs text-amber-400">
                            ⚠️ 휴먼 리뷰로 인해 일부 결과가 변경되었습니다.
                        </p>
                    )}
                </div>
            </div>

            {/* Human Review Stats */}
            <div className="bg-[var(--background-card)] rounded-xl p-4 border border-[var(--border)] shadow-sm">
                <h4 className="text-sm font-bold text-[var(--foreground)] mb-3">휴먼 리뷰 현황</h4>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{stats.humanCorrectCount}</div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1">AI 판정 정확함</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{stats.humanIncorrectCount}</div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1">수정 필요</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-[var(--text-tertiary)]">{stats.humanUnreviewedCount}</div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1">미검토</div>
                    </div>
                </div>
                <div className="mt-3 h-2 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-emerald-500"
                        style={{
                            width: `${totalCases > 0 ? (stats.humanCorrectCount / totalCases) * 100 : 0}%`,
                        }}
                    />
                    <div
                        className="h-full bg-amber-500"
                        style={{
                            width: `${totalCases > 0 ? (stats.humanIncorrectCount / totalCases) * 100 : 0}%`,
                        }}
                    />
                </div>
            </div>

            {/* Top Labels */}
            {Object.keys(stats.topLabelCounts).length > 0 && (
                <div className="bg-[var(--background-card)] rounded-xl p-4 border border-[var(--border)] shadow-sm">
                    <h4 className="text-sm font-bold text-[var(--foreground)] mb-3">주요 라벨 분포</h4>
                    <div className="space-y-2">
                        {Object.entries(stats.topLabelCounts)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([label, count]) => (
                                <div key={label} className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-[var(--surface-subtle)] border border-[var(--border)] rounded text-xs text-[var(--text-secondary)]">
                                        {label}
                                    </span>
                                    <div className="flex-1 h-2 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-500"
                                            style={{
                                                width: `${totalCases > 0 ? (count / totalCases) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs text-[var(--text-secondary)] w-10 text-right">
                                        {count}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({
    title,
    value,
    total,
    color,
    icon,
}: {
    title: string;
    value: number;
    total: number;
    color: 'emerald' | 'blue' | 'rose';
    icon: string;
}) {
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    const colorClasses = {
        emerald: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        blue: 'text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/30',
        rose: 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/30',
    };

    return (
        <div className={`rounded-xl p-4 border ${colorClasses[color]}`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-lg">{icon}</span>
                <span className="text-sm font-bold">{title}</span>
            </div>
            <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">{value}</span>
                <span className="text-xs opacity-70 mb-1">{percentage}% ({total}개 중)</span>
            </div>
        </div>
    );
}

function PassBar({
    label,
    count,
    total,
    color,
}: {
    label: string;
    count: number;
    total: number;
    color: 'emerald' | 'rose';
}) {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    const colorClass = color === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500';

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <span className="text-[var(--foreground)]">
                    {count}개 ({percentage}%)
                </span>
            </div>
            <div className="h-2 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-full overflow-hidden">
                <div
                    className={`h-full ${colorClass} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
