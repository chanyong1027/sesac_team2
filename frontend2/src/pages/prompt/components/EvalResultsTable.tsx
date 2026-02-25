import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EvalCaseStatus, EvalHumanReviewVerdict, EvalCaseResultTableRowResponse } from '@/types/api.types';
import { promptApi } from '@/api/prompt.api';

interface EvalResultsTableProps {
    workspaceId: number;
    promptId: number;
    runId: number;
    onRowClick?: (row: EvalCaseResultTableRowResponse) => void;
}

const STATUS_LABELS: Record<EvalCaseStatus, string> = {
    QUEUED: '대기',
    RUNNING: '실행중',
    OK: '완료',
    ERROR: '오류',
    SKIPPED: '걸러짐',
};

const STATUS_COLORS: Record<EvalCaseStatus, string> = {
    QUEUED: 'text-[var(--text-tertiary)]',
    RUNNING: 'text-blue-500 dark:text-blue-400',
    OK: 'text-emerald-500 dark:text-emerald-400',
    ERROR: 'text-rose-500 dark:text-rose-400',
    SKIPPED: 'text-amber-500 dark:text-amber-400',
};

const VERDICT_LABELS: Record<EvalHumanReviewVerdict, string> = {
    CORRECT: '정확',
    INCORRECT: '수정',
    UNREVIEWED: '미검토',
};

const VERDICT_COLORS: Record<EvalHumanReviewVerdict, string> = {
    CORRECT: 'text-emerald-500 dark:text-emerald-400',
    INCORRECT: 'text-amber-500 dark:text-amber-400',
    UNREVIEWED: 'text-[var(--text-secondary)]',
};

