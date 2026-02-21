import { useState } from 'react';
import type { EvalCaseResultResponse, RunCaseContext } from '@/types/api.types';

// --- Helpers (Should ideally be in a shared utils file) ---
function toNullableNumber(value: any): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toNullableBoolean(value: any): boolean | null {
    if (value == null) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
    }
    return null;
}

function toStringArray(value: any): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item != null).map((item) => String(item));
}

function isObject(value: any): value is Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function prettyJson(value: unknown): string {
    if (value == null) return '-';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function formatOptionalNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '-';
    return Number(value).toFixed(2);
}

function formatSignedNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '-';
    return `${value > 0 ? '+' : ''}${Number(value).toFixed(2)}`;
}

function renderPassValue(pass: boolean | null): string {
    if (pass === null) return '-';
    return pass ? '통과' : '실패';
}

function renderWinner(winner: 'CANDIDATE' | 'BASELINE' | 'TIE' | null | undefined): string {
    if (winner === 'CANDIDATE') return '이번 버전 우세';
    if (winner === 'BASELINE') return '운영 버전 우세';
    if (winner === 'TIE') return '동점';
    return winner || '-';
}

function badgeToneClass(tone: 'good' | 'warn' | 'danger' | 'info' | 'neutral'): string {
    if (tone === 'danger') return 'border-rose-400/40 bg-rose-500/15 text-rose-200';
    if (tone === 'warn') return 'border-amber-400/40 bg-amber-500/15 text-amber-200';
    if (tone === 'info') return 'border-sky-400/40 bg-sky-500/15 text-sky-200';
    if (tone === 'good') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
    return 'border-white/20 bg-white/10 text-gray-300';
}

function passBadgeClass(pass: boolean | null): string {
    if (pass === true) return badgeToneClass('good');
    if (pass === false) return badgeToneClass('warn');
    return badgeToneClass('neutral');
}

function extractCompareSummary(judgeOutput: any) {
    if (!isObject(judgeOutput) || !isObject(judgeOutput.compare)) return null;
    return judgeOutput.compare as any;
}

function extractCandidateRuleChecks(ruleChecks: any) {
    if (!isObject(ruleChecks)) return null;
    if (isObject(ruleChecks.candidate)) return ruleChecks.candidate;
    return ruleChecks; // Fallback for single mode
}

function extractBaselineRuleChecks(ruleChecks: any) {
    if (!isObject(ruleChecks) || !isObject(ruleChecks.baseline)) return null;
    return ruleChecks.baseline;
}

function extractCandidateJudgeOutput(judgeOutput: any) {
    if (!isObject(judgeOutput)) return null;
    if (isObject(judgeOutput.candidate)) return judgeOutput.candidate;
    return judgeOutput; // Fallback
}

function extractBaselineJudgeOutput(judgeOutput: any) {
    if (!isObject(judgeOutput) || !isObject(judgeOutput.baseline)) return null;
    return judgeOutput.baseline;
}

function toCompactValue(value: unknown): string {
    if (value == null || value === '') return '-';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
    return String(value);
}

// --- Components ---

