import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EvalCaseResultResponse, EvalHumanReviewVerdict } from '@/types/api.types';
import { promptApi } from '@/api/prompt.api';

interface RunCaseContext {
    input?: string;
    contextJson?: Record<string, unknown> | null;
    expectedJson?: Record<string, unknown> | null;
    constraintsJson?: Record<string, unknown> | null;
}

interface CaseDetailPanelProps {
    item: EvalCaseResultResponse;
    inputText?: string;
    caseContext?: RunCaseContext;
    workspaceId: number;
    promptId: number;
    runId: number;
}

// --- Helpers ---
function prettyJson(value: unknown): string {
    if (value == null) return '-';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function extractCompareSummary(judgeOutput: any) {
    return (judgeOutput && typeof judgeOutput === 'object' && judgeOutput.compare) ? judgeOutput.compare : null;
}

function extractFailedChecks(ruleChecks: any): string[] {
    return (ruleChecks && Array.isArray(ruleChecks.failedChecks)) ? ruleChecks.failedChecks : [];
}

function formatRuleName(key: string) {
    const map: Record<string, string> = {
        max_chars: '최대 글자수',
        max_lines: '최대 줄수',
        format: '형식(JSON)',
        required_keys: '필수 키',
        must_include: '필수 포함 단어',
        must_not_include: '금지 단어',
    };
    return map[key] || key;
}

function verdictLabel(verdict: EvalHumanReviewVerdict): string {
    switch (verdict) {
        case 'CORRECT': return '정확함';
        case 'INCORRECT': return '수정 필요';
        case 'UNREVIEWED': return '미검토';
        default: return verdict;
    }
}

function verdictColor(verdict: EvalHumanReviewVerdict): string {
    switch (verdict) {
        case 'CORRECT': return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
        case 'INCORRECT': return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
        case 'UNREVIEWED': return 'text-[var(--text-secondary)] bg-gray-500/10 border-gray-500/30';
        default: return 'text-[var(--text-secondary)]';
    }
}

// --- Component ---
export function CaseDetailPanel({
    item,
    inputText,
    caseContext,
    workspaceId,
    promptId,
    runId,
}: CaseDetailPanelProps) {
    const [activeTab, setActiveTab] = useState<'REPORT' | 'HUMAN_REVIEW' | 'DATA'>('REPORT');
    const queryClient = useQueryClient();

    // Data Extraction
    const caseInput = inputText || caseContext?.input || '입력 데이터 없음';
    const compare = extractCompareSummary(item.judgeOutput);
    const failedChecks = extractFailedChecks(item.ruleChecks);

    // AI Judge Info
    const judge = (item.judgeOutput && typeof item.judgeOutput === 'object' && 'candidate' in item.judgeOutput)
        ? item.judgeOutput.candidate
        : item.judgeOutput;

    const judgeScore = judge?.overallScore ?? null;
    const judgeReason = judge?.reason || (Array.isArray(judge?.evidence) ? judge.evidence[0] : null);

    // Compare Mode Check
    const isCompareMode = !!item.baselineOutput;

    // Status Colors
    const statusColor = item.pass
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300';

    // Human Review State
    const [verdict, setVerdict] = useState<EvalHumanReviewVerdict>(item.humanReviewVerdict || 'UNREVIEWED');
    const [overridePass, setOverridePass] = useState<boolean | null>(item.humanOverridePass);
    const [comment, setComment] = useState(item.humanReviewComment || '');
    const [category, setCategory] = useState(item.humanReviewCategory || '');

    useEffect(() => {
        setVerdict(item.humanReviewVerdict || 'UNREVIEWED');
        setOverridePass(item.humanOverridePass);
        setComment(item.humanReviewComment || '');
        setCategory(item.humanReviewCategory || '');
    }, [
        item.id,
        item.humanReviewVerdict,
        item.humanOverridePass,
        item.humanReviewComment,
        item.humanReviewCategory,
    ]);

    // Fetch review history
    const { data: reviewHistory } = useQuery({
        queryKey: ['humanReviewHistory', workspaceId, promptId, runId, item.id],
        queryFn: async () => {
            return (await promptApi.getHumanReviewHistory(workspaceId, promptId, runId, item.id)).data;
        },
        enabled: activeTab === 'HUMAN_REVIEW',
    });

    // Submit review mutation
    const submitReview = useMutation({
        mutationFn: async () => {
            return promptApi.upsertHumanReview(workspaceId, promptId, runId, item.id, {
                verdict,
                overridePass: verdict === 'INCORRECT' && overridePass !== null ? overridePass : undefined,
                comment: comment || undefined,
                category: category || undefined,
                requestId: `manual-${Date.now()}`,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evalRunCases', workspaceId, promptId, runId] });
            queryClient.invalidateQueries({ queryKey: ['humanReviewHistory', workspaceId, promptId, runId, item.id] });
            alert('검토가 저장되었습니다.');
        },
        onError: (error: Error) => {
            alert(`저장 실패: ${error.message}`);
        },
    });

    const canReview = item.status === 'OK';

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex border-b border-[var(--border)]">
                <button
                    onClick={() => setActiveTab('REPORT')}
                    className={`px-6 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'REPORT' ? 'border-[var(--primary)] text-[var(--foreground)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                >
                    📝 통합 리포트
                </button>
                <button
                    onClick={() => setActiveTab('HUMAN_REVIEW')}
                    className={`px-6 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'HUMAN_REVIEW' ? 'border-purple-500 text-purple-400' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                >
                    👤 휴먼 리뷰 {item.humanReviewVerdict !== 'UNREVIEWED' && '✓'}
                </button>
                <button
                    onClick={() => setActiveTab('DATA')}
                    className={`px-6 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'DATA' ? 'border-amber-500 text-amber-400' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`}
                >
                    💾 원본 데이터
                </button>
            </div>

            {/* Content: Report Tab */}
            {activeTab === 'REPORT' && (
                <div className="flex-1 overflow-y-auto space-y-6 pr-2 animate-in fade-in">

                    {/* 1. Q&A Section */}
                    <div className="space-y-4">
                        {/* User Question */}
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-sm text-[var(--text-secondary)]">person</span>
                            </div>
                            <div className="bg-[var(--muted)] rounded-2xl rounded-tl-none p-4 max-w-[80%] border border-[var(--border)]">
                                <p className="text-xs font-bold text-gray-400 mb-1">사용자 질문 (Input)</p>
                                <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{caseInput}</p>
                            </div>
                        </div>

                        {/* Model Answer (Split or Single) */}
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--primary)]/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-sm text-[var(--primary)]">smart_toy</span>
                            </div>

                            <div className="flex-1 space-y-2">
                                {isCompareMode ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={`p-4 rounded-2xl rounded-tl-none border ${compare?.winner === 'CANDIDATE' ? 'bg-[var(--primary)]/10 border-[var(--primary)]/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-[var(--muted)] border-[var(--border)]'}`}>
                                            <div className="flex justify-between mb-2">
                                                <span className="text-xs font-bold text-[var(--primary)]">이번 버전 (Candidate)</span>
                                                {compare?.winner === 'CANDIDATE' && <span className="text-[10px] bg-[var(--primary)] text-black px-1.5 rounded font-bold">WIN 👑</span>}
                                            </div>
                                            <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{item.candidateOutput}</p>
                                        </div>
                                        <div className={`p-4 rounded-2xl border ${compare?.winner === 'BASELINE' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-[var(--muted)] border-[var(--border)] opacity-70'}`}>
                                            <div className="flex justify-between mb-2">
                                                <span className="text-xs font-bold text-blue-400">운영 버전 (Baseline)</span>
                                                {compare?.winner === 'BASELINE' && <span className="text-[10px] bg-blue-500 text-black px-1.5 rounded font-bold">WIN 🛡️</span>}
                                            </div>
                                            <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{item.baselineOutput}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-2xl rounded-tl-none bg-[var(--muted)] border border-[var(--border)]">
                                        <p className="text-xs font-bold text-gray-400 mb-1">AI 답변</p>
                                        <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">{item.candidateOutput}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-[var(--border)]" />

                    {/* 2. Verdict Section (Reason) */}
                    <div className={`rounded-xl border p-4 ${statusColor}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-lg">
                                {item.pass ? 'check_circle' : 'error'}
                            </span>
                            <h4 className="font-bold text-sm">
                                {item.pass ? '평가 통과 (Passed)' : '평가 실패 (Failed)'}
                            </h4>
                            {judgeScore != null && <span className="text-xs opacity-80">| AI 점수: {judgeScore}점</span>}
                            {item.effectivePass !== item.pass && (
                                <span className={`text-xs px-2 py-0.5 rounded ${item.effectivePass ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'}`}>
                                    최종: {item.effectivePass ? '통과' : '실패'} (수정됨)
                                </span>
                            )}
                        </div>

                        {/* 2-1. Rule Failures */}
                        {failedChecks.length > 0 && (
                            <div className="mb-3 bg-[var(--muted)] rounded p-2 text-xs">
                                <p className="font-bold text-rose-700 dark:text-rose-300 mb-1">🚫 룰 위반 발견:</p>
                                <ul className="list-disc pl-4 space-y-0.5 text-rose-700/80 dark:text-rose-200/80">
                                    {failedChecks.map((check, idx) => (
                                        <li key={idx}>{formatRuleName(check)} 조건 만족 실패</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 2-2. AI Judge Reason */}
                        {judgeReason && (
                            <div className="text-xs opacity-90 leading-relaxed">
                                <span className="font-bold">AI 심사평:</span> "{judgeReason}"
                            </div>
                        )}
                    </div>

                    {/* 3. Collapsible Details (Advanced Info) */}
                    <details className="group rounded-xl border border-[var(--border)] bg-[var(--muted)]">
                        <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--accent)] transition-colors">
                            <span className="text-xs font-bold text-gray-400">🔍 상세 평가 근거 보기 (룰/AI 심사)</span>
                            <span className="material-symbols-outlined text-gray-500 text-sm group-open:rotate-180 transition-transform">expand_more</span>
                        </summary>
                        <div className="p-4 border-t border-[var(--border)] space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Rule Check Detail</p>
                                    <pre className="text-[10px] text-[var(--text-secondary)] bg-[var(--input)] p-2 rounded overflow-auto max-h-40">{prettyJson(item.ruleChecks)}</pre>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">AI Judge Detail</p>
                                    <pre className="text-[10px] text-[var(--text-secondary)] bg-[var(--input)] p-2 rounded overflow-auto max-h-40">{prettyJson(item.judgeOutput)}</pre>
                                </div>
                            </div>
                        </div>
                    </details>

                </div>
            )}

            {/* Content: Human Review Tab */}
            {activeTab === 'HUMAN_REVIEW' && (
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 animate-in fade-in">
                    {!canReview ? (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 text-sm">
                            ⚠️ 검토 불가: 완료된 케이스(OK 상태)만 검토할 수 있습니다.
                        </div>
                    ) : (
                        <>
                            {/* Current Review Status */}
                            <div className={`rounded-xl border p-4 ${verdictColor(item.humanReviewVerdict)}`}>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">
                                        {item.humanReviewVerdict === 'CORRECT' ? 'check_circle' :
                                            item.humanReviewVerdict === 'INCORRECT' ? 'warning' : 'help'}
                                    </span>
                                    <div>
                                        <p className="font-bold text-sm">현재 상태: {verdictLabel(item.humanReviewVerdict)}</p>
                                        {item.humanReviewedAt && (
                                            <p className="text-xs opacity-70">
                                                {new Date(item.humanReviewedAt).toLocaleString('ko-KR')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {item.humanReviewComment && (
                                    <p className="mt-2 text-xs opacity-90">💬 {item.humanReviewComment}</p>
                                )}
                                {item.humanReviewCategory && (
                                    <p className="mt-1 text-xs opacity-70">🏷️ {item.humanReviewCategory}</p>
                                )}
                            </div>

                            {/* Review Form */}
                            <div className="space-y-4 bg-[var(--muted)] rounded-xl p-4 border border-[var(--border)]">
                                <h4 className="text-sm font-bold text-[var(--foreground)]">✏️ 검토 입력</h4>

                                {/* Verdict Selection */}
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400">AI 판정 검토</label>
                                    <div className="flex gap-2">
                                        {(['CORRECT', 'INCORRECT', 'UNREVIEWED'] as EvalHumanReviewVerdict[]).map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => setVerdict(v)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${verdict === v
                                                        ? 'bg-purple-500 text-white'
                                                        : 'bg-[var(--muted)] text-[var(--text-secondary)] hover:bg-[var(--accent)]'
                                                    }`}
                                            >
                                                {verdictLabel(v)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Override Pass/Fail (only when INCORRECT) */}
                                {verdict === 'INCORRECT' && (
                                    <div className="space-y-2">
                                        <label className="text-xs text-gray-400">최종 판정 재정의</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setOverridePass(true)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${overridePass === true
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-[var(--muted)] text-[var(--text-secondary)] hover:bg-[var(--accent)]'
                                                    }`}
                                            >
                                                ✅ 최종 통과
                                            </button>
                                            <button
                                                onClick={() => setOverridePass(false)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${overridePass === false
                                                        ? 'bg-rose-500 text-white'
                                                        : 'bg-[var(--muted)] text-[var(--text-secondary)] hover:bg-[var(--accent)]'
                                                    }`}
                                            >
                                                ❌ 최종 실패
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-500">
                                            AI 판정과 다른 결과를 선택하여 effectivePass를 변경할 수 있습니다.
                                        </p>
                                    </div>
                                )}

                                {/* Category */}
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400">카테고리 (선택)</label>
                                    <input
                                        type="text"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        placeholder="예: safety, format, hallucination"
                                        className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-xs text-[var(--foreground)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-purple-500"
                                    />
                                </div>

                                {/* Comment */}
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400">코멘트 (선택)</label>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="검토 의견을 입력하세요..."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-xs text-[var(--foreground)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-purple-500 resize-none"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    onClick={() => submitReview.mutate()}
                                    disabled={submitReview.isPending}
                                    className="w-full py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                    {submitReview.isPending ? '저장 중...' : '검토 저장'}
                                </button>
                            </div>

                            {/* Review History */}
                            {reviewHistory && reviewHistory.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-[var(--foreground)]">📜 검토 이력</h4>
                                    <div className="space-y-2">
                                        {reviewHistory.map((history) => (
                                            <div key={history.id} className="p-3 bg-[var(--muted)] rounded-lg border border-[var(--border)] text-xs">
                                                <div className="flex justify-between items-start">
                                                    <span className={`font-bold ${verdictColor(history.verdict)} px-2 py-0.5 rounded`}>
                                                        {verdictLabel(history.verdict)}
                                                    </span>
                                                    <span className="text-gray-500">
                                                        {new Date(history.changedAt).toLocaleString('ko-KR')}
                                                    </span>
                                                </div>
                                                {history.category && (
                                                    <p className="mt-1 text-gray-400">🏷️ {history.category}</p>
                                                )}
                                                {history.comment && (
                                                    <p className="mt-1 text-[var(--foreground)]">💬 {history.comment}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Content: Data Tab */}
            {activeTab === 'DATA' && (
                <div className="flex-1 overflow-y-auto space-y-4 animate-in fade-in">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-200">
                        🛠️ 개발자용 디버깅 데이터입니다.
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <DetailBlock title="Full Response Object" value={prettyJson(item)} />
                        <DetailBlock title="Candidate Meta (Token/Cost)" value={prettyJson(item.candidateMeta)} />
                        {isCompareMode && <DetailBlock title="Baseline Meta" value={prettyJson(item.baselineMeta)} />}
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Sub Components ---

function DetailBlock({ title, value }: { title: string; value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="group relative p-3 bg-[var(--muted)] rounded border border-[var(--border)] hover:border-[var(--ring)] transition-colors">
            <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase">{title}</p>
                <button
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText(value);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        } catch {
                            // Clipboard API unavailable
                        }
                    }}
                    className="text-[10px] text-gray-500 hover:text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="text-[10px] font-mono text-gray-400 overflow-auto max-h-60 leading-relaxed custom-scrollbar">
                {value}
            </pre>
        </div>
    );
}