export function EvalResultsTable({ workspaceId, promptId, runId, onRowClick }: EvalResultsTableProps) {
    const [page, setPage] = useState(0);
    const [filters, setFilters] = useState<{
        status?: EvalCaseStatus;
        pass?: boolean;
        reviewVerdict?: EvalHumanReviewVerdict;
        overridden?: boolean;
    }>({});

    const pageSize = 20;

    const { data, isLoading } = useQuery({
        queryKey: ['evalRunCasesTable', workspaceId, promptId, runId, page, filters],
        queryFn: async () => {
            return (await promptApi.getEvalRunCasesTable(workspaceId, promptId, runId, {
                page,
                size: pageSize,
                ...filters,
            })).data;
        },
    });

    const rows = data?.content || [];
    const totalPages = data?.totalPages || 0;
    const totalElements = data?.totalElements || 0;

    const FilterSelect = ({
        label,
        value,
        onChange,
        options,
    }: {
        label: string;
        value: string | undefined;
        onChange: (value: string | undefined) => void;
        options: Array<{ value: string; label: string }>;
    }) => (
        <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">{label}:</span>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || undefined)}
                className="px-2 py-1 bg-[var(--input)] border border-[var(--border)] rounded text-xs text-[var(--foreground)] focus:outline-none focus:border-purple-500"
            >
                <option value="">전체</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 p-3 bg-[var(--surface-subtle)] rounded-lg border border-[var(--border)]">
                <FilterSelect
                    label="상태"
                    value={filters.status}
                    onChange={(v) => setFilters((f) => ({ ...f, status: v as EvalCaseStatus }))}
                    options={[
                        { value: 'QUEUED', label: '대기' },
                        { value: 'RUNNING', label: '실행중' },
                        { value: 'OK', label: '완료' },
                        { value: 'ERROR', label: '오류' },
                        { value: 'SKIPPED', label: '걸러짐' },
                    ]}
                />
                <FilterSelect
                    label="AI 판정"
                    value={filters.pass !== undefined ? String(filters.pass) : undefined}
                    onChange={(v) => setFilters((f) => ({ ...f, pass: v ? v === 'true' : undefined }))}
                    options={[
                        { value: 'true', label: '통과' },
                        { value: 'false', label: '실패' },
                    ]}
                />
                <FilterSelect
                    label="휴먼 리뷰"
                    value={filters.reviewVerdict}
                    onChange={(v) => setFilters((f) => ({ ...f, reviewVerdict: v as EvalHumanReviewVerdict }))}
                    options={[
                        { value: 'CORRECT', label: '정확' },
                        { value: 'INCORRECT', label: '수정' },
                        { value: 'UNREVIEWED', label: '미검토' },
                    ]}
                />
                <FilterSelect
                    label="재정의"
                    value={filters.overridden !== undefined ? String(filters.overridden) : undefined}
                    onChange={(v) => setFilters((f) => ({ ...f, overridden: v ? v === 'true' : undefined }))}
                    options={[
                        { value: 'true', label: '수정됨' },
                        { value: 'false', label: '원본' },
                    ]}
                />
                <button
                    onClick={() => { setFilters({}); setPage(0); }}
                    className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                >
                    필터 초기화
                </button>
            </div>

            {/* Table */}
            <div className="bg-[var(--background-card)] rounded-lg border border-[var(--border)] overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                    <thead className="bg-[var(--surface-subtle)]">
                        <tr>
                            <th className="px-3 py-2 text-left text-[var(--text-secondary)] font-bold">ID</th>
                            <th className="px-3 py-2 text-left text-[var(--text-secondary)] font-bold">상태</th>
                            <th className="px-3 py-2 text-left text-[var(--text-secondary)] font-bold">점수</th>
                            <th className="px-3 py-2 text-left text-[var(--text-secondary)] font-bold">AI 판정</th>
                            <th className="px-3 py-2 text-left text-[var(--text-secondary)] font-bold">최종</th>
                            <th className="px-3 py-2 text-left text-[var(--text-secondary)] font-bold">휴먼 리뷰</th>
                            <th className="px-3 py-2 text-left text-[var(--text-secondary)] font-bold">라벨</th>
                            <th className="px-3 py-2 text-left text-[var(--text-secondary)] font-bold">소요시간</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="px-3 py-8 text-center text-[var(--text-secondary)]">
                                    로딩 중...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-3 py-8 text-center text-[var(--text-secondary)]">
                                    결과가 없습니다.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr
                                    key={row.id}
                                    onClick={() => onRowClick?.(row)}
                                    className={`border-t border-[var(--border)] hover:bg-[var(--hover)] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                                >
                                    <td className="px-3 py-2 text-[var(--foreground)]">#{row.id}</td>
                                    <td className="px-3 py-2">
                                        <span className={STATUS_COLORS[row.status]}>
                                            {STATUS_LABELS[row.status]}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-[var(--foreground)]">
                                        {row.overallScore?.toFixed(2) || '-'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={row.pass ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}>
                                            {row.pass ? '통과' : '실패'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.effectivePass !== row.pass ? (
                                            <span className={row.effectivePass ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-rose-500 dark:text-rose-400 font-bold'}>
                                                {row.effectivePass ? '✓ 통과' : '✗ 실패'}
                                            </span>
                                        ) : (
                                            <span className="text-[var(--text-tertiary)]">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={VERDICT_COLORS[row.humanReviewVerdict]}>
                                            {VERDICT_LABELS[row.humanReviewVerdict]}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-wrap gap-1">
                                            {row.labels?.slice(0, 3).map((label, i) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-[var(--input)] border border-[var(--border)] rounded text-[10px] text-[var(--text-secondary)]">
                                                    {label}
                                                </span>
                                            ))}
                                            {(row.labels?.length || 0) > 3 && (
                                                <span className="text-[10px] text-[var(--text-tertiary)]">+{row.labels!.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                                        {row.startedAt && row.completedAt
                                            ? formatDuration(new Date(row.startedAt), new Date(row.completedAt))
                                            : '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <div className="text-xs text-[var(--text-secondary)]">
                        총 {totalElements}개 중 {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalElements)}개
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-3 py-1 text-xs bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] rounded disabled:opacity-50 hover:bg-[var(--hover)]"
                        >
                            이전
                        </button>
                        <span className="px-3 py-1 flex items-center text-xs text-[var(--text-secondary)]">
                            {page + 1} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-3 py-1 text-xs bg-[var(--input)] border border-[var(--border)] text-[var(--foreground)] rounded disabled:opacity-50 hover:bg-[var(--hover)]"
                        >
                            다음
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatDuration(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime();
    if (ms < 1000) return `${ms}ms`;
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${min}m ${remSec}s`;
}
