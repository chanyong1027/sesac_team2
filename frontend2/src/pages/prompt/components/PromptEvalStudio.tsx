import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { promptApi } from '@/api/prompt.api';
import { CaseEditorRow } from './CaseEditorRow';
import { CaseDetailPanel } from './CaseDetailPanel';
import {
    toKoreanCaseStatus,
    toKoreanErrorCodeLabel,
    toKoreanIssueText,
    toKoreanJudgeLabel,
    toKoreanRiskLevel,
    toKoreanRunStatus,
    toKoreanRuleCheckLabel,
} from './promptEvalLabelMaps';
import {
    createEmptyCaseFormRow,
    parseCaseRows,
    type CaseFormRow,
    type CaseJsonField,
    type JsonObject,
} from './CaseEditorUtils';
import type {
    EvalCaseResultListResponse,
    EvalCaseResultResponse,
    EvalReleaseCriteriaAuditResponse,
    EvalReleaseCriteriaResponse,
    EvalMode,
    EvalRunEstimateResponse,
    EvalRunResponse,
    EvalTestCaseResponse,
    ErrorResponse,
    RubricTemplateCode,
} from '@/types/api.types';

interface PromptEvalStudioProps {
    workspaceId: number;
    promptId: number;
}

type StudioStep = 'DATASET' | 'CONFIG' | 'RESULT';
type EditableCaseField = Exclude<keyof CaseFormRow, 'id'>;

interface RunCaseContext {
    input?: string;
    contextJson?: Record<string, unknown> | null;
    expectedJson?: Record<string, unknown> | null;
    constraintsJson?: Record<string, unknown> | null;
}

type JsonRecord = Record<string, unknown>;

const RUN_CASE_PAGE_SIZE = 200;

const RUBRIC_OPTIONS: Array<{
    code: RubricTemplateCode;
    label: string;
    description: string;
}> = [
    { code: 'GENERAL_TEXT', label: '일반 답변', description: '관련성, 완성도, 안전성 중심 평가' },
    { code: 'SUMMARY', label: '요약', description: '핵심 누락/사실 일치 중심 평가' },
    { code: 'JSON_EXTRACTION', label: 'JSON 추출', description: 'JSON 형식/필수 키 중심 평가' },
    { code: 'CLASSIFICATION', label: '분류', description: '라벨 정확도/일관성 중심 평가' },
    { code: 'CUSTOM', label: '커스텀', description: '저장된 커스텀 루브릭 기반 평가' },
];

interface RubricCriterionDraft {
    id: string;
    key: string;
    description: string;
    weight: string;
}

interface RubricPreset {
    description: string;
    criteria: Array<{ key: string; description: string; weight: number }>;
    minOverallScore: number;
    requireJsonParsePass: boolean;
}

interface ReleaseCriteriaDraft {
    minPassRate: string;
    minAvgOverallScore: string;
    maxErrorRate: string;
    minImprovementNoticeDelta: string;
}

const DEFAULT_RELEASE_CRITERIA_DRAFT: ReleaseCriteriaDraft = {
    minPassRate: '90',
    minAvgOverallScore: '75',
    maxErrorRate: '10',
    minImprovementNoticeDelta: '3',
};

const RUBRIC_PRESETS: Record<RubricTemplateCode, RubricPreset> = {
    GENERAL_TEXT: {
        description: '일반 텍스트 품질 평가',
        criteria: [
            { key: 'relevance', description: '질문/맥락과의 관련성', weight: 1.0 },
            { key: 'completeness', description: '핵심 정보 충족도', weight: 1.0 },
            { key: 'clarity', description: '표현의 명확성', weight: 1.0 },
            { key: 'safety', description: '안전성/정책 준수', weight: 1.0 },
        ],
        minOverallScore: 70,
        requireJsonParsePass: false,
    },
    SUMMARY: {
        description: '요약 품질 평가',
        criteria: [
            { key: 'coverage', description: '핵심 내용 포괄성', weight: 1.0 },
            { key: 'faithfulness', description: '원문 대비 사실 일치', weight: 1.2 },
            { key: 'conciseness', description: '불필요한 장황함 억제', weight: 0.8 },
            { key: 'format', description: '요청 형식 준수', weight: 1.0 },
        ],
        minOverallScore: 72,
        requireJsonParsePass: false,
    },
    JSON_EXTRACTION: {
        description: '구조화 추출 품질 평가',
        criteria: [
            { key: 'format', description: 'JSON 형식 정확성', weight: 1.3 },
            { key: 'schema', description: '요구 스키마 적합성', weight: 1.3 },
            { key: 'value_correctness', description: '필드 값의 정확도', weight: 1.0 },
            { key: 'extraneous_text', description: '불필요 텍스트 억제', weight: 0.8 },
        ],
        minOverallScore: 75,
        requireJsonParsePass: true,
    },
    CLASSIFICATION: {
        description: '분류 품질 평가',
        criteria: [
            { key: 'label_valid', description: '라벨 유효성', weight: 1.2 },
            { key: 'correctness', description: '정답 라벨 정확도', weight: 1.1 },
            { key: 'consistency', description: '결과 일관성', weight: 1.0 },
        ],
        minOverallScore: 75,
        requireJsonParsePass: false,
    },
    CUSTOM: {
        description: '커스텀 평가 기준',
        criteria: [{ key: 'quality', description: '품질 종합 점수', weight: 1.0 }],
        minOverallScore: 70,
        requireJsonParsePass: false,
    },
};

function createRubricCriterionDraft(
    key = '',
    description = '',
    weight = '1.0'
): RubricCriterionDraft {
    return {
        id: `criterion-${Math.random().toString(36).slice(2, 11)}`,
        key,
        description,
        weight,
    };
}

function createRubricDraftFromTemplate(template: RubricTemplateCode): {
    criteria: RubricCriterionDraft[];
    minOverallScore: string;
    requireJsonParsePass: boolean;
    description: string;
} {
    const preset = RUBRIC_PRESETS[template];
    return {
        criteria: preset.criteria.map((item) =>
            createRubricCriterionDraft(item.key, item.description, String(item.weight))
        ),
        minOverallScore: String(preset.minOverallScore),
        requireJsonParsePass: preset.requireJsonParsePass,
        description: preset.description,
    };
}

function parseFiniteNumber(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toReleaseCriteriaDraft(criteria: EvalReleaseCriteriaResponse): ReleaseCriteriaDraft {
    return {
        minPassRate: String(criteria.minPassRate),
        minAvgOverallScore: String(criteria.minAvgOverallScore),
        maxErrorRate: String(criteria.maxErrorRate),
        minImprovementNoticeDelta: String(criteria.minImprovementNoticeDelta),
    };
}

function buildRubricOverridesPayload(
    criteria: RubricCriterionDraft[],
    minOverallScoreText: string,
    requireJsonParsePass: boolean,
    note: string
): Record<string, unknown> | null {
    const normalizedCriteria = criteria
        .map((item) => ({
            key: item.key.trim(),
            description: item.description.trim(),
            weight: parseFiniteNumber(item.weight),
        }))
        .filter((item) => item.key.length > 0 && item.weight !== null);

    const weights: Record<string, number> = {};
    normalizedCriteria.forEach((item) => {
        if (item.weight !== null) {
            weights[item.key] = item.weight;
        }
    });

    const gates: Record<string, unknown> = {};
    const parsedMinOverallScore = parseFiniteNumber(minOverallScoreText);
    if (parsedMinOverallScore !== null) {
        gates.minOverallScore = parsedMinOverallScore;
    }
    if (requireJsonParsePass) {
        gates.requireJsonParsePass = true;
    }

    const definitionLines = normalizedCriteria
        .filter((item) => item.description.length > 0)
        .map((item) => `${item.key}: ${item.description}`);
    const noteText = note.trim();
    const description = [noteText, ...definitionLines].filter((text) => text.length > 0).join('\n');

    const overrides: Record<string, unknown> = {};
    if (Object.keys(weights).length > 0) {
        overrides.weights = weights;
    }
    if (Object.keys(gates).length > 0) {
        overrides.gates = gates;
    }
    if (description) {
        overrides.description = description;
    }

    return Object.keys(overrides).length > 0 ? overrides : null;
}

function readStoredRunId(workspaceId: number, promptId: number): number | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const key = `prompt-eval-run:${workspaceId}:${promptId}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
        return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchAllRunCases(
    workspaceId: number,
    promptId: number,
    runId: number,
    pageSize: number
): Promise<EvalCaseResultResponse[]> {
    const firstPage = (await promptApi.getEvalRunCases(workspaceId, promptId, runId, 0, pageSize)).data;
    if (firstPage.totalPages <= 1) {
        return firstPage.content;
    }

    const promises: Array<Promise<EvalCaseResultListResponse>> = [];
    for (let page = 1; page < firstPage.totalPages; page += 1) {
        promises.push(
            promptApi
                .getEvalRunCases(workspaceId, promptId, runId, page, pageSize)
                .then((response) => response.data)
        );
    }

    const restPages = await Promise.all(promises);
    return [firstPage, ...restPages].flatMap((page) => page.content);
}

function extractJudgeLabels(judgeOutput: Record<string, unknown> | null): string[] {
    const labels = judgeOutput?.labels;
    if (!Array.isArray(labels)) {
        return [];
    }
    return labels.map((item) => String(item));
}

function asRecord(value: unknown): JsonRecord | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as JsonRecord;
    }
    return null;
}

function asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

function asBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function asString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value;
    }
    return null;
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((item) => String(item));
}

function formatNumber(value: number | null, digits = 2): string {
    if (value == null || Number.isNaN(value)) {
        return '-';
    }
    return value.toFixed(digits);
}

function formatPercent(value: number | null): string {
    if (value == null || Number.isNaN(value)) {
        return '-';
    }
    return `${value.toFixed(2)}%`;
}

function formatSigned(value: number | null, digits = 2): string {
    if (value == null || Number.isNaN(value)) {
        return '-';
    }
    return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function formatSignedTokens(value: number | null): string {
    if (value == null || Number.isNaN(value)) {
        return '-';
    }
    const rounded = Math.round(value);
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${rounded.toLocaleString('ko-KR')}`;
}

function formatSignedCurrency(value: number | null, digits = 6): string {
    if (value == null || Number.isNaN(value)) {
        return '-';
    }
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}$${Math.abs(value).toFixed(digits)}`;
}

function formatSignedMs(value: number | null): string {
    if (value == null || Number.isNaN(value)) {
        return '-';
    }
    const rounded = Math.round(value);
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${rounded.toLocaleString('ko-KR')}ms`;
}

function formatTimestamp(value: string | null | undefined): string {
    if (!value) {
        return '-';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '-';
    }
    return parsed.toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDurationMs(startedAt: string | null | undefined, completedAt: string | null | undefined): string {
    if (!startedAt || !completedAt) {
        return '-';
    }
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return '-';
    }
    const totalSec = Math.round((end - start) / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min <= 0) {
        return `${sec}s`;
    }
    return `${min}m ${sec}s`;
}

function formatDurationRangeSec(minSec: number | null | undefined, maxSec: number | null | undefined): string {
    const minValue = typeof minSec === 'number' && Number.isFinite(minSec) ? minSec : null;
    const maxValue = typeof maxSec === 'number' && Number.isFinite(maxSec) ? maxSec : null;
    if (minValue == null || maxValue == null) {
        return '-';
    }

    const toLabel = (seconds: number): string => {
        if (seconds < 60) {
            return `${Math.round(seconds)}초`;
        }
        const minute = Math.floor(seconds / 60);
        const second = Math.round(seconds % 60);
        if (second === 0) {
            return `${minute}분`;
        }
        return `${minute}분 ${second}초`;
    };

    return `${toLabel(minValue)} ~ ${toLabel(maxValue)}`;
}

function formatUsdRange(minUsd: number | null | undefined, maxUsd: number | null | undefined): string {
    const minValue = typeof minUsd === 'number' && Number.isFinite(minUsd) ? minUsd : null;
    const maxValue = typeof maxUsd === 'number' && Number.isFinite(maxUsd) ? maxUsd : null;
    if (minValue == null || maxValue == null) {
        return '-';
    }
    return `$${minValue.toFixed(4)} ~ $${maxValue.toFixed(4)}`;
}

type InsightGrade = 'S' | 'A' | 'B' | 'F' | '...';

function computeInsightGrade(
    passRate: number | null,
    avgOverallScore: number | null,
    errorRate: number | null,
    isRunning: boolean
): InsightGrade {
    if (isRunning) {
        return '...';
    }
    if (passRate == null || avgOverallScore == null || errorRate == null) {
        return 'F';
    }
    if (passRate >= 90 && avgOverallScore >= 85 && errorRate <= 1) {
        return 'S';
    }
    if (passRate >= 80 && avgOverallScore >= 75 && errorRate <= 3) {
        return 'A';
    }
    if (passRate >= 65 && avgOverallScore >= 65 && errorRate <= 5) {
        return 'B';
    }
    return 'F';
}

function gradeToneClass(grade: InsightGrade): string {
    if (grade === 'S') return 'text-emerald-300';
    if (grade === 'A') return 'text-sky-300';
    if (grade === 'B') return 'text-amber-300';
    if (grade === 'F') return 'text-rose-300';
    return 'text-gray-300';
}

type CountDistributionEntry = {
    key: string;
    count: number;
    pct: number;
};

type CompareWinner = 'CANDIDATE' | 'BASELINE' | 'TIE';
type CompareDiffTone = 'BETTER' | 'WORSE' | 'SAME' | 'UNKNOWN';
type CandidateLatencyStats = {
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    sampleSize: number;
};
type CompareCaseDelta = {
    scoreDelta: number | null;
    candidateScore: number | null;
    baselineScore: number | null;
    tokenDelta: number | null;
    costDelta: number | null;
    latencyDelta: number | null;
    candidatePass: boolean | null;
    baselinePass: boolean | null;
};
type DeltaSummary = {
    avg: number | null;
    sampleSize: number;
};

type DecisionGateLevel = 'PASS' | 'FAIL' | 'WARN' | 'NA';
type DecisionGateItem = {
    key: string;
    label: string;
    actual: string;
    threshold: string;
    level: DecisionGateLevel;
    note?: string;
};

