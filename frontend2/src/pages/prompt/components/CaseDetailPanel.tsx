import { useState } from 'react';
import type { EvalCaseResultResponse } from '@/types/api.types';

interface RunCaseContext {
    input?: string;
    contextJson?: Record<string, unknown> | null;
    expectedJson?: Record<string, unknown> | null;
    constraintsJson?: Record<string, unknown> | null;
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

// --- Component ---
export function CaseDetailPanel({
    item,
    inputText,
    caseContext,
}: {
    item: EvalCaseResultResponse;
    inputText?: string;
    caseContext?: RunCaseContext;
}) {
    const [activeTab, setActiveTab] = useState<'REPORT' | 'DATA'>('REPORT');

    // Data Extraction
    const caseInput = inputText || caseContext?.input || '입력 데이터 없음';
    const compare = extractCompareSummary(item.judgeOutput);
    const failedChecks = extractFailedChecks(item.ruleChecks);
    
    // AI Judge Info
    const judge = (item.judgeOutput && typeof item.judgeOutput === 'object' && 'candidate' in item.judgeOutput) 
        ? item.judgeOutput.candidate 
        : item.judgeOutput; // Fallback for single mode or flat structure
    
    const judgeScore = judge?.overallScore ?? 0;
    const judgeReason = judge?.reason || (Array.isArray(judge?.evidence) ? judge.evidence[0] : null);

    // Compare Mode Check
    const isCompareMode = !!item.baselineOutput;

    // Status Colors
    const statusColor = item.pass 
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
        : 'bg-rose-500/10 border-rose-500/30 text-rose-400';

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Tabs */}
            <div className="flex border-b border-white/10">
                <button 
                    onClick={() => setActiveTab('REPORT')}
                    className={`px-6 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'REPORT' ? 'border-[var(--primary)] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    📝 통합 리포트
                </button>
                <button 
                    onClick={() => setActiveTab('DATA')}
                    className={`px-6 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'DATA' ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    💾 원본 데이터 (JSON)
                </button>
            </div>

            {/* Content: Report Tab */}
            {activeTab === 'REPORT' && (
                <div className="flex-1 overflow-y-auto space-y-6 pr-2 animate-in fade-in">
                    
                    {/* 1. Q&A Section */}
                    <div className="space-y-4">
                        {/* User Question */}
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-sm text-gray-300">person</span>
                            </div>
                            <div className="bg-white/5 rounded-2xl rounded-tl-none p-4 max-w-[80%] border border-white/10">
                                <p className="text-xs font-bold text-gray-400 mb-1">사용자 질문 (Input)</p>
                                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{caseInput}</p>
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
                                        <div className={`p-4 rounded-2xl rounded-tl-none border ${compare?.winner === 'CANDIDATE' ? 'bg-[var(--primary)]/10 border-[var(--primary)]/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-black/20 border-white/10'}`}>
                                            <div className="flex justify-between mb-2">
                                                <span className="text-xs font-bold text-[var(--primary)]">이번 버전 (Candidate)</span>
                                                {compare?.winner === 'CANDIDATE' && <span className="text-[10px] bg-[var(--primary)] text-black px-1.5 rounded font-bold">WIN 👑</span>}
                                            </div>
                                            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{item.candidateOutput}</p>
                                        </div>
                                        <div className={`p-4 rounded-2xl border ${compare?.winner === 'BASELINE' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-black/20 border-white/10 opacity-70'}`}>
                                            <div className="flex justify-between mb-2">
                                                <span className="text-xs font-bold text-blue-400">운영 버전 (Baseline)</span>
                                                {compare?.winner === 'BASELINE' && <span className="text-[10px] bg-blue-500 text-black px-1.5 rounded font-bold">WIN 🛡️</span>}
                                            </div>
                                            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{item.baselineOutput}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-2xl rounded-tl-none bg-black/20 border border-white/10">
                                        <p className="text-xs font-bold text-gray-400 mb-1">AI 답변</p>
                                        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{item.candidateOutput}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    {/* 2. Verdict Section (Reason) */}
                    <div className={`rounded-xl border p-4 ${statusColor}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-lg">
                                {item.pass ? 'check_circle' : 'error'}
                            </span>
                            <h4 className="font-bold text-sm">
                                {item.pass ? '평가 통과 (Passed)' : '평가 실패 (Failed)'}
                            </h4>
                            {judgeScore > 0 && <span className="text-xs opacity-80">| AI 점수: {judgeScore}점</span>}
                        </div>
                        
                        {/* 2-1. Rule Failures */}
                        {failedChecks.length > 0 && (
                            <div className="mb-3 bg-black/20 rounded p-2 text-xs">
                                <p className="font-bold text-rose-300 mb-1">🚫 룰 위반 발견:</p>
                                <ul className="list-disc pl-4 space-y-0.5 text-rose-200/80">
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
                    <details className="group rounded-xl border border-white/10 bg-black/20">
                        <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors">
                            <span className="text-xs font-bold text-gray-400">🔍 상세 평가 근거 보기 (룰/AI 심사)</span>
                            <span className="material-symbols-outlined text-gray-500 text-sm group-open:rotate-180 transition-transform">expand_more</span>
                        </summary>
                        <div className="p-4 border-t border-white/10 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Rule Check Detail</p>
                                    <pre className="text-[10px] text-gray-400 bg-black/30 p-2 rounded overflow-auto max-h-40">{prettyJson(item.ruleChecks)}</pre>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">AI Judge Detail</p>
                                    <pre className="text-[10px] text-gray-400 bg-black/30 p-2 rounded overflow-auto max-h-40">{prettyJson(item.judgeOutput)}</pre>
                                </div>
                            </div>
                        </div>
                    </details>

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

function DetailBlock({ title, value }: { title: string; value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="group relative p-3 bg-black/40 rounded border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase">{title}</p>
                <button 
                    onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="text-[10px] text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
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