export function CaseDetailPanel({
    item,
    inputText,
    caseContext,
}: {
    item: EvalCaseResultResponse;
    inputText?: string;
    caseContext?: RunCaseContext;
}) {
    const [detailTab, setDetailTab] = useState<'SUMMARY' | 'COMPARE' | 'ANALYSIS' | 'RAW'>('SUMMARY');

    const compare = extractCompareSummary(item.judgeOutput);
    const candidateRuleChecks = extractCandidateRuleChecks(item.ruleChecks);
    const baselineRuleChecks = extractBaselineRuleChecks(item.ruleChecks);
    const candidateJudgeOutput = extractCandidateJudgeOutput(item.judgeOutput);
    const baselineJudgeOutput = extractBaselineJudgeOutput(item.judgeOutput);
    const caseInput = inputText || caseContext?.input || '입력 데이터를 찾지 못했습니다.';
    const contextJson = caseContext?.contextJson ?? null;
    const expectedJson = caseContext?.expectedJson ?? null;
    const constraintsJson = caseContext?.constraintsJson ?? null;
    
    // Logic extraction (simplified)
    const guidelineText = '세부 가이드는 Advanced 탭 참조'; // Simplifying for now
    const failureReason = item.errorMessage || (item.pass === false ? '품질 기준 미달' : '성공');
    const failed = item.pass === false || item.status === 'ERROR';

    return (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
            {/* Detail Tabs */}
            <div className="flex items-center gap-1 border-b border-white/10 pb-2 mb-3">
                <button onClick={() => setDetailTab('SUMMARY')} className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${detailTab === 'SUMMARY' ? 'text-white border-b-2 border-[var(--primary)] bg-white/5' : 'text-gray-400 hover:bg-white/5'}`}>요약</button>
                <button onClick={() => setDetailTab('COMPARE')} className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${detailTab === 'COMPARE' ? 'text-indigo-300 border-b-2 border-indigo-500 bg-indigo-500/10' : 'text-gray-400 hover:bg-white/5'}`}>비교</button>
                <button onClick={() => setDetailTab('ANALYSIS')} className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${detailTab === 'ANALYSIS' ? 'text-emerald-300 border-b-2 border-emerald-500 bg-emerald-500/10' : 'text-gray-400 hover:bg-white/5'}`}>분석</button>
                <button onClick={() => setDetailTab('RAW')} className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${detailTab === 'RAW' ? 'text-amber-300 border-b-2 border-amber-500 bg-amber-500/10' : 'text-gray-400 hover:bg-white/5'}`}>원본</button>
            </div>

            {detailTab === 'SUMMARY' && (
                <div className="grid grid-cols-12 gap-4 animate-in fade-in">
                    <div className="col-span-5 p-4 bg-black/30 rounded border border-white/10">
                        <h4 className="text-xs font-bold text-gray-400 mb-2">INPUT</h4>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{caseInput}</p>
                    </div>
                    <div className="col-span-7 p-4 bg-black/30 rounded border border-white/10 relative">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${failed ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <h4 className="text-xs font-bold text-gray-400 mb-2">OUTPUT ({failed ? 'FAIL' : 'PASS'})</h4>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{item.candidateOutput}</p>
                        <p className={`mt-2 text-xs p-2 rounded ${failed ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                            {failureReason}
                        </p>
                    </div>
                </div>
            )}

            {detailTab === 'COMPARE' && (
                <div className="space-y-3 animate-in fade-in">
                    {compare ? (
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded text-indigo-200 text-xs text-center">
                            점수 차이: {formatSignedNumber(compare.scoreDelta)} (승자: {renderWinner(compare.winner)})
                        </div>
                    ) : <div className="text-center text-xs text-gray-500">비교 데이터 없음</div>}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-black/30 rounded border border-white/10">
                            <p className="text-xs font-bold text-emerald-400 mb-2">Candidate (이번 버전)</p>
                            <p className="text-sm text-gray-300">{item.candidateOutput}</p>
                        </div>
                        <div className="p-3 bg-black/30 rounded border border-white/10">
                            <p className="text-xs font-bold text-sky-400 mb-2">Baseline (운영 버전)</p>
                            <p className="text-sm text-gray-300">{item.baselineOutput || '(없음)'}</p>
                        </div>
                    </div>
                </div>
            )}

            {detailTab === 'ANALYSIS' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <RuleSummaryCard title="Candidate Rules" checks={candidateRuleChecks} />
                    <JudgeSummaryCard title="Candidate Judge" judge={candidateJudgeOutput} />
                </div>
            )}

            {detailTab === 'RAW' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <DetailBlock title="Rule Raw" value={prettyJson(candidateRuleChecks)} />
                    <DetailBlock title="Judge Raw" value={prettyJson(candidateJudgeOutput)} />
                </div>
            )}
        </div>
    );
}

function RuleSummaryCard({ title, checks }: { title: string; checks: any }) {
    return (
        <div className="p-3 bg-black/30 rounded border border-white/10">
            <p className="text-xs font-bold text-gray-400 mb-2">{title}</p>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap">{prettyJson(checks)}</pre>
        </div>
    );
}

function JudgeSummaryCard({ title, judge }: { title: string; judge: any }) {
    return (
        <div className="p-3 bg-black/30 rounded border border-white/10">
            <p className="text-xs font-bold text-gray-400 mb-2">{title}</p>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap">{prettyJson(judge)}</pre>
        </div>
    );
}

function DetailBlock({ title, value }: { title: string; value: string }) {
    return (
        <div className="p-2 bg-black/40 rounded">
            <p className="text-[10px] text-gray-500 mb-1">{title}</p>
            <pre className="text-[10px] text-gray-400 overflow-auto max-h-40">{value}</pre>
        </div>
    );
}