type CompareBattleWinner = 'CANDIDATE' | 'BASELINE' | 'TIE' | null;
type CompareTradeoffChip = {
    key: string;
    label: string;
    value: string;
    tone: 'good' | 'danger' | 'neutral';
};

type ReleaseCriteriaNotice = {
    type: 'success' | 'error';
    message: string;
};

function toCountDistribution(value: unknown): CountDistributionEntry[] {
    const record = asRecord(value);
    if (!record) {
        return [];
    }

    const entries = Object.entries(record)
        .map(([key, raw]) => ({
            key,
            count: asNumber(raw) ?? 0,
        }))
        .filter((item) => item.key.trim().length > 0 && item.count > 0)
        .sort((a, b) => b.count - a.count);

    const total = entries.reduce((sum, item) => sum + item.count, 0);
    return entries.map((item) => ({
        ...item,
        pct: total > 0 ? (item.count * 100) / total : 0,
    }));
}

function extractCompareWinner(item: EvalCaseResultResponse): CompareWinner | null {
    const judge = asRecord(item.judgeOutput);
    const compare = asRecord(judge?.compare);
    const winner = asString(compare?.winner);
    if (winner === 'CANDIDATE' || winner === 'BASELINE' || winner === 'TIE') {
        return winner;
    }
    return null;
}

function extractCompareScoreDelta(item: EvalCaseResultResponse): number | null {
    const judge = asRecord(item.judgeOutput);
    const compare = asRecord(judge?.compare);
    return asNumber(compare?.scoreDelta);
}

function resolveCompareDiffTone(item: EvalCaseResultResponse): CompareDiffTone {
    const winner = extractCompareWinner(item);
    if (winner === 'CANDIDATE') {
        return 'BETTER';
    }
    if (winner === 'BASELINE') {
        return 'WORSE';
    }
    if (winner === 'TIE') {
        return 'SAME';
    }

    const scoreDelta = extractCompareScoreDelta(item);
    if (scoreDelta == null) {
        return 'UNKNOWN';
    }
    if (Math.abs(scoreDelta) < 0.01) {
        return 'SAME';
    }
    return scoreDelta > 0 ? 'BETTER' : 'WORSE';
}

function extractMetaMetric(
    item: EvalCaseResultResponse,
    side: 'candidate' | 'baseline',
    key: 'totalTokens' | 'estimatedCostUsd' | 'latencyMs'
): number | null {
    const meta = side === 'candidate'
        ? asRecord(item.candidateMeta)
        : asRecord(item.baselineMeta);
    return asNumber(meta?.[key]);
}

function toCompareCaseDelta(item: EvalCaseResultResponse): CompareCaseDelta {
    const judge = asRecord(item.judgeOutput);
    const compare = asRecord(judge?.compare);
    const candidateTokens = extractMetaMetric(item, 'candidate', 'totalTokens');
    const baselineTokens = extractMetaMetric(item, 'baseline', 'totalTokens');
    const candidateCost = extractMetaMetric(item, 'candidate', 'estimatedCostUsd');
    const baselineCost = extractMetaMetric(item, 'baseline', 'estimatedCostUsd');
    const candidateLatency = extractMetaMetric(item, 'candidate', 'latencyMs');
    const baselineLatency = extractMetaMetric(item, 'baseline', 'latencyMs');

    return {
        scoreDelta: asNumber(compare?.scoreDelta),
        candidateScore: asNumber(compare?.candidateOverallScore),
        baselineScore: asNumber(compare?.baselineOverallScore),
        tokenDelta: candidateTokens != null && baselineTokens != null ? candidateTokens - baselineTokens : null,
        costDelta: candidateCost != null && baselineCost != null ? candidateCost - baselineCost : null,
        latencyDelta: candidateLatency != null && baselineLatency != null ? candidateLatency - baselineLatency : null,
        candidatePass: asBoolean(compare?.candidatePass),
        baselinePass: asBoolean(compare?.baselinePass),
    };
}

function summarizeDeltas(values: Array<number | null>): DeltaSummary {
    const finiteValues = values.filter((value): value is number => value != null && Number.isFinite(value));
    if (finiteValues.length === 0) {
        return { avg: null, sampleSize: 0 };
    }

    const total = finiteValues.reduce((sum, value) => sum + value, 0);
    return {
        avg: total / finiteValues.length,
        sampleSize: finiteValues.length,
    };
}

function extractCandidateLatencyMs(item: EvalCaseResultResponse): number | null {
    const candidateMeta = asRecord(item.candidateMeta);
    return asNumber(candidateMeta?.latencyMs);
}

function computeCandidateLatencyStats(cases: EvalCaseResultResponse[]): CandidateLatencyStats {
    const latencies = cases
        .map((item) => extractCandidateLatencyMs(item))
        .filter((value): value is number => value != null)
        .sort((a, b) => a - b);

    if (latencies.length === 0) {
        return {
            avgLatencyMs: null,
            p95LatencyMs: null,
            sampleSize: 0,
        };
    }

    const avgLatencyMs = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
    const rank = Math.ceil(latencies.length * 0.95) - 1;
    const p95Index = Math.max(0, Math.min(rank, latencies.length - 1));

    return {
        avgLatencyMs,
        p95LatencyMs: latencies[p95Index],
        sampleSize: latencies.length,
    };
}

function extractApiError(error: unknown): { status: number | null; message: string | null } {
    if (isAxiosError<ErrorResponse>(error)) {
        const status = error.response?.status ?? null;
        const message = error.response?.data?.message?.trim() || error.message || null;
        return { status, message };
    }

    if (error instanceof Error) {
        return { status: null, message: error.message };
    }

    return { status: null, message: null };
}

export function PromptEvalStudio({ workspaceId, promptId }: PromptEvalStudioProps) {
    const queryClient = useQueryClient();

    const [initialStoredRunId] = useState<number | null>(() => readStoredRunId(workspaceId, promptId));
    const [currentStep, setCurrentStep] = useState<StudioStep>(initialStoredRunId ? 'RESULT' : 'DATASET');

    const [previewDatasetId, setPreviewDatasetId] = useState<number | null>(null);
    const [runDatasetId, setRunDatasetId] = useState<number | null>(null);
    const [isCreatingDataset, setIsCreatingDataset] = useState(false);
    const [newDatasetName, setNewDatasetName] = useState('');
    const [caseRows, setCaseRows] = useState<CaseFormRow[]>([createEmptyCaseFormRow()]);

    const [expandedEditorCaseId, setExpandedEditorCaseId] = useState<string | null>(null);

    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
    const [mode, setMode] = useState<EvalMode | null>(null);
    const [rubricTemplateCode, setRubricTemplateCode] = useState<RubricTemplateCode | null>(null);
    const [useRubricOverrides, setUseRubricOverrides] = useState(false);
    const [rubricCriteriaRows, setRubricCriteriaRows] = useState<RubricCriterionDraft[]>(
        () => createRubricDraftFromTemplate('GENERAL_TEXT').criteria
    );
    const [rubricMinOverallScore, setRubricMinOverallScore] = useState(
        () => createRubricDraftFromTemplate('GENERAL_TEXT').minOverallScore
    );
    const [rubricRequireJsonParsePass, setRubricRequireJsonParsePass] = useState(
        () => createRubricDraftFromTemplate('GENERAL_TEXT').requireJsonParsePass
    );
    const [rubricDescriptionNote, setRubricDescriptionNote] = useState(
        () => createRubricDraftFromTemplate('GENERAL_TEXT').description
    );
    const [releaseCriteriaDraft, setReleaseCriteriaDraft] = useState<ReleaseCriteriaDraft | null>(null);
    const [releaseCriteriaNotice, setReleaseCriteriaNotice] = useState<ReleaseCriteriaNotice | null>(null);
    const [currentRunId, setCurrentRunId] = useState<number | null>(initialStoredRunId);

    const runStorageKey = useMemo(
        () => `prompt-eval-run:${workspaceId}:${promptId}`,
        [workspaceId, promptId]
    );

    const { data: datasets } = useQuery({
        queryKey: ['evalDatasets', workspaceId, promptId],
        queryFn: async () => (await promptApi.getEvalDatasets(workspaceId, promptId)).data,
    });

    const { data: versions } = useQuery({
        queryKey: ['promptVersions', promptId],
        queryFn: async () => (await promptApi.getVersions(promptId)).data,
    });

    const { data: defaults } = useQuery({
        queryKey: ['evalDefaults', workspaceId, promptId],
        queryFn: async () => (await promptApi.getEvalDefaults(workspaceId, promptId)).data,
    });

    const { data: release } = useQuery({
        queryKey: ['promptRelease', promptId],
        queryFn: async () => {
            try {
                return (await promptApi.getRelease(promptId)).data;
            } catch {
                return null;
            }
        },
    });

    const { data: releaseCriteria, isLoading: isLoadingReleaseCriteria } = useQuery({
        queryKey: ['evalReleaseCriteria', workspaceId],
        queryFn: async () => (await promptApi.getEvalReleaseCriteria(workspaceId)).data,
    });
    const { data: releaseCriteriaHistory } = useQuery({
        queryKey: ['evalReleaseCriteriaHistory', workspaceId],
        queryFn: async () => (await promptApi.getEvalReleaseCriteriaHistory(workspaceId)).data,
    });

    const { data: runs } = useQuery({
        queryKey: ['evalRuns', workspaceId, promptId],
        queryFn: async () => (await promptApi.getEvalRuns(workspaceId, promptId)).data,
        refetchInterval: (query) => {
            const items = (query.state.data as EvalRunResponse[] | undefined) ?? [];
            return items.some((item) => item.status === 'QUEUED' || item.status === 'RUNNING') ? 3000 : false;
        },
    });

    const resolvedPreviewDatasetId = useMemo(() => {
        if (previewDatasetId && datasets?.some((item) => item.id === previewDatasetId)) {
            return previewDatasetId;
        }
        if (previewDatasetId && !datasets) {
            return previewDatasetId;
        }
        return datasets?.[0]?.id ?? null;
    }, [previewDatasetId, datasets]);

    const resolvedRunDatasetId = useMemo(() => {
        if (runDatasetId && datasets?.some((item) => item.id === runDatasetId)) {
            return runDatasetId;
        }
        if (runDatasetId && !datasets) {
            return runDatasetId;
        }
        return datasets?.[0]?.id ?? null;
    }, [runDatasetId, datasets]);
    const resolvedVersionId = selectedVersionId ?? versions?.[0]?.id ?? null;
    const resolvedMode = mode ?? defaults?.defaultMode ?? 'CANDIDATE_ONLY';
    const resolvedRubricTemplateCode = rubricTemplateCode ?? defaults?.rubricTemplateCode ?? 'GENERAL_TEXT';
    const activeReleaseVersionLabel = useMemo(() => {
        const activeVersionId = release?.activeVersionId;
        if (!activeVersionId) {
            return null;
        }
        const matched = versions?.find((item) => item.id === activeVersionId);
        if (matched) {
            return `v${matched.versionNumber}`;
        }
        return `#${activeVersionId}`;
    }, [release?.activeVersionId, versions]);
    const resolvedRubricOverrides = useMemo(() => {
        if (!useRubricOverrides) {
            return defaults?.rubricOverrides ?? null;
        }
        return buildRubricOverridesPayload(
            rubricCriteriaRows,
            rubricMinOverallScore,
            rubricRequireJsonParsePass,
            rubricDescriptionNote
        );
    }, [
        useRubricOverrides,
        defaults?.rubricOverrides,
        rubricCriteriaRows,
        rubricMinOverallScore,
        rubricRequireJsonParsePass,
        rubricDescriptionNote,
    ]);

    useEffect(() => {
        setReleaseCriteriaDraft(null);
    }, [workspaceId]);

    useEffect(() => {
        if (!releaseCriteria) {
            return;
        }
        setReleaseCriteriaDraft((prev) => prev ?? toReleaseCriteriaDraft(releaseCriteria));
    }, [releaseCriteria]);

    const { data: runEstimate, isFetching: isEstimatingRunEstimate } = useQuery({
        queryKey: [
            'evalRunEstimate',
            workspaceId,
            promptId,
            resolvedRunDatasetId,
            resolvedVersionId,
            resolvedMode,
            resolvedRubricTemplateCode,
        ],
        queryFn: async () => {
            if (!resolvedRunDatasetId || !resolvedVersionId) {
                return null;
            }
            return (await promptApi.estimateEvalRun(workspaceId, promptId, {
                datasetId: resolvedRunDatasetId,
                promptVersionId: resolvedVersionId,
                mode: resolvedMode,
                rubricTemplateCode: resolvedRubricTemplateCode,
            })).data;
        },
        enabled: !!resolvedRunDatasetId
            && !!resolvedVersionId
            && (resolvedMode !== 'COMPARE_ACTIVE' || !!release?.activeVersionId),
        staleTime: 15_000,
    });

    const applyRubricPreset = (template: RubricTemplateCode) => {
        const preset = createRubricDraftFromTemplate(template);
        setRubricCriteriaRows(preset.criteria);
        setRubricMinOverallScore(preset.minOverallScore);
        setRubricRequireJsonParsePass(preset.requireJsonParsePass);
        setRubricDescriptionNote(preset.description);
    };

    const handleRubricTemplateChange = (template: RubricTemplateCode) => {
        setRubricTemplateCode(template);
        applyRubricPreset(template);
    };

    const handleRubricOverrideToggle = (enabled: boolean) => {
        setUseRubricOverrides(enabled);
    };

    const resolvedRunId = useMemo(() => {
        if (currentRunId && runs?.some((item) => item.id === currentRunId)) {
            return currentRunId;
        }
        if (currentRunId && !runs) {
            return currentRunId;
        }
        return runs?.[0]?.id ?? null;
    }, [currentRunId, runs]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        if (!resolvedRunId) {
            window.localStorage.removeItem(runStorageKey);
            return;
        }
        window.localStorage.setItem(runStorageKey, String(resolvedRunId));
    }, [resolvedRunId, runStorageKey]);

    const { data: run } = useQuery({
        queryKey: ['evalRun', workspaceId, promptId, resolvedRunId],
        queryFn: async () => {
            if (!resolvedRunId) {
                return null;
            }
            return (await promptApi.getEvalRun(workspaceId, promptId, resolvedRunId)).data;
        },
        enabled: !!resolvedRunId,
        refetchInterval: (query) => {
            const status = (query.state.data as EvalRunResponse | null | undefined)?.status;
            return status === 'RUNNING' || status === 'QUEUED' ? 2000 : false;
        },
    });

    const { data: runCases } = useQuery({
        queryKey: ['evalRunCases', workspaceId, promptId, resolvedRunId],
        queryFn: async () => {
            if (!resolvedRunId) {
                return [] as EvalCaseResultResponse[];
            }
            return fetchAllRunCases(workspaceId, promptId, resolvedRunId, RUN_CASE_PAGE_SIZE);
        },
        enabled: !!resolvedRunId,
        refetchInterval: run && (run.status === 'RUNNING' || run.status === 'QUEUED') ? 3000 : false,
    });

    const { data: runDatasetCases } = useQuery({
        queryKey: ['evalDatasetCasesByRun', workspaceId, promptId, run?.datasetId],
        queryFn: async () => {
            if (!run?.datasetId) {
                return [] as EvalTestCaseResponse[];
            }
            return (await promptApi.getEvalDatasetCases(workspaceId, promptId, run.datasetId)).data;
        },
        enabled: !!run?.datasetId,
    });

    const caseContextById = useMemo(() => {
        const map: Record<number, RunCaseContext> = {};
        (runDatasetCases || []).forEach((item) => {
            map[item.id] = {
                input: item.input,
                contextJson: item.contextJson,
                expectedJson: item.expectedJson,
                constraintsJson: item.constraintsJson,
            };
        });
        return map;
    }, [runDatasetCases]);

    const caseInputById = useMemo(() => {
        const map: Record<number, string> = {};
        Object.entries(caseContextById).forEach(([id, context]) => {
            map[Number(id)] = context.input ?? '';
        });
        return map;
    }, [caseContextById]);

    const { data: datasetCases } = useQuery({
        queryKey: ['evalDatasetCases', workspaceId, promptId, resolvedPreviewDatasetId],
        queryFn: async () => {
            if (!resolvedPreviewDatasetId) {
                return [] as EvalTestCaseResponse[];
            }
            return (await promptApi.getEvalDatasetCases(workspaceId, promptId, resolvedPreviewDatasetId)).data;
        },
        enabled: !!resolvedPreviewDatasetId && !isCreatingDataset,
    });

    const createDatasetMutation = useMutation({
        mutationFn: async () => {
            if (!newDatasetName.trim()) {
                throw new Error('데이터셋 이름을 입력하세요.');
            }

            const testCases = parseCaseRows(caseRows);
            if (testCases.length === 0) {
                throw new Error('최소 1개 이상의 케이스가 필요합니다.');
            }

            const response = await promptApi.createEvalDataset(workspaceId, promptId, { name: newDatasetName });
            const datasetId = response.data.id;
            await promptApi.bulkUploadEvalDatasetCases(workspaceId, promptId, datasetId, {
                testCases,
                replaceExisting: true,
            });
            return datasetId;
        },
        onSuccess: (datasetId) => {
            queryClient.invalidateQueries({ queryKey: ['evalDatasets', workspaceId, promptId] });
            queryClient.invalidateQueries({ queryKey: ['evalDatasetCases', workspaceId, promptId, datasetId] });
            setPreviewDatasetId(datasetId);
            setRunDatasetId((prev) => prev ?? datasetId);
            setIsCreatingDataset(false);
            setNewDatasetName('');
            setCaseRows([createEmptyCaseFormRow()]);
            setExpandedEditorCaseId(null);
        },
        onError: (error: Error) => {
            alert(error.message);
        },
    });

    const startRunMutation = useMutation({
        mutationFn: async () => {
            if (!resolvedRunDatasetId || !resolvedVersionId) {
                throw new Error('데이터셋과 버전을 선택하세요.');
            }
            if (resolvedMode === 'COMPARE_ACTIVE' && !release?.activeVersionId) {
                throw new Error('운영 버전이 없어 비교 평가를 실행할 수 없습니다.');
            }

            const response = await promptApi.createEvalRun(workspaceId, promptId, {
                datasetId: resolvedRunDatasetId,
                promptVersionId: resolvedVersionId,
                mode: resolvedMode,
                rubricTemplateCode: resolvedRubricTemplateCode,
                rubricOverrides: resolvedRubricOverrides ?? undefined,
            });
            return response.data.id;
        },
        onSuccess: (runId) => {
            setCurrentRunId(runId);
            setCurrentStep('RESULT');
            queryClient.invalidateQueries({ queryKey: ['evalRuns', workspaceId, promptId] });
            queryClient.invalidateQueries({ queryKey: ['evalRunCases', workspaceId, promptId, runId] });
        },
        onError: (error: Error) => {
            alert(error.message);
        },
    });

    const cancelRunMutation = useMutation({
        mutationFn: async () => {
            if (!resolvedRunId) {
                throw new Error('취소할 실행이 없습니다.');
            }
            await promptApi.cancelEvalRun(workspaceId, promptId, resolvedRunId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evalRuns', workspaceId, promptId] });
            queryClient.invalidateQueries({ queryKey: ['evalRun', workspaceId, promptId, resolvedRunId] });
            queryClient.invalidateQueries({ queryKey: ['evalRunCases', workspaceId, promptId, resolvedRunId] });
        },
        onError: (error: Error) => {
            alert(error.message);
        },
    });

    const updateReleaseCriteriaMutation = useMutation({
        mutationFn: async () => {
            if (!releaseCriteriaDraft) {
                throw new Error('배포 판정 기준을 불러오는 중입니다. 잠시 후 다시 시도하세요.');
            }

            const rawValues = [
                releaseCriteriaDraft.minPassRate,
                releaseCriteriaDraft.minAvgOverallScore,
                releaseCriteriaDraft.maxErrorRate,
                releaseCriteriaDraft.minImprovementNoticeDelta,
            ];
            if (rawValues.some((value) => value.trim().length === 0)) {
                throw new Error('배포 판정 기준 입력값을 모두 채워주세요.');
            }

            const minPassRate = parseFiniteNumber(releaseCriteriaDraft.minPassRate);
            const minAvgOverallScore = parseFiniteNumber(releaseCriteriaDraft.minAvgOverallScore);
            const maxErrorRate = parseFiniteNumber(releaseCriteriaDraft.maxErrorRate);
            const minImprovementNoticeDelta = parseFiniteNumber(releaseCriteriaDraft.minImprovementNoticeDelta);

            const parsedValues = [
                minPassRate,
                minAvgOverallScore,
                maxErrorRate,
                minImprovementNoticeDelta,
            ];
            if (parsedValues.some((value) => value == null)) {
                throw new Error('배포 판정 기준은 숫자로 입력해야 합니다.');
            }
            if (parsedValues.some((value) => (value ?? 0) < 0 || (value ?? 0) > 100)) {
                throw new Error('배포 판정 기준은 0~100 범위에서 입력해야 합니다.');
            }

            return (
                await promptApi.updateEvalReleaseCriteria(workspaceId, {
                    minPassRate: minPassRate!,
                    minAvgOverallScore: minAvgOverallScore!,
                    maxErrorRate: maxErrorRate!,
                    minImprovementNoticeDelta: minImprovementNoticeDelta!,
                })
            ).data;
        },
        onMutate: () => {
            setReleaseCriteriaNotice(null);
        },
        onSuccess: (updatedCriteria) => {
            setReleaseCriteriaDraft(toReleaseCriteriaDraft(updatedCriteria));
            setReleaseCriteriaNotice({ type: 'success', message: '배포 판정 기준을 저장했습니다.' });
            queryClient.invalidateQueries({ queryKey: ['evalReleaseCriteria', workspaceId] });
            queryClient.invalidateQueries({ queryKey: ['evalReleaseCriteriaHistory', workspaceId] });
        },
        onError: (error: unknown) => {
            const { status, message } = extractApiError(error);
            const fallbackMessage = status === 403
                ? '워크스페이스 소유자만 배포 판정 기준을 변경할 수 있습니다.'
                : '배포 판정 기준 저장에 실패했습니다.';
            setReleaseCriteriaNotice({
                type: 'error',
                message: message ?? fallbackMessage,
            });
        },
    });

    const updateCaseRow = (id: string, field: EditableCaseField, value: string) => {
        setCaseRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    };

    const parseJsonSafe = (text: string): JsonObject => {
        try {
            const parsed: unknown = JSON.parse(text || '{}');
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as JsonObject;
            }
            return {};
        } catch {
            return {};
        }
    };

    const updateCaseJsonObject = (
        id: string,
        field: CaseJsonField,
        updater: (prev: JsonObject) => JsonObject
    ) => {
        setCaseRows((prev) =>
            prev.map((row) => {
                if (row.id !== id) {
                    return row;
                }
                const current = parseJsonSafe(row[field]);
                return {
                    ...row,
                    [field]: JSON.stringify(updater(current), null, 2),
                };
            })
        );
    };

    const setCaseArrayField = (id: string, field: CaseJsonField, key: string, values: string[]) => {
        updateCaseJsonObject(id, field, (prev) => {
            const next = { ...prev };
            if (values.length > 0) {
                next[key] = values;
            } else {
                delete next[key];
            }
            return next;
        });
    };

    const setConstraintJsonOnly = (id: string, checked: boolean) => {
        updateCaseJsonObject(id, 'constraintsJsonText', (prev) => {
            const next = { ...prev };
            if (checked) {
                next.format = 'json_only';
            } else {
                delete next.format;
            }
            return next;
        });
    };

    const removeCaseRow = (id: string) => {
        setCaseRows((prev) => prev.filter((row) => row.id !== id));
        setExpandedEditorCaseId((prev) => (prev === id ? null : prev));
    };

    const handleChangeReleaseCriteriaDraft = (field: keyof ReleaseCriteriaDraft, value: string) => {
        setReleaseCriteriaNotice(null);
        setReleaseCriteriaDraft((prev) => ({
            ...(prev ?? DEFAULT_RELEASE_CRITERIA_DRAFT),
            [field]: value,
        }));
    };

    const handleResetReleaseCriteriaDraft = () => {
        setReleaseCriteriaNotice(null);
        setReleaseCriteriaDraft(
            releaseCriteria ? toReleaseCriteriaDraft(releaseCriteria) : DEFAULT_RELEASE_CRITERIA_DRAFT
        );
    };

    const isRunInProgress = run?.status === 'RUNNING' || run?.status === 'QUEUED';
    const activeStep: StudioStep = isRunInProgress ? 'RESULT' : currentStep;

    return (
        <div className="min-h-[800px] flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400">science</span>
                        프롬프트 스튜디오 (Prompt Studio)
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">설계하고, 평가하고, 개선하세요.</p>
                </div>
                <div className="flex items-center bg-black/30 rounded-full p-1 border border-white/10">
                    <StepButton
                        label="1. 데이터셋"
                        active={activeStep === 'DATASET'}
                        done={(datasets?.length ?? 0) > 0}
                        onClick={() => setCurrentStep('DATASET')}
                    />
                    <div className="w-4 h-px bg-white/10" />
                    <StepButton
                        label="2. 설정"
                        active={activeStep === 'CONFIG'}
                        done={!!resolvedVersionId && !!resolvedRunDatasetId}
                        onClick={() => setCurrentStep('CONFIG')}
                    />
                    <div className="w-4 h-px bg-white/10" />
                    <StepButton
                        label="3. 결과"
                        active={activeStep === 'RESULT'}
                        done={!!resolvedRunId}
                        onClick={() => {
                            if (resolvedRunId) {
                                setCurrentStep('RESULT');
                            }
                        }}
                    />
                </div>
            </div>

            <div className="flex-1 relative">
                {activeStep === 'DATASET' && (
                    <DatasetSection
                        datasets={datasets || []}
                        selectedId={resolvedPreviewDatasetId}
                        onSelect={setPreviewDatasetId}
                        isCreating={isCreatingDataset}
                        setCreating={setIsCreatingDataset}
                        newName={newDatasetName}
                        setNewName={setNewDatasetName}
                        rows={caseRows}
                        setRows={setCaseRows}
                        expandedEditorCaseId={expandedEditorCaseId}
                        setExpandedEditorCaseId={setExpandedEditorCaseId}
                        updateCaseRow={updateCaseRow}
                        setCaseArrayField={setCaseArrayField}
                        setConstraintJsonOnly={setConstraintJsonOnly}
                        updateCaseJsonObject={updateCaseJsonObject}
                        removeCaseRow={removeCaseRow}
                        onSave={() => createDatasetMutation.mutate()}
                        isSaving={createDatasetMutation.isPending}
                        onNext={() => setCurrentStep('CONFIG')}
                        existingCases={datasetCases || []}
                    />
                )}

                {activeStep === 'CONFIG' && (
                    <ConfigSection
                        datasets={datasets || []}
                        selectedDatasetId={resolvedRunDatasetId}
                        onSelectDataset={setRunDatasetId}
                        versions={versions || []}
                        selectedVersionId={resolvedVersionId}
                        onSelectVersion={setSelectedVersionId}
                        mode={resolvedMode}
                        setMode={setMode}
                        rubricTemplateCode={resolvedRubricTemplateCode}
                        onChangeRubricTemplate={handleRubricTemplateChange}
                        useRubricOverrides={useRubricOverrides}
                        onToggleRubricOverrides={handleRubricOverrideToggle}
                        rubricCriteriaRows={rubricCriteriaRows}
                        setRubricCriteriaRows={setRubricCriteriaRows}
                        rubricMinOverallScore={rubricMinOverallScore}
                        setRubricMinOverallScore={setRubricMinOverallScore}
                        rubricRequireJsonParsePass={rubricRequireJsonParsePass}
                        setRubricRequireJsonParsePass={setRubricRequireJsonParsePass}
                        rubricDescriptionNote={rubricDescriptionNote}
                        setRubricDescriptionNote={setRubricDescriptionNote}
                        onResetRubricPreset={() => applyRubricPreset(resolvedRubricTemplateCode)}
                        releaseCriteriaDraft={releaseCriteriaDraft}
                        isLoadingReleaseCriteria={isLoadingReleaseCriteria}
                        releaseCriteriaNotice={releaseCriteriaNotice}
                        onChangeReleaseCriteriaDraft={handleChangeReleaseCriteriaDraft}
                        onSaveReleaseCriteria={() => updateReleaseCriteriaMutation.mutate()}
                        onResetReleaseCriteria={handleResetReleaseCriteriaDraft}
                        isSavingReleaseCriteria={updateReleaseCriteriaMutation.isPending}
                        releaseCriteriaUpdatedBy={releaseCriteria?.updatedBy ?? null}
                        releaseCriteriaUpdatedAt={releaseCriteria?.updatedAt ?? null}
                        releaseCriteriaHistory={releaseCriteriaHistory ?? []}
                        hasActiveRelease={!!release?.activeVersionId}
                        activeReleaseVersionLabel={activeReleaseVersionLabel}
                        runEstimate={runEstimate ?? null}
                        isEstimatingRunEstimate={isEstimatingRunEstimate}
                        onRun={() => startRunMutation.mutate()}
                        isRunning={startRunMutation.isPending}
                    />
                )}

                {activeStep === 'RESULT' && (
                    <ResultDashboard
                        run={run || null}
                        runs={runs || []}
                        versions={versions || []}
                        selectedRunId={resolvedRunId}
                        onSelectRun={setCurrentRunId}
                        onCancelRun={() => cancelRunMutation.mutate()}
                        isCancelling={cancelRunMutation.isPending}
                        cases={runCases || []}
                        compareMode={run?.mode === 'COMPARE_ACTIVE'}
                        caseInputById={caseInputById}
                        caseContextById={caseContextById}
                    />
                )}
            </div>
        </div>
    );
}

interface DatasetSectionProps {
    datasets: Array<{ id: number; name: string }>;
    selectedId: number | null;
    onSelect: (id: number) => void;
    isCreating: boolean;
    setCreating: (flag: boolean) => void;
    newName: string;
    setNewName: (name: string) => void;
    rows: CaseFormRow[];
    setRows: Dispatch<SetStateAction<CaseFormRow[]>>;
    expandedEditorCaseId: string | null;
    setExpandedEditorCaseId: Dispatch<SetStateAction<string | null>>;
    updateCaseRow: (rowId: string, field: EditableCaseField, value: string) => void;
    setCaseArrayField: (rowId: string, field: CaseJsonField, key: string, values: string[]) => void;
    setConstraintJsonOnly: (rowId: string, checked: boolean) => void;
    updateCaseJsonObject: (rowId: string, field: CaseJsonField, updater: (current: JsonObject) => JsonObject) => void;
    removeCaseRow: (rowId: string) => void;
    onSave: () => void;
    isSaving: boolean;
    onNext: () => void;
    existingCases: EvalTestCaseResponse[];
}

function DatasetSection({
    datasets,
    selectedId,
    onSelect,
    isCreating,
    setCreating,
    newName,
    setNewName,
    rows,
    setRows,
    expandedEditorCaseId,
    setExpandedEditorCaseId,
    updateCaseRow,
    setCaseArrayField,
    setConstraintJsonOnly,
    updateCaseJsonObject,
    removeCaseRow,
    onSave,
    isSaving,
    onNext,
    existingCases,
}: DatasetSectionProps) {
    return (
        <div className="grid grid-cols-12 gap-6 h-full">
            <div className="col-span-3 glass-card border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-white">데이터셋 목록</h4>
                    <button type="button" onClick={() => setCreating(true)} className="text-[var(--primary)] text-xs hover:underline">
                        + 새로 만들기
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                    {datasets.map((dataset) => (
                        <button
                            type="button"
                            key={dataset.id}
                            onClick={() => {
                                onSelect(dataset.id);
                                setCreating(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all border ${
                                selectedId === dataset.id
                                    ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-white font-medium shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                                    : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-gray-200'
                            }`}
                        >
                            {dataset.name}
                        </button>
                    ))}
                    {datasets.length === 0 && (
                        <p className="text-xs text-gray-500 py-6 text-center">아직 데이터셋이 없습니다.</p>
                    )}
                </div>
            </div>

            <div className="col-span-9 glass-card border border-white/10 rounded-xl p-6 flex flex-col">
                {isCreating ? (
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <h4 className="text-lg font-bold text-white">새 데이터셋 생성</h4>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCreating(false)}
                                    className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    onClick={onSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-[var(--primary)] text-black rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-60"
                                >
                                    {isSaving ? '저장 중...' : '저장하기'}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">이름</label>
                                <input
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                    value={newName}
                                    onChange={(event) => setNewName(event.target.value)}
                                    placeholder="예: v1.0 테스트용"
                                />
                            </div>
                            <div className="space-y-3">
                                <p className="text-xs text-gray-400">테스트 케이스 (질문 및 규칙)</p>
                                {rows.map((row, idx) => (
                                    <CaseEditorRow
                                        key={row.id}
                                        row={row}
                                        idx={idx}
                                        caseCount={rows.length}
                                        expandedEditorCaseId={expandedEditorCaseId}
                                        setExpandedEditorCaseId={setExpandedEditorCaseId}
                                        removeCaseRow={removeCaseRow}
                                        updateCaseRow={updateCaseRow}
                                        setCaseArrayField={setCaseArrayField}
                                        setConstraintJsonOnly={setConstraintJsonOnly}
                                        updateCaseJsonObject={updateCaseJsonObject}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="pt-4 mt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const newRow = createEmptyCaseFormRow();
                                    setRows((prev) => [...prev, newRow]);
                                    setExpandedEditorCaseId(newRow.id);
                                }}
                                className="px-4 py-2 rounded-lg border border-dashed border-white/20 text-xs text-gray-300 hover:border-white/40 hover:text-white"
                            >
                                + 케이스 추가
                            </button>
                            <button
                                type="button"
                                onClick={onSave}
                                disabled={isSaving}
                                className="px-5 py-2 bg-[var(--primary)] text-black rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-60"
                            >
                                {isSaving ? '저장 중...' : '데이터셋 저장'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-lg font-bold text-white">데이터셋 미리보기</h4>
                            <button
                                type="button"
                                onClick={onNext}
                                disabled={!selectedId}
                                className="px-6 py-2 bg-white text-black rounded-lg text-sm font-bold shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:transform-none"
                            >
                                다음 단계 (설정) &rarr;
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                            {existingCases.map((item) => {
                                const mustCover = Array.isArray(item.expectedJson?.must_cover) ? item.expectedJson.must_cover : [];
                                const mustInclude = Array.isArray(item.constraintsJson?.must_include) ? item.constraintsJson.must_include : [];
                                const mustNotInclude = Array.isArray(item.constraintsJson?.must_not_include) ? item.constraintsJson.must_not_include : [];
                                const rules = [
                                    ...mustInclude.map((word) => `필수: "${String(word)}"`),
                                    ...mustNotInclude.map((word) => `금지: "${String(word)}"`),
                                    item.constraintsJson?.format === 'json_only' ? 'JSON형식' : null,
                                ].filter((value): value is string => Boolean(value));

                                return (
                                    <div key={item.id} className="p-4 bg-black/20 border border-white/5 rounded-xl space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-bold text-gray-500">Q. 질문</p>
                                            {item.externalId && (
                                                <span className="text-[10px] text-gray-300 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">
                                                    ID: {item.externalId}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-200">{item.input}</p>

                                        {(mustCover.length > 0 || rules.length > 0) && <div className="h-px bg-white/5" />}

                                        <div className="grid grid-cols-2 gap-4">
                                            {mustCover.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-emerald-500/80 mb-1 uppercase">AI 정답 가이드</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {mustCover.map((text, index) => (
                                                            <span
                                                                key={`${String(text)}-${index}`}
                                                                className="text-[11px] bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded border border-emerald-500/20"
                                                            >
                                                                {String(text)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {rules.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-sky-500/80 mb-1 uppercase">룰 체크</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {rules.map((text, index) => (
                                                            <span
                                                                key={`${text}-${index}`}
                                                                className="text-[11px] bg-sky-500/10 text-sky-300 px-2 py-1 rounded border border-sky-500/20"
                                                            >
                                                                {text}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {existingCases.length === 0 && (
                                <div className="text-center text-gray-500 py-10">데이터가 없습니다.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

interface ConfigSectionProps {
    datasets: Array<{ id: number; name: string }>;
    selectedDatasetId: number | null;
    onSelectDataset: (id: number) => void;
    versions: Array<{ id: number; versionNumber: number; model: string }>;
    selectedVersionId: number | null;
    onSelectVersion: (id: number) => void;
    mode: EvalMode;
    setMode: (mode: EvalMode) => void;
    rubricTemplateCode: RubricTemplateCode;
    onChangeRubricTemplate: (code: RubricTemplateCode) => void;
    useRubricOverrides: boolean;
    onToggleRubricOverrides: (enabled: boolean) => void;
    rubricCriteriaRows: RubricCriterionDraft[];
    setRubricCriteriaRows: Dispatch<SetStateAction<RubricCriterionDraft[]>>;
    rubricMinOverallScore: string;
    setRubricMinOverallScore: (value: string) => void;
    rubricRequireJsonParsePass: boolean;
    setRubricRequireJsonParsePass: (value: boolean) => void;
    rubricDescriptionNote: string;
    setRubricDescriptionNote: (value: string) => void;
    onResetRubricPreset: () => void;
    releaseCriteriaDraft: ReleaseCriteriaDraft | null;
    releaseCriteriaNotice: ReleaseCriteriaNotice | null;
    isLoadingReleaseCriteria: boolean;
    onChangeReleaseCriteriaDraft: (field: keyof ReleaseCriteriaDraft, value: string) => void;
    onSaveReleaseCriteria: () => void;
    onResetReleaseCriteria: () => void;
    isSavingReleaseCriteria: boolean;
    releaseCriteriaUpdatedBy: number | null;
    releaseCriteriaUpdatedAt: string | null;
    releaseCriteriaHistory: EvalReleaseCriteriaAuditResponse[];
    hasActiveRelease: boolean;
    activeReleaseVersionLabel: string | null;
    runEstimate: EvalRunEstimateResponse | null;
    isEstimatingRunEstimate: boolean;
    onRun: () => void;
    isRunning: boolean;
}

function ConfigSection({
    datasets,
    selectedDatasetId,
    onSelectDataset,
    versions,
    selectedVersionId,
    onSelectVersion,
    mode,
    setMode,
    rubricTemplateCode,
    onChangeRubricTemplate,
    useRubricOverrides,
    onToggleRubricOverrides,
    rubricCriteriaRows,
    setRubricCriteriaRows,
    rubricMinOverallScore,
    setRubricMinOverallScore,
    rubricRequireJsonParsePass,
    setRubricRequireJsonParsePass,
    rubricDescriptionNote,
    setRubricDescriptionNote,
    onResetRubricPreset,
    releaseCriteriaDraft,
    releaseCriteriaNotice,
    isLoadingReleaseCriteria,
    onChangeReleaseCriteriaDraft,
    onSaveReleaseCriteria,
    onResetReleaseCriteria,
    isSavingReleaseCriteria,
    releaseCriteriaUpdatedBy,
    releaseCriteriaUpdatedAt,
    releaseCriteriaHistory,
    hasActiveRelease,
    activeReleaseVersionLabel,
    runEstimate,
    isEstimatingRunEstimate,
    onRun,
    isRunning,
}: ConfigSectionProps) {
    const updateCriterionRow = (
        rowId: string,
        field: keyof Omit<RubricCriterionDraft, 'id'>,
        value: string
    ) => {
        setRubricCriteriaRows((prev) =>
            prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
        );
    };

    const addCriterionRow = () => {
        setRubricCriteriaRows((prev) => [...prev, createRubricCriterionDraft()]);
    };

    const removeCriterionRow = (rowId: string) => {
        setRubricCriteriaRows((prev) => prev.filter((row) => row.id !== rowId));
    };

    const activeCriteriaCount = rubricCriteriaRows.filter((row) => row.key.trim().length > 0).length;
    const runBlockedReason =
        !selectedDatasetId
            ? '실행 데이터셋을 선택하세요.'
            : !selectedVersionId
                ? '대상 버전을 선택하세요.'
                : null;
    const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
    const singleMode = mode === 'CANDIDATE_ONLY';
    const compareMode = mode === 'COMPARE_ACTIVE';
    const estimateCostRange = formatUsdRange(runEstimate?.estimatedCostUsdMin, runEstimate?.estimatedCostUsdMax);
    const estimateDurationRange = formatDurationRangeSec(runEstimate?.estimatedDurationSecMin, runEstimate?.estimatedDurationSecMax);
    const estimateTooltip = runEstimate
        ? `예상 비용 ${estimateCostRange}\n예상 소요 ${estimateDurationRange}\n예상 호출 ${runEstimate.estimatedCallsMin}~${runEstimate.estimatedCallsMax}회`
        : isEstimatingRunEstimate
            ? '예상치 계산 중...'
            : '실행 전 예상치가 준비되지 않았습니다.';
    const effectiveReleaseCriteriaDraft = releaseCriteriaDraft ?? DEFAULT_RELEASE_CRITERIA_DRAFT;
    const releaseCriteriaActionsDisabled = isLoadingReleaseCriteria || isSavingReleaseCriteria;
    const releaseCriteriaHistoryPreview = releaseCriteriaHistory.slice(0, 5);

    return (
        <div className="max-w-4xl mx-auto pt-10 animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-bold text-white mb-8 text-center">어떻게 평가하시겠습니까?</h3>

            <div className="space-y-6 mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-black/20 border border-white/10 rounded-2xl p-6 space-y-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">실행 선택</p>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">실행 데이터셋 (Dataset)</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {datasets.map((dataset) => (
                                    <button
                                        type="button"
                                        key={dataset.id}
                                        onClick={() => onSelectDataset(dataset.id)}
                                        className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all ${
                                            selectedDatasetId === dataset.id
                                                ? 'bg-fuchsia-500/20 border-fuchsia-500 text-white'
                                                : 'bg-black/40 border-transparent text-gray-400 hover:bg-white/5'
                                        }`}
                                    >
                                        <span className="text-sm truncate">{dataset.name}</span>
                                        <span className="text-xs opacity-60">#{dataset.id}</span>
                                    </button>
                                ))}
                            </div>
                            {datasets.length === 0 && <p className="text-[11px] text-rose-400 mt-2">데이터셋을 먼저 생성하세요.</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3">대상 버전 (Target Version)</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {versions.map((version) => (
                                    <button
                                        type="button"
                                        key={version.id}
                                        onClick={() => onSelectVersion(version.id)}
                                        className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all ${
                                            selectedVersionId === version.id
                                                ? 'bg-purple-500/20 border-purple-500 text-white'
                                                : 'bg-black/40 border-transparent text-gray-400 hover:bg-white/5'
                                        }`}
                                    >
                                        <span className="font-mono text-sm">v{version.versionNumber}</span>
                                        <span className="text-xs opacity-60">{version.model}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="bg-black/20 border border-white/10 rounded-2xl p-5 space-y-3">
                            <label className="block text-xs font-bold text-gray-400 uppercase">평가 모드 (Mode)</label>
                            <button
                                type="button"
                                onClick={() => setMode('CANDIDATE_ONLY')}
                                className={`w-full p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                                    mode === 'CANDIDATE_ONLY'
                                        ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/50'
                                        : 'bg-black/20 border-white/10 opacity-60 hover:opacity-100'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                                    <span className="font-bold text-emerald-100">기본 검증 (Single)</span>
                                </div>
                                <p className="text-xs text-gray-400">선택한 버전만 빠르고 독립적으로 검사합니다.</p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMode('COMPARE_ACTIVE')}
                                disabled={!hasActiveRelease}
                                className={`w-full p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                                    mode === 'COMPARE_ACTIVE'
                                        ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/50'
                                        : 'bg-black/20 border-white/10 opacity-60 hover:opacity-100 disabled:opacity-30'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-blue-400">compare_arrows</span>
                                    <span className="font-bold text-blue-100">운영 비교 (Compare)</span>
                                </div>
                                <p className="text-xs text-gray-400">현재 운영중인 버전과 성능/품질을 비교합니다.</p>
                                {!hasActiveRelease && <p className="text-[10px] text-rose-400 mt-1">* 운영 버전 없음</p>}
                            </button>
                        </div>

                        <div className="bg-black/20 border border-white/10 rounded-2xl p-4 space-y-3">
                            <p className="text-xs font-bold text-gray-400 uppercase">비교 프리뷰</p>
                            {singleMode && (
                                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 animate-in fade-in duration-200">
                                    <p className="text-[10px] text-emerald-200 mb-1">단일 검증</p>
                                    <p className="text-sm text-emerald-100 font-semibold">
                                        내 버전 {selectedVersion ? `v${selectedVersion.versionNumber}` : '(미선택)'}
                                    </p>
                                    <p className="text-[11px] text-emerald-200/80 mt-1">선택한 버전만 기준 충족 여부를 검사합니다.</p>
                                </div>
                            )}

                            {compareMode && (
                                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                                        <p className="text-[10px] text-blue-200 mb-1">내 버전</p>
                                        <p className="text-sm text-blue-100 font-semibold">
                                            {selectedVersion ? `v${selectedVersion.versionNumber}` : '(미선택)'}
                                        </p>
                                        <p className="text-[10px] text-blue-200/75 mt-1">{selectedVersion?.model ?? '-'}</p>
                                    </div>
                                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                                        <p className="text-[10px] text-indigo-200 mb-1">운영 버전 (Active)</p>
                                        <p className="text-sm text-indigo-100 font-semibold">{activeReleaseVersionLabel ?? '(없음)'}</p>
                                        <p className="text-[10px] text-indigo-200/75 mt-1">현재 배포 상태와 직접 비교합니다.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-black/20 border border-white/10 rounded-2xl p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">평가 기준 (Rubric)</p>
                            <p className="text-[11px] text-gray-500 mt-1">템플릿 선택 후 필요하면 세부 기준을 직접 정의하세요.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleRubricOverrides(!useRubricOverrides)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                useRubricOverrides
                                    ? 'bg-[var(--primary)]/20 border-[var(--primary)] text-[var(--primary)]'
                                    : 'bg-black/30 border-white/10 text-gray-300 hover:text-white'
                            }`}
                        >
                            {useRubricOverrides ? '커스텀 기준 ON' : '커스텀 기준 OFF'}
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">루브릭 템플릿</label>
                        <select
                            value={rubricTemplateCode}
                            onChange={(event) => onChangeRubricTemplate(event.target.value as RubricTemplateCode)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--primary)] outline-none"
                        >
                            {RUBRIC_OPTIONS.map((option) => (
                                <option key={option.code} value={option.code}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-gray-500 mt-2">
                            {RUBRIC_OPTIONS.find((option) => option.code === rubricTemplateCode)?.description}
                        </p>
                    </div>

                    {useRubricOverrides ? (
                        <div className="space-y-4 border border-white/10 rounded-xl p-4 bg-black/30">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-gray-300">
                                    현재 {activeCriteriaCount}개 기준이 적용됩니다.
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={onResetRubricPreset}
                                        className="text-[11px] text-gray-300 px-2.5 py-1 rounded border border-white/15 hover:border-white/30"
                                    >
                                        템플릿 기준 불러오기
                                    </button>
                                    <button
                                        type="button"
                                        onClick={addCriterionRow}
                                        className="text-[11px] text-[var(--primary)] px-2.5 py-1 rounded border border-[var(--primary)]/40 hover:border-[var(--primary)]"
                                    >
                                        + 기준 추가
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {rubricCriteriaRows.map((row) => (
                                    <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                                        <input
                                            value={row.key}
                                            onChange={(event) => updateCriterionRow(row.id, 'key', event.target.value)}
                                            placeholder="criterion key (예: relevance)"
                                            className="col-span-4 bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
                                        />
                                        <input
                                            value={row.description}
                                            onChange={(event) => updateCriterionRow(row.id, 'description', event.target.value)}
                                            placeholder="의미 설명"
                                            className="col-span-5 bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
                                        />
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={row.weight}
                                            onChange={(event) => updateCriterionRow(row.id, 'weight', event.target.value)}
                                            placeholder="weight"
                                            className="col-span-2 bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeCriterionRow(row.id)}
                                            disabled={rubricCriteriaRows.length <= 1}
                                            className="col-span-1 text-gray-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title={rubricCriteriaRows.length <= 1 ? '최소 1개 기준 필요' : '기준 삭제'}
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] text-gray-400">최소 종합 점수 (minOverallScore)</label>
                                    <input
                                        type="number"
                                        value={rubricMinOverallScore}
                                        onChange={(event) => setRubricMinOverallScore(event.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                    />
                                </div>
                                <label className="flex items-center gap-2 text-xs text-gray-300 mt-5">
                                    <input
                                        type="checkbox"
                                        checked={rubricRequireJsonParsePass}
                                        onChange={(event) => setRubricRequireJsonParsePass(event.target.checked)}
                                        className="rounded border-white/20 bg-white/10"
                                    />
                                    JSON 파싱 성공 필수 (requireJsonParsePass)
                                </label>
                            </div>

                            <div>
                                <label className="text-[11px] text-gray-400 block mb-1">루브릭 설명/노트</label>
                                <textarea
                                    value={rubricDescriptionNote}
                                    onChange={(event) => setRubricDescriptionNote(event.target.value)}
                                    placeholder="평가자의 판단 기준 메모를 입력하세요."
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white min-h-[72px] resize-y"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">
                                    각 기준 설명은 자동으로 description에 병합되어 Judge 프롬프트에 반영됩니다.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[11px] text-gray-500">
                            기본 템플릿 기준(또는 저장된 defaults override)을 그대로 사용합니다.
                        </p>
                    )}
                </div>

                <div className="bg-black/20 border border-white/10 rounded-2xl p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">배포 판정 기준</p>
                            <p className="text-[11px] text-gray-500 mt-1">
                                실행 결과의 배포 가능/보류는 아래 워크스페이스 기준으로 계산됩니다.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onResetReleaseCriteria}
                                disabled={releaseCriteriaActionsDisabled}
                                className="text-[11px] text-gray-300 px-2.5 py-1 rounded border border-white/15 hover:border-white/30 disabled:opacity-50"
                            >
                                기준 되돌리기
                            </button>
                            <button
                                type="button"
                                onClick={onSaveReleaseCriteria}
                                disabled={releaseCriteriaActionsDisabled}
                                className="text-[11px] text-[var(--primary)] px-2.5 py-1 rounded border border-[var(--primary)]/40 hover:border-[var(--primary)] disabled:opacity-50"
                            >
                                {isSavingReleaseCriteria ? '저장 중...' : '기준 저장'}
                            </button>
                        </div>
                    </div>

                    {releaseCriteriaNotice && (
                        <div
                            className={`rounded-lg border px-3 py-2 text-xs ${
                                releaseCriteriaNotice.type === 'success'
                                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                                    : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                            }`}
                        >
                            {releaseCriteriaNotice.message}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] text-gray-400">최소 통과율 (%)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                value={effectiveReleaseCriteriaDraft.minPassRate}
                                onChange={(event) => onChangeReleaseCriteriaDraft('minPassRate', event.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-gray-400">최소 평균 점수</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                value={effectiveReleaseCriteriaDraft.minAvgOverallScore}
                                onChange={(event) => onChangeReleaseCriteriaDraft('minAvgOverallScore', event.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-gray-400">최대 오류율 (%)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                value={effectiveReleaseCriteriaDraft.maxErrorRate}
                                onChange={(event) => onChangeReleaseCriteriaDraft('maxErrorRate', event.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-gray-400">개선폭 알림 기준 (비교 모드 Δ점수)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                value={effectiveReleaseCriteriaDraft.minImprovementNoticeDelta}
                                onChange={(event) => onChangeReleaseCriteriaDraft('minImprovementNoticeDelta', event.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                            />
                        </div>
                    </div>

                    <p className="text-[10px] text-gray-500">
                        마지막 업데이트: {releaseCriteriaUpdatedAt ? formatTimestamp(releaseCriteriaUpdatedAt) : '-'}
                        {releaseCriteriaUpdatedBy != null ? ` · 변경자 #${releaseCriteriaUpdatedBy}` : ''}
                        {' / '}
                        저장한 기준은 다음 실행부터 판정에 반영됩니다.
                    </p>

                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                        <p className="text-[11px] text-gray-300">최근 기준 변경 이력</p>
                        {releaseCriteriaHistoryPreview.length === 0 ? (
                            <p className="text-[11px] text-gray-500">아직 이력이 없습니다.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {releaseCriteriaHistoryPreview.map((historyItem) => (
                                    <div key={historyItem.id} className="text-[11px] text-gray-300 flex flex-wrap items-center gap-2">
                                        <span className="text-gray-500">{formatTimestamp(historyItem.changedAt)}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">변경자 #{historyItem.changedBy ?? '-'}</span>
                                        <span>Pass ≥ {historyItem.minPassRate.toFixed(1)}%</span>
                                        <span>Score ≥ {historyItem.minAvgOverallScore.toFixed(1)}</span>
                                        <span>Error ≤ {historyItem.maxErrorRate.toFixed(1)}%</span>
                                        <span>Δ ≥ {historyItem.minImprovementNoticeDelta.toFixed(1)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="text-center space-y-3">
                <div className="relative inline-flex flex-col items-center group">
                    <button
                        type="button"
                        onClick={onRun}
                        title={estimateTooltip}
                        disabled={isRunning || !selectedVersionId || !selectedDatasetId}
                        className="px-10 py-4 bg-white text-black rounded-full font-black text-xl shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:scale-105 transition-all disabled:opacity-50 disabled:transform-none"
                    >
                        {isRunning ? '실행 중...' : '평가 시작'}
                    </button>
                    <div className="pointer-events-none absolute bottom-full mb-2 w-[280px] rounded-lg border border-white/20 bg-black/90 px-3 py-2 text-left text-[11px] text-gray-200 opacity-0 translate-y-1 transition-all group-hover:opacity-100 group-hover:translate-y-0">
                        <p className="font-semibold text-white mb-1">실행 예상치</p>
                        <p>비용: {estimateCostRange}</p>
                        <p>소요: {estimateDurationRange}</p>
                        {runEstimate && <p>호출: {runEstimate.estimatedCallsMin}~{runEstimate.estimatedCallsMax}회</p>}
                        {!runEstimate && <p>{isEstimatingRunEstimate ? '예상치 계산 중...' : '예상치를 준비하지 못했습니다.'}</p>}
                    </div>
                </div>

                {runEstimate && (
                    <div className="flex flex-wrap justify-center gap-2 text-[11px] text-gray-300">
                        <span className="px-2 py-1 rounded border border-white/10 bg-white/5">
                            예상 비용 {estimateCostRange}
                        </span>
                        <span className="px-2 py-1 rounded border border-white/10 bg-white/5">
                            예상 시간 {estimateDurationRange}
                        </span>
                        <span className="px-2 py-1 rounded border border-white/10 bg-white/5">
                            예상 케이스 {runEstimate.estimatedCases}건
                        </span>
                    </div>
                )}

                {runEstimate?.estimateNotice && (
                    <p className="text-[11px] text-gray-500">{runEstimate.estimateNotice}</p>
                )}
                {runBlockedReason && <p className="text-xs text-rose-400">{runBlockedReason}</p>}
            </div>
        </div>
    );
}

interface ResultDashboardProps {
    run: EvalRunResponse | null;
    runs: EvalRunResponse[];
    versions: Array<{ id: number; versionNumber: number; model: string }>;
    selectedRunId: number | null;
    onSelectRun: (runId: number) => void;
    onCancelRun: () => void;
    isCancelling: boolean;
    cases: EvalCaseResultResponse[];
    compareMode: boolean;
    caseInputById: Record<number, string>;
    caseContextById: Record<number, RunCaseContext>;
}

type CaseFilter = 'ALL' | 'PASS' | 'FAIL' | 'ERROR' | 'RUNNING' | 'SKIPPED' | 'BETTER' | 'WORSE' | 'SAME';
type ReasonDrivenCaseFilter = Extract<CaseFilter, 'FAIL' | 'WORSE'>;

type RunTrendPoint = {
    runId: number;
    createdAt: string;
    mode: EvalMode;
    promptVersionId: number;
};

export function filterRunTrendPoints(
    points: RunTrendPoint[],
    modeFilter: EvalMode | 'ALL',
    versionFilter: number | 'ALL',
    windowSize = 10
): RunTrendPoint[] {
    const normalizedWindowSize = Number.isFinite(windowSize) ? Math.max(1, Math.floor(windowSize)) : 10;
    const sorted = [...points].sort((a, b) => {
        const timeA = Date.parse(a.createdAt);
        const timeB = Date.parse(b.createdAt);
        const resolvedA = Number.isFinite(timeA) ? timeA : 0;
        const resolvedB = Number.isFinite(timeB) ? timeB : 0;
        if (resolvedA !== resolvedB) return resolvedA - resolvedB;
        return a.runId - b.runId;
    });

    const filtered = sorted.filter((item) => {
        if (modeFilter !== 'ALL' && item.mode !== modeFilter) return false;
        if (versionFilter !== 'ALL' && item.promptVersionId !== versionFilter) return false;
        return true;
    });

    if (filtered.length <= normalizedWindowSize) {
        return filtered;
    }
    return filtered.slice(filtered.length - normalizedWindowSize);
}

function isPendingCase(status: EvalCaseResultResponse['status']): boolean {
    return status === 'QUEUED' || status === 'RUNNING';
}

function matchesCaseFilter(item: EvalCaseResultResponse, filter: CaseFilter): boolean {
    if (filter === 'ALL') return true;
    if (filter === 'PASS') return item.pass === true;
    if (filter === 'FAIL') return item.pass === false;
    if (filter === 'ERROR') return item.status === 'ERROR';
    if (filter === 'RUNNING') return isPendingCase(item.status);
    if (filter === 'SKIPPED') return item.status === 'SKIPPED';
    if (filter === 'BETTER') return resolveCompareDiffTone(item) === 'BETTER';
    if (filter === 'WORSE') return resolveCompareDiffTone(item) === 'WORSE';
    if (filter === 'SAME') return resolveCompareDiffTone(item) === 'SAME';
    return true;
}

export function resolveReasonDrivenCaseFilter(
    reason: string,
    winner: CompareBattleWinner,
    compareMode: boolean
): ReasonDrivenCaseFilter {
    if (!compareMode) {
        return 'FAIL';
    }

    const normalized = reason.toLowerCase();
    const regressionHints = ['회귀', '열세', '낮', '느려', '비용', 'worse', 'regression', 'loss'];
    const failHints = ['미달', '실패', '오류', 'must', 'passrate', '기준', 'fail', 'error'];

    if (regressionHints.some((hint) => normalized.includes(hint))) {
        return 'WORSE';
    }
    if (failHints.some((hint) => normalized.includes(hint))) {
        return 'FAIL';
    }
    return winner === 'BASELINE' ? 'WORSE' : 'FAIL';
}

function ResultDashboard({
    run,
    runs,
    versions,
    selectedRunId,
    onSelectRun,
    onCancelRun,
    isCancelling,
    cases,
    compareMode,
    caseInputById,
    caseContextById,
}: ResultDashboardProps) {
    const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
    const [caseFilter, setCaseFilter] = useState<CaseFilter>('ALL');

    const filteredCases = useMemo(
        () => cases.filter((item) => matchesCaseFilter(item, caseFilter)),
        [cases, caseFilter]
    );

    const resolvedSelectedCaseId = useMemo(() => {
        if (selectedCaseId && filteredCases.some((item) => item.id === selectedCaseId)) {
            return selectedCaseId;
        }
        return filteredCases[0]?.id ?? null;
    }, [selectedCaseId, filteredCases]);

    const selectedCase = useMemo(
        () => filteredCases.find((item) => item.id === resolvedSelectedCaseId) ?? null,
        [filteredCases, resolvedSelectedCaseId]
    );

    const isRunning = run?.status === 'RUNNING' || run?.status === 'QUEUED';

    const summary = asRecord(run?.summary);
    const cost = asRecord(run?.cost);
    const performance = asRecord(summary?.performance);
    const candidatePerformance = asRecord(performance?.candidate);
    const criteriaSnapshot = asRecord(summary?.criteriaSnapshot);
    const decisionReasons = asStringArray(summary?.decisionReasons);
    const localizedDecisionReasons = decisionReasons.map((reason) => toKoreanIssueText(reason));

    const total = run?.totalCases ?? cases.length;
    const loadedCount = cases.length;
    const completed = run?.processedCases ?? cases.filter((item) => item.status === 'OK' || item.status === 'ERROR' || item.status === 'SKIPPED').length;
    const passed = run?.passedCases ?? cases.filter((item) => item.pass === true).length;
    const failures = run ? run.failedCases + run.errorCases : cases.filter((item) => item.pass === false || item.status === 'ERROR').length;
    const warnings = cases.filter((item) => item.pass === true && extractJudgeLabels(item.judgeOutput).length > 0).length;
    const passRate = asNumber(summary?.passRate) ?? (completed > 0 ? (passed * 100) / completed : null);
    const errorRate = asNumber(summary?.errorRate) ?? (completed > 0 ? (run?.errorCases ?? 0) * 100 / completed : null);
    const avgOverallScore = asNumber(summary?.avgOverallScore);
    const avgScoreDelta = asNumber(summary?.avgScoreDelta);
    const compareCoverageRate = asNumber(summary?.compareCoverageRate);
    const releaseDecision = asString(summary?.releaseDecision);
    const riskLevel = asString(summary?.riskLevel);
    const plainSummary = asString(summary?.plainSummary);
    const topIssues = asStringArray(summary?.topIssues).slice(0, 3);
    const localizedTopIssues = topIssues.map((issue) => toKoreanIssueText(issue));
    const llmOverallReview = asRecord(summary?.llmOverallReview);
    const llmOverallComment = asString(llmOverallReview?.overallComment);
    const llmVerdictReason = asString(llmOverallReview?.verdictReason);
    const llmStrengths = asStringArray(llmOverallReview?.strengths).slice(0, 3);
    const llmRisks = asStringArray(llmOverallReview?.risks).slice(0, 3);
    const llmNextActions = asStringArray(llmOverallReview?.nextActions).slice(0, 3);
    const ruleFailDistribution = toCountDistribution(summary?.ruleFailCounts).slice(0, 5);
    const errorCodeDistribution = toCountDistribution(summary?.errorCodeCounts).slice(0, 5);
    const labelDistribution = toCountDistribution(summary?.labelCounts).slice(0, 5);
    const totalTokens = asNumber(cost?.totalTokens);
    const totalCostUsd = asNumber(cost?.totalCostUsd);
    const latencyStatsFromCases = useMemo(
        () => computeCandidateLatencyStats(cases),
        [cases]
    );
    const p95LatencyMs = asNumber(candidatePerformance?.p95LatencyMs) ?? latencyStatsFromCases.p95LatencyMs;
    const avgLatencyMs = asNumber(candidatePerformance?.avgLatencyMs) ?? latencyStatsFromCases.avgLatencyMs;
    const performanceDelta = asRecord(performance?.delta);
    const avgLatencyDeltaMs = asNumber(asRecord(performanceDelta?.avgLatencyMs)?.value);

    const compareCases = compareMode
        ? cases.filter((item) => resolveCompareDiffTone(item) !== 'UNKNOWN')
        : [];
    const compareCaseDeltas = compareMode
        ? compareCases.map((item) => toCompareCaseDelta(item))
        : [];
    const scoreDeltaSummary = summarizeDeltas(compareCaseDeltas.map((item) => item.scoreDelta));
    const tokenDeltaSummary = summarizeDeltas(compareCaseDeltas.map((item) => item.tokenDelta));
    const costDeltaSummary = summarizeDeltas(compareCaseDeltas.map((item) => item.costDelta));
    const latencyDeltaSummary = summarizeDeltas(compareCaseDeltas.map((item) => item.latencyDelta));
    const avgScoreDeltaEffective = avgScoreDelta ?? scoreDeltaSummary.avg;
    const avgLatencyDeltaEffective = avgLatencyDeltaMs ?? latencyDeltaSummary.avg;
    const passComparableCases = compareCaseDeltas.filter((item) => item.candidatePass != null && item.baselinePass != null);
    const passWinCases = passComparableCases.filter((item) => item.candidatePass === true && item.baselinePass === false).length;
    const passLossCases = passComparableCases.filter((item) => item.candidatePass === false && item.baselinePass === true).length;
    const betterCases = compareCases.filter((item) => resolveCompareDiffTone(item) === 'BETTER');
    const worseCases = compareCases.filter((item) => resolveCompareDiffTone(item) === 'WORSE');
    const sameCases = compareCases.filter((item) => resolveCompareDiffTone(item) === 'SAME');
    const compareWinRate = compareCases.length > 0 ? (betterCases.length * 100) / compareCases.length : null;
    const battleWinner: CompareBattleWinner = !compareMode
        ? null
        : betterCases.length > worseCases.length
            ? 'CANDIDATE'
            : worseCases.length > betterCases.length
                ? 'BASELINE'
                : 'TIE';
    const tradeoffParts: string[] = [];
    if (avgScoreDeltaEffective != null) {
        tradeoffParts.push(
            avgScoreDeltaEffective > 0
                ? `품질 상승(+${avgScoreDeltaEffective.toFixed(2)})`
                : avgScoreDeltaEffective < 0
                    ? `품질 하락(${avgScoreDeltaEffective.toFixed(2)})`
                    : '품질 동일'
        );
    }
    if (costDeltaSummary.avg != null) {
        tradeoffParts.push(
            costDeltaSummary.avg < 0
                ? `비용 절감(${formatSignedCurrency(costDeltaSummary.avg)})`
                : costDeltaSummary.avg > 0
                    ? `비용 증가(${formatSignedCurrency(costDeltaSummary.avg)})`
                    : '비용 동일'
        );
    }
    if (avgLatencyDeltaEffective != null) {
        tradeoffParts.push(
            avgLatencyDeltaEffective < 0
                ? `속도 개선(${formatSignedMs(avgLatencyDeltaEffective)})`
                : avgLatencyDeltaEffective > 0
                    ? `속도 저하(${formatSignedMs(avgLatencyDeltaEffective)})`
                    : '속도 동일'
        );
    }
    const compareTradeoffSummary = tradeoffParts.length > 0
        ? tradeoffParts.join(' · ')
        : '비교 데이터가 충분하지 않습니다.';
    const compareTradeoffChips: CompareTradeoffChip[] = [
        {
            key: 'quality',
            label: '품질',
            value: avgScoreDeltaEffective == null
                ? '-'
                : avgScoreDeltaEffective > 0
                    ? `↑ ${avgScoreDeltaEffective.toFixed(2)}`
                    : avgScoreDeltaEffective < 0
                        ? `↓ ${Math.abs(avgScoreDeltaEffective).toFixed(2)}`
                        : '= 0.00',
            tone: avgScoreDeltaEffective == null
                ? 'neutral'
                : avgScoreDeltaEffective > 0
                    ? 'good'
                    : avgScoreDeltaEffective < 0
                        ? 'danger'
                        : 'neutral',
        },
        {
            key: 'cost',
            label: '비용',
            value: costDeltaSummary.avg == null
                ? '-'
                : costDeltaSummary.avg < 0
                    ? `↓ $${Math.abs(costDeltaSummary.avg).toFixed(6)}`
                    : costDeltaSummary.avg > 0
                        ? `↑ $${costDeltaSummary.avg.toFixed(6)}`
                        : '= $0.000000',
            tone: costDeltaSummary.avg == null
                ? 'neutral'
                : costDeltaSummary.avg < 0
                    ? 'good'
                    : costDeltaSummary.avg > 0
                        ? 'danger'
                        : 'neutral',
        },
        {
            key: 'latency',
            label: '속도',
            value: avgLatencyDeltaEffective == null
                ? '-'
                : avgLatencyDeltaEffective < 0
                    ? `↑ ${Math.abs(avgLatencyDeltaEffective).toFixed(2)}ms`
                    : avgLatencyDeltaEffective > 0
                        ? `↓ ${avgLatencyDeltaEffective.toFixed(2)}ms`
                        : '= 0ms',
            tone: avgLatencyDeltaEffective == null
                ? 'neutral'
                : avgLatencyDeltaEffective < 0
                    ? 'good'
                    : avgLatencyDeltaEffective > 0
                        ? 'danger'
                        : 'neutral',
        },
        {
            key: 'pass',
            label: '패스 승부',
            value: passComparableCases.length === 0
                ? '-'
                : `W ${passWinCases} / L ${passLossCases}`,
            tone: passComparableCases.length === 0
                ? 'neutral'
                : passWinCases > passLossCases
                    ? 'good'
                    : passWinCases < passLossCases
                        ? 'danger'
                        : 'neutral',
        },
    ];
    const battleReasonPool: string[] = [];
    if (battleWinner === 'BASELINE') {
        if (avgScoreDeltaEffective != null && avgScoreDeltaEffective < 0) {
            battleReasonPool.push(`평균 점수가 운영 대비 ${Math.abs(avgScoreDeltaEffective).toFixed(2)}점 낮습니다.`);
        }
        if (passComparableCases.length > 0 && passLossCases > passWinCases) {
            battleReasonPool.push(`패스 승부 열세입니다 (Win ${passWinCases} / Loss ${passLossCases}).`);
        }
        if (avgLatencyDeltaEffective != null && avgLatencyDeltaEffective > 0) {
            battleReasonPool.push(`평균 응답 속도가 ${Math.round(avgLatencyDeltaEffective)}ms 느립니다.`);
        }
        if (costDeltaSummary.avg != null && costDeltaSummary.avg > 0) {
            battleReasonPool.push(`평균 비용이 ${formatSignedCurrency(costDeltaSummary.avg)} 증가했습니다.`);
        }
    }
    localizedDecisionReasons.forEach((reason) => battleReasonPool.push(reason));
    localizedTopIssues.forEach((issue) => battleReasonPool.push(issue));
    const battleReasons = Array.from(new Set(battleReasonPool.filter((reason) => reason.trim().length > 0))).slice(0, 3);
    const handleReasonFilter = (reason: string) => {
        const nextFilter = resolveReasonDrivenCaseFilter(reason, battleWinner, compareMode);
        setCaseFilter(nextFilter);
        setSelectedCaseId(null);
    };

    const minPassRateThreshold = asNumber(criteriaSnapshot?.minPassRate);
    const minAvgOverallScoreThreshold = asNumber(criteriaSnapshot?.minAvgOverallScore);
    const maxErrorRateThreshold = asNumber(criteriaSnapshot?.maxErrorRate);
    const minImprovementNoticeDeltaThreshold = asNumber(criteriaSnapshot?.minImprovementNoticeDelta);
    const compareBaselineComplete = asBoolean(summary?.compareBaselineComplete);
    const decisionGateItems: DecisionGateItem[] = [
        {
            key: 'passRate',
            label: '통과율',
            actual: formatPercent(passRate),
            threshold: minPassRateThreshold != null ? `기준 ≥ ${formatPercent(minPassRateThreshold)}` : '기준 없음',
            level: passRate == null || minPassRateThreshold == null
                ? 'NA'
                : passRate >= minPassRateThreshold
                    ? 'PASS'
                    : 'FAIL' as DecisionGateLevel,
        },
        {
            key: 'avgScore',
            label: '평균 점수',
            actual: formatNumber(avgOverallScore),
            threshold: minAvgOverallScoreThreshold != null
                ? `기준 ≥ ${formatNumber(minAvgOverallScoreThreshold)}`
                : '기준 없음',
            level: avgOverallScore == null || minAvgOverallScoreThreshold == null
                ? 'NA'
                : avgOverallScore >= minAvgOverallScoreThreshold
                    ? 'PASS'
                    : 'FAIL' as DecisionGateLevel,
        },
        {
            key: 'errorRate',
            label: '오류율',
            actual: formatPercent(errorRate),
            threshold: maxErrorRateThreshold != null ? `기준 ≤ ${formatPercent(maxErrorRateThreshold)}` : '기준 없음',
            level: errorRate == null || maxErrorRateThreshold == null
                ? 'NA'
                : errorRate <= maxErrorRateThreshold
                    ? 'PASS'
                    : 'FAIL' as DecisionGateLevel,
        },
        ...(!compareMode
            ? []
            : [
                {
                    key: 'compareBaseline',
                    label: '운영 비교 완전성',
                    actual: compareBaselineComplete == null
                        ? '-'
                        : compareBaselineComplete
                            ? '완료'
                            : '미완료',
                    threshold: '운영 비교 데이터 필수',
                    level: compareBaselineComplete == null
                        ? 'NA'
                        : compareBaselineComplete
                            ? 'PASS'
                            : 'FAIL' as DecisionGateLevel,
                },
                {
                    key: 'improvementDelta',
                    label: '개선폭(Δ점수)',
                    actual: formatSigned(avgScoreDeltaEffective),
                    threshold: minImprovementNoticeDeltaThreshold != null
                        ? `권장 ≥ +${minImprovementNoticeDeltaThreshold.toFixed(2)}`
                        : '권장 기준 없음',
                    level: avgScoreDeltaEffective == null
                        ? 'NA'
                        : avgScoreDeltaEffective < 0
                            ? 'FAIL'
                            : minImprovementNoticeDeltaThreshold == null
                                ? 'PASS'
                                : avgScoreDeltaEffective < minImprovementNoticeDeltaThreshold
                                    ? 'WARN'
                                    : 'PASS' as DecisionGateLevel,
                    note: avgScoreDeltaEffective == null
                        ? '비교 점수 데이터 없음'
                        : avgScoreDeltaEffective < 0
                            ? '운영 대비 회귀'
                            : minImprovementNoticeDeltaThreshold != null && avgScoreDeltaEffective < minImprovementNoticeDeltaThreshold
                                ? '개선폭은 있으나 권장 기준 미만'
                                : undefined,
                },
            ]),
    ];

    const statusLabel = compareMode ? '운영 비교' : '단일 검증';
    const decisionLabel =
        releaseDecision === 'PASS'
            ? '배포 가능'
            : releaseDecision === 'HOLD'
                ? '배포 보류'
                : '-';
    const decisionBadgeClass = releaseDecision === 'PASS'
        ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
        : releaseDecision === 'HOLD'
            ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
            : 'border-white/20 bg-white/5 text-gray-200';
    const hasDecisionGateData = decisionGateItems.length > 0 || localizedDecisionReasons.length > 0;
    const failurePreviewCases = cases
        .filter((item) => item.pass === false || item.status === 'ERROR')
        .slice(0, 3);
    const caseFilterOptions: Array<{ key: CaseFilter; label: string }> = [
        { key: 'ALL', label: `전체 ${cases.length}` },
        { key: 'PASS', label: `통과 ${cases.filter((item) => item.pass === true).length}` },
        { key: 'FAIL', label: `실패 ${cases.filter((item) => item.pass === false).length}` },
        { key: 'ERROR', label: `오류 ${cases.filter((item) => item.status === 'ERROR').length}` },
        { key: 'RUNNING', label: `대기/실행 ${cases.filter((item) => isPendingCase(item.status)).length}` },
        ...(compareMode
            ? [
                { key: 'BETTER' as const, label: `🔵 Better ${betterCases.length}` },
                { key: 'WORSE' as const, label: `🔴 Worse ${worseCases.length}` },
                { key: 'SAME' as const, label: `⚪ Same ${sameCases.length}` },
            ]
            : []),
    ];
    const insightGrade = computeInsightGrade(passRate, avgOverallScore, errorRate, isRunning);
    const insightText = isRunning
        ? `현재 ${completed}/${total} 케이스를 분석 중입니다.`
        : compareMode && compareWinRate != null
            ? `이번 버전 우세 ${compareWinRate.toFixed(1)}% (Win ${betterCases.length} / Loss ${worseCases.length} / Same ${sameCases.length})`
        : localizedTopIssues[0]
            ? localizedTopIssues[0]
            : failures > 0
                ? `총 ${failures}건의 실패/오류 케이스가 감지되었습니다.`
                : '전체 케이스가 기준을 충족했습니다.';
    const gradeDescription = insightGrade === 'S'
        ? '즉시 배포 후보'
        : insightGrade === 'A'
            ? '배포 가능권'
            : insightGrade === 'B'
                ? '개선 후 재검증 권장'
                : insightGrade === 'F'
                    ? '배포 보류 권장'
                    : '분석 중';

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-start gap-5">
                    <div className="min-w-[160px]">
                        <p className="text-[11px] uppercase tracking-wider text-gray-400">종합 등급</p>
                        <p className={`text-6xl font-black leading-none mt-1 ${gradeToneClass(insightGrade)}`}>
                            {insightGrade}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">{gradeDescription}</p>
                        <span className={`inline-flex mt-3 px-2.5 py-1 rounded-full text-[11px] border ${decisionBadgeClass}`}>
                            판정 {decisionLabel}
                        </span>
                    </div>
                    <div className="flex-1 space-y-3">
                        <p className="text-xs text-gray-400 mb-1">핵심 요약</p>
                        <p className="text-base font-semibold text-white">{insightText}</p>
                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
                            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                                PassRate {formatPercent(passRate)}
                            </span>
                            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                                평균점수 {formatNumber(avgOverallScore)}
                            </span>
                            {compareMode && compareWinRate != null && (
                                <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-200">
                                    승률 {compareWinRate.toFixed(1)}% (W {betterCases.length} / L {worseCases.length} / S {sameCases.length})
                                </span>
                            )}
                        </div>
                    </div>
                    {compareMode && (
                        <div className="lg:w-[340px] shrink-0 rounded-xl border border-white/10 bg-black/25 p-3 space-y-3">
                            <p className="text-[11px] uppercase tracking-wider text-gray-400">비교 스냅샷</p>
                            <p className="text-xs text-gray-300">{compareTradeoffSummary}</p>
                            <div className="flex flex-wrap gap-2">
                                {compareTradeoffChips.map((chip) => (
                                    <span key={chip.key} className="text-[11px] px-2 py-1 rounded border border-white/15 bg-white/[0.06] text-gray-200">
                                        {chip.label} {chip.value}
                                    </span>
                                ))}
                            </div>
                            {battleReasons.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-[11px] text-gray-400">기준/주의 사유</p>
                                    <div className="flex flex-wrap gap-2">
                                        {battleReasons.slice(0, 2).map((reason, index) => (
                                            <button
                                                type="button"
                                                key={`${reason}-${index}`}
                                                onClick={() => handleReasonFilter(reason)}
                                                className="text-[11px] px-2 py-1 rounded border border-white/15 bg-white/[0.06] text-gray-200 hover:bg-white/10"
                                            >
                                                {reason}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <StatusCard label="Pass Rate" value={formatPercent(passRate)} tone="neutral" />
                <StatusCard label="실패 건수" value={`${failures}/${total}`} tone="neutral" />
                {compareMode ? (
                    <>
                        <StatusCard
                            label="Δ비용(USD)"
                            value={formatSignedCurrency(costDeltaSummary.avg)}
                            tone="neutral"
                        />
                        <StatusCard
                            label="Δ평균 지연(ms)"
                            value={formatSignedMs(avgLatencyDeltaEffective)}
                            tone="neutral"
                        />
                    </>
                ) : (
                    <>
                        <StatusCard label="총 비용(USD)" value={totalCostUsd != null ? `$${totalCostUsd.toFixed(6)}` : '-'} tone="neutral" />
                        <StatusCard label="평균 지연(ms)" value={formatNumber(avgLatencyMs)} tone="neutral" />
                    </>
                )}
            </div>

            {failurePreviewCases.length > 0 && (
                <div className="glass-card border border-white/10 rounded-xl p-4 shrink-0 bg-black/20">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white">문제아 리스트 (실패/오류 Top {failurePreviewCases.length})</p>
                        <span className="text-[11px] text-gray-400">클릭 시 상세 케이스로 이동</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                        {failurePreviewCases.map((item) => {
                            const judgeLabels = extractJudgeLabels(item.judgeOutput).map((label) => toKoreanJudgeLabel(label));
                            const reason = judgeLabels[0]
                                || (item.errorCode ? toKoreanErrorCodeLabel(item.errorCode) : null)
                                || (item.status === 'ERROR' ? '실행 오류' : '기준 미달');
                            return (
                                <button
                                    type="button"
                                    key={`failure-preview-${item.id}`}
                                    onClick={() => {
                                        setCaseFilter('ALL');
                                        setSelectedCaseId(item.id);
                                    }}
                                    className="text-left rounded-lg border border-white/10 bg-black/30 px-3 py-2 hover:bg-white/5"
                                >
                                    <p className="text-[11px] text-gray-400">#{item.testCaseId}</p>
                                    <p className="text-xs text-gray-100 truncate mt-1">
                                        {caseInputById[item.testCaseId] || `Case #${item.testCaseId}`}
                                    </p>
                                    <p className="text-[11px] text-gray-300 mt-2 truncate">{reason}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <details className="glass-card border border-white/10 rounded-xl p-4 shrink-0 bg-black/20">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">상세 분석 보기</span>
                    <span className="text-[11px] text-gray-400">LLM 평가 · 판정 근거 · 분포</span>
                </summary>
                <div className="mt-3 space-y-4">
                    {llmOverallComment && (
                        <div className="rounded-xl border border-blue-400/20 p-4 bg-blue-500/5 space-y-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-wider text-blue-300/90">LLM 종합평가</p>
                                <p className="text-sm md:text-base font-semibold text-white mt-1">{llmOverallComment}</p>
                                {llmVerdictReason && (
                                    <p className="text-xs text-blue-100/80 mt-1">{llmVerdictReason}</p>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <InsightListPanel
                                    title="강점"
                                    entries={llmStrengths}
                                    emptyText="강점 정보 없음"
                                    tone="good"
                                />
                                <InsightListPanel
                                    title="리스크"
                                    entries={llmRisks}
                                    emptyText="리스크 정보 없음"
                                    tone="warn"
                                />
                                <InsightListPanel
                                    title="다음 액션"
                                    entries={llmNextActions}
                                    emptyText="액션 정보 없음"
                                    tone="info"
                                />
                            </div>
                        </div>
                    )}

                    {hasDecisionGateData && (
                        <div className="rounded-xl border border-white/10 p-4 bg-black/20">
                            <p className="text-xs font-semibold text-white mb-3">판정 근거표</p>
                            <DecisionGatePanel
                                items={decisionGateItems}
                                decisionReasons={localizedDecisionReasons}
                            />
                        </div>
                    )}

                    <div className="rounded-xl border border-white/10 p-4 space-y-3 bg-black/20">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-white">{plainSummary || '요약 정보가 없습니다.'}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    상태: {run?.status ? toKoreanRunStatus(run.status) : '-'} / 모드: {statusLabel} / 소요 시간: {formatDurationMs(run?.startedAt, run?.completedAt)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isRunning && (
                                    <button
                                        type="button"
                                        onClick={onCancelRun}
                                        disabled={isCancelling}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                                    >
                                        {isCancelling ? '취소 요청 중...' : '실행 취소'}
                                    </button>
                                )}
                                <span className="text-[11px] text-gray-500">
                                    생성 {formatTimestamp(run?.createdAt)}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
                            <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                                진행 {completed}/{total}
                            </span>
                            <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                                통과 {passed}
                            </span>
                            <span className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
                                실패/오류 {failures}
                            </span>
                            <span className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                                경고 {warnings}
                            </span>
                            {avgScoreDeltaEffective != null && (
                                <span className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                                    비교 Δ {formatSigned(avgScoreDeltaEffective)}
                                </span>
                            )}
                            {compareCoverageRate != null && (
                                <span className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300">
                                    비교 커버리지 {formatPercent(compareCoverageRate)}
                                </span>
                            )}
                            {riskLevel && (
                                <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                                    위험도 {toKoreanRiskLevel(riskLevel)}
                                </span>
                            )}
                            {totalTokens != null && (
                                <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                                    총 토큰 {Math.round(totalTokens).toLocaleString('ko-KR')}
                                </span>
                            )}
                        </div>

                        {localizedTopIssues.length > 0 && (
                            <div className="text-xs text-gray-300">
                                <p className="text-[11px] text-gray-400 mb-1">주요 이슈</p>
                                <div className="flex flex-wrap gap-2">
                                    {localizedTopIssues.map((issue, index) => (
                                        <span key={`${issue}-${index}`} className="px-2 py-1 rounded bg-white/5 border border-white/10">
                                            {issue}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <CountDistributionPanel
                                title="룰 실패 분포 (Top 5)"
                                entries={ruleFailDistribution}
                                emptyText="룰 실패가 없습니다."
                                tone="danger"
                                labelMapper={toKoreanRuleCheckLabel}
                            />
                            <CountDistributionPanel
                                title="에러코드 분포 (Top 5)"
                                entries={errorCodeDistribution}
                                emptyText="에러코드가 없습니다."
                                tone="warn"
                                labelMapper={toKoreanErrorCodeLabel}
                            />
                            <CountDistributionPanel
                                title="Judge 라벨 분포 (Top 5)"
                                entries={labelDistribution}
                                emptyText="라벨 이슈가 없습니다."
                                tone="info"
                                labelMapper={toKoreanJudgeLabel}
                            />
                        </div>
                    </div>
                </div>
            </details>

            <div className="flex-1 flex gap-4 overflow-hidden">
                <div className="w-[330px] glass-card border border-white/10 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-white/10 bg-black/20">
                        <p className="font-bold text-xs text-gray-300 mb-2">실행 히스토리</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {runs.map((runItem) => {
                                const runSummary = asRecord(runItem.summary);
                                const runPassRate = asNumber(runSummary?.passRate);
                                const selected = selectedRunId === runItem.id;
                                return (
                                    <button
                                        type="button"
                                        key={runItem.id}
                                        onClick={() => onSelectRun(runItem.id)}
                                        className={`w-full text-left p-2 rounded-lg border transition ${
                                            selected
                                                ? 'bg-white/10 border-white/30'
                                                : 'bg-black/30 border-white/10 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] text-gray-200">Run #{runItem.id}</span>
                                            <span className="text-[10px] text-gray-400">{toKoreanRunStatus(runItem.status)}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                                            <span>{formatTimestamp(runItem.createdAt)}</span>
                                            <span>{runPassRate != null ? `${runPassRate.toFixed(1)}%` : '-'}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-3 border-b border-white/10 bg-black/20">
                        <p className="font-bold text-xs text-gray-300 mb-2">
                            테스트 케이스 ({filteredCases.length}/{loadedCount}/{total})
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {caseFilterOptions.map((option) => (
                                <button
                                    type="button"
                                    key={option.key}
                                    onClick={() => setCaseFilter(option.key)}
                                    className={`px-2 py-1 rounded text-[10px] border ${
                                        caseFilter === option.key
                                            ? 'bg-white text-black border-white'
                                            : 'bg-black/30 text-gray-300 border-white/10 hover:border-white/30'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filteredCases.map((item) => {
                            const selected = selectedCase?.id === item.id;
                            const isFailureCase = item.pass === false || item.status === 'ERROR';
                            const diffTone = compareMode ? resolveCompareDiffTone(item) : 'UNKNOWN';
                            const compareDelta = compareMode ? toCompareCaseDelta(item) : null;
                            const compareRowClass = compareMode
                                ? selected
                                    ? diffTone === 'BETTER'
                                        ? 'bg-blue-500/20 border-l-2 border-l-blue-300'
                                        : diffTone === 'WORSE'
                                            ? 'bg-rose-500/20 border-l-2 border-l-rose-300'
                                            : diffTone === 'SAME'
                                                ? 'bg-slate-500/20 border-l-2 border-l-slate-300'
                                                : 'bg-white/10 border-l-2 border-l-white'
                                    : diffTone === 'BETTER'
                                        ? 'bg-blue-500/[0.08] border-l-2 border-l-blue-500/60 hover:bg-blue-500/[0.14]'
                                        : diffTone === 'WORSE'
                                            ? 'bg-rose-500/[0.08] border-l-2 border-l-rose-500/60 hover:bg-rose-500/[0.14]'
                                            : diffTone === 'SAME'
                                                ? 'bg-slate-500/[0.08] border-l-2 border-l-slate-500/60 hover:bg-slate-500/[0.14]'
                                                : 'hover:bg-white/5'
                                : selected
                                    ? isFailureCase
                                        ? 'bg-rose-500/20 border-l-2 border-l-rose-300'
                                        : 'bg-white/10 border-l-2 border-l-white'
                                    : isFailureCase
                                        ? 'bg-rose-500/[0.08] border-l-2 border-l-rose-500/60 hover:bg-rose-500/[0.14]'
                                        : 'hover:bg-white/5';
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedCaseId(item.id)}
                                    className={`p-3 border-b border-white/5 cursor-pointer transition-colors ${compareRowClass}`}
                                >
                                    <div className="flex justify-between mb-1">
                                        <span className="font-mono text-[10px] text-gray-500">#{item.testCaseId}</span>
                                        <div className="flex items-center gap-1">
                                            {compareMode && (
                                                <CompareDiffBadge
                                                    tone={diffTone}
                                                    scoreDelta={extractCompareScoreDelta(item)}
                                                />
                                            )}
                                            <CaseStatusBadge item={item} />
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-300 truncate">
                                        {caseInputById[item.testCaseId] || `Case #${item.testCaseId}`}
                                    </div>
                                    {compareMode && compareDelta && (
                                        <CaseCompareDeltaLine delta={compareDelta} />
                                    )}
                                </div>
                            );
                        })}
                        {filteredCases.length === 0 && (
                            <div className="text-center text-xs text-gray-500 py-8">조건에 맞는 케이스가 없습니다.</div>
                        )}
                    </div>
                </div>

                <div className="flex-1 glass-card border border-white/10 rounded-xl overflow-hidden bg-black/20 p-4">
                    {selectedCase ? (
                        <CaseDetailPanel
                            item={selectedCase}
                            inputText={caseInputById[selectedCase.testCaseId]}
                            caseContext={caseContextById[selectedCase.testCaseId]}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            {isRunning ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-3xl mb-2">sync</span>
                                    <p>실시간 분석 중...</p>
                                </>
                            ) : (
                                <p>케이스를 선택하여 상세 결과를 확인하세요.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DecisionGatePanel({
    items,
    decisionReasons,
}: {
    items: DecisionGateItem[];
    decisionReasons: string[];
}) {
    if (items.length === 0 && decisionReasons.length === 0) {
        return null;
    }

    const levelMeta: Record<DecisionGateLevel, { label: string; className: string }> = {
        PASS: { label: '통과', className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' },
        FAIL: { label: '실패', className: 'bg-rose-500/15 border-rose-500/30 text-rose-200' },
        WARN: { label: '주의', className: 'bg-amber-500/15 border-amber-500/30 text-amber-200' },
        NA: { label: '미판정', className: 'bg-white/5 border-white/15 text-gray-300' },
    };

    return (
        <div className="space-y-3">
            <p className="text-[10px] text-gray-500">현재 실행에 적용된 기준과 실제값 비교</p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {items.map((item) => {
                    const meta = levelMeta[item.level];
                    return (
                        <div key={item.key} className={`rounded-lg border p-3 ${meta.className}`}>
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold">{item.label}</p>
                                <span className="text-[10px] px-1.5 py-0.5 rounded border border-current/30">
                                    {meta.label}
                                </span>
                            </div>
                            <p className="text-sm font-bold mt-1">{item.actual}</p>
                            <p className="text-[10px] opacity-80 mt-1">{item.threshold}</p>
                            {item.note && (
                                <p className="text-[10px] opacity-90 mt-1">{item.note}</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {decisionReasons.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[11px] text-gray-400">차단/주의 사유</p>
                    <div className="flex flex-wrap gap-2">
                        {decisionReasons.map((reason, index) => (
                            <span key={`${reason}-${index}`} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] text-gray-200">
                                {reason}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function CountDistributionPanel({
    title,
    entries,
    emptyText,
    tone,
    labelMapper,
}: {
    title: string;
    entries: CountDistributionEntry[];
    emptyText: string;
    tone: 'danger' | 'warn' | 'info';
    labelMapper?: (key: string) => string;
}) {
    const toneClass = {
        danger: 'bg-rose-500/20 border-rose-500/30',
        warn: 'bg-amber-500/20 border-amber-500/30',
        info: 'bg-blue-500/20 border-blue-500/30',
    }[tone];

    const total = entries.reduce((sum, entry) => sum + entry.count, 0);

    return (
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-200">{title}</p>
                <span className="text-[10px] text-gray-500">{total}건</span>
            </div>

            {entries.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">{emptyText}</p>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry) => (
                        <div key={entry.key} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] text-gray-300 truncate">{labelMapper ? labelMapper(entry.key) : entry.key}</p>
                                <p className="text-[10px] text-gray-500 shrink-0">
                                    {entry.count} ({entry.pct.toFixed(1)}%)
                                </p>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded">
                                <div
                                    className={`h-full rounded border ${toneClass}`}
                                    style={{ width: `${Math.max(6, Math.min(100, entry.pct))}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function InsightListPanel({
    title,
    entries,
    emptyText,
    tone,
}: {
    title: string;
    entries: string[];
    emptyText: string;
    tone: 'good' | 'warn' | 'info';
}) {
    const toneClass = {
        good: 'border-emerald-500/30 bg-emerald-500/10',
        warn: 'border-rose-500/30 bg-rose-500/10',
        info: 'border-blue-500/30 bg-blue-500/10',
    }[tone];

    return (
        <div className={`rounded-lg border p-3 ${toneClass}`}>
            <p className="text-[11px] text-white/90 font-semibold mb-2">{title}</p>
            {entries.length === 0 ? (
                <p className="text-[11px] text-gray-400">{emptyText}</p>
            ) : (
                <div className="space-y-1.5">
                    {entries.map((entry, index) => (
                        <p key={`${title}-${index}`} className="text-[11px] text-gray-100 leading-relaxed">
                            • {entry}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

function CaseStatusBadge({ item }: { item: EvalCaseResultResponse }) {
    const isPending = item.status === 'QUEUED' || item.status === 'RUNNING';
    const isError = item.status === 'ERROR';
    const isSkipped = item.status === 'SKIPPED';
    const hasWarning = item.pass === true && extractJudgeLabels(item.judgeOutput).length > 0;

    const style = isPending
        ? 'bg-gray-700 text-gray-300'
        : isError
            ? 'bg-rose-500/20 text-rose-300'
            : isSkipped
                ? 'bg-slate-600/30 text-slate-300'
                : item.pass === false
                    ? 'bg-rose-500/20 text-rose-300'
                    : hasWarning
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300';

    const text = isPending
        ? toKoreanCaseStatus(item.status)
        : isError
            ? '오류'
            : isSkipped
                ? '스킵'
                : item.pass === false
                    ? '실패'
                    : hasWarning
                        ? '경고'
                        : '통과';

    return <span className={`text-[10px] px-1.5 rounded ${style}`}>{text}</span>;
}

function CompareDiffBadge({
    tone,
    scoreDelta,
}: {
    tone: CompareDiffTone;
    scoreDelta: number | null;
}) {
    if (tone === 'UNKNOWN') {
        return (
            <span className="text-[10px] px-1.5 rounded bg-white/10 text-gray-400">
                비교 없음
            </span>
        );
    }

    const deltaText = scoreDelta == null
        ? ''
        : ` ${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(2)}`;

    const map = {
        BETTER: { label: `🔵 Better${deltaText}`, className: 'bg-blue-500/20 text-blue-200' },
        WORSE: { label: `🔴 Worse${deltaText}`, className: 'bg-rose-500/20 text-rose-200' },
        SAME: { label: '⚪ Same', className: 'bg-slate-500/20 text-slate-200' },
        UNKNOWN: { label: '비교 없음', className: 'bg-white/10 text-gray-400' },
    } as const;

    const selected = map[tone];
    return <span className={`text-[10px] px-1.5 rounded ${selected.className}`}>{selected.label}</span>;
}

function CaseCompareDeltaLine({ delta }: { delta: CompareCaseDelta }) {
    const chips: string[] = [];
    if (delta.candidateScore != null || delta.baselineScore != null) {
        chips.push(`점수 ${formatNumber(delta.candidateScore)} vs ${formatNumber(delta.baselineScore)}`);
    }
    if (delta.scoreDelta != null) {
        chips.push(`Δ점수 ${formatSigned(delta.scoreDelta)}`);
    }
    if (delta.tokenDelta != null) {
        chips.push(`Δ토큰 ${formatSignedTokens(delta.tokenDelta)}`);
    }
    if (delta.costDelta != null) {
        chips.push(`Δ비용 ${formatSignedCurrency(delta.costDelta)}`);
    }
    if (delta.latencyDelta != null) {
        chips.push(`Δ지연 ${formatSignedMs(delta.latencyDelta)}`);
    }

    if (chips.length === 0) {
        return (
            <p className="mt-1 text-[10px] text-gray-500">
                비교 지표 없음
            </p>
        );
    }

    return (
        <p className="mt-1 text-[10px] text-gray-400 truncate">
            {chips.join(' · ')}
        </p>
    );
}

function StepButton({
    label,
    active,
    done,
    onClick,
}: {
    label: string;
    active: boolean;
    done: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${
                active
                    ? 'bg-white text-black shadow-lg scale-105'
                    : done
                        ? 'text-emerald-400 hover:text-emerald-300'
                        : 'text-gray-500 hover:text-gray-300'
            }`}
        >
            {label} {done && !active && '✓'}
        </button>
    );
}

function StatusCard({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone: 'good' | 'warn' | 'danger' | 'info' | 'neutral';
}) {
    const colors = {
        good: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        warn: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        danger: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
        neutral: 'bg-white/5 border-white/10 text-gray-400',
    };

    return (
        <div className={`p-4 rounded-xl border ${colors[tone]}`}>
            <p className="text-[10px] opacity-70 uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
        </div>
    );
}
