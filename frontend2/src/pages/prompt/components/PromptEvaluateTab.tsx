import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { promptApi } from '@/api/prompt.api';
import { organizationApi } from '@/api/organization.api';
import axios from 'axios';
import type {
    EvalCaseResultResponse,
    EvalCaseResultListResponse,
    EvalMode,
    EvalRunResponse,
    EvalRunStatus,
    EvalTestCaseResponse,
    EvalTestCaseCreateRequest,
    EvalReleaseCriteriaUpdateRequest,
    RubricTemplateCode
} from '@/types/api.types';

type ModeOption = { value: EvalMode; label: string; description: string };
type RubricOption = { code: RubricTemplateCode; label: string; description: string };
type PresetOption = { key: string; label: string; description: string; value: string };
type EvalTab = 'dataset' | 'run' | 'result';
type CaseInputMode = 'FORM' | 'JSON';
type ResultViewMode = 'SUMMARY' | 'ENGINEERING';
type ResultSectionTab = 'OVERVIEW' | 'CASES' | 'PERFORMANCE';
type CaseFormRow = {
    id: string;
    externalId: string;
    input: string;
    contextJsonText: string;
    expectedJsonText: string;
    constraintsJsonText: string;
};
type CaseJsonField = 'contextJsonText' | 'expectedJsonText' | 'constraintsJsonText';
type RunCaseContext = Pick<EvalTestCaseResponse, 'input' | 'contextJson' | 'expectedJson' | 'constraintsJson'>;
type CustomCriterionInputRow = { id: string; criterion: string; weight: string; minScore: string };
type CustomRubricFormState = { description: string; minOverallScore: string; criteria: CustomCriterionInputRow[] };

const RUBRIC_OPTIONS: RubricOption[] = [
    {
        code: 'GENERAL_TEXT',
        label: '일반 답변 품질',
        description: '관련성, 완성도, 명확성, 안전성을 종합 평가합니다.',
    },
    {
        code: 'SUMMARY',
        label: '요약 품질',
        description: '핵심 포함 여부와 사실 일치도를 중심으로 평가합니다.',
    },
    {
        code: 'JSON_EXTRACTION',
        label: 'JSON 추출 품질',
        description: 'JSON 파싱/필수 키/스키마 준수를 엄격하게 평가합니다.',
    },
    {
        code: 'CLASSIFICATION',
        label: '분류 품질',
        description: '라벨 유효성, 정답성, 일관성을 평가합니다.',
    },
    {
        code: 'CUSTOM',
        label: '커스텀 평가',
        description: '직접 정의한 항목/가중치/게이트로 평가합니다.',
    },
];

const MODE_OPTIONS: ModeOption[] = [
    {
        value: 'CANDIDATE_ONLY',
        label: '이번 버전만 평가',
        description: '선택한 프롬프트 버전만 실행해 품질을 확인합니다.',
    },
    {
        value: 'COMPARE_ACTIVE',
        label: '운영 버전과 비교 평가',
        description: '선택한 버전과 현재 운영(Active) 버전을 함께 실행해 비교합니다.',
    },
];

const CASE_PRESETS: PresetOption[] = [
    {
        key: 'general',
        label: '일반 QA 가이드',
        description: '직접 수정해서 쓰는 일반 답변형 초안입니다.',
        value: `[{"input":"환불 규정 알려줘","contextJson":{"locale":"ko-KR"},"expectedJson":{"must_cover":["환불 가능 기간을 안내","문의/접수의 다음 단계 제시"]},"constraintsJson":{"max_chars":400,"must_include":["환불"]}}]`,
    },
    {
        key: 'summary',
        label: '요약 가이드',
        description: '직접 수정해서 쓰는 요약 평가 초안입니다.',
        value: `[{"input":"다음 공지를 3줄로 요약해줘","contextJson":{"notice":"학부모 상담 주간은 3월 2주차이며 사전 신청이 필요합니다."},"constraintsJson":{"max_lines":3,"must_include":["사전 신청"]}}]`,
    },
    {
        key: 'json',
        label: 'JSON 추출 가이드',
        description: '직접 수정해서 쓰는 JSON 검증 초안입니다.',
        value: `[{"input":"문장에서 주문번호와 금액을 추출해줘","contextJson":{"text":"주문번호 A123, 결제금액 12000원"},"constraintsJson":{"format":"json_only","required_keys":["orderNo","amount"]}}]`,
    },
];

const EVAL_TABS: { value: EvalTab; label: string; description: string }[] = [
    { value: 'dataset', label: '데이터셋 관리', description: '데이터셋 생성/케이스 업로드' },
    { value: 'run', label: '평가 실행', description: '버전/모드/루브릭 설정 후 실행' },
    { value: 'result', label: '결과 분석', description: 'Run/Case 결과와 근거 확인' },
];

// Keep the first page reasonably sized; allow manual "load more" for large datasets.
const RUN_CASE_PAGE_SIZE = 50;

const CASE_LANGUAGE_OPTIONS = [
    { value: '', label: '자동/미지정' },
    { value: 'ko', label: '한국어 (ko)' },
    { value: 'en', label: '영어 (en)' },
    { value: 'ja', label: '일본어 (ja)' },
];

let fallbackCustomCriterionIdSeed = 0;
let fallbackCaseRowIdSeed = 0;

export function PromptEvaluateTab({ workspaceId, promptId }: { workspaceId: number; promptId: number }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { orgId: orgIdParam } = useParams<{ orgId: string }>();
    const orgId = Number(orgIdParam);

    const [datasetName, setDatasetName] = useState('');
    const [datasetDescription, setDatasetDescription] = useState('');
    const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
    const [datasetLayoutMode, setDatasetLayoutMode] = useState<'FOCUS' | 'SPLIT'>('FOCUS');
    const [caseInputMode, setCaseInputMode] = useState<CaseInputMode>('FORM');
    const [caseFormRows, setCaseFormRows] = useState<CaseFormRow[]>(() => [createEmptyCaseFormRow('case-0')]);
    const [expandedEditorCaseId, setExpandedEditorCaseId] = useState<string | null>(null);
    const [advancedJsonOpenByRow, setAdvancedJsonOpenByRow] = useState<Record<string, boolean>>({});
    const [isMovingToRun, setIsMovingToRun] = useState(false);
    const [testcaseInput, setTestcaseInput] = useState('');
    const [replaceExisting, setReplaceExisting] = useState(true);

    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
    const [mode, setMode] = useState<EvalMode>('CANDIDATE_ONLY');
    const [rubricTemplateCode, setRubricTemplateCode] = useState<RubricTemplateCode>('GENERAL_TEXT');
    const [rubricOverridesInput, setRubricOverridesInput] = useState('');
    const [customRubricForm, setCustomRubricForm] = useState<CustomRubricFormState>(
        () => createDefaultCustomRubricForm(() => 'criterion-0')
    );
    const [customAdvancedJsonOpen, setCustomAdvancedJsonOpen] = useState(false);
    const [autoEvalEnabled, setAutoEvalEnabled] = useState(false);

    const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
    const [runCaseExtraPages, setRunCaseExtraPages] = useState<EvalCaseResultListResponse[]>([]);
    const [isRunCaseLoadMorePending, setIsRunCaseLoadMorePending] = useState(false);
    const [isRunCaseLoadAllPending, setIsRunCaseLoadAllPending] = useState(false);
    // Default to step 1. Users can still jump to results even when there are no runs yet.
    const [activeTab, setActiveTab] = useState<EvalTab>('dataset');
    const [resultViewMode, setResultViewMode] = useState<ResultViewMode>('SUMMARY');
    const [resultSectionTab, setResultSectionTab] = useState<ResultSectionTab>('OVERVIEW');
    const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastTone, setToastTone] = useState<'success' | 'error' | 'info'>('info');
    const [releaseCriteriaForm, setReleaseCriteriaForm] = useState<EvalReleaseCriteriaUpdateRequest>({
        minPassRate: 90,
        minAvgOverallScore: 75,
        maxErrorRate: 10,
        minImprovementNoticeDelta: 3,
    });
    const toastTimerRef = useRef<number | null>(null);
    const moveToRunTimerRef = useRef<number | null>(null);
    const customCriterionIdRef = useRef(1);
    const caseRowIdRef = useRef(1);
    const caseBuilderSectionRef = useRef<HTMLDivElement | null>(null);
    const addCaseButtonRef = useRef<HTMLButtonElement | null>(null);
    const lastCustomFormJsonRef = useRef<string | null>(null);

    const showToast = (message: string, tone: 'success' | 'error' | 'info' = 'info') => {
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
        setToastTone(tone);
        setToastMessage(message);
        toastTimerRef.current = window.setTimeout(() => {
            setToastMessage(null);
            toastTimerRef.current = null;
        }, 2500);
    };

    const nextCustomCriterionId = () => {
        const id = `criterion-${customCriterionIdRef.current}`;
        customCriterionIdRef.current += 1;
        return id;
    };

    const nextCaseRowId = () => {
        const id = `case-${caseRowIdRef.current}`;
        caseRowIdRef.current += 1;
        return id;
    };

    const applyCustomFormAndSyncOverrides = (nextForm: CustomRubricFormState) => {
        const normalized = normalizeCustomRubricForm(nextForm, nextCustomCriterionId);
        setCustomRubricForm(normalized);

        const overrides = buildCustomRubricOverrides(normalized);
        const nextJsonText = Object.keys(overrides).length > 0 ? JSON.stringify(overrides, null, 2) : '';
        lastCustomFormJsonRef.current = nextJsonText;
        setRubricOverridesInput(nextJsonText);
    };

    const { data: datasets } = useQuery({
        queryKey: ['evalDatasets', workspaceId, promptId],
        queryFn: async () => (await promptApi.getEvalDatasets(workspaceId, promptId)).data,
    });

    const { data: defaults } = useQuery({
        queryKey: ['evalDefaults', workspaceId, promptId],
        queryFn: async () => (await promptApi.getEvalDefaults(workspaceId, promptId)).data,
    });

    const { data: versions } = useQuery({
        queryKey: ['promptVersions', promptId],
        queryFn: async () => (await promptApi.getVersions(promptId)).data,
    });

    const { data: activeRelease } = useQuery({
        queryKey: ['promptRelease', promptId],
        queryFn: async () => {
            try {
                return (await promptApi.getRelease(promptId)).data;
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return null;
                }
                throw error;
            }
        },
        enabled: !!promptId,
        retry: false,
    });

    const { data: providerCredentials } = useQuery({
        queryKey: ['providerCredentials', orgId],
        queryFn: async () => (await organizationApi.getCredentials(orgId)).data,
        enabled: Number.isFinite(orgId) && orgId > 0,
        // Provider keys can be added/updated in another screen. Always refetch on mount for accuracy.
        staleTime: 0,
        refetchOnMount: 'always',
    });

    const { data: releaseCriteria } = useQuery({
        queryKey: ['evalReleaseCriteria', workspaceId],
        queryFn: async () => (await promptApi.getEvalReleaseCriteria(workspaceId)).data,
    });

    const { data: runs } = useQuery({
        queryKey: ['evalRuns', workspaceId, promptId],
        queryFn: async () => (await promptApi.getEvalRuns(workspaceId, promptId)).data,
        refetchInterval: (data) =>
            Array.isArray(data) && data.some((run) => run.status === 'QUEUED' || run.status === 'RUNNING')
                ? 4000
                : false,
    });

    const selectedRun = useMemo(() => {
        if (!runs || !selectedRunId) return null;
        return runs.find((run) => run.id === selectedRunId) ?? null;
    }, [runs, selectedRunId]);

    const { data: runCases } = useQuery({
        queryKey: ['evalRunCases', workspaceId, promptId, selectedRunId, RUN_CASE_PAGE_SIZE],
        queryFn: async () => {
            if (!selectedRunId) return null;
            return (await promptApi.getEvalRunCases(workspaceId, promptId, selectedRunId, 0, RUN_CASE_PAGE_SIZE)).data;
        },
        enabled: !!selectedRunId,
        refetchInterval: () =>
            selectedRun && (selectedRun.status === 'QUEUED' || selectedRun.status === 'RUNNING') ? 4000 : false,
    });

    const mergedRunCases = useMemo(() => {
        const firstPage = runCases?.content || [];
        if (runCaseExtraPages.length === 0) {
            return firstPage;
        }
        return [
            ...firstPage,
            ...runCaseExtraPages.flatMap((page) => page.content || []),
        ];
    }, [runCases?.content, runCaseExtraPages]);

    const runCaseTotalElements = runCases?.totalElements ?? mergedRunCases.length;
    const runCaseTotalPages = runCases?.totalPages ?? 1;
    const runCaseLoadedPages = 1 + runCaseExtraPages.length;
    const canLoadMoreRunCases = Boolean(runCases && runCaseLoadedPages < runCaseTotalPages);

    const loadMoreRunCases = async () => {
        if (!selectedRunId || !runCases) {
            return;
        }
        if (isRunCaseLoadMorePending || isRunCaseLoadAllPending) {
            return;
        }
        const nextPage = 1 + runCaseExtraPages.length;
        if (nextPage >= runCases.totalPages) {
            return;
        }
        setIsRunCaseLoadMorePending(true);
        try {
            const response = await promptApi.getEvalRunCases(
                workspaceId,
                promptId,
                selectedRunId,
                nextPage,
                RUN_CASE_PAGE_SIZE
            );
            setRunCaseExtraPages((prev) => [...prev, response.data]);
        } catch (error: any) {
            showToast(error?.message || '케이스 목록을 더 불러오지 못했습니다.', 'error');
        } finally {
            setIsRunCaseLoadMorePending(false);
        }
    };

    const loadAllRunCases = async () => {
        if (!selectedRunId || !runCases) {
            return;
        }
        if (isRunCaseLoadAllPending || isRunCaseLoadMorePending) {
            return;
        }
        if (runCaseLoadedPages >= runCases.totalPages) {
            return;
        }
        setIsRunCaseLoadAllPending(true);
        try {
            const startPage = 1 + runCaseExtraPages.length;
            const pendingPages: EvalCaseResultListResponse[] = [];
            for (let page = startPage; page < runCases.totalPages; page += 1) {
                const response = await promptApi.getEvalRunCases(
                    workspaceId,
                    promptId,
                    selectedRunId,
                    page,
                    RUN_CASE_PAGE_SIZE
                );
                pendingPages.push(response.data);
            }
            setRunCaseExtraPages((prev) => [...prev, ...pendingPages]);
        } catch (error: any) {
            showToast(error?.message || '케이스 목록을 모두 불러오지 못했습니다.', 'error');
        } finally {
            setIsRunCaseLoadAllPending(false);
        }
    };

    const { data: selectedDatasetCases, isFetching: isSelectedDatasetCasesFetching } = useQuery({
        queryKey: ['evalDatasetCases', workspaceId, promptId, selectedDatasetId],
        queryFn: async () => {
            if (!selectedDatasetId) return [];
            return (await promptApi.getEvalDatasetCases(workspaceId, promptId, selectedDatasetId)).data;
        },
        enabled: !!selectedDatasetId,
    });

    const { data: runDatasetCases } = useQuery({
        queryKey: ['evalDatasetCasesByRun', workspaceId, promptId, selectedRun?.datasetId],
        queryFn: async () => {
            if (!selectedRun?.datasetId) return [];
            return (await promptApi.getEvalDatasetCases(workspaceId, promptId, selectedRun.datasetId)).data;
        },
        enabled: !!selectedRun?.datasetId,
    });

    useEffect(() => {
        if (!selectedDatasetId && defaults?.datasetId) {
            setSelectedDatasetId(defaults.datasetId);
        }
        if (!selectedDatasetId && datasets && datasets.length > 0) {
            setSelectedDatasetId(datasets[0].id);
        }
    }, [defaults?.datasetId, datasets, selectedDatasetId]);

    useEffect(() => {
        if (defaults) {
            setMode(defaults.defaultMode);
            setRubricTemplateCode(defaults.rubricTemplateCode);
            lastCustomFormJsonRef.current = null;
            setRubricOverridesInput(
                defaults.rubricOverrides
                    ? JSON.stringify(defaults.rubricOverrides, null, 2)
                    : ''
            );
            setAutoEvalEnabled(defaults.autoEvalEnabled);
        }
    }, [defaults]);

    useEffect(() => {
        if (!releaseCriteria) {
            return;
        }
        setReleaseCriteriaForm({
            minPassRate: Number(releaseCriteria.minPassRate ?? 90),
            minAvgOverallScore: Number(releaseCriteria.minAvgOverallScore ?? 75),
            maxErrorRate: Number(releaseCriteria.maxErrorRate ?? 10),
            minImprovementNoticeDelta: Number(releaseCriteria.minImprovementNoticeDelta ?? 3),
        });
    }, [releaseCriteria]);

    useEffect(() => {
        if (!selectedVersionId && versions && versions.length > 0) {
            setSelectedVersionId(versions[0].id);
        }
    }, [versions, selectedVersionId]);

    useEffect(() => {
        if (!selectedRunId && runs && runs.length > 0) {
            setSelectedRunId(runs[0].id);
        }
    }, [runs, selectedRunId]);

    useEffect(() => {
        setExpandedCaseId(null);
        setResultSectionTab('OVERVIEW');
        setRunCaseExtraPages([]);
        setIsRunCaseLoadMorePending(false);
        setIsRunCaseLoadAllPending(false);
    }, [selectedRunId]);

    useEffect(() => {
        if (caseInputMode !== 'FORM') {
            return;
        }
        if (caseFormRows.length === 0) {
            if (expandedEditorCaseId !== null) {
                setExpandedEditorCaseId(null);
            }
            return;
        }
        if (!expandedEditorCaseId || !caseFormRows.some((row) => row.id === expandedEditorCaseId)) {
            setExpandedEditorCaseId(caseFormRows[0].id);
        }
    }, [caseFormRows, caseInputMode, expandedEditorCaseId]);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                window.clearTimeout(toastTimerRef.current);
            }
            if (moveToRunTimerRef.current) {
                window.clearTimeout(moveToRunTimerRef.current);
            }
        };
    }, []);

    const selectedMode = useMemo(
        () => MODE_OPTIONS.find((option) => option.value === mode),
        [mode]
    );

    const selectedRubric = useMemo(
        () => RUBRIC_OPTIONS.find((option) => option.code === rubricTemplateCode),
        [rubricTemplateCode]
    );

    const selectedDataset = useMemo(
        () => (datasets || []).find((dataset) => dataset.id === selectedDatasetId) ?? null,
        [datasets, selectedDatasetId]
    );

    const selectedVersion = useMemo(
        () => (versions || []).find((version) => version.id === selectedVersionId) ?? null,
        [versions, selectedVersionId]
    );
    const selectedRunVersion = useMemo(
        () => (versions || []).find((version) => version.id === selectedRun?.promptVersionId) ?? null,
        [versions, selectedRun?.promptVersionId]
    );
    const selectedRunVersionLabel = selectedRunVersion
        ? `v${selectedRunVersion.versionNumber}`
        : selectedRun
            ? `version#${selectedRun.promptVersionId}`
            : '-';
    const activeVersionLabel = activeRelease?.activeVersionNo ? `v${activeRelease.activeVersionNo}` : '-';

    const missingProviderKeys = useMemo(() => {
        if (!Number.isFinite(orgId) || orgId <= 0) {
            return [];
        }
        const requiredProviders = new Set<string>();
        if (selectedVersion?.provider) {
            requiredProviders.add(String(selectedVersion.provider));
        }
        if (mode === 'COMPARE_ACTIVE') {
            const activeVersion = (versions || []).find((version) => version.id === activeRelease?.activeVersionId) ?? null;
            if (activeVersion?.provider) {
                requiredProviders.add(String(activeVersion.provider));
            }
        }
        // Judge provider is currently fixed by backend properties (eval.judge.provider=OPENAI).
        requiredProviders.add('OPENAI');

        const normalizeProvider = (value: string) => (value || '').trim().toUpperCase();

        const creds = providerCredentials || [];
        const hasProvider = (provider: string) => {
            const target = normalizeProvider(provider);
            return creds.some(
                (cred) => normalizeProvider(cred.provider) === target && cred.status === 'ACTIVE'
            );
        };

        return Array.from(requiredProviders).filter((provider) => !hasProvider(provider));
    }, [orgId, providerCredentials, selectedVersion?.provider, mode, versions, activeRelease?.activeVersionId]);

    const providerKeyMissingBanner = useMemo(() => {
        const content = runCases?.content || [];
        if (!selectedRun || content.length === 0) {
            return null;
        }
        const allMissingKey = content.every(
            (item) => item.status === 'ERROR' && (item.errorMessage || '').includes('provider key')
        );
        if (!allMissingKey) {
            return null;
        }
        return {
            title: 'Provider 키가 등록되지 않아 평가가 실행되지 않았습니다.',
            body: 'Settings > Provider Keys에서 OpenAI 키를 등록하면 Candidate/Judge 호출이 정상 동작합니다.',
        };
    }, [runCases?.content, selectedRun]);

    const parsedRubricOverrides = useMemo(() => {
        const trimmed = rubricOverridesInput.trim();
        if (!trimmed) {
            return undefined;
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return null;
            }
            return parsed as Record<string, any>;
        } catch {
            return null;
        }
    }, [rubricOverridesInput]);

    useEffect(() => {
        if (rubricTemplateCode !== 'CUSTOM') {
            return;
        }

        const trimmed = rubricOverridesInput.trim();
        if (!trimmed) {
            const defaultForm = createDefaultCustomRubricForm(nextCustomCriterionId);
            applyCustomFormAndSyncOverrides(defaultForm);
            return;
        }

        if (lastCustomFormJsonRef.current !== null && trimmed === lastCustomFormJsonRef.current.trim()) {
            return;
        }

        if (!parsedRubricOverrides || typeof parsedRubricOverrides !== 'object' || Array.isArray(parsedRubricOverrides)) {
            return;
        }

        const nextForm = buildCustomRubricFormFromOverrides(
            parsedRubricOverrides as Record<string, any>,
            nextCustomCriterionId
        );
        setCustomRubricForm(nextForm);
    }, [rubricTemplateCode, rubricOverridesInput, parsedRubricOverrides]);

    const preparedCaseInput = useMemo(() => {
        if (caseInputMode === 'FORM') {
            try {
                const parsed = parseCaseRows(caseFormRows);
                return {
                    count: parsed.length,
                    error: null as string | null,
                    testCases: parsed,
                };
            } catch (error: any) {
                return {
                    count: 0,
                    error: error?.message || '테스트케이스 입력값을 확인해주세요.',
                    testCases: [] as EvalTestCaseCreateRequest[],
                };
            }
        }

        const trimmed = testcaseInput.trim();
        if (!trimmed) {
            return { count: 0, error: null as string | null, testCases: [] as EvalTestCaseCreateRequest[] };
        }
        try {
            const parsed = parseCaseInput(trimmed);
            return { count: parsed.length, error: null as string | null, testCases: parsed };
        } catch (error: any) {
            return {
                count: 0,
                error: error?.message || '테스트케이스 JSON 형식이 올바르지 않습니다.',
                testCases: [] as EvalTestCaseCreateRequest[],
            };
        }
    }, [caseInputMode, caseFormRows, testcaseInput]);

    const hasDatasetCases = (selectedDatasetCases?.length || 0) > 0;
    const hasDraftCases = preparedCaseInput.count > 0 && !preparedCaseInput.error;
    const canGoToRunFromDataset = hasDatasetCases || hasDraftCases;
    const goToRunDisabledReason = hasDatasetCases
        ? ''
        : preparedCaseInput.error
            ? '입력 오류를 먼저 해결해 주세요.'
            : preparedCaseInput.count === 0
                ? '왼쪽에서 테스트 케이스를 1개 이상 작성해 주세요.'
                : '';

    const previewCases = useMemo(() => {
        if ((selectedDatasetCases?.length || 0) > 0) {
            return (selectedDatasetCases || []).map((item) => ({
                key: `saved-${item.id}`,
                order: item.caseOrder,
                input: item.input,
                externalId: item.externalId || '',
                checks: summarizeCaseChecks(item.expectedJson, item.constraintsJson),
                source: 'saved' as const,
            }));
        }

        return preparedCaseInput.testCases.map((item, idx) => ({
            key: `draft-${idx}`,
            order: idx + 1,
            input: item.input,
            externalId: item.externalId || '',
            checks: summarizeCaseChecks(item.expectedJson, item.constraintsJson),
            source: 'draft' as const,
        }));
    }, [preparedCaseInput.testCases, selectedDatasetCases]);
    const canEstimateCompare = mode !== 'COMPARE_ACTIVE'
        || (!!activeRelease?.activeVersionId && selectedVersionId !== activeRelease.activeVersionId);
    const canEstimateRun = !!selectedDatasetId && !!selectedVersionId && canEstimateCompare;

    const {
        data: runEstimate,
        isFetching: isRunEstimateFetching,
        error: runEstimateError,
    } = useQuery({
        queryKey: ['evalRunEstimate', workspaceId, promptId, selectedVersionId, selectedDatasetId, mode, rubricTemplateCode],
        queryFn: async () => {
            if (!selectedVersionId || !selectedDatasetId) {
                return null;
            }
            return (
                await promptApi.estimateEvalRun(workspaceId, promptId, {
                    promptVersionId: selectedVersionId,
                    datasetId: selectedDatasetId,
                    mode,
                    rubricTemplateCode,
                })
            ).data;
        },
        enabled: canEstimateRun,
        retry: false,
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

    const createDatasetWithCasesMutation = useMutation({
        mutationFn: async () => {
            const name = datasetName.trim();
            if (!name) throw new Error('데이터셋 이름은 필수입니다.');
            if (preparedCaseInput.error) throw new Error(preparedCaseInput.error);
            const testCases = preparedCaseInput.testCases;
            if (testCases.length === 0) throw new Error('최소 1개 이상의 테스트케이스가 필요합니다.');

            let createdDatasetId: number | null = null;
            try {
                const datasetResponse = await promptApi.createEvalDataset(workspaceId, promptId, {
                    name,
                    description: datasetDescription.trim() || undefined,
                });
                createdDatasetId = datasetResponse.data.id;

                const uploadResponse = await promptApi.bulkUploadEvalDatasetCases(
                    workspaceId,
                    promptId,
                    createdDatasetId,
                    {
                        testCases,
                        replaceExisting: true,
                    }
                );

                return {
                    dataset: datasetResponse.data,
                    uploadedCount: uploadResponse.data.uploadedCount,
                };
            } catch (error: any) {
                if (createdDatasetId) {
                    throw new Error(
                        `데이터셋은 생성되었지만 케이스 저장에 실패했습니다. (datasetId=${createdDatasetId})`
                    );
                }
                throw error;
            }
        },
        onSuccess: async (result) => {
            setDatasetName('');
            setDatasetDescription('');
            setSelectedDatasetId(result.dataset.id);
            const nextId = nextCaseRowId();
            setCaseFormRows([createEmptyCaseFormRow(nextId)]);
            setExpandedEditorCaseId(nextId);
            setAdvancedJsonOpenByRow({});
            setTestcaseInput('');
            await queryClient.invalidateQueries({ queryKey: ['evalDatasets', workspaceId, promptId] });
            await queryClient.invalidateQueries({
                queryKey: ['evalDatasetCases', workspaceId, promptId, result.dataset.id],
            });
            showToast(
                `데이터셋이 생성되고 ${result.uploadedCount}개 테스트케이스가 저장되었습니다.`,
                'success'
            );
        },
        onError: (error: any) => {
            showToast(error?.message || '데이터셋 생성/케이스 저장에 실패했습니다.', 'error');
        },
    });

    const uploadCasesMutation = useMutation({
        mutationFn: async () => {
            if (!selectedDatasetId) throw new Error('데이터셋을 먼저 선택하세요.');
            if (preparedCaseInput.error) throw new Error(preparedCaseInput.error);
            const testCases = preparedCaseInput.testCases;
            if (testCases.length === 0) throw new Error('업로드할 테스트 케이스가 없습니다.');
            return promptApi.bulkUploadEvalDatasetCases(workspaceId, promptId, selectedDatasetId, {
                testCases,
                replaceExisting,
            });
        },
        onSuccess: async (response) => {
            showToast(`${response.data.uploadedCount}개 테스트 케이스가 업로드되었습니다.`, 'success');
            await queryClient.invalidateQueries({ queryKey: ['evalRunCases', workspaceId, promptId] });
            await queryClient.invalidateQueries({ queryKey: ['evalDatasetCases', workspaceId, promptId, selectedDatasetId] });
            const nextId = nextCaseRowId();
            setCaseFormRows([createEmptyCaseFormRow(nextId)]);
            setExpandedEditorCaseId(nextId);
            setAdvancedJsonOpenByRow({});
            setTestcaseInput('');
        },
        onError: (error: any) => {
            showToast(error?.message || '테스트 케이스 업로드에 실패했습니다.', 'error');
        },
    });

    const saveDefaultMutation = useMutation({
        mutationFn: async () => {
            if (parsedRubricOverrides === null) {
                throw new Error('루브릭 Override JSON 형식이 올바르지 않습니다.');
            }
            return promptApi.upsertEvalDefaults(workspaceId, promptId, {
                datasetId: selectedDatasetId ?? undefined,
                rubricTemplateCode,
                rubricOverrides: parsedRubricOverrides,
                defaultMode: mode,
                autoEvalEnabled,
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['evalDefaults', workspaceId, promptId] });
            showToast('평가 기본 설정이 저장되었습니다.', 'success');
        },
        onError: (error: any) => {
            showToast(error?.message || '기본 설정 저장에 실패했습니다.', 'error');
        },
    });

    const saveReleaseCriteriaMutation = useMutation({
        mutationFn: async () => {
            return promptApi.updateEvalReleaseCriteria(workspaceId, releaseCriteriaForm);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['evalReleaseCriteria', workspaceId] });
            showToast('배포 판단 기준이 저장되었습니다.', 'success');
        },
        onError: (error: any) => {
            showToast(error?.message || '배포 판단 기준 저장에 실패했습니다.', 'error');
        },
    });

    const createRunMutation = useMutation({
        mutationFn: async (forcedMode?: EvalMode) => {
            const effectiveMode = forcedMode ?? mode;
            if (missingProviderKeys.length > 0) {
                throw new Error(`Provider 키가 없습니다: ${missingProviderKeys.join(', ')}. 먼저 Provider Keys에서 등록하세요.`);
            }
            if (!selectedDatasetId) throw new Error('데이터셋을 선택하세요.');
            if (!selectedVersionId) throw new Error('프롬프트 버전을 선택하세요.');
            if (!hasDatasetCases) throw new Error('선택한 데이터셋에 테스트케이스가 없습니다. 먼저 케이스를 업로드하세요.');
            if (parsedRubricOverrides === null) {
                throw new Error('루브릭 Override JSON 형식이 올바르지 않습니다.');
            }
            if (effectiveMode === 'COMPARE_ACTIVE') {
                if (!activeRelease?.activeVersionId) {
                    throw new Error('현재 배포(Active) 버전이 없어 비교 모드를 실행할 수 없습니다.');
                }
                if (selectedVersionId === activeRelease.activeVersionId) {
                    throw new Error('비교 대상이 동일합니다. 현재 배포 버전과 다른 후보 버전을 선택하세요.');
                }
            }
            return promptApi.createEvalRun(workspaceId, promptId, {
                promptVersionId: selectedVersionId,
                datasetId: selectedDatasetId,
                mode: effectiveMode,
                rubricTemplateCode,
                rubricOverrides: parsedRubricOverrides,
            });
        },
        onSuccess: async (response) => {
            setSelectedRunId(response.data.id);
            setExpandedCaseId(null);
            setActiveTab('result');
            await queryClient.invalidateQueries({ queryKey: ['evalRuns', workspaceId, promptId] });
            showToast(`평가 실행을 시작했습니다. Run #${response.data.id}`, 'success');
        },
        onError: (error: any) => {
            showToast(error?.message || '평가 실행 생성에 실패했습니다.', 'error');
        },
    });

    const rerunSelectedRunMutation = useMutation({
        mutationFn: async (run: EvalRunResponse) => {
            if (!run) {
                throw new Error('선택된 Run이 없습니다.');
            }

            const requiredProviders = new Set<string>();
            const normalizeProvider = (value: string) => (value || '').trim().toUpperCase();
            const creds = providerCredentials || [];
            const hasProvider = (provider: string) => {
                const target = normalizeProvider(provider);
                return creds.some(
                    (cred) => normalizeProvider(cred.provider) === target && cred.status === 'ACTIVE'
                );
            };

            const candidateVersion = (versions || []).find((version) => version.id === run.promptVersionId) ?? null;
            const candidateProvider = run.candidateProvider || (candidateVersion?.provider ? String(candidateVersion.provider) : '');
            if (candidateProvider) {
                requiredProviders.add(candidateProvider);
            }

            if (run.mode === 'COMPARE_ACTIVE') {
                if (!activeRelease?.activeVersionId) {
                    throw new Error('현재 운영(Active) 버전이 없어 비교 모드를 다시 실행할 수 없습니다. 먼저 Release를 진행하세요.');
                }
                if (run.promptVersionId === activeRelease.activeVersionId) {
                    throw new Error('비교 대상이 동일합니다. 운영 버전과 다른 후보 버전으로 다시 실행하세요.');
                }
                const activeVersion = (versions || []).find((version) => version.id === activeRelease.activeVersionId) ?? null;
                if (activeVersion?.provider) {
                    requiredProviders.add(String(activeVersion.provider));
                }
            }

            // Judge provider is currently fixed by backend properties (eval.judge.provider=OPENAI).
            requiredProviders.add('OPENAI');

            const missing = Array.from(requiredProviders).filter((provider) => !hasProvider(provider));
            if (missing.length > 0) {
                throw new Error(`Provider 키가 없습니다: ${missing.join(', ')}. 먼저 Provider Keys에서 등록하세요.`);
            }

            return promptApi.createEvalRun(workspaceId, promptId, {
                promptVersionId: run.promptVersionId,
                datasetId: run.datasetId,
                mode: run.mode,
                rubricTemplateCode: run.rubricTemplateCode,
                rubricOverrides: run.rubricOverrides || undefined,
            });
        },
        onSuccess: async (response) => {
            setSelectedRunId(response.data.id);
            setExpandedCaseId(null);
            setActiveTab('result');
            await queryClient.invalidateQueries({ queryKey: ['evalRuns', workspaceId, promptId] });
            showToast(`같은 설정으로 다시 실행했습니다. Run #${response.data.id}`, 'success');
        },
        onError: (error: any) => {
            showToast(error?.message || '다시 실행에 실패했습니다.', 'error');
        },
    });

    const cancelRunMutation = useMutation({
        mutationFn: async (runId: number) => promptApi.cancelEvalRun(workspaceId, promptId, runId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['evalRuns', workspaceId, promptId] });
            showToast('평가 실행을 취소했습니다.', 'info');
        },
        onError: (error: any) => {
            showToast(error?.message || '실행 취소에 실패했습니다.', 'error');
        },
    });

    const runProgressPercent = useMemo(() => {
        if (!selectedRun || selectedRun.totalCases <= 0) {
            return 0;
        }
        return Math.min(100, Math.round((selectedRun.processedCases / selectedRun.totalCases) * 100));
    }, [selectedRun]);

    const selectedRunDecision = useMemo(
        () => extractRunDecision(selectedRun?.summary),
        [selectedRun?.summary]
    );

    const applyRubricOverridesTextFromExternal = (text: string) => {
        lastCustomFormJsonRef.current = null;
        setRubricOverridesInput(text);
    };

    const updateCustomRubricForm = (updater: (prev: CustomRubricFormState) => CustomRubricFormState) => {
        const next = updater(customRubricForm);
        applyCustomFormAndSyncOverrides(next);
    };

    const handleCustomCriterionChange = (
        criterionId: string,
        field: 'criterion' | 'weight' | 'minScore',
        value: string
    ) => {
        updateCustomRubricForm((prev) => ({
            ...prev,
            criteria: prev.criteria.map((row) =>
                row.id === criterionId ? { ...row, [field]: value } : row
            ),
        }));
    };

    const handleAddCustomCriterion = () => {
        updateCustomRubricForm((prev) => ({
            ...prev,
            criteria: [...prev.criteria, createEmptyCriterionRow(nextCustomCriterionId)],
        }));
    };

    const handleRemoveCustomCriterion = (criterionId: string) => {
        updateCustomRubricForm((prev) => ({
            ...prev,
            criteria: prev.criteria.filter((row) => row.id !== criterionId),
        }));
    };

    const handleCaseModeChange = (nextMode: CaseInputMode) => {
        if (nextMode === caseInputMode) {
            return;
        }

        if (nextMode === 'JSON') {
            try {
                const fromForm = parseCaseRows(caseFormRows);
                if (fromForm.length > 0) {
                    setTestcaseInput(JSON.stringify(fromForm, null, 2));
                }
            } catch {
                // Keep current textarea as-is when form has validation errors.
            }
        } else {
            const trimmed = testcaseInput.trim();
            if (trimmed) {
                try {
                    const parsed = parseCaseInput(trimmed);
                    setCaseFormRows(buildCaseRowsFromCases(parsed, nextCaseRowId));
                    setExpandedEditorCaseId(null);
                    setAdvancedJsonOpenByRow({});
                } catch {
                    // Keep existing form rows when JSON text is invalid.
                }
            }
        }

        setCaseInputMode(nextMode);
    };

    const handleCasePresetApply = (presetValue: string) => {
        if (caseInputMode === 'JSON') {
            setTestcaseInput(presetValue);
            return;
        }

        try {
            const parsed = parseCaseInput(presetValue);
            setCaseFormRows(buildCaseRowsFromCases(parsed, nextCaseRowId));
            setExpandedEditorCaseId(null);
            setAdvancedJsonOpenByRow({});
        } catch {
            setTestcaseInput(presetValue);
            setCaseInputMode('JSON');
            showToast('프리셋을 JSON 모드로 적용했습니다.', 'info');
        }
    };

    const updateCaseRow = (rowId: string, field: keyof Omit<CaseFormRow, 'id'>, value: string) => {
        setCaseFormRows((prev) =>
            prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
        );
    };

    const updateCaseJsonObject = (
        rowId: string,
        field: CaseJsonField,
        updater: (current: Record<string, any>) => Record<string, any>
    ) => {
        setCaseFormRows((prev) =>
            prev.map((row) => {
                if (row.id !== rowId) return row;
                const current = parseObjectTextLoose(row[field]);
                const next = cleanupJsonObject(updater(current));
                return {
                    ...row,
                    [field]: Object.keys(next).length > 0 ? JSON.stringify(next, null, 2) : '',
                };
            })
        );
    };

    const setCaseArrayField = (
        rowId: string,
        field: CaseJsonField,
        key: string,
        values: string[]
    ) => {
        updateCaseJsonObject(rowId, field, (obj) => {
            const next = { ...obj };
            const cleaned = normalizeStringArray(values);
            if (cleaned.length > 0) {
                next[key] = cleaned;
            } else {
                delete next[key];
            }
            return next;
        });
    };

    const setCaseBooleanFlag = (
        rowId: string,
        key: string,
        checked: boolean
    ) => {
        updateCaseJsonObject(rowId, 'expectedJsonText', (obj) => {
            const next = { ...obj };
            const flags = isObject(next.structure_flags) ? { ...next.structure_flags } : {};
            if (checked) {
                flags[key] = true;
            } else {
                delete flags[key];
            }
            if (Object.keys(flags).length > 0) {
                next.structure_flags = flags;
            } else {
                delete next.structure_flags;
            }
            return next;
        });
    };

    const setConstraintMaxChars = (rowId: string, value: string) => {
        const parsed = value.trim() ? Number(value) : null;
        updateCaseJsonObject(rowId, 'constraintsJsonText', (obj) => {
            const next = { ...obj };
            if (parsed != null && Number.isFinite(parsed) && parsed > 0) {
                next.max_chars = Math.floor(parsed);
            } else {
                delete next.max_chars;
            }
            return next;
        });
    };

    const setConstraintJsonOnly = (rowId: string, checked: boolean) => {
        updateCaseJsonObject(rowId, 'constraintsJsonText', (obj) => {
            const next = { ...obj };
            if (checked) {
                next.format = 'json_only';
            } else if (next.format === 'json_only') {
                delete next.format;
            }
            return next;
        });
    };

    const setConstraintLanguage = (rowId: string, language: string) => {
        updateCaseJsonObject(rowId, 'constraintsJsonText', (obj) => {
            const next = { ...obj };
            if (language.trim()) {
                next.allowed_language = language.trim();
            } else {
                delete next.allowed_language;
            }
            return next;
        });
    };

    const setConstraintKeywordNormalization = (rowId: string, enabled: boolean) => {
        updateCaseJsonObject(rowId, 'constraintsJsonText', (obj) => {
            const next = { ...obj };
            if (enabled) {
                next.keyword_normalization = 'BASIC';
            } else {
                delete next.keyword_normalization;
            }
            delete next.keyword_normalize;
            return next;
        });
    };

    const setContextLanguage = (rowId: string, language: string) => {
        updateCaseJsonObject(rowId, 'contextJsonText', (obj) => {
            const next = { ...obj };
            if (language.trim()) {
                next.lang = language.trim();
            } else {
                delete next.lang;
            }
            return next;
        });
    };

    const addCaseRow = () => {
        const nextId = nextCaseRowId();
        setCaseFormRows((prev) => [...prev, createEmptyCaseFormRow(nextId)]);
        setExpandedEditorCaseId(nextId);
    };

    const removeCaseRow = (rowId: string) => {
        setAdvancedJsonOpenByRow((prev) => {
            if (!prev[rowId]) return prev;
            const next = { ...prev };
            delete next[rowId];
            return next;
        });
        setCaseFormRows((prev) => {
            const filtered = prev.filter((row) => row.id !== rowId);
            if (filtered.length > 0) {
                return filtered;
            }
            const nextId = nextCaseRowId();
            setExpandedEditorCaseId(nextId);
            return [createEmptyCaseFormRow(nextId)];
        });
    };

    const scrollToCaseBuilder = () => {
        caseBuilderSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => {
            addCaseButtonRef.current?.focus();
        }, 260);
    };

    const handleMoveToRun = () => {
        if (!canGoToRunFromDataset || isMovingToRun) {
            return;
        }
        setIsMovingToRun(true);
        moveToRunTimerRef.current = window.setTimeout(() => {
            setActiveTab('run');
            setIsMovingToRun(false);
            moveToRunTimerRef.current = null;
        }, 260);
    };

    return (
        <div className="space-y-6">
            {toastMessage && (
                <div className={`fixed top-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-xl border ${
                    toastTone === 'success'
                        ? 'bg-emerald-500/15 border-emerald-400/20 text-emerald-200'
                        : toastTone === 'error'
                            ? 'bg-rose-500/15 border-rose-400/20 text-rose-200'
                            : 'bg-blue-500/15 border-blue-400/20 text-blue-200'
                }`}>
                    {toastMessage}
                </div>
            )}

            <div className="glass-card rounded-2xl p-6 space-y-4">
                <h3 className="text-white font-semibold">프롬프트 평가 가이드</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {EVAL_TABS.map((tab, index) => {
                        const isCurrent = activeTab === tab.value;
                        return (
                            <button
                                key={tab.value}
                                type="button"
                                onClick={() => setActiveTab(tab.value)}
                                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                                    isCurrent
                                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 shadow-[0_0_18px_rgba(168,85,247,0.2)]'
                                        : 'border-white/10 bg-black/20 hover:bg-black/30'
                                }`}
                            >
                                <p className={`text-[11px] font-semibold uppercase ${isCurrent ? 'text-[var(--primary)]' : 'text-gray-500'}`}>
                                    {`단계 ${index + 1}${isCurrent ? ' (현재)' : ''}`}
                                </p>
                                <p className={`mt-1 text-base font-semibold ${isCurrent ? 'text-white' : 'text-gray-300'}`}>
                                    {tab.label}
                                </p>
                                <p className={`mt-1 text-xs ${isCurrent ? 'text-gray-200' : 'text-gray-500'}`}>
                                    {tab.description}
                                </p>
                            </button>
                        );
                    })}
                </div>
                <p className="text-xs text-gray-400">
                    최종 통과 기준: <span className="text-gray-300">AI 심사(Judge) 통과</span> + <span className="text-gray-300">하드룰(Rule) 통과</span> + <span className="text-gray-300">합격선(Gate) 충족</span>
                </p>
            </div>

            {activeTab === 'dataset' ? (
                <div className="space-y-3">
                    <div className="glass-card rounded-2xl border border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-gray-400">
                            작성이 길어질 때는 <span className="text-gray-200">집중(1열)</span>, 비교 확인이 필요하면 <span className="text-gray-200">분할(2열)</span> 모드를 사용하세요.
                        </div>
                        <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-1">
                            <button
                                type="button"
                                onClick={() => setDatasetLayoutMode('FOCUS')}
                                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                                    datasetLayoutMode === 'FOCUS'
                                        ? 'bg-[var(--primary)] text-black font-semibold'
                                        : 'text-gray-300 hover:bg-white/10'
                                }`}
                            >
                                집중(1열)
                            </button>
                            <button
                                type="button"
                                onClick={() => setDatasetLayoutMode('SPLIT')}
                                className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                                    datasetLayoutMode === 'SPLIT'
                                        ? 'bg-[var(--primary)] text-black font-semibold'
                                        : 'text-gray-300 hover:bg-white/10'
                                }`}
                            >
                                분할(2열)
                            </button>
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 ${datasetLayoutMode === 'SPLIT' ? 'lg:grid-cols-12' : ''} gap-6`}>
	                    <section className={`glass-card rounded-2xl border border-white/10 flex flex-col ${datasetLayoutMode === 'SPLIT' ? 'lg:col-span-5' : ''}`}>
	                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
	                            <h3 className="text-white font-semibold text-lg">데이터셋 설정</h3>
	                            <div className="inline-flex w-full sm:w-auto rounded-md border border-white/15 bg-black/30 p-1">
	                                <button
	                                    type="button"
	                                    onClick={() => handleCaseModeChange('FORM')}
                                    className={`px-2.5 py-1 rounded text-xs whitespace-nowrap ${
                                        caseInputMode === 'FORM'
                                            ? 'bg-white/15 text-white'
                                            : 'text-gray-400 hover:text-gray-200'
	                                    }`}
	                                    title="추천(기본) 입력 방식"
	                                >
	                                    폼 (추천)
	                                </button>
	                                <button
	                                    type="button"
	                                    onClick={() => handleCaseModeChange('JSON')}
                                    className={`px-2.5 py-1 rounded text-xs whitespace-nowrap ${
                                        caseInputMode === 'JSON'
                                            ? 'bg-white/15 text-white'
                                            : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                    title="고급(개발자용) 직접 편집"
                                >
                                    JSON (고급)
                                </button>
                            </div>
                        </div>

                        {caseInputMode === 'JSON' ? (
                            <div className="mx-5 mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                                고급(개발자용) 모드입니다. JSON 직접 편집 시 객체 형식을 지켜주세요.
                            </div>
                        ) : null}

                        <div className="space-y-5 px-5 py-5">
	                            <div className="space-y-3">
	                                <div>
	                                    <label className="block text-xs text-gray-400 mb-1">데이터셋 이름</label>
	                                    <input
	                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
	                                        placeholder="예: cs-refund-eval-v1"
	                                        value={datasetName}
                                        onChange={(e) => setDatasetName(e.target.value)}
                                    />
	                                </div>
	                                <div>
	                                    <label className="block text-xs text-gray-400 mb-1">설명 (선택)</label>
	                                    <textarea
	                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white h-20 resize-none"
	                                        placeholder="데이터셋 목적을 적어주세요."
	                                        value={datasetDescription}
                                        onChange={(e) => setDatasetDescription(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-white/10" />

	                            <div ref={caseBuilderSectionRef} className="space-y-3">
	                                <div className="flex items-center justify-between">
	                                    <h4 className="text-sm font-semibold text-gray-200">새 테스트 케이스</h4>
	                                    <button
	                                        type="button"
	                                        onClick={() => {
	                                            const nextId = nextCaseRowId();
                                            setCaseFormRows([createEmptyCaseFormRow(nextId)]);
                                            setExpandedEditorCaseId(nextId);
                                            setAdvancedJsonOpenByRow({});
                                            setTestcaseInput('');
	                                        }}
	                                        className="text-xs text-[var(--primary)] hover:underline"
	                                    >
	                                        입력 초기화
	                                    </button>
	                                </div>

                                <details className="rounded-lg border border-white/10 bg-black/20 p-3">
                                    <summary className="cursor-pointer text-xs text-gray-200 font-medium">입력 항목 가이드 보기</summary>
                                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-400">
                                        <p><span className="text-gray-200">Input</span>: 모델에 보낼 사용자 질문/요청</p>
                                        <p><span className="text-gray-200">External ID</span>: 케이스 식별자(예: `refund_case_01`)</p>
                                        <p><span className="text-gray-200">Context JSON</span>: 추가 문맥 변수(JSON 객체)</p>
                                        <p><span className="text-gray-200">Expected Output Criteria</span>: AI 체크(예: `must_cover`, `guideline`)</p>
                                        <p><span className="text-gray-200">Constraints JSON</span>: 형식/길이 제약(예: `json_only`, `max_chars`)</p>
                                    </div>
                                </details>

                                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-gray-300">
                                    <span className="text-emerald-300">Expected</span>: 답변에 포함되어야 할 내용
                                    <span className="mx-2 text-gray-500">/</span>
                                    <span className="text-sky-300">Constraints</span>: 답변 형식 및 제한 조건
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {CASE_PRESETS.map((preset) => (
                                        <button
                                            key={preset.key}
                                            type="button"
                                            onClick={() => handleCasePresetApply(preset.value)}
                                            className="px-2 py-1 rounded-md bg-white/10 border border-white/20 text-[11px] text-gray-200 hover:bg-white/15"
                                            title={preset.description}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                {caseInputMode === 'FORM' ? (
                                    <div className="space-y-3 max-h-[620px] overflow-auto pr-1">
                                        {caseFormRows.map((row, idx) => {
                                            const expectedObj = parseObjectTextLoose(row.expectedJsonText);
                                            const constraintsObj = parseObjectTextLoose(row.constraintsJsonText);
                                            const contextObj = parseObjectTextLoose(row.contextJsonText);

                                            const mustCover = toStringArray(expectedObj.must_cover);
                                            const mustIncludeWords = Array.from(new Set([
                                                ...toStringArray(constraintsObj.must_include),
                                                ...toStringArray(expectedObj.must_include),
                                            ].map((item) => item.trim()).filter((item) => item.length > 0)));
                                            const mustNotIncludeWords = Array.from(new Set([
                                                ...toStringArray(constraintsObj.must_not_include),
                                                ...toStringArray(expectedObj.must_not_include),
                                                ...toStringArray(constraintsObj.forbidden_words),
                                            ].map((item) => item.trim()).filter((item) => item.length > 0)));
                                            const requiredKeys = toStringArray(constraintsObj.required_keys);
                                            const structureFlags = isObject(expectedObj.structure_flags) ? expectedObj.structure_flags : {};
                                            const structureStepByStep = Boolean(structureFlags.step_by_step);
                                            const structureNumbered = Boolean(structureFlags.numbered_list);
                                            const structureGreeting = Boolean(structureFlags.greeting);

                                            const maxChars = toNullableNumber(constraintsObj.max_chars);
                                            const jsonOnly = constraintsObj.format === 'json_only';
                                            const keywordNormalizationRaw = constraintsObj.keyword_normalization ?? constraintsObj.keyword_normalize;
                                            const keywordNormalizationEnabled = String(
                                                typeof keywordNormalizationRaw === 'string'
                                                    ? keywordNormalizationRaw
                                                    : keywordNormalizationRaw === true
                                                        ? 'BASIC'
                                                        : ''
                                            ).toUpperCase() === 'BASIC';
                                            const allowedLanguage = typeof constraintsObj.allowed_language === 'string'
                                                ? constraintsObj.allowed_language
                                                : '';

                                            const contextLanguage = typeof contextObj.lang === 'string'
                                                ? contextObj.lang
                                                : typeof contextObj.locale === 'string'
                                                    ? contextObj.locale
                                                    : '';
                                            const extraContextKeys = Object.keys(contextObj).filter((key) => key !== 'lang' && key !== 'locale');

                                            const strength = evaluateConstraintStrength(expectedObj, constraintsObj);

                                            const isAdvancedOpen = Boolean(advancedJsonOpenByRow[row.id]);
                                            const isExpanded = expandedEditorCaseId === row.id;
                                            const summaryInput = row.input.trim()
                                                ? truncateText(row.input, 56)
                                                : '질문을 입력해 주세요.';
                                            const structureCount = [structureStepByStep, structureNumbered, structureGreeting].filter(Boolean).length;

                                            return (
                                                <div key={row.id} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <div className="min-w-0 space-y-1">
                                                            <p className="text-xs text-gray-200 font-semibold">Case #{idx + 1}</p>
                                                            <p className="text-xs text-gray-400 truncate">{summaryInput}</p>
                                                        </div>
                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] ${strength.badgeClass}`}>
                                                                제약 강도 {strength.level}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] text-gray-300 cursor-help"
                                                                title={strength.tooltip}
                                                                aria-label="제약 강도 계산 기준"
                                                            >
                                                                ?
                                                            </button>
                                                            <span className="text-[10px] text-gray-500">
                                                                {strength.ruleLabel}
                                                            </span>
                                                            <span className="inline-flex px-2 py-0.5 rounded-full border border-white/20 bg-white/5 text-[10px] text-gray-300">
                                                                조건 {strength.conditionCount}개
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedEditorCaseId((prev) => (prev === row.id ? null : row.id))}
                                                                className="px-2 py-1 rounded border border-white/20 bg-white/5 text-xs text-gray-200 hover:bg-white/10"
                                                                aria-expanded={isExpanded}
                                                                aria-controls={`case-editor-${row.id}`}
                                                            >
                                                                {isExpanded ? '접기' : '펼치기'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeCaseRow(row.id)}
                                                                className="px-2 py-1 rounded bg-white/10 border border-white/20 text-[11px] text-gray-200"
                                                                disabled={caseFormRows.length <= 1}
                                                            >
                                                                삭제
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {!isExpanded ? (
                                                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400">
                                                            AI 핵심포인트 {mustCover.length}개, 룰 필수단어 {mustIncludeWords.length}개, 룰 금지단어 {mustNotIncludeWords.length}개, 구조요건 {structureCount}개
                                                        </div>
                                                    ) : null}

                                                    {isExpanded ? (
                                                        <div id={`case-editor-${row.id}`} className="border-t border-white/10 pt-3 space-y-3">
                                                            <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                                                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">기본 정보</p>
                                                        <div>
                                                            <FieldTooltipLabel
                                                                label="사용자 질문 (필수)"
                                                                help='모델에 전달할 사용자 질문입니다. 예: "환불 가능 기간 알려주세요"'
                                                            />
                                                            <textarea
                                                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white h-20"
                                                                placeholder="예: 다음 주 상담 신청 방법 알려주세요."
                                                                value={row.input}
                                                                onChange={(e) => updateCaseRow(row.id, 'input', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            <div>
                                                                <FieldTooltipLabel
                                                                    label="케이스 ID (선택)"
                                                                    help='케이스 식별용 ID입니다. 예: "refund_case_01"'
                                                                />
                                                                <input
                                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                                                    placeholder="refund_case_01"
                                                                    value={row.externalId}
                                                                    onChange={(e) => updateCaseRow(row.id, 'externalId', e.target.value)}
                                                                />
                                                            </div>
                                                            <div>
                                                                <FieldTooltipLabel
                                                                    label="언어 (선택)"
                                                                    help='컨텍스트 변수 lang에 저장됩니다.'
                                                                />
                                                                <select
                                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                                                    value={contextLanguage}
                                                                    onChange={(e) => setContextLanguage(row.id, e.target.value)}
                                                                >
                                                                    {CASE_LANGUAGE_OPTIONS.map((option) => (
                                                                        <option key={option.value || 'auto'} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                                <p className="mt-1 text-[11px] text-gray-500">추가 문맥 변수: {extraContextKeys.length}개</p>
                                                            </div>
                                                        </div>
                                                            </div>

                                                            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3 space-y-3">
                                                        <p className="text-[11px] uppercase tracking-wide text-emerald-300 font-semibold">AI 체크 (의미 기반)</p>
                                                        <div className="rounded-md border border-emerald-400/15 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-100">
                                                            <span className="font-semibold">팁</span>: 고객 프롬프트 유형을 모를 때는 먼저 <span className="text-emerald-200">핵심 포인트(must_cover)</span>로
                                                            "의미적으로 다뤄야 하는 요구사항"을 적는 걸 추천합니다.
                                                        </div>
                                                        <TagListEditor
                                                            label="핵심 포인트 (의미 기반, Judge가 판단)"
                                                            values={mustCover}
                                                            placeholder='예: "환불 가능 기간을 안내", "문의 다음 단계 제시"'
                                                            onChange={(values) => setCaseArrayField(row.id, 'expectedJsonText', 'must_cover', values)}
                                                        />
                                                        <p className="text-[11px] text-emerald-100/80">
                                                            필수/금지 키워드(문자 그대로)는 아래 <span className="text-sky-200 font-semibold">룰 체크(하드 룰)</span>에서 설정하세요.
                                                        </p>
                                                        <div className="space-y-2">
                                                            <p className="text-[11px] text-emerald-200">필수 구조</p>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                <StructureToggleCard
                                                                    label="단계별 안내 포함"
                                                                    checked={structureStepByStep}
                                                                    onChange={(checked) => setCaseBooleanFlag(row.id, 'step_by_step', checked)}
                                                                />
                                                                <StructureToggleCard
                                                                    label="번호 목록 형식"
                                                                    checked={structureNumbered}
                                                                    onChange={(checked) => setCaseBooleanFlag(row.id, 'numbered_list', checked)}
                                                                />
                                                                <StructureToggleCard
                                                                    label="인사말 포함"
                                                                    checked={structureGreeting}
                                                                    onChange={(checked) => setCaseBooleanFlag(row.id, 'greeting', checked)}
                                                                />
                                                            </div>
                                                        </div>
                                                            </div>

                                                            <div className="rounded-lg border border-sky-400/20 bg-sky-500/5 p-3 space-y-3">
                                                        <p className="text-[11px] uppercase tracking-wide text-sky-300 font-semibold">룰 체크 (하드 룰)</p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            <div>
                                                                <FieldTooltipLabel
                                                                    label="최대 글자 수"
                                                                    help='응답 길이를 제한합니다. 비우면 제한하지 않습니다.'
                                                                />
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                                                    placeholder="예: 400"
                                                                    value={maxChars ?? ''}
                                                                    onChange={(e) => setConstraintMaxChars(row.id, e.target.value)}
                                                                />
                                                            </div>
                                                            <div>
                                                                <FieldTooltipLabel
                                                                    label="허용 응답 언어"
                                                                    help='모델 출력 언어를 제한하고 싶을 때 사용합니다.'
                                                                />
                                                                <select
                                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                                                    value={allowedLanguage}
                                                                    onChange={(e) => setConstraintLanguage(row.id, e.target.value)}
                                                                >
                                                                    {CASE_LANGUAGE_OPTIONS.map((option) => (
                                                                        <option key={option.value || 'auto'} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            <TagListEditor
                                                                label="필수 포함 키워드 (하드룰, 문자 그대로)"
                                                                values={mustIncludeWords}
                                                                placeholder="예: 환불, 사전 신청"
                                                                onChange={(values) => {
                                                                    setCaseArrayField(row.id, 'constraintsJsonText', 'must_include', values);
                                                                    updateCaseJsonObject(row.id, 'expectedJsonText', (obj) => {
                                                                        const next = { ...obj };
                                                                        delete next.must_include;
                                                                        return next;
                                                                    });
                                                                }}
                                                            />
                                                            <TagListEditor
                                                                label="금지 키워드 (하드룰, 문자 그대로)"
                                                                values={mustNotIncludeWords}
                                                                placeholder="예: 확실히, 절대"
                                                                onChange={(values) => {
                                                                    setCaseArrayField(row.id, 'constraintsJsonText', 'must_not_include', values);
                                                                    updateCaseJsonObject(row.id, 'constraintsJsonText', (obj) => {
                                                                        const next = { ...obj };
                                                                        delete next.forbidden_words;
                                                                        return next;
                                                                    });
                                                                    updateCaseJsonObject(row.id, 'expectedJsonText', (obj) => {
                                                                        const next = { ...obj };
                                                                        delete next.must_not_include;
                                                                        return next;
                                                                    });
                                                                }}
                                                            />
                                                        </div>
                                                        <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                                                            <input
                                                                type="checkbox"
                                                                checked={keywordNormalizationEnabled}
                                                                onChange={(e) => setConstraintKeywordNormalization(row.id, e.target.checked)}
                                                            />
                                                            키워드 정규화 (공백/대소문자/구두점 무시)
                                                        </label>
                                                        {keywordNormalizationEnabled ? (
                                                            <p className="text-[11px] text-gray-400">
                                                                예: "사전 신청"과 "사전신청", "refund policy"와 "Refund-policy!!"를 동일하게 매칭합니다.
                                                            </p>
                                                        ) : null}
                                                        <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                                                            <input
                                                                type="checkbox"
                                                                checked={jsonOnly}
                                                                onChange={(e) => setConstraintJsonOnly(row.id, e.target.checked)}
                                                            />
                                                            응답은 JSON 객체 형식만 허용
                                                        </label>
                                                        {!jsonOnly ? (
                                                            <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-gray-400">
                                                                JSON 필수 키(required_keys)는 <span className="text-gray-200">json_only</span>일 때만 검사됩니다.
                                                            </div>
                                                        ) : null}
                                                        {jsonOnly ? (
                                                            <TagListEditor
                                                                label="JSON 필수 키(required_keys)"
                                                                values={requiredKeys}
                                                                placeholder="예: answer, category"
                                                                onChange={(values) => setCaseArrayField(row.id, 'constraintsJsonText', 'required_keys', values)}
                                                            />
                                                        ) : null}
                                                            </div>

                                                            <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAdvancedJsonOpenByRow((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                                                            className="px-2 py-1 rounded-md bg-white/10 border border-white/20 text-[11px] text-gray-200 hover:bg-white/15"
                                                        >
                                                            ⚙ JSON 직접 편집 {isAdvancedOpen ? '닫기' : '열기'}
                                                        </button>
                                                        {isAdvancedOpen ? (
                                                            <div className="grid grid-cols-1 gap-2">
                                                                <div>
                                                                    <FieldTooltipLabel
                                                                        label="Context JSON (Advanced)"
                                                                        help='기본 UI에서 다루지 않는 추가 문맥 변수는 여기서 직접 입력하세요.'
                                                                    />
                                                                    <textarea
                                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white h-20 font-mono"
                                                                        placeholder='{"lang":"ko","grade":"middle"}'
                                                                        value={row.contextJsonText}
                                                                        onChange={(e) => updateCaseRow(row.id, 'contextJsonText', e.target.value)}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <FieldTooltipLabel
                                                                        label="Expected JSON (Advanced)"
                                                                        help='빌더가 생성한 expectedJson을 직접 수정할 수 있습니다.'
                                                                    />
                                                                    <textarea
                                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-emerald-200 h-20 font-mono"
                                                                        placeholder='{"must_cover":["..."],"must_include":["..."]}'
                                                                        value={row.expectedJsonText}
                                                                        onChange={(e) => updateCaseRow(row.id, 'expectedJsonText', e.target.value)}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <FieldTooltipLabel
                                                                        label="Constraints JSON (Advanced)"
                                                                        help='빌더가 생성한 constraintsJson을 직접 수정할 수 있습니다.'
                                                                    />
                                                                    <textarea
                                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white h-20 font-mono"
                                                                        placeholder='{"max_chars":400}'
                                                                        value={row.constraintsJsonText}
                                                                        onChange={(e) => updateCaseRow(row.id, 'constraintsJsonText', e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
	                                        <button
	                                            type="button"
	                                            onClick={addCaseRow}
	                                            ref={addCaseButtonRef}
	                                            className="w-full py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm hover:bg-white/10"
	                                        >
	                                            + 데이터셋에 케이스 추가
	                                        </button>
	                                    </div>
	                                ) : (
                                    <textarea
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white h-64 font-mono"
                                        placeholder={sampleTestCaseText()}
                                        value={testcaseInput}
                                        onChange={(e) => setTestcaseInput(e.target.value)}
                                    />
                                )}

                                {preparedCaseInput.error ? (
                                    <p className="text-[11px] text-rose-300">입력 오류: {preparedCaseInput.error}</p>
                                ) : (
                                    <p className="text-[11px] text-emerald-300">저장 준비 완료: {preparedCaseInput.count}개 케이스</p>
                                )}
                            </div>
                        </div>
                    </section>

	                    <section className={`glass-card rounded-2xl border border-white/10 flex flex-col ${datasetLayoutMode === 'SPLIT' ? 'lg:col-span-7' : ''}`}>
	                        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
	                            <div className="flex items-center gap-3">
	                                <h3 className="text-white font-semibold text-lg">케이스 미리보기</h3>
	                                <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-semibold">
	                                    {previewCases.length} Cases
	                                </span>
	                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveTab('run')}
                                className="px-3 py-1.5 rounded-md bg-white/10 border border-white/20 text-xs text-white hover:bg-white/15"
                            >
                                Run 설정으로 이동
                            </button>
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">평가할 데이터셋 선택</label>
                                    <select
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                        value={selectedDatasetId ?? ''}
                                        onChange={(e) => setSelectedDatasetId(e.target.value ? Number(e.target.value) : null)}
                                    >
                                        <option value="">선택하세요</option>
                                        {(datasets || []).map((dataset) => (
                                            <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300 flex flex-wrap items-center gap-3">
                                    <span>데이터셋 {datasets?.length || 0}개</span>
                                    <span>선택: {selectedDataset?.name || '없음'}</span>
                                    <span>케이스: {selectedDatasetCases?.length || 0}개</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                <label className="inline-flex items-center gap-2 text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={replaceExisting}
                                        onChange={(e) => setReplaceExisting(e.target.checked)}
                                    />
                                    기존 케이스 교체 후 업로드
                                </label>
                                {!hasDatasetCases ? (
                                    <p className="text-yellow-300">선택한 데이터셋 케이스가 없습니다.</p>
                                ) : (
                                    <p className="text-emerald-300">선택 데이터셋으로 바로 평가 실행 가능합니다.</p>
                                )}
                                {isSelectedDatasetCasesFetching ? (
                                    <p className="text-gray-500">데이터셋 케이스를 불러오는 중...</p>
                                ) : null}
                            </div>
                        </div>

                        <div className="border-y border-white/10 bg-black/20">
                            <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[11px] text-gray-400 uppercase tracking-wide">
                                <div className="col-span-2 text-center">Case ID</div>
                                <div className="col-span-5">Input / Prompt</div>
                                <div className="col-span-4">Expected Criteria</div>
                                <div className="col-span-1 text-right">상태</div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto min-h-[320px]">
                            {previewCases.length === 0 ? (
	                                <div className="px-4 py-8 text-sm text-gray-400 space-y-3">
	                                    <p>아직 표시할 테스트 케이스가 없습니다.</p>
	                                    <p className="text-gray-500">왼쪽에서 케이스를 작성하고 <span className="text-gray-300">+ 데이터셋에 케이스 추가</span> 버튼을 눌러주세요.</p>
	                                    <button
	                                        type="button"
	                                        onClick={scrollToCaseBuilder}
	                                        className="px-3 py-1.5 rounded-md bg-white/10 border border-white/20 text-xs text-white hover:bg-white/15"
                                    >
                                        케이스 작성 위치로 이동
                                    </button>
                                </div>
                            ) : (
                                previewCases.map((item) => (
                                    <div key={item.key} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5">
                                        <div className="col-span-2 text-center text-xs">
                                            {item.externalId ? (
                                                <span className="inline-flex px-2 py-0.5 rounded-md border border-white/20 bg-white/5 text-[10px] text-gray-200">
                                                    {truncateText(item.externalId, 18)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-500">#{item.order}</span>
                                            )}
                                        </div>
                                        <div className="col-span-5 space-y-1">
                                            <p className="text-sm text-gray-200">{truncateText(item.input, 90)}</p>
                                        </div>
                                        <div className="col-span-4 text-xs text-gray-400">{item.checks}</div>
                                        <div className="col-span-1 flex justify-end">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${
                                                item.source === 'saved'
                                                    ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                                                    : 'border-amber-400/40 bg-amber-400/15 text-amber-200'
                                            }`}>
                                                {item.source === 'saved' ? '저장 완료' : '임시'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                    </section>
                    </div>

                    {/* Sticky CTA bar for dataset step: keep primary actions always visible. */}
                    <div className="sticky bottom-4 z-20 mt-6">
	                        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md px-5 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
	                            <div className="flex flex-wrap items-center justify-between gap-3">
	                                <div className="min-w-0">
	                                    <p className="text-xs text-gray-300">
	                                        1단계 저장/이동
	                                        <span className="mx-2 text-gray-600">|</span>
	                                        <span className="text-gray-400">데이터셋</span>:
	                                        <span className="ml-1 text-gray-200 font-semibold">{datasetName.trim() || '이름 없음'}</span>
	                                        <span className="mx-2 text-gray-600">|</span>
	                                        임시 케이스:
	                                        <span className="ml-1 text-gray-200 font-semibold">{preparedCaseInput.count}</span>
	                                    </p>
	                                    <p className="mt-1 text-[11px] text-gray-500">
	                                        작성한 케이스를 저장하려면 <span className="text-gray-300">데이터셋 생성 + 케이스 저장</span>,
                                        기존 데이터셋에 추가하려면 <span className="text-gray-300">선택 데이터셋에 케이스 업로드</span>를 사용하세요.
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => createDatasetWithCasesMutation.mutate()}
                                        disabled={
                                            createDatasetWithCasesMutation.isPending
                                            || !datasetName.trim()
                                            || preparedCaseInput.count === 0
                                            || !!preparedCaseInput.error
                                        }
                                        className="px-4 py-2 rounded-lg bg-[var(--primary)] text-black text-sm font-semibold disabled:opacity-50"
                                    >
                                        {createDatasetWithCasesMutation.isPending ? '저장 중...' : '데이터셋 생성 + 케이스 저장'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => uploadCasesMutation.mutate()}
                                        disabled={uploadCasesMutation.isPending || preparedCaseInput.count === 0 || !!preparedCaseInput.error || !selectedDatasetId}
                                        className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm disabled:opacity-50"
                                    >
                                        {uploadCasesMutation.isPending ? '업로드 중...' : '선택 데이터셋에 케이스 업로드'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleMoveToRun}
                                        disabled={!canGoToRunFromDataset || isMovingToRun}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold text-black bg-gradient-to-r from-fuchsia-400 to-violet-400 hover:from-fuchsia-300 hover:to-violet-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isMovingToRun ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                                                이동 중...
                                            </span>
                                        ) : 'Save & Next: Run 설정'}
                                    </button>
                                </div>
                            </div>

                            {!canGoToRunFromDataset && goToRunDisabledReason ? (
                                <p className="mt-2 text-right text-[11px] text-amber-200">{goToRunDisabledReason}</p>
                            ) : null}
                            {preparedCaseInput.error ? (
                                <p className="mt-2 text-right text-[11px] text-rose-300">입력 오류: {preparedCaseInput.error}</p>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}

            {activeTab === 'run' ? (
                <div className="glass-card rounded-2xl p-6 space-y-4">
                    <h3 className="text-white font-semibold">평가 설정 / 실행</h3>
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                        <div className="xl:col-span-8 space-y-4">
                            {missingProviderKeys.length > 0 ? (
                                <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
                                    <p className="text-sm font-semibold text-amber-200">평가 실행 전 확인</p>
                                    <p className="mt-1 text-xs text-amber-100">
                                        Provider 키가 없어 실제 모델 호출(Candidate/Judge)을 수행할 수 없습니다.
                                        필요한 Provider: <span className="font-mono">{missingProviderKeys.join(', ')}</span>
                                    </p>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (Number.isFinite(orgId) && orgId > 0) {
                                                    navigate(`/orgs/${orgId}/settings/provider-keys`);
                                                }
                                            }}
                                            className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-white hover:bg-white/15"
                                        >
                                            Provider Keys로 이동
                                        </button>
                                        <span className="text-[11px] text-amber-100/80">
                                            Judge는 현재 <span className="font-mono">OPENAI</span>로 고정되어 있어 OpenAI 키가 필요합니다.
                                        </span>
                                    </div>
                                </div>
                            ) : null}
	                            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
	                                <div className="flex items-start justify-between gap-3">
	                                    <div>
	                                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">설정 요약</p>
	                                        <p className="mt-1 text-white font-semibold text-lg">현재 평가 설정</p>
	                                    </div>
	                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] ${
                                            mode === 'COMPARE_ACTIVE'
                                                ? 'border-sky-400/40 bg-sky-500/15 text-sky-200'
                                                : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                                        }`}>
                                            {renderModeLabel(mode)}
                                        </span>
                                        <span className="inline-flex px-2 py-0.5 rounded-full border border-violet-400/40 bg-violet-500/15 text-violet-200 text-[11px]">
                                            {selectedRubric?.label || rubricTemplateCode}
                                        </span>
                                    </div>
                                </div>

	                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
	                                    <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
	                                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">테스트 버전(후보)</p>
	                                        <p className="mt-1 text-white text-sm font-semibold">
	                                            {selectedVersion ? `v${selectedVersion.versionNumber}` : '선택 필요'}
	                                            {selectedVersion?.model ? <span className="ml-2 text-gray-400 font-normal">({selectedVersion.model})</span> : null}
	                                        </p>
	                                    </div>
	                                    <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
	                                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">데이터셋</p>
	                                        <p className="mt-1 text-white text-sm font-semibold">
	                                            {selectedDataset?.name || '선택 필요'}
	                                        </p>
	                                        <p className="mt-1 text-[11px] text-gray-500">
                                            케이스: {(selectedDatasetCases?.length || 0).toLocaleString()}개
                                        </p>
	                                    </div>
	                                    <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
	                                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">운영 버전(베이스라인)</p>
	                                        <p className="mt-1 text-white text-sm font-semibold">
	                                            {activeRelease?.activeVersionNo ? `v${activeRelease.activeVersionNo}` : '없음'}
	                                        </p>
	                                        <p className="mt-1 text-[11px] text-gray-500">
                                            {activeRelease?.activeVersionId ? '비교 기준으로 사용됩니다.' : '비교 모드를 사용하려면 Release가 필요합니다.'}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[11px] text-gray-400 uppercase tracking-wide">최종 통과 기준</p>
                                            <span
                                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[11px] text-gray-300 cursor-help"
                                                title={
                                                    '케이스 1건이 PASS 되려면: 1) AI 심사(Judge) pass 2) 형식/제약(Rule) pass 3) 점수 합격선(Gate) 통과를 모두 만족해야 합니다.'
                                                }
                                                aria-label="최종 통과 기준 설명"
                                            >
                                                ?
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                            <span className="inline-flex px-2 py-0.5 rounded-full border border-violet-400/40 bg-violet-500/15 text-violet-200">
                                                AI 심사 통과 (Judge)
                                            </span>
                                            <span className="inline-flex px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-200">
                                                형식/제약 통과 (Rule)
                                            </span>
                                            <span className="inline-flex px-2 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-200">
                                                합격선 충족 (Gate)
                                            </span>
                                        </div>
                                        <p className="mt-2 text-[11px] text-gray-500">
                                            세 조건을 모두 만족해야 케이스가 PASS로 집계됩니다.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-violet-400/20 bg-violet-500/10 p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm text-violet-100 font-semibold">워크스페이스 공통 배포 판단 기준</p>
                                    <button
                                        type="button"
                                        onClick={() => saveReleaseCriteriaMutation.mutate()}
                                        disabled={saveReleaseCriteriaMutation.isPending}
                                        className="px-3 py-1.5 rounded-md bg-white/10 border border-white/20 text-xs text-white disabled:opacity-50"
                                    >
                                        기준 저장
                                    </button>
                                </div>
                                <p className="text-[11px] text-violet-100/80">
                                    Run 완료 시점 snapshot 기준으로만 판정합니다. 과거 Run은 현재 기준 변경의 영향을 받지 않습니다.
                                </p>
	                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
	                                    <div>
	                                        <FieldTooltipLabel label="최소 통과율(%)" help="이 값보다 낮으면 HOLD" />
	                                        <input
	                                            type="number"
	                                            min={0}
	                                            max={100}
                                            step={0.1}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                            value={releaseCriteriaForm.minPassRate}
                                            onChange={(e) =>
                                                setReleaseCriteriaForm((prev) => ({ ...prev, minPassRate: Number(e.target.value) || 0 }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <FieldTooltipLabel label="최소 평균 점수" help="overallScore 평균 하한선(0~100)" />
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.1}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                            value={releaseCriteriaForm.minAvgOverallScore}
                                            onChange={(e) =>
                                                setReleaseCriteriaForm((prev) => ({ ...prev, minAvgOverallScore: Number(e.target.value) || 0 }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <FieldTooltipLabel label="최대 에러율(%)" help="errorCase 비율 상한선" />
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.1}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                            value={releaseCriteriaForm.maxErrorRate}
                                            onChange={(e) =>
                                                setReleaseCriteriaForm((prev) => ({ ...prev, maxErrorRate: Number(e.target.value) || 0 }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <FieldTooltipLabel label="개선 미미 기준 Δ" help="비교 모드에서 이 값보다 작으면 경고 사유로 표시" />
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.1}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                            value={releaseCriteriaForm.minImprovementNoticeDelta}
                                            onChange={(e) =>
                                                setReleaseCriteriaForm((prev) => ({ ...prev, minImprovementNoticeDelta: Number(e.target.value) || 0 }))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm text-emerald-100 font-semibold">예상 비용/시간 (대략)</p>
                                    <span
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/25 bg-black/20 text-[11px] text-emerald-100/80 cursor-help"
                                        title="케이스 수, 모드(비교 여부), Judge/재시도 설정을 기반으로 호출/토큰/비용/시간을 대략 추정합니다. 실제 실행과 차이가 있을 수 있습니다."
                                        aria-label="예상치 설명"
                                    >
                                        ?
                                    </span>
                                </div>
                                {!canEstimateRun ? (
                                    <p className="text-[11px] text-emerald-100/80">
                                        버전/데이터셋을 선택하고, 비교 모드라면 운영 버전과 다른 테스트 버전을 선택하면 예상치를 확인할 수 있습니다.
                                    </p>
                                ) : isRunEstimateFetching ? (
                                    <p className="text-[11px] text-emerald-100/80">예상치를 계산 중입니다...</p>
                                ) : runEstimate ? (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs text-emerald-100">
                                        {(() => {
                                            const tier = runEstimate.estimatedCostTier ? String(runEstimate.estimatedCostTier) : '';
                                            const assumptions = isObject(runEstimate.assumptions) ? runEstimate.assumptions : {};
                                            const pricingKnown = assumptions.pricingKnown !== undefined ? Boolean(assumptions.pricingKnown) : true;
                                            const costUnknown = tier === 'UNKNOWN' || pricingKnown === false;

                                            const costText = costUnknown
                                                ? '미정 (가격표 미등록 모델)'
                                                : `$${Number(runEstimate.estimatedCostUsdMin).toFixed(4)} ~ $${Number(runEstimate.estimatedCostUsdMax).toFixed(4)}`;

                                            return (
                                                <>
                                        <div className="rounded-md border border-emerald-300/25 bg-black/20 px-3 py-2">
                                            <p className="text-emerald-200/70">케이스 수</p>
                                            <p className="text-sm font-semibold">{runEstimate.estimatedCases}</p>
                                        </div>
                                        <div className="rounded-md border border-emerald-300/25 bg-black/20 px-3 py-2">
                                            <p className="text-emerald-200/70">호출 수</p>
                                            <p className="text-sm font-semibold">{runEstimate.estimatedCallsMin} ~ {runEstimate.estimatedCallsMax}</p>
                                        </div>
                                        <div className="rounded-md border border-emerald-300/25 bg-black/20 px-3 py-2">
                                            <p className="text-emerald-200/70">토큰</p>
                                            <p className="text-sm font-semibold">{runEstimate.estimatedTokensMin.toLocaleString()} ~ {runEstimate.estimatedTokensMax.toLocaleString()}</p>
                                        </div>
                                        <div className="rounded-md border border-emerald-300/25 bg-black/20 px-3 py-2">
                                            <p className="text-emerald-200/70">비용/시간</p>
                                            <p
                                                className="text-sm font-semibold"
                                                title={costUnknown ? '현재 모델 가격표가 등록되지 않아 비용을 계산할 수 없습니다.' : undefined}
                                            >
                                                {costText}
                                            </p>
                                            <p className="mt-1">{renderEstimateCostTier(runEstimate.estimatedCostTier)}</p>
                                            <p className="text-[11px] text-emerald-200/70">
                                                {runEstimate.estimatedDurationSecMin}s ~ {runEstimate.estimatedDurationSecMax}s
                                            </p>
                                        </div>
                                        <p className="md:col-span-4 text-[11px] text-emerald-100/80">
                                            범위로 표시됩니다(최소~최대). {runEstimate.estimateNotice}
                                        </p>
                                                </>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-emerald-100/80">예상치를 불러오지 못했습니다.</p>
                                )}
                                {runEstimateError ? (
                                    <p className="text-[11px] text-amber-200">예상치 계산 실패: {extractErrorMessage(runEstimateError)}</p>
                                ) : null}
                            </div>

                            <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-3 space-y-2">
                                <p className="text-sm text-blue-200 font-semibold">현재 운영 버전 비교 평가</p>
                                <p className="text-[11px] text-blue-100/80">
                                    테스트 버전과 현재 Active 버전을 같은 테스트케이스로 동시에 실행합니다.
                                    최종 pass는 테스트 버전 기준이며, 케이스 상세에서 운영 버전 결과를 같이 확인할 수 있습니다.
                                </p>
                                {!activeRelease?.activeVersionId ? (
                                    <p className="text-[11px] text-yellow-200">
                                        아직 운영 버전이 없습니다. 먼저 Release를 진행한 뒤 비교 모드를 실행하세요.
                                    </p>
                                ) : null}
                                {activeRelease?.activeVersionId && selectedVersionId === activeRelease.activeVersionId ? (
                                    <p className="text-[11px] text-yellow-200">
                                        현재 운영 버전과 동일한 버전이 선택되어 있습니다. 다른 테스트 버전을 선택하세요.
                                    </p>
                                ) : null}
	                                <div className="flex items-center gap-2">
	                                    <button
	                                        type="button"
	                                        onClick={() => setMode('COMPARE_ACTIVE')}
	                                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-xs"
	                                    >
	                                        비교 테스트 모드로 설정
	                                    </button>
	                                    <button
	                                        type="button"
	                                        onClick={() => createRunMutation.mutate('COMPARE_ACTIVE')}
	                                        disabled={
	                                            createRunMutation.isPending
	                                            || missingProviderKeys.length > 0
	                                            || !selectedDatasetId
	                                            || !selectedVersionId
	                                            || !hasDatasetCases
	                                            || parsedRubricOverrides === null
	                                            || !activeRelease?.activeVersionId
	                                            || selectedVersionId === activeRelease.activeVersionId
	                                        }
	                                        className="px-3 py-2 rounded-lg bg-blue-400 text-black text-xs font-semibold disabled:opacity-50"
	                                    >
	                                        지금 비교 테스트 시작
	                                    </button>
	                                </div>
	                                {missingProviderKeys.length > 0 ? (
	                                    <p className="text-[11px] text-yellow-200">
	                                        실행을 위해 Provider Keys 등록이 필요합니다: {missingProviderKeys.join(', ')}
	                                    </p>
	                                ) : null}
	                            </div>
	                        </div>

                        <div className="xl:col-span-4 rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
                            <h4 className="text-sm font-semibold text-white">Run 입력 설정</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs text-gray-400">프롬프트 버전</label>
                            <select
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                value={selectedVersionId ?? ''}
                                onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                            >
                                <option value="">선택하세요</option>
                                {(versions || []).map((version) => (
                                    <option key={version.id} value={version.id}>v{version.versionNumber} - {version.model}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-400">평가 방식 (Mode)</label>
                            <select
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                value={mode}
                                onChange={(e) => setMode(e.target.value as EvalMode)}
                            >
                                {MODE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-gray-500">{selectedMode?.description}</p>
                        </div>
                            </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-400">평가 기준 (Rubric)</label>
                            <select
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                value={rubricTemplateCode}
                                onChange={(e) => {
                                    const next = e.target.value as RubricTemplateCode;
                                    setRubricTemplateCode(next);
                                    if (next !== 'CUSTOM') {
                                        setCustomAdvancedJsonOpen(false);
                                    }
                                }}
                            >
                                {RUBRIC_OPTIONS.map((option) => (
                                    <option key={option.code} value={option.code}>{option.label}</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-gray-500">{selectedRubric?.description}</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-gray-400">루브릭 Override</label>
                            {rubricTemplateCode === 'CUSTOM' ? (
                                <div className="space-y-3">
                                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                                        <p className="text-xs text-gray-300">CUSTOM 빠른 설정</p>
                                        <p className="text-[11px] text-gray-500">
                                            항목별 가중치와 최소 점수를 입력하면 `weights`/`gates.minCriterionScores`를 자동 생성합니다.
                                        </p>
	                                        <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-gray-300 space-y-1">
	                                            <p><span className="text-gray-400">설명:</span> 평가 목적 + (권장) 항목 정의를 `key: 의미` 형식으로 1줄씩 적어주세요.</p>
	                                            <p><span className="text-gray-400">최소 전체 점수:</span> 0~100 기준 합격선입니다. 예: `75`</p>
	                                            <p><span className="text-gray-400">평가 항목명:</span> 점수를 줄 기준 이름입니다. 예: `정확성`, `완성도`, `안전성`</p>
	                                            <p><span className="text-gray-400">가중치:</span> 항목 중요도입니다. 보통 `1.0`부터 시작합니다.</p>
	                                            <p><span className="text-gray-400">최소점수:</span> 해당 항목의 필수 하한선(1~5)입니다. 비우면 하한 없음.</p>
	                                        </div>
	                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
	                                            <div>
	                                                <FieldTooltipLabel
	                                                    label="설명"
	                                                    help="CUSTOM 항목은 `policy_accuracy: ...` 처럼 항목 의미를 함께 적으면 Judge 일관성이 좋아집니다."
	                                                />
	                                                <textarea
	                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white h-24 resize-none"
	                                                    placeholder={`예: 고객센터 답변 품질 평가\npolicy_accuracy: 제공된 컨텍스트/정책과 일치하는가\nactionability: 사용자가 바로 할 수 있는 다음 단계가 구체적인가\ntone: 정중/공감/비난 없음\nbrevity: 불필요하게 길지 않은가`}
	                                                    value={customRubricForm.description}
	                                                    onChange={(e) => updateCustomRubricForm((prev) => ({ ...prev, description: e.target.value }))}
	                                                />
	                                            </div>
                                            <div>
                                                <FieldTooltipLabel
                                                    label="최소 전체 점수"
                                                    help="0~100 기준 합격선입니다. 예: 75"
                                                />
                                                <input
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                                    placeholder="예: 75"
                                                    value={customRubricForm.minOverallScore}
                                                    onChange={(e) => updateCustomRubricForm((prev) => ({ ...prev, minOverallScore: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {customRubricForm.criteria.map((row) => (
                                                <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_auto] gap-2">
                                                    <div>
                                                        <FieldTooltipLabel
                                                            label="평가 항목명"
                                                            help="Judge가 점수를 매길 항목 이름입니다. 예: 정확성"
                                                        />
                                                        <input
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                                            placeholder="예: 정확성"
                                                            value={row.criterion}
                                                            onChange={(e) =>
                                                                handleCustomCriterionChange(row.id, 'criterion', e.target.value)
                                                            }
                                                        />
                                                    </div>
                                                    <div>
                                                        <FieldTooltipLabel
                                                            label="가중치"
                                                            help="항목 중요도입니다. 기본 1.0, 중요하면 1.2~1.5"
                                                        />
                                                        <input
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                                            placeholder="예: 1.2"
                                                            value={row.weight}
                                                            onChange={(e) =>
                                                                handleCustomCriterionChange(row.id, 'weight', e.target.value)
                                                            }
                                                        />
                                                    </div>
                                                    <div>
                                                        <FieldTooltipLabel
                                                            label="최소점수(선택)"
                                                            help="해당 항목의 최소 통과 점수(1~5)입니다."
                                                        />
                                                        <input
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                                            placeholder="예: 4"
                                                            value={row.minScore}
                                                            onChange={(e) =>
                                                                handleCustomCriterionChange(row.id, 'minScore', e.target.value)
                                                            }
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCustomCriterion(row.id)}
                                                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-gray-200"
                                                        disabled={customRubricForm.criteria.length <= 1}
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={handleAddCustomCriterion}
                                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-gray-200"
                                            >
                                                항목 추가
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setCustomAdvancedJsonOpen((prev) => !prev)}
                                        className="px-2 py-1 rounded-md bg-white/10 border border-white/20 text-[11px] text-gray-300 hover:bg-white/15"
                                    >
                                        {customAdvancedJsonOpen ? '고급 JSON 편집 닫기' : '고급 JSON 직접 편집 열기'}
                                    </button>

                                    {customAdvancedJsonOpen ? (
                                        <textarea
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white h-32 font-mono"
                                            placeholder={sampleRubricOverrideText()}
                                            value={rubricOverridesInput}
                                            onChange={(e) => applyRubricOverridesTextFromExternal(e.target.value)}
                                        />
                                    ) : null}
                                </div>
                            ) : (
                                <>
                                    <textarea
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white h-28 font-mono"
                                        placeholder={sampleRubricOverrideText()}
                                        value={rubricOverridesInput}
                                        onChange={(e) => applyRubricOverridesTextFromExternal(e.target.value)}
                                    />
                                    <p className="text-[11px] text-gray-500">
                                        비워두면 템플릿 기본값을 사용합니다.
                                    </p>
                                </>
                            )}
                            {parsedRubricOverrides === null ? (
                                <p className="text-[11px] text-red-300">JSON 형식 오류: 객체 형태로 입력해주세요.</p>
                            ) : null}
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={autoEvalEnabled}
                                onChange={(e) => setAutoEvalEnabled(e.target.checked)}
                            />
                            새 버전 생성 시 자동 평가
                        </label>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => saveDefaultMutation.mutate()}
                                disabled={saveDefaultMutation.isPending}
                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm disabled:opacity-50"
                            >
                                기본값 저장
                            </button>
	                            <button
	                                type="button"
	                                onClick={() => createRunMutation.mutate(mode)}
	                                disabled={
	                                    createRunMutation.isPending
	                                    || missingProviderKeys.length > 0
	                                    || !selectedDatasetId
	                                    || !selectedVersionId
	                                    || !hasDatasetCases
	                                    || parsedRubricOverrides === null
	                                    || (mode === 'COMPARE_ACTIVE' && (!activeRelease?.activeVersionId || selectedVersionId === activeRelease.activeVersionId))
	                                }
	                                className="px-3 py-2 rounded-lg bg-[var(--primary)] text-black text-sm font-semibold disabled:opacity-50"
	                            >
	                                지금 평가 실행
	                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('result')}
                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
                            >
                                결과 탭으로 이동
                            </button>
                        </div>
	                        {(missingProviderKeys.length > 0
	                            || !selectedDatasetId
	                            || !selectedVersionId
	                            || !hasDatasetCases
	                            || parsedRubricOverrides === null
	                            || (mode === 'COMPARE_ACTIVE' && (!activeRelease?.activeVersionId || selectedVersionId === activeRelease.activeVersionId))
	                        ) ? (
	                            <div className="rounded-md border border-yellow-400/20 bg-yellow-500/10 px-3 py-2 text-[11px] text-yellow-200 space-y-1">
	                                <p className="font-semibold">실행 전 확인</p>
	                                {missingProviderKeys.length > 0 ? (
	                                    <p>- Provider Keys 등록 필요: {missingProviderKeys.join(', ')}</p>
	                                ) : null}
	                                {!selectedDatasetId ? <p>- 데이터셋 선택 필요</p> : null}
	                                {!hasDatasetCases ? <p>- 선택한 데이터셋에 케이스가 없습니다(업로드 필요)</p> : null}
	                                {!selectedVersionId ? <p>- 프롬프트 버전 선택 필요</p> : null}
	                                {mode === 'COMPARE_ACTIVE' && !activeRelease?.activeVersionId ? (
	                                    <p>- 운영(Active) 버전이 없어 Compare 모드를 실행할 수 없습니다(Release 필요)</p>
	                                ) : null}
	                                {mode === 'COMPARE_ACTIVE' && activeRelease?.activeVersionId && selectedVersionId === activeRelease.activeVersionId ? (
	                                    <p>- 후보 버전이 운영(Active) 버전과 동일합니다(다른 버전 선택 필요)</p>
	                                ) : null}
	                                {parsedRubricOverrides === null ? <p>- 루브릭 Override JSON 형식 오류(객체 형태로 입력)</p> : null}
	                            </div>
	                        ) : null}
	                        </div>
	                    </div>
	                </div>
            ) : null}

            {activeTab === 'result' ? (
                <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-semibold">평가 실행 이력</h3>
                        <p className="mt-1 text-[11px] text-gray-500">
                            판정은 Run 완료 시점 snapshot 기준으로만 고정됩니다(과거 Run 재계산 금지).
                        </p>
                    </div>
                    {selectedRun && (selectedRun.status === 'QUEUED' || selectedRun.status === 'RUNNING') ? (
                        <button
                            type="button"
                            onClick={() => cancelRunMutation.mutate(selectedRun.id)}
                            className="px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-400/10 text-red-300 text-xs"
                        >
                            현재 실행 취소
                        </button>
                    ) : null}
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-300">
                        {selectedRun
                            ? `선택 Run: #${selectedRun.id} (${renderRunStatus(selectedRun.status)})`
                            : '선택된 Run이 없습니다. 아래 히스토리에서 Run을 선택하세요.'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                        {selectedRun ? `${new Date(selectedRun.createdAt).toLocaleString('ko-KR')} / ${renderModeLabel(selectedRun.mode)}` : ''}
                    </p>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">
                        <button
                            type="button"
                            onClick={() => setResultSectionTab('OVERVIEW')}
                            className={`px-3 py-1.5 rounded-md text-xs ${
                                resultSectionTab === 'OVERVIEW'
                                    ? 'bg-[var(--primary)] text-black font-semibold'
                                    : 'text-gray-300 hover:bg-white/10'
                            }`}
                        >
                            요약 (Overview)
                        </button>
                        <button
                            type="button"
                            onClick={() => setResultSectionTab('CASES')}
                            className={`px-3 py-1.5 rounded-md text-xs ${
                                resultSectionTab === 'CASES'
                                    ? 'bg-[var(--primary)] text-black font-semibold'
                                    : 'text-gray-300 hover:bg-white/10'
                            }`}
                        >
                            케이스 (Cases)
                        </button>
                        <button
                            type="button"
                            onClick={() => setResultSectionTab('PERFORMANCE')}
                            className={`px-3 py-1.5 rounded-md text-xs ${
                                resultSectionTab === 'PERFORMANCE'
                                    ? 'bg-[var(--primary)] text-black font-semibold'
                                    : 'text-gray-300 hover:bg-white/10'
                            }`}
                        >
                            성능 (Performance)
                        </button>
                    </div>
	                    <div className="flex items-center gap-2">
	                        <span className="text-[11px] text-gray-500">
	                            Run 번호: <span className="font-mono text-gray-300">{selectedRun ? `run-${selectedRun.id}` : '-'}</span>
	                        </span>
	                        <button
	                            type="button"
	                            onClick={() => {
	                                if (selectedRun) {
	                                    rerunSelectedRunMutation.mutate(selectedRun);
	                                }
	                            }}
	                            disabled={
	                                !selectedRun
	                                || rerunSelectedRunMutation.isPending
	                                || selectedRun.status === 'QUEUED'
	                                || selectedRun.status === 'RUNNING'
	                            }
	                            title={selectedRun && (selectedRun.status === 'QUEUED' || selectedRun.status === 'RUNNING')
	                                ? '실행 중인 Run은 완료 후 다시 실행할 수 있습니다.'
	                                : '선택 Run과 동일한 설정(데이터셋/버전/루브릭/모드)으로 새 Run을 생성합니다.'}
	                            className="px-2 py-1 rounded-md bg-white/10 border border-white/20 text-[11px] text-white hover:bg-white/15 disabled:opacity-50"
	                        >
	                            {rerunSelectedRunMutation.isPending ? '다시 실행 중...' : '같은 설정으로 다시 실행'}
	                        </button>
	                    </div>
	                </div>

                {selectedRun ? (
                    <div className="space-y-3">
                        {selectedRun.mode === 'COMPARE_ACTIVE' && toNullableBoolean(selectedRun.summary?.compareBaselineComplete) === false ? (
                            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
                                <p className="text-sm font-semibold text-rose-200">운영 버전(베이스라인) 비교 데이터가 일부 누락되었습니다.</p>
                                <p className="mt-1 text-xs text-rose-100/90">
                                    Compare 모드는 “이번 테스트 버전 vs 현재 운영 버전” 비교가 완전해야 배포 판단이 가능합니다.
                                    운영 버전 실행/채점이 일부 실패하면 정책상 배포 보류(HOLD)로 처리됩니다.
                                </p>
                                <p className="mt-2 text-[11px] text-rose-100/80">
                                    비교 커버리지: {toNullableNumber(selectedRun.summary?.compareCoverageRate)?.toFixed(1) ?? '-'}% (
                                    OK {toNullableNumber(selectedRun.summary?.compareOkCases) ?? '-'} / 누락 {toNullableNumber(selectedRun.summary?.compareMissingOkCases) ?? '-'}
                                    )
                                </p>
                                <p className="mt-1 text-[11px] text-rose-100/70">
                                    다시 실행하면 “현재 운영(Active) 버전”을 기준으로 Compare가 수행됩니다(운영 버전이 변경되었다면 비교 결과가 달라질 수 있습니다).
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedRun) {
                                                rerunSelectedRunMutation.mutate(selectedRun);
                                            }
                                        }}
                                        disabled={rerunSelectedRunMutation.isPending}
                                        className="px-3 py-2 rounded-lg bg-rose-300 text-black text-xs font-semibold disabled:opacity-50"
                                    >
                                        {rerunSelectedRunMutation.isPending ? '다시 실행 중...' : '같은 설정으로 다시 실행'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('run')}
                                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-white hover:bg-white/15"
                                    >
                                        평가 실행 탭으로 이동
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (Number.isFinite(orgId) && orgId > 0) {
                                                navigate(`/orgs/${orgId}/settings/provider-keys`);
                                            }
                                        }}
                                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-white hover:bg-white/15"
                                    >
                                        Provider Keys 확인
                                    </button>
                                </div>
                            </div>
                        ) : null}
	                        {providerKeyMissingBanner ? (
	                            <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
	                                <p className="text-sm font-semibold text-amber-200">{providerKeyMissingBanner.title}</p>
	                                <p className="mt-1 text-xs text-amber-100">{providerKeyMissingBanner.body}</p>
	                                <div className="mt-3 flex flex-wrap gap-2">
	                                    <button
	                                        type="button"
	                                        onClick={() => {
	                                            if (selectedRun) {
	                                                rerunSelectedRunMutation.mutate(selectedRun);
	                                            }
	                                        }}
	                                        disabled={!selectedRun || rerunSelectedRunMutation.isPending}
	                                        className="px-3 py-2 rounded-lg bg-amber-300 text-black text-xs font-semibold disabled:opacity-50"
	                                    >
	                                        {rerunSelectedRunMutation.isPending ? '다시 실행 중...' : '같은 설정으로 다시 실행'}
	                                    </button>
	                                    <button
	                                        type="button"
	                                        onClick={() => {
	                                            if (Number.isFinite(orgId) && orgId > 0) {
	                                                navigate(`/orgs/${orgId}/settings/provider-keys`);
                                            }
                                        }}
                                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-white hover:bg-white/15"
                                    >
                                        Provider Keys로 이동
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('run')}
                                        className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-white hover:bg-white/15"
                                    >
                                        평가 실행으로 이동
                                    </button>
                                </div>
                            </div>
                        ) : null}
                        {resultSectionTab !== 'CASES' ? (
                            <DecisionActionBar
                                decision={selectedRunDecision}
                                runMode={selectedRun.mode}
                                candidateVersionLabel={selectedRunVersionLabel}
                                activeVersionLabel={activeVersionLabel}
                            />
                        ) : null}

                        {resultSectionTab === 'OVERVIEW' ? (
                            <>
                                <OverviewDecisionPanel run={selectedRun} decision={selectedRunDecision} />
                                <OverviewFailureAnalysisPanel
                                    summary={selectedRun.summary}
                                    totalFailures={selectedRun.failedCases + selectedRun.errorCases}
                                    onViewCases={() => setResultSectionTab('CASES')}
                                />
                            </>
                        ) : null}

                        {resultSectionTab === 'PERFORMANCE' ? (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setResultViewMode('SUMMARY')}
                                        className={`px-3 py-1.5 rounded-md text-xs border ${
                                            resultViewMode === 'SUMMARY'
                                                ? 'bg-[var(--primary)] text-black border-[var(--primary)] font-semibold'
                                                : 'bg-white/10 border-white/20 text-gray-200'
                                        }`}
                                    >
                                        요약 보기
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setResultViewMode('ENGINEERING')}
                                        className={`px-3 py-1.5 rounded-md text-xs border ${
                                            resultViewMode === 'ENGINEERING'
                                                ? 'bg-white/20 text-white border-white/30 font-semibold'
                                                : 'bg-white/10 border-white/20 text-gray-200'
                                        }`}
                                    >
                                        기술 상세 보기
                                    </button>
                                    <p className="text-[11px] text-gray-500">
                                        {resultViewMode === 'SUMMARY'
                                            ? '핵심 지표 위주로 표시합니다.'
                                            : '운영/디버깅 상세를 함께 표시합니다.'}
                                    </p>
                                </div>
                                <div className="bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-xs text-gray-300">
                                    <p>선택 Run: #{selectedRun.id} / 상태: {renderRunStatus(selectedRun.status)} / 모드: {renderModeLabel(selectedRun.mode)}</p>
                                    <p>진행: {selectedRun.processedCases}/{selectedRun.totalCases}건</p>
                                    <p>생성시각: {new Date(selectedRun.createdAt).toLocaleString('ko-KR')}</p>
                                    <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                                        <div className="h-full bg-[var(--primary)]" style={{ width: `${runProgressPercent}%` }} />
                                    </div>
                                    <p className="mt-1 text-[11px] text-gray-500">진행률 {runProgressPercent}%</p>
                                </div>
	                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
	                                    <KpiCard label="통과율" value={`${Number(selectedRun.summary?.passRate ?? 0).toFixed(2)}%`} tone="good" />
	                                    <KpiCard label="평균 점수" value={formatOptionalNumber(toNullableNumber(selectedRun.summary?.avgOverallScore))} />
	                                    <KpiCard label="통과" value={String(selectedRun.passedCases)} tone="good" />
	                                    <KpiCard label="오류" value={String(selectedRun.errorCases)} tone={selectedRun.errorCases > 0 ? 'danger' : undefined} />
	                                </div>
                                <RunTrendCard runs={runs || []} />
                            </>
                        ) : null}

	                        {resultSectionTab === 'CASES' ? (
	                            <RunCaseList
	                                cases={mergedRunCases}
	                                totalCases={runCaseTotalElements}
	                                loadedCases={mergedRunCases.length}
	                                totalPassCases={selectedRun.passedCases}
	                                totalFailCases={selectedRun.failedCases}
	                                totalErrorCases={selectedRun.errorCases}
	                                isCompare={selectedRun.mode === 'COMPARE_ACTIVE'}
	                                isRunning={selectedRun.status === 'QUEUED' || selectedRun.status === 'RUNNING'}
	                                canLoadMore={canLoadMoreRunCases}
	                                onLoadMore={loadMoreRunCases}
	                                onLoadAll={loadAllRunCases}
	                                isLoadMorePending={isRunCaseLoadMorePending}
	                                isLoadAllPending={isRunCaseLoadAllPending}
	                                caseContextById={caseContextById}
	                                expandedCaseId={expandedCaseId}
	                                onToggleExpand={(caseId) => setExpandedCaseId((prev) => (prev === caseId ? null : caseId))}
	                            />
	                        ) : null}
                    </div>
                ) : null}

                {resultSectionTab === 'PERFORMANCE' && resultViewMode === 'ENGINEERING' ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
	                            <thead>
	                                <tr className="text-left text-gray-400 border-b border-white/10">
	                                    <th className="py-2 pr-3">Run 번호</th>
	                                    <th className="py-2 pr-3">상태</th>
	                                    <th className="py-2 pr-3">진행률</th>
	                                    <th className="py-2 pr-3">통과율</th>
	                                    <th className="py-2 pr-3">통과/실패/오류</th>
	                                    <th className="py-2 pr-3">판정</th>
	                                    <th className="py-2 pr-3">모드</th>
	                                    <th className="py-2 pr-3">생성시각</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(runs || []).map((run) => (
                                    <tr
                                        key={run.id}
                                        className={`border-b border-white/5 cursor-pointer ${selectedRunId === run.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                        onClick={() => setSelectedRunId(run.id)}
                                    >
                                        <td className="py-2 pr-3 text-white">#{run.id}</td>
                                        <td className="py-2 pr-3 text-gray-200">
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] ${runStatusBadgeClass(run.status)}`}>
                                                {renderRunStatus(run.status)}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-3 text-gray-300">{run.processedCases}/{run.totalCases}</td>
                                        <td className="py-2 pr-3 text-gray-300">{Number(run.summary?.passRate ?? 0).toFixed(1)}%</td>
                                        <td className="py-2 pr-3 text-gray-300">{run.passedCases}/{run.failedCases}/{run.errorCases}</td>
                                        <td className="py-2 pr-3 text-gray-300">{renderReleaseDecisionBadge(run.summary?.releaseDecision)}</td>
                                        <td className="py-2 pr-3 text-gray-300">{renderModeLabel(run.mode)}</td>
                                        <td className="py-2 pr-3 text-gray-400">{new Date(run.createdAt).toLocaleString('ko-KR')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : resultSectionTab === 'PERFORMANCE' ? (
                    <details className="rounded-md border border-white/10 bg-black/20 p-2">
                        <summary className="cursor-pointer text-[11px] text-gray-300">실행 히스토리 보기 (기술 상세)</summary>
                        <div className="overflow-x-auto mt-2">
                            <table className="min-w-full text-sm">
	                                <thead>
	                                    <tr className="text-left text-gray-400 border-b border-white/10">
	                                        <th className="py-2 pr-3">Run 번호</th>
	                                        <th className="py-2 pr-3">상태</th>
	                                        <th className="py-2 pr-3">판정</th>
	                                        <th className="py-2 pr-3">통과율</th>
	                                        <th className="py-2 pr-3">생성시각</th>
	                                    </tr>
	                                </thead>
                                <tbody>
                                    {(runs || []).map((run) => (
                                        <tr
                                            key={run.id}
                                            className={`border-b border-white/5 cursor-pointer ${selectedRunId === run.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                            onClick={() => setSelectedRunId(run.id)}
                                        >
                                            <td className="py-2 pr-3 text-white">#{run.id}</td>
                                            <td className="py-2 pr-3 text-gray-200">{renderRunStatus(run.status)}</td>
                                            <td className="py-2 pr-3 text-gray-300">{renderReleaseDecisionBadge(run.summary?.releaseDecision)}</td>
                                            <td className="py-2 pr-3 text-gray-300">{Number(run.summary?.passRate ?? 0).toFixed(1)}%</td>
                                            <td className="py-2 pr-3 text-gray-400">{new Date(run.createdAt).toLocaleString('ko-KR')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                ) : null}

                </div>
            ) : null}
        </div>
    );
}

function RunCaseList({
    cases,
    totalCases,
    loadedCases,
    totalPassCases,
    totalFailCases,
    totalErrorCases,
    isCompare,
    isRunning,
    canLoadMore,
    onLoadMore,
    onLoadAll,
    isLoadMorePending,
    isLoadAllPending,
    caseContextById,
    expandedCaseId,
    onToggleExpand,
}: {
    cases: EvalCaseResultResponse[];
    totalCases: number;
    loadedCases: number;
    totalPassCases: number;
    totalFailCases: number;
    totalErrorCases: number;
    isCompare: boolean;
    isRunning: boolean;
    canLoadMore: boolean;
    onLoadMore: () => void;
    onLoadAll: () => void;
    isLoadMorePending: boolean;
    isLoadAllPending: boolean;
    caseContextById: Record<number, RunCaseContext>;
    expandedCaseId: number | null;
    onToggleExpand: (caseId: number) => void;
}) {
    const [filter, setFilter] = useState<'ALL' | 'ISSUE' | 'PASS' | 'FAIL' | 'ERROR'>('ALL');
    const [sortMode, setSortMode] = useState<'RISK_DESC' | 'CASE_ASC'>('RISK_DESC');
    const [tableMode, setTableMode] = useState<'FOCUS' | 'FULL'>('FOCUS');
    const [query, setQuery] = useState('');

    if (totalCases <= 0) {
        return <p className="text-xs text-gray-400">선택한 Run에 케이스가 없습니다.</p>;
    }

    if (loadedCases === 0) {
        return <p className="text-xs text-gray-400">케이스 결과를 불러오는 중...</p>;
    }

    const issueCount = totalFailCases + totalErrorCases;

    const filteredCases = cases.filter((item) => {
        if (filter === 'ISSUE' && !(item.pass === false || item.status === 'ERROR')) return false;
        if (filter === 'PASS' && item.pass !== true) return false;
        if (filter === 'FAIL' && item.pass !== false) return false;
        if (filter === 'ERROR' && item.status !== 'ERROR') return false;
        if (!query.trim()) return true;

        const q = query.trim().toLowerCase();
        const inputPreview = (caseContextById[item.testCaseId]?.input || '').toLowerCase();
        const reason = renderCaseReason(item).toLowerCase();
        return (
            String(item.testCaseId).includes(q)
            || inputPreview.includes(q)
            || reason.includes(q)
        );
    });
    const highRiskCount = cases.filter((item) => classifyCaseRisk(item) === 'HIGH').length;
    const mediumRiskCount = cases.filter((item) => classifyCaseRisk(item) === 'MEDIUM').length;
    const sortedCases = [...filteredCases].sort((a, b) => {
        if (sortMode === 'CASE_ASC') {
            return a.testCaseId - b.testCaseId;
        }

        const scoreDiff = caseRiskScore(b) - caseRiskScore(a);
        if (scoreDiff !== 0) {
            return scoreDiff;
        }
        return a.testCaseId - b.testCaseId;
    });
    const issueCases = sortedCases.filter((item) => item.pass === false || item.status === 'ERROR').slice(0, 3);
    const showFullColumns = tableMode === 'FULL';
    const tableColSpan = 6 + (showFullColumns ? 1 : 0) + (showFullColumns && isCompare ? 1 : 0);

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white">케이스 결과</h4>
            <p className="text-[11px] text-gray-500">
                행을 클릭하면 실제 입력/모델응답/형식 검사/AI 심사 근거를 확인할 수 있습니다.
            </p>
            <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 space-y-2">
                <p className="text-xs text-amber-200 font-medium">우선 확인할 실패/오류 케이스</p>
                {issueCases.length === 0 ? (
                    <p className="text-[11px] text-emerald-300">현재 실패/오류 케이스가 없습니다.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {issueCases.map((item) => (
                            <button
                                key={`issue-${item.id}`}
                                type="button"
                                onClick={() => onToggleExpand(item.id)}
                                className="text-left rounded-md border border-amber-300/25 bg-black/25 px-3 py-2 hover:bg-black/40"
                            >
                                <p className="text-[11px] text-amber-100">케이스 #{item.testCaseId}</p>
                                <p className="text-[11px] text-gray-300 mt-1">{truncateText(caseContextById[item.testCaseId]?.input, 36)}</p>
                                <div className="mt-1 flex items-center gap-1">
                                    <FailureOriginBadge origin={resolveCaseFailureOrigin(item)} />
                                    <FailureTypeBadge type={resolveCaseFailureType(item)} />
                                    <p className="text-[11px] text-amber-200">{renderCaseReason(item)}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2 py-1">
                            <span className="text-[11px] text-gray-500">상태</span>
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as 'ALL' | 'ISSUE' | 'PASS' | 'FAIL' | 'ERROR')}
                                className="bg-transparent border-none text-xs text-gray-200 focus:ring-0 pr-6"
                            >
                                <option value="ISSUE">이슈만 보기</option>
                                <option value="ALL">전체 보기</option>
                                <option value="PASS">통과만</option>
                                <option value="FAIL">실패만</option>
                                <option value="ERROR">오류만</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2 py-1">
                            <span className="text-[11px] text-gray-500">정렬</span>
                            <select
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value as 'RISK_DESC' | 'CASE_ASC')}
                                className="bg-transparent border-none text-xs text-gray-200 focus:ring-0 pr-6"
                            >
                                <option value="RISK_DESC">위험도 우선</option>
                                <option value="CASE_ASC">케이스 번호 순</option>
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => setTableMode((prev) => (prev === 'FOCUS' ? 'FULL' : 'FOCUS'))}
                            className="px-2 py-1 rounded-md border bg-white/10 border-white/20 text-[11px] text-gray-200 hover:bg-white/15"
                        >
                            컬럼: {showFullColumns ? '전체' : '핵심'}
                        </button>
	                    </div>
	                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-white/20 bg-white/5 text-gray-200">
                        전체 {totalCases.toLocaleString()}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-white/20 bg-white/5 text-gray-200">
                        불러옴 {loadedCases.toLocaleString()}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-200">
                        이슈 {issueCount.toLocaleString()}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-200">
                        통과 {totalPassCases.toLocaleString()}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-200">
                        실패 {totalFailCases.toLocaleString()}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-red-400/40 bg-red-500/15 text-red-200">
                        오류 {totalErrorCases.toLocaleString()}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-200">
                        고위험(표시) {highRiskCount.toLocaleString()}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-200">
                        중위험(표시) {mediumRiskCount.toLocaleString()}
                    </span>
                </div>
                {loadedCases < totalCases ? (
                    <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-gray-400">
                            현재 {loadedCases.toLocaleString()}/{totalCases.toLocaleString()}건만 불러온 상태입니다. 검색/필터는 불러온 범위에만 적용됩니다.
                            {isRunning ? ' (실행 중에는 일부만 표시될 수 있습니다)' : ''}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onLoadMore}
                                disabled={!canLoadMore || isLoadMorePending || isLoadAllPending}
                                className="px-2 py-1 rounded-md border bg-white/10 border-white/20 text-[11px] text-gray-200 hover:bg-white/15 disabled:opacity-50"
                            >
                                {isLoadMorePending ? '불러오는 중...' : '더 불러오기'}
                            </button>
                            <button
                                type="button"
                                onClick={onLoadAll}
                                disabled={!canLoadMore || isRunning || isLoadMorePending || isLoadAllPending}
                                title={isRunning ? '실행이 완료된 후 전체 불러오기를 권장합니다.' : undefined}
                                className="px-2 py-1 rounded-md border bg-white/10 border-white/20 text-[11px] text-gray-200 hover:bg-white/15 disabled:opacity-50"
                            >
                                {isLoadAllPending ? '전체 불러오는 중...' : '전체 불러오기'}
                            </button>
                        </div>
                    </div>
                ) : null}
                <input
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    placeholder="케이스 번호/입력 문구/실패 사유로 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
	                <details className="rounded border border-white/10 bg-black/30 px-2 py-1">
	                    <summary className="cursor-pointer text-[11px] text-gray-400">용어 설명 보기</summary>
	                    <div className="mt-1 text-[11px] text-gray-400 space-y-1">
	                        <p>- 상태: 실행 결과 상태(완료/에러)</p>
	                        <p>- Pass: 최종 통과 여부(룰 검사 + AI 심사 + 게이트)</p>
	                        {isCompare ? <p>- 비교(Δ): 이번 테스트 버전 점수 - 현재 운영 버전 점수</p> : null}
	                    </div>
	                </details>
                <p className="text-[11px] text-gray-500">
                    현재 표시: {sortedCases.length.toLocaleString()}건 (불러옴 {loadedCases.toLocaleString()}/{totalCases.toLocaleString()})
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead className="sticky top-0 z-10">
                        <tr className="text-left text-gray-400 border-b border-white/10 bg-black/40 backdrop-blur">
                            <th className="py-2 pr-3">케이스</th>
                            <th className="py-2 pr-3">입력 요약</th>
                            <th className="py-2 pr-3">위험도</th>
	                            <th className="py-2 pr-3">상태(실행)</th>
	                            <th className="py-2 pr-3">Pass(최종)</th>
	                            {showFullColumns ? <th className="py-2 pr-3">점수</th> : null}
	                            {showFullColumns && isCompare ? <th className="py-2 pr-3">비교(Δ 이번-운영)</th> : null}
	                            <th className="py-2 pr-3">실패 유형 / 원인</th>
	                        </tr>
                    </thead>
                    <tbody>
                        {sortedCases.map((item) => {
                            const expanded = expandedCaseId === item.id;
                            const compare = extractCompareSummary(item.judgeOutput);
                            const risk = classifyCaseRisk(item);
                            return (
                                <Fragment key={item.id}>
                                    <tr
                                        className={`border-b border-white/5 cursor-pointer ${expanded ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                        onClick={() => onToggleExpand(item.id)}
                                    >
                                        <td className="py-2 pr-3 text-white">#{item.testCaseId}</td>
                                        <td className="py-2 pr-3 text-gray-300">{truncateText(caseContextById[item.testCaseId]?.input, 52)}</td>
                                        <td className="py-2 pr-3 text-gray-200">
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] ${riskBadgeClass(risk)}`}>
                                                {renderRiskLabel(risk)}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-3 text-gray-200">
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] ${caseStatusBadgeClass(item.status)}`}>
                                                {renderCaseStatus(item.status)}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-3 text-gray-200">
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] ${passBadgeClass(item.pass)}`}>
                                                {renderPassValue(item.pass)}
                                            </span>
                                        </td>
                                        {showFullColumns ? <td className="py-2 pr-3 text-gray-200">{item.overallScore ?? '-'}</td> : null}
	                                        {showFullColumns && isCompare ? (
	                                            <td className="py-2 pr-3 text-gray-200">
	                                                {renderCompareCell(compare)}
	                                            </td>
	                                        ) : null}
                                        <td className="py-2 pr-3 text-gray-300">
                                            <div className="flex items-center gap-1">
                                                <FailureOriginBadge origin={resolveCaseFailureOrigin(item)} />
                                                <FailureTypeBadge type={resolveCaseFailureType(item)} />
                                                <span>{renderCaseReason(item)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {expanded ? (
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 pr-3" colSpan={tableColSpan}>
                                                <CaseDetailPanel
                                                    item={item}
                                                    inputText={caseContextById[item.testCaseId]?.input}
                                                    caseContext={caseContextById[item.testCaseId]}
                                                />
                                            </td>
                                        </tr>
                                    ) : null}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function CaseDetailPanel({
    item,
    inputText,
    caseContext,
}: {
    item: EvalCaseResultResponse;
    inputText?: string;
    caseContext?: RunCaseContext;
}) {
    const compare = extractCompareSummary(item.judgeOutput);
    const candidateRuleChecks = extractCandidateRuleChecks(item.ruleChecks);
    const baselineRuleChecks = extractBaselineRuleChecks(item.ruleChecks);
    const candidateJudgeOutput = extractCandidateJudgeOutput(item.judgeOutput);
    const baselineJudgeOutput = extractBaselineJudgeOutput(item.judgeOutput);
    const caseInput = inputText || caseContext?.input || '입력 데이터를 찾지 못했습니다.';
    const contextJson = caseContext?.contextJson ?? null;
    const expectedJson = caseContext?.expectedJson ?? null;
    const constraintsJson = caseContext?.constraintsJson ?? null;
    const requiredKeywords = extractRequiredKeywords(expectedJson, constraintsJson);
    const missingKeywords = findMissingKeywords(item.candidateOutput, requiredKeywords);
    const guidelineText = buildExpectedGuidelineText(expectedJson, constraintsJson);
    const failureReason = buildCaseFailureReasonText(item, candidateJudgeOutput);
    const failed = item.pass === false || item.status === 'ERROR';

    return (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
            <div className="grid grid-cols-12 gap-0 rounded-lg border border-white/10 overflow-hidden">
                <div className="col-span-12 lg:col-span-3 p-4 border-b lg:border-b-0 lg:border-r border-white/10 bg-black/30 space-y-3">
                    <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Input</h4>
                    <div>
                        <p className="text-[11px] text-gray-500 mb-1">User Query</p>
                        <p className="text-sm text-gray-200 leading-relaxed bg-black/30 border border-white/10 rounded px-2 py-2">
                            {caseInput}
                        </p>
                    </div>
                    {contextJson ? (
                        <div>
                            <p className="text-[11px] text-gray-500 mb-1">Context Variables</p>
                            <pre className="text-[11px] font-mono text-gray-300 bg-black/40 border border-white/10 rounded px-2 py-2 overflow-auto whitespace-pre-wrap">
                                {prettyJson(contextJson)}
                            </pre>
                        </div>
                    ) : null}
                </div>

                <div className="col-span-12 lg:col-span-5 p-4 border-b lg:border-b-0 lg:border-r border-white/10 relative space-y-3">
                    <div className={`absolute left-0 top-0 h-full w-1 ${failed ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                    <h4 className={`text-[11px] font-semibold uppercase tracking-wide flex items-center gap-2 ${failed ? 'text-rose-300' : 'text-emerald-300'}`}>
                        Actual Output ({failed ? 'Failed' : 'Passed'})
                    </h4>
                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {item.candidateOutput || '-'}
                    </p>
                    {item.baselineOutput ? (
                        <details className="rounded border border-white/10 bg-black/25 p-2">
                            <summary className="cursor-pointer text-[11px] text-gray-400">현재 운영 버전 응답 보기</summary>
                            <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">{item.baselineOutput}</p>
                        </details>
                    ) : null}
                    <div className={`rounded-md border px-3 py-2 ${failed ? 'border-rose-400/30 bg-rose-500/10' : 'border-emerald-400/30 bg-emerald-500/10'}`}>
                        <p className={`text-xs font-semibold ${failed ? 'text-rose-200' : 'text-emerald-200'}`}>Failure Reason</p>
                        <p className={`mt-1 text-xs ${failed ? 'text-rose-100' : 'text-emerald-100'}`}>{failureReason}</p>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-4 p-4 bg-black/30 space-y-3">
                    <h4 className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wide flex items-center gap-2">
                        Expected / Guideline
                    </h4>
                    <div className="rounded border border-emerald-400/20 bg-emerald-500/10 px-3 py-2">
                        <p className="text-[11px] text-emerald-200 font-semibold mb-1">Ideal Response Logic</p>
                        <p className="text-xs text-emerald-100 whitespace-pre-wrap">{guidelineText}</p>
                    </div>
                    <div className="rounded border border-white/10 bg-black/30 px-3 py-2 space-y-2">
                        <p className="text-[11px] text-gray-400">Required Keywords</p>
                        {requiredKeywords.length === 0 ? (
                            <p className="text-xs text-gray-500">명시된 필수 키워드 없음</p>
                        ) : (
                            <div className="flex flex-wrap gap-1">
                                {requiredKeywords.map((keyword) => (
                                    <span
                                        key={keyword}
                                        className={`text-[11px] px-2 py-0.5 rounded border ${
                                            missingKeywords.includes(keyword)
                                                ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                                                : 'bg-white/10 border-white/20 text-gray-200'
                                        }`}
                                    >
                                        {keyword}
                                    </span>
                                ))}
                            </div>
                        )}
                        {missingKeywords.length > 0 ? (
                            <p className="text-[11px] text-rose-200">누락 키워드: {missingKeywords.join(', ')}</p>
                        ) : null}
                    </div>
                </div>
            </div>

            {compare ? (
                <div className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-3 py-2">
                    <p className="text-xs text-indigo-200 font-medium">이번 버전 vs 운영 버전 비교 요약</p>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-1">
                            <p className="text-[11px] text-emerald-200">이번 테스트 버전</p>
                            <p className="text-xs text-emerald-100">
                                점수 {formatOptionalNumber(compare.candidateOverallScore)} / pass {renderPassValue(compare.candidatePass ?? null)}
                            </p>
                        </div>
                        <div className="rounded border border-sky-400/30 bg-sky-500/10 px-2 py-1">
                            <p className="text-[11px] text-sky-200">현재 운영 버전</p>
                            <p className="text-xs text-sky-100">
                                점수 {formatOptionalNumber(compare.baselineOverallScore)} / pass {renderPassValue(compare.baselinePass ?? null)}
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-indigo-100 mt-2">
                        점수 차이 Δ {formatSignedNumber(compare.scoreDelta)} / 우세: {renderWinner(compare.winner)}
                    </p>
                </div>
            ) : null}

            <details className="rounded-md border border-emerald-400/20 bg-emerald-500/5 px-3 py-2">
                <summary className="cursor-pointer text-xs text-emerald-200 font-medium">이번 테스트 버전 평가 결과</summary>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
                    <RuleSummaryCard title="룰 검사 (이번 테스트 버전)" checks={candidateRuleChecks} />
                    <JudgeSummaryCard title="AI 심사 요약 (이번 테스트 버전)" judge={candidateJudgeOutput} />
                </div>
            </details>

            {baselineRuleChecks || baselineJudgeOutput ? (
                <details className="rounded-md border border-sky-400/20 bg-sky-500/5 px-3 py-2">
                    <summary className="cursor-pointer text-xs text-sky-200 font-medium">현재 운영 버전 평가 결과</summary>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
                        <RuleSummaryCard title="룰 검사 (현재 운영 버전)" checks={baselineRuleChecks} />
                        <JudgeSummaryCard title="AI 심사 요약 (현재 운영 버전)" judge={baselineJudgeOutput} />
                    </div>
                </details>
            ) : null}

            <details className="rounded-md border border-white/10 bg-black/25 p-2">
                <summary className="cursor-pointer text-[11px] text-gray-300">모델 메타 정보 보기 (토큰/지연/비용)</summary>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
                    <MetaSummaryCard title="이번 테스트 버전 메타" meta={item.candidateMeta} />
                    <MetaSummaryCard title="현재 운영 버전 메타" meta={item.baselineMeta} />
                </div>
            </details>

            {item.errorCode || item.errorMessage ? (
                <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2">
                    <p className="text-xs text-rose-200 font-medium">실행 오류</p>
                    <p className="text-xs text-rose-300 mt-1">code: {item.errorCode || '-'}</p>
                    <p className="text-xs text-rose-300">{item.errorMessage || '-'}</p>
                </div>
            ) : null}

            <details className="rounded-md border border-white/10 bg-black/25 p-2">
                <summary className="cursor-pointer text-[11px] text-gray-400">원본 JSON 보기 (개발/디버깅용)</summary>
                <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <DetailBlock title="룰 체크 원본 (이번 테스트 버전)" value={prettyJson(candidateRuleChecks)} mono />
                    <DetailBlock title="Judge 원본 (이번 테스트 버전)" value={prettyJson(candidateJudgeOutput)} mono />
                    <DetailBlock title="룰 체크 원본 (현재 운영 버전)" value={prettyJson(baselineRuleChecks)} mono />
                    <DetailBlock title="Judge 원본 (현재 운영 버전)" value={prettyJson(baselineJudgeOutput)} mono />
                    <DetailBlock title="메타 원본 (이번 테스트 버전)" value={prettyJson(item.candidateMeta)} mono />
                    <DetailBlock title="메타 원본 (현재 운영 버전)" value={prettyJson(item.baselineMeta)} mono />
                </div>
            </details>
        </div>
    );
}

function extractRequiredKeywords(
    expectedJson: Record<string, any> | null | undefined,
    constraintsJson: Record<string, any> | null | undefined
): string[] {
    const merged = [
        ...toStringArray(expectedJson?.must_include),
        ...toStringArray(constraintsJson?.must_include),
        ...toStringArray(expectedJson?.required_keywords),
        ...toStringArray(constraintsJson?.required_keywords),
        ...toStringArray(constraintsJson?.required_keys),
    ];
    return Array.from(new Set(merged.map((item) => item.trim()).filter((item) => item.length > 0)));
}

function findMissingKeywords(output: string | null | undefined, requiredKeywords: string[]): string[] {
    const normalizedOutput = (output || '').toLowerCase();
    if (!normalizedOutput || requiredKeywords.length === 0) {
        return [];
    }
    return requiredKeywords.filter((keyword) => !normalizedOutput.includes(keyword.toLowerCase()));
}

function buildExpectedGuidelineText(
    expectedJson: Record<string, any> | null | undefined,
    constraintsJson: Record<string, any> | null | undefined
): string {
    const mustCover = toStringArray(expectedJson?.must_cover).map((item) => item.trim()).filter((item) => item.length > 0);
    if (mustCover.length > 0) {
        const preview = mustCover.slice(0, 5).join(', ');
        const suffix = mustCover.length > 5 ? ` 외 ${mustCover.length - 5}개` : '';
        return `답변에서 다음 핵심 포인트를 모두 다뤄야 합니다(must_cover, 의미 기반 판단): ${preview}${suffix}.`;
    }

    const directGuideline =
        (typeof expectedJson?.ideal_response === 'string' && expectedJson.ideal_response)
        || (typeof expectedJson?.guideline === 'string' && expectedJson.guideline)
        || (typeof expectedJson?.description === 'string' && expectedJson.description)
        || (typeof expectedJson?.instruction === 'string' && expectedJson.instruction);

    if (directGuideline) {
        return directGuideline;
    }

    const checkSummary = summarizeCaseChecks(expectedJson, constraintsJson);
    if (checkSummary !== '없음') {
        return `아래 조건을 만족하도록 응답해야 합니다: ${checkSummary}.`;
    }

    return '해당 케이스는 명시 제약이 없어 일반 루브릭 기준(관련성/명확성/완성도/안전성)으로 평가합니다.';
}

function buildCaseFailureReasonText(
    item: EvalCaseResultResponse,
    candidateJudgeOutput: Record<string, any> | null
): string {
    if (item.errorMessage) {
        return item.errorMessage;
    }

    const evidence = toStringArray(candidateJudgeOutput?.evidence);
    if (evidence.length > 0) {
        return evidence[0];
    }

    const labels = toStringArray(candidateJudgeOutput?.labels);
    if (labels.length > 0) {
        return `Judge 라벨 이슈: ${labels.join(', ')}`;
    }

    return renderCaseReason(item);
}

function OverviewDecisionPanel({
    run,
    decision,
}: {
    run: EvalRunResponse;
    decision: RunDecisionView;
}) {
    const summary = run.summary ?? {};
    const criteriaSnapshot = isObject(summary.criteriaSnapshot) ? summary.criteriaSnapshot : {};
    const passRate = toNullableNumber(summary.passRate) ?? (run.processedCases > 0 ? (run.passedCases / run.processedCases) * 100 : 0);
    const avgScore = toNullableNumber(summary.avgOverallScore) ?? 0;
    const avgScoreDelta = toNullableNumber(summary.avgScoreDelta);
    const errorRate = run.processedCases > 0 ? (run.errorCases / run.processedCases) * 100 : 0;
    const targetPassRate = toNullableNumber(criteriaSnapshot.minPassRate);
    const targetAvgScore = toNullableNumber(criteriaSnapshot.minAvgOverallScore);
    const targetErrorRate = toNullableNumber(criteriaSnapshot.maxErrorRate);
    const reasons = decision.reasons.length > 0 ? decision.reasons : ['판정 사유 데이터가 없습니다.'];
    const plainSummary = typeof summary.plainSummary === 'string' ? summary.plainSummary : '';
    const isHold = decision.decision === 'HOLD';

    return (
        <div className={`rounded-xl border p-5 space-y-4 ${isHold ? 'border-rose-500/30 bg-rose-950/20' : 'border-emerald-500/25 bg-emerald-950/20'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h4 className={`text-2xl font-bold ${isHold ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {isHold ? '배포 보류 (Release Hold)' : '배포 가능 (Safe To Deploy)'}
                    </h4>
                    <p className="mt-1 text-sm text-gray-300">
                        설정된 통과 기준(snapshot) 기준 판정입니다. 위험도는 <span className="font-semibold text-yellow-300">{decision.riskLevelLabel}</span> 입니다.
                    </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${decision.badgeClass}`}>
                    {decision.decisionLabel}
                </span>
            </div>

            {plainSummary ? (
                <p className="text-sm text-gray-300">{plainSummary}</p>
            ) : null}

            <div className="space-y-1 text-xs text-gray-300">
                {reasons.slice(0, 3).map((reason) => (
                    <p key={reason}>- {reason}</p>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricProgressCard
                    label="통과율(%)"
                    value={`${passRate.toFixed(1)}%`}
                    delta={targetPassRate != null ? `현재-목표 ${formatSignedNumber(passRate - targetPassRate)}%p` : undefined}
                    target={targetPassRate != null ? `목표 ${targetPassRate.toFixed(1)}%` : undefined}
                    status={targetPassRate != null ? (passRate >= targetPassRate ? '달성' : '미달') : undefined}
                    progress={normalizePercent(passRate)}
                    progressTone={targetPassRate != null ? (passRate >= targetPassRate ? 'good' : 'danger') : (isHold ? 'danger' : 'good')}
                />
                <MetricProgressCard
                    label="평균 점수(루브릭)"
                    value={avgScore.toFixed(2)}
                    delta={targetAvgScore != null ? `현재-목표 ${formatSignedNumber(avgScore - targetAvgScore)}` : undefined}
                    target={targetAvgScore != null ? `목표 ${targetAvgScore.toFixed(1)} 이상` : undefined}
                    status={targetAvgScore != null ? (avgScore >= targetAvgScore ? '달성' : '미달') : undefined}
                    progress={normalizePercent(avgScore)}
                    progressTone={targetAvgScore != null ? (avgScore >= targetAvgScore ? 'good' : 'danger') : (scoreDeltaTone(avgScoreDelta) === 'danger' ? 'danger' : 'warn')}
                />
                <MetricProgressCard
                    label="오류율(%)"
                    value={`${errorRate.toFixed(1)}%`}
                    delta={targetErrorRate != null ? `${targetErrorRate.toFixed(1)} 이하` : undefined}
                    target={targetErrorRate != null ? `목표 ${targetErrorRate.toFixed(1)}% 이하` : undefined}
                    status={targetErrorRate != null ? (errorRate <= targetErrorRate ? '달성' : '미달') : undefined}
                    progress={normalizePercent(100 - errorRate)}
                    progressTone={errorRate > (targetErrorRate ?? 10) ? 'danger' : 'good'}
                />
                {run.mode === 'COMPARE_ACTIVE' ? (
                    <MetricProgressCard
                        label="점수 변화(Δ)"
                        value={formatSignedNumber(avgScoreDelta)}
                        delta={avgScoreDelta == null ? undefined : avgScoreDelta < 0 ? '운영 대비 하락' : '운영 대비 상승/동일'}
                        target="목표 운영 대비 0 이상"
                        status={avgScoreDelta == null ? undefined : avgScoreDelta >= 0 ? '달성' : '미달'}
                        progress={normalizePercent((avgScoreDelta ?? 0) + 50)}
                        progressTone={scoreDeltaTone(avgScoreDelta) ?? 'warn'}
                    />
                ) : null}
            </div>
        </div>
    );
}

function MetricProgressCard({
    label,
    value,
    delta,
    target,
    status,
    progress,
    progressTone,
}: {
    label: string;
    value: string;
    delta?: string;
    target?: string;
    status?: '달성' | '미달';
    progress: number;
    progressTone: 'good' | 'warn' | 'danger';
}) {
    const barClass = progressTone === 'good'
        ? 'bg-emerald-400'
        : progressTone === 'danger'
            ? 'bg-rose-400'
            : 'bg-amber-300';

    return (
        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3">
            <p className="text-[11px] text-gray-400">{label}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
                <p className="text-3xl font-bold text-white">{value}</p>
                {status ? (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        status === '달성'
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                            : 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                    }`}>
                        {status}
                    </span>
                ) : null}
            </div>
            {target ? <p className="text-[11px] text-gray-400 mt-1">{target}</p> : null}
            {delta ? <p className="text-[11px] text-gray-400 mt-1">{delta}</p> : null}
            <div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full ${barClass}`} style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
}

function OverviewFailureAnalysisPanel({
    summary,
    totalFailures,
    onViewCases,
}: {
    summary: Record<string, any> | null;
    totalFailures: number;
    onViewCases: () => void;
}) {
    const clusters = buildFailureClusters(summary, totalFailures);
    const top = clusters[0];
    return (
        <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h4 className="text-white font-semibold">실패 원인 분석 (Failure Clusters)</h4>
                <span className="px-2 py-0.5 rounded text-xs border border-rose-400/30 bg-rose-500/10 text-rose-200">
                    Total Failures: {totalFailures}
                </span>
            </div>
            <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="space-y-3">
                    {clusters.length === 0 ? (
                        <p className="text-xs text-gray-500">실패 클러스터 데이터가 없습니다.</p>
                    ) : (
                        clusters.map((cluster) => (
                            <div key={cluster.name} className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm text-gray-200">{cluster.name}</p>
                                    <p className="text-xs text-gray-400">{cluster.count}건 ({cluster.ratio.toFixed(0)}%)</p>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${cluster.tone === 'danger' ? 'bg-rose-400' : cluster.tone === 'warn' ? 'bg-amber-300' : 'bg-sky-300'}`}
                                        style={{ width: `${normalizePercent(cluster.ratio)}%` }}
                                    />
                                </div>
                                <p className="text-[11px] text-gray-500">{cluster.description}</p>
                            </div>
                        ))
                    )}
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                    <p className="text-xs font-semibold text-[var(--primary)] uppercase">Insight & Recommendation</p>
                    <p className="text-lg font-semibold text-white">{top ? top.name : '핵심 이슈 없음'}</p>
                    <p className="text-sm text-gray-300">
                        {top
                            ? `${top.description} 현재 실패의 주 원인입니다.`
                            : '현재는 주요 실패 클러스터가 식별되지 않았습니다.'}
                    </p>
                    <p className="text-xs text-gray-400">
                        권장: 상위 실패 항목부터 프롬프트 제약(형식/필수 키워드/안전 규칙)을 보강하고 케이스 재실행으로 회귀를 확인하세요.
                    </p>
                    <button
                        type="button"
                        onClick={onViewCases}
                        className="w-full px-3 py-2 rounded-md bg-white/10 border border-white/20 text-sm text-white hover:bg-white/15"
                    >
                        실패 케이스 상세 보기
                    </button>
                </div>
            </div>
        </div>
    );
}

type FailureClusterItem = {
    name: string;
    count: number;
    ratio: number;
    description: string;
    tone: 'danger' | 'warn' | 'info';
};

function buildFailureClusters(summary: Record<string, any> | null, totalFailures: number): FailureClusterItem[] {
    const total = totalFailures > 0 ? totalFailures : 1;
    const ruleClusters = topEntries(summary?.ruleFailCounts).map(([name, count]) => ({
        name: mapRuleFailLabel(name),
        count,
        ratio: (count / total) * 100,
        description: mapRuleFailDescription(name),
        tone: 'danger' as const,
    }));
    const labelClusters = topEntries(summary?.labelCounts).map(([name, count]) => ({
        name: `Judge: ${name}`,
        count,
        ratio: (count / total) * 100,
        description: mapJudgeLabelDescription(name),
        tone: 'warn' as const,
    }));
    const errorClusters = topEntries(summary?.errorCodeCounts).map(([name, count]) => ({
        name: `Error: ${name}`,
        count,
        ratio: (count / total) * 100,
        description: mapErrorCodeDescription(name),
        tone: 'info' as const,
    }));

    return [...ruleClusters, ...labelClusters, ...errorClusters]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}

function mapRuleFailLabel(name: string): string {
    if (name === 'must_include') return '필수 키워드 누락';
    if (name === 'must_not_include') return '금지 키워드 포함';
    if (name === 'json_parse') return 'JSON 포맷 오류';
    if (name === 'schema') return '스키마 불일치';
    if (name === 'max_chars') return '응답 길이 초과';
    if (name === 'max_lines') return '응답 줄 수 초과';
    return name;
}

function mapRuleFailDescription(name: string): string {
    if (name === 'json_parse') return 'JSON 형식이 깨져 파싱에 실패했습니다.';
    if (name === 'schema') return '필수 필드/타입이 스키마와 다릅니다.';
    if (name === 'must_include') return '필수 키워드가 응답에 포함되지 않았습니다.';
    if (name === 'must_not_include') return '금지 키워드가 응답에 포함되었습니다.';
    if (name === 'max_chars') return '답변 길이가 제한을 초과했습니다.';
    if (name === 'max_lines') return '답변 줄 수가 제한을 초과했습니다.';
    return '규칙 검사에서 반복 실패가 발생했습니다.';
}

function mapJudgeLabelDescription(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('missing_must_cover')) return '필수 핵심 포인트(must_cover) 중 일부가 응답에 반영되지 않았습니다.';
    if (lower.includes('missing_must_include')) return '엄격 포함 키워드(must_include)가 응답에 누락되었습니다.';
    if (lower.includes('forbidden_token_present')) return '엄격 금지 키워드(must_not_include)가 응답에 포함되었습니다.';
    if (lower.includes('rubric_criterion_definition_missing') || lower.includes('criterion_definition_missing')) {
        return '커스텀 루브릭 항목 정의가 부족합니다. 설명(description)에 `key: 의미` 형식으로 각 항목 의미를 추가하세요.';
    }
    if (lower.includes('hallucination') || lower.includes('factual')) return '사실성과 관련된 판단 실패가 반복되었습니다.';
    if (lower.includes('tone')) return '톤/문체 품질 기준을 만족하지 못했습니다.';
    if (lower.includes('safety')) return '안전성 기준 위반 가능성이 감지되었습니다.';
    return 'AI Judge 기준에서 품질 미달이 반복되었습니다.';
}

function mapErrorCodeDescription(name: string): string {
    if (name.includes('EVAL_CASE_EXECUTION_ERROR')) return '모델 호출이 실행되지 않았습니다(Provider 키 미등록/권한/네트워크). Provider Keys를 확인하세요.';
    if (name.includes('TIMEOUT')) return '모델 호출 시간이 초과되었습니다.';
    if (name.includes('RATE_LIMIT')) return '업스트림 요청 제한에 도달했습니다.';
    if (name.includes('UNAVAILABLE') || name.includes('5XX')) return '업스트림 서비스가 일시적으로 불안정합니다.';
    if (name.includes('INVALID_REQUEST')) return '요청 형식이 유효하지 않습니다.';
    return '실행 단계 오류가 반복 발생했습니다.';
}

function normalizePercent(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(100, Math.max(0, value));
}

function DetailBlock({ title, value, mono = false }: { title: string; value: string; mono?: boolean }) {
    return (
        <div className="rounded-md border border-white/10 bg-black/25 p-2">
            <p className="text-[11px] text-gray-400 mb-1">{title}</p>
            <pre className={`max-h-52 overflow-auto whitespace-pre-wrap text-[11px] text-gray-200 ${mono ? 'font-mono' : ''}`}>
                {value}
            </pre>
        </div>
    );
}

function DecisionActionBar({
    decision,
    runMode,
    candidateVersionLabel,
    activeVersionLabel,
}: {
    decision: RunDecisionView;
    runMode: EvalMode;
    candidateVersionLabel: string;
    activeVersionLabel: string;
}) {
    const summaryReasons = decision.reasons.slice(0, 2);
    return (
        <div className={`sticky top-2 z-20 rounded-lg border px-4 py-3 backdrop-blur ${decision.cardClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-[11px] opacity-80">의사결정 요약</p>
                    <p className="text-sm font-semibold">
                        {decision.decisionLabel}
                        <span className="ml-2 text-xs opacity-80">위험도 {decision.riskLevelLabel}</span>
                    </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] border ${decision.badgeClass}`}>
                    {decision.decisionLabel}
                </span>
            </div>
            <p className="mt-1 text-[11px] opacity-90">
                {runMode === 'COMPARE_ACTIVE'
                    ? `비교 대상: 이번 테스트 ${candidateVersionLabel} vs 현재 운영 ${activeVersionLabel}`
                    : `평가 대상: 이번 테스트 ${candidateVersionLabel}`}
            </p>
            {summaryReasons.length > 0 ? (
                <div className="mt-2 text-[11px] space-y-1">
                    {summaryReasons.map((reason) => (
                        <p key={reason}>- {reason}</p>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function RunTrendCard({ runs }: { runs: EvalRunResponse[] }) {
    const recentRuns = [...runs]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-5);

    if (recentRuns.length === 0) {
        return null;
    }

    return (
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-2">
            <p className="text-xs text-gray-300 font-medium">최근 Run 추이 (최근 5개)</p>
            <div className="space-y-1">
                {recentRuns.map((run) => {
                    const passRate = toNullableNumber(run.summary?.passRate) ?? 0;
                    const avgScore = toNullableNumber(run.summary?.avgOverallScore) ?? 0;
                    return (
                        <div key={run.id} className="rounded-md border border-white/10 bg-black/25 px-2 py-2">
                            <div className="flex items-center justify-between text-[11px] text-gray-300">
                                <span>Run #{run.id}</span>
                                <span>{new Date(run.createdAt).toLocaleString('ko-KR')}</span>
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-200">
                                <span>통과율 {passRate.toFixed(1)}%</span>
                                <span>평균 점수 {avgScore.toFixed(1)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function KpiCard({
    label,
    value,
    tone,
    emphasized,
}: {
    label: string;
    value: string;
    tone?: 'good' | 'warn' | 'danger';
    emphasized?: boolean;
}) {
    const toneClass = tone === 'good'
        ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
        : tone === 'warn'
            ? 'border-amber-400/25 bg-amber-500/10 text-amber-200'
            : tone === 'danger'
                ? 'border-rose-400/25 bg-rose-500/10 text-rose-200'
                : 'border-white/10 bg-black/25 text-gray-200';

    return (
        <div className={`rounded-lg border px-3 py-2 ${toneClass} ${emphasized ? 'min-h-[88px]' : ''}`}>
            <p className="text-[11px] opacity-80">{label}</p>
            <p className={`${emphasized ? 'text-2xl' : 'text-lg'} font-semibold`}>{value}</p>
        </div>
    );
}

function RuleSummaryCard({ title, checks }: { title: string; checks: Record<string, any> | null }) {
    const pass = toNullableBoolean(checks?.pass);
    const failedChecks = toStringArray(checks?.failedChecks);
    const checkEntries = Object.entries(checks || {})
        .filter(([key]) => key !== 'pass' && key !== 'failedChecks' && key !== 'candidate' && key !== 'baseline')
        .slice(0, 8);

    return (
        <div className="rounded-md border border-white/10 bg-black/25 p-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-gray-400">{title}</p>
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${passBadgeClass(pass ?? null)}`}>
                    {renderPassValue(pass ?? null)}
                </span>
            </div>

            {failedChecks.length > 0 ? (
                <p className="text-[11px] text-amber-200">실패 항목: {failedChecks.join(', ')}</p>
            ) : (
                <p className="text-[11px] text-emerald-300">문제 없음</p>
            )}

            {checkEntries.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                    {checkEntries.map(([key, value]) => (
                        <span key={key} className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] text-gray-200">
                            {key}: {toCompactValue(value)}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function JudgeSummaryCard({ title, judge }: { title: string; judge: Record<string, any> | null }) {
    const pass = toNullableBoolean(judge?.pass);
    const overallScore = toNullableNumber(judge?.overallScore);
    const scores = extractScoreEntries(judge?.scores);
    const labels = toStringArray(judge?.labels);
    const evidence = toStringArray(judge?.evidence).slice(0, 2);
    const suggestions = toStringArray(judge?.suggestions).slice(0, 2);

    return (
        <div className="rounded-md border border-white/10 bg-black/25 p-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-gray-400">{title}</p>
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${passBadgeClass(pass ?? null)}`}>
                    {renderPassValue(pass ?? null)}
                </span>
            </div>

            <p className="text-[11px] text-gray-200">Overall Score: {formatOptionalNumber(overallScore)}</p>

            {scores.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                    {scores.map(([key, value]) => (
                        <span key={key} className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] text-gray-200">
                            {key}: {formatOptionalNumber(value)}
                        </span>
                    ))}
                </div>
            ) : null}

            {labels.length > 0 ? (
                <p className="text-[11px] text-amber-200">주요 이슈: {labels.join(', ')}</p>
            ) : (
                <p className="text-[11px] text-emerald-300">주요 이슈 없음</p>
            )}

            {evidence.length > 0 ? (
                <div className="text-[11px] text-gray-300 space-y-1">
                    {evidence.map((line, idx) => (
                        <p key={`${idx}-${line}`}>근거 {idx + 1}: {line}</p>
                    ))}
                </div>
            ) : null}

            {suggestions.length > 0 ? (
                <div className="text-[11px] text-sky-200 space-y-1">
                    {suggestions.map((line, idx) => (
                        <p key={`${idx}-${line}`}>개선 {idx + 1}: {line}</p>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function MetaSummaryCard({ title, meta }: { title: string; meta: Record<string, any> | null }) {
    const rows: Array<[string, string]> = [
        ['provider', toCompactValue(meta?.provider)],
        ['model(requested/used)', `${toCompactValue(meta?.requestedModel)} / ${toCompactValue(meta?.usedModel)}`],
        ['latencyMs', toCompactValue(meta?.latencyMs)],
        ['tokens(in/out/total)', `${toCompactValue(meta?.inputTokens)} / ${toCompactValue(meta?.outputTokens)} / ${toCompactValue(meta?.totalTokens)}`],
        ['estimatedCostUsd', toCompactValue(meta?.estimatedCostUsd)],
    ];

    return (
        <div className="rounded-md border border-white/10 bg-black/25 p-2 space-y-2">
            <p className="text-[11px] text-gray-400">{title}</p>
            {meta?.error ? (
                <p className="text-[11px] text-amber-200">
                    오류: {toCompactValue(meta.error)} {meta?.message ? `(${toCompactValue(meta.message)})` : ''}
                </p>
            ) : null}
            <div className="grid grid-cols-1 gap-1">
                {rows.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-2 text-[11px] text-gray-200">
                        <span className="text-gray-400">{key}</span>
                        <span className="text-right">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

type CompareSummaryView = {
    candidateOverallScore?: number | null;
    baselineOverallScore?: number | null;
    candidatePass?: boolean | null;
    baselinePass?: boolean | null;
    scoreDelta?: number | null;
    winner?: string | null;
};

type RunDecisionView = {
    decision: string;
    decisionLabel: string;
    riskLevel: string;
    riskLevelLabel: string;
    riskLevelTone?: 'good' | 'warn' | 'danger';
    reasons: string[];
    cardClass: string;
    badgeClass: string;
};

function extractRunDecision(summary: Record<string, any> | null | undefined): RunDecisionView {
    const decision = summary?.releaseDecision ? String(summary.releaseDecision) : 'UNKNOWN';
    const riskLevel = summary?.riskLevel ? String(summary.riskLevel) : 'LOW';
    const reasons = toStringArray(summary?.decisionReasons).map(mapDecisionReasonLabel);

    const safe = decision === 'SAFE_TO_DEPLOY';
    const hold = decision === 'HOLD';
    const cardClass = safe
        ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
        : hold
            ? 'border-rose-400/25 bg-rose-500/10 text-rose-100'
            : 'border-white/10 bg-black/20 text-gray-200';
    const badgeClass = safe
        ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200'
        : hold
            ? 'border-rose-400/30 bg-rose-400/15 text-rose-200'
            : 'border-white/20 bg-white/10 text-gray-200';

    return {
        decision,
        decisionLabel: safe ? '배포 가능' : hold ? '배포 보류' : '판정 없음',
        riskLevel,
        riskLevelLabel: decision === 'UNKNOWN' ? '-' : mapRiskLevelLabel(riskLevel),
        riskLevelTone: decision === 'UNKNOWN'
            ? undefined
            : riskLevel === 'HIGH'
                ? 'danger'
                : riskLevel === 'MEDIUM'
                    ? 'warn'
                    : 'good',
        reasons,
        cardClass,
        badgeClass,
    };
}

function mapDecisionReasonLabel(reason: string): string {
    switch (reason) {
        case 'PASS_RATE_BELOW_THRESHOLD':
            return '통과율이 설정 기준보다 낮습니다.';
        case 'AVG_SCORE_BELOW_THRESHOLD':
            return '평균 점수가 설정 기준보다 낮습니다.';
        case 'ERROR_RATE_ABOVE_THRESHOLD':
            return '오류율이 설정 기준을 초과했습니다.';
        case 'COMPARE_REGRESSION_DETECTED':
            return '현재 운영 버전 대비 점수가 하락했습니다.';
        case 'COMPARE_IMPROVEMENT_MINOR':
            return '점수는 상승했지만 개선폭이 작습니다.';
        case 'COMPARE_BASELINE_INCOMPLETE':
            return '운영 버전 비교 데이터가 일부 누락되어 배포 판단을 확정할 수 없습니다. Compare를 다시 실행하세요.';
        default:
            return reason;
    }
}

function mapRiskLevelLabel(riskLevel: string): string {
    switch (riskLevel) {
        case 'HIGH':
            return '높음';
        case 'MEDIUM':
            return '중간';
        case 'LOW':
            return '낮음';
        default:
            return riskLevel;
    }
}

function extractCompareSummary(judgeOutput: Record<string, any> | null | undefined): CompareSummaryView | null {
    if (!isObject(judgeOutput) || !isObject(judgeOutput.compare)) {
        return null;
    }
    const compare = judgeOutput.compare as Record<string, any>;
    return {
        candidateOverallScore: toNullableNumber(compare.candidateOverallScore),
        baselineOverallScore: toNullableNumber(compare.baselineOverallScore),
        candidatePass: toNullableBoolean(compare.candidatePass),
        baselinePass: toNullableBoolean(compare.baselinePass),
        scoreDelta: toNullableNumber(compare.scoreDelta),
        winner: compare.winner != null ? String(compare.winner) : null,
    };
}

function extractCandidateRuleChecks(ruleChecks: Record<string, any> | null | undefined): Record<string, any> | null {
    if (!isObject(ruleChecks)) {
        return null;
    }
    if (isObject(ruleChecks.candidate)) {
        return ruleChecks.candidate as Record<string, any>;
    }
    return ruleChecks;
}

function extractBaselineRuleChecks(ruleChecks: Record<string, any> | null | undefined): Record<string, any> | null {
    if (!isObject(ruleChecks) || !isObject(ruleChecks.baseline)) {
        return null;
    }
    return ruleChecks.baseline as Record<string, any>;
}

function extractCandidateJudgeOutput(judgeOutput: Record<string, any> | null | undefined): Record<string, any> | null {
    if (!isObject(judgeOutput)) {
        return null;
    }
    const copy = { ...(judgeOutput as Record<string, any>) };
    delete copy.baseline;
    delete copy.compare;
    return copy;
}

function extractBaselineJudgeOutput(judgeOutput: Record<string, any> | null | undefined): Record<string, any> | null {
    if (!isObject(judgeOutput) || !isObject(judgeOutput.baseline)) {
        return null;
    }
    return judgeOutput.baseline as Record<string, any>;
}

function renderCompareCell(compare: CompareSummaryView | null) {
    if (!compare) {
        return '-';
    }
    const deltaNumber = toNullableNumber(compare.scoreDelta);
    const delta = formatSignedNumber(deltaNumber);
    const tone = scoreDeltaTone(deltaNumber);
    const candidateScore = formatOptionalNumber(compare.candidateOverallScore);
    const baselineScore = formatOptionalNumber(compare.baselineOverallScore);
    return (
        <div className="flex flex-wrap items-center gap-1">
            <span className={badgePillClass('good')}>
                이번 {candidateScore}
            </span>
            <span className={badgePillClass('info')}>
                운영 {baselineScore}
            </span>
            <span className={`${compareDeltaBadgeClass(tone)} gap-1`}>
                Δ {delta}
            </span>
            <span className="text-[11px] text-gray-300">{renderWinner(compare.winner)}</span>
        </div>
    );
}

function renderWinner(winner: string | null | undefined): string {
    if (!winner) {
        return '-';
    }
    if (winner === 'CANDIDATE') {
        return '이번 버전 우세';
    }
    if (winner === 'BASELINE') {
        return '운영 버전 우세';
    }
    if (winner === 'TIE') {
        return '동점';
    }
    return winner;
}

function formatSignedNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
        return '-';
    }
    return `${value > 0 ? '+' : ''}${Number(value).toFixed(2)}`;
}

function scoreDeltaTone(value: number | null): 'good' | 'warn' | 'danger' | undefined {
    if (value == null || Number.isNaN(value)) {
        return undefined;
    }
    if (value < 0) {
        return 'danger';
    }
    if (value === 0) {
        return 'warn';
    }
    return 'good';
}

function compareDeltaBadgeClass(tone: 'good' | 'warn' | 'danger' | undefined): string {
    if (tone === 'good') {
        return badgePillClass('good');
    }
    if (tone === 'danger') {
        return badgePillClass('danger');
    }
    if (tone === 'warn') {
        return badgePillClass('warn');
    }
    return badgePillClass('neutral');
}

function formatOptionalNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
        return '-';
    }
    return Number(value).toFixed(2);
}

function extractScoreEntries(rawScores: unknown): Array<[string, number]> {
    if (!isObject(rawScores)) {
        return [];
    }
    return Object.entries(rawScores)
        .map(([key, value]) => [key, toNullableNumber(value)] as const)
        .filter(([, value]) => value !== null)
        .map(([key, value]) => [key, value as number]);
}

function toCompactValue(value: unknown): string {
    if (value == null || value === '') {
        return '-';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.length === 0 ? '[]' : value.map((item) => String(item)).join(', ');
    }
    if (isObject(value)) {
        return '{...}';
    }
    return String(value);
}

function toNullableNumber(value: any): number | null {
    if (value == null || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toNullableBoolean(value: any): boolean | null {
    if (value == null) {
        return null;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
    }
    return null;
}

function FieldTooltipLabel({ label, help }: { label: string; help: string }) {
    return (
        <div className="mb-1 flex items-center gap-1">
            <span className="text-[11px] text-gray-400">{label}</span>
            <span className="inline-flex items-center">
                <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] text-gray-300 cursor-help"
                    title={help}
                    aria-label={`${label} 도움말`}
                >
                    ?
                </span>
            </span>
        </div>
    );
}

function renderModeLabel(mode: EvalMode): string {
    return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function renderRunStatus(status: EvalRunStatus): string {
    switch (status) {
        case 'QUEUED':
            return '대기 중';
        case 'RUNNING':
            return '실행 중';
        case 'COMPLETED':
            return '완료';
        case 'FAILED':
            return '실패';
        case 'CANCELLED':
            return '취소';
        default:
            return status;
    }
}

function renderReleaseDecisionBadge(decision: string | null | undefined) {
    if (decision === 'HOLD') {
        return (
            <span className={badgePillClass('danger')}>
                배포 보류
            </span>
        );
    }
    if (decision === 'SAFE_TO_DEPLOY') {
        return (
            <span className={badgePillClass('good')}>
                배포 가능
            </span>
        );
    }
    return (
        <span className={badgePillClass('neutral')}>
            -
        </span>
    );
}

function renderEstimateCostTier(tier: string | null | undefined) {
    if (tier === 'HIGH') {
        return <span className={badgePillClass('danger')}>비용 높음</span>;
    }
    if (tier === 'MEDIUM') {
        return <span className={badgePillClass('warn')}>비용 중간</span>;
    }
    if (tier === 'LOW') {
        return <span className={badgePillClass('good')}>비용 낮음</span>;
    }
    return <span className={badgePillClass('neutral')}>비용 미정</span>;
}

function runStatusBadgeClass(status: EvalRunStatus): string {
    switch (status) {
        case 'COMPLETED':
            return badgeToneClass('good');
        case 'FAILED':
            return badgeToneClass('danger');
        case 'RUNNING':
            return badgeToneClass('info');
        case 'CANCELLED':
            return badgeToneClass('neutral');
        default:
            return badgeToneClass('neutral');
    }
}

function renderCaseStatus(status: string): string {
    switch (status) {
        case 'QUEUED':
            return '대기 중';
        case 'RUNNING':
            return '실행 중';
        case 'OK':
            return '완료';
        case 'ERROR':
            return '에러';
        case 'SKIPPED':
            return '건너뜀';
        default:
            return status;
    }
}

function renderPassValue(pass: boolean | null): string {
    if (pass === null) return '-';
    return pass ? '통과' : '실패';
}

function passBadgeClass(pass: boolean | null): string {
    if (pass === true) {
        return badgeToneClass('good');
    }
    if (pass === false) {
        return badgeToneClass('warn');
    }
    return badgeToneClass('neutral');
}

function caseStatusBadgeClass(status: string): string {
    if (status === 'OK') {
        return badgeToneClass('good');
    }
    if (status === 'ERROR') {
        return badgeToneClass('danger');
    }
    if (status === 'RUNNING') {
        return badgeToneClass('info');
    }
    return badgeToneClass('neutral');
}

function classifyCaseRisk(item: EvalCaseResultResponse): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (item.status === 'ERROR') {
        return 'HIGH';
    }
    if (item.pass === false) {
        return 'HIGH';
    }

    const compare = extractCompareSummary(item.judgeOutput);
    const delta = toNullableNumber(compare?.scoreDelta);
    if (delta != null && delta < 0) {
        return 'MEDIUM';
    }

    if (item.errorCode) {
        return 'MEDIUM';
    }

    const failedChecks = toStringArray(item.ruleChecks?.failedChecks);
    if (failedChecks.length > 0) {
        return 'MEDIUM';
    }

    const labels = toStringArray(item.judgeOutput?.labels);
    if (labels.length > 0) {
        return 'MEDIUM';
    }
    return 'LOW';
}

function caseRiskScore(item: EvalCaseResultResponse): number {
    const risk = classifyCaseRisk(item);
    if (risk === 'HIGH') {
        return 300 + (item.status === 'ERROR' ? 30 : 0);
    }
    if (risk === 'MEDIUM') {
        const compare = extractCompareSummary(item.judgeOutput);
        const delta = toNullableNumber(compare?.scoreDelta);
        if (delta != null && delta < 0) {
            return 220 + Math.abs(delta);
        }
        return 180;
    }
    return 100;
}

function renderRiskLabel(risk: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    if (risk === 'HIGH') {
        return '고위험';
    }
    if (risk === 'MEDIUM') {
        return '중위험';
    }
    return '저위험';
}

function riskBadgeClass(risk: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    if (risk === 'HIGH') {
        return badgeToneClass('danger');
    }
    if (risk === 'MEDIUM') {
        return badgeToneClass('warn');
    }
    return badgeToneClass('good');
}

function renderCaseReason(item: EvalCaseResultResponse): string {
    if (item.errorCode) {
        return item.errorCode;
    }

    const failedChecks = toStringArray(item.ruleChecks?.failedChecks);
    if (failedChecks.length > 0) {
        return `룰 실패: ${failedChecks.join(', ')}`;
    }

    const labels = toStringArray(item.judgeOutput?.labels);
    if (labels.length > 0) {
        return `AI 이슈: ${labels.join(', ')}`;
    }

    return '-';
}

type CaseFailureOrigin = 'EXECUTION' | 'RULE' | 'JUDGE' | 'UNKNOWN';
type CaseFailureType =
    | 'JSON 형식 오류'
    | '스키마 불일치'
    | '응답 길이 초과'
    | '핵심 포인트 누락'
    | '필수 키워드 누락'
    | '금지 키워드 포함'
    | '타임아웃'
    | '요청 제한'
    | '업스트림 장애'
    | '사실성/환각'
    | '톤/스타일 이슈'
    | '실행 오류'
    | '기타 품질 이슈';
type BadgeTone = 'danger' | 'warn' | 'info' | 'good' | 'neutral';

function resolveCaseFailureOrigin(item: EvalCaseResultResponse): CaseFailureOrigin {
    if (item.status === 'ERROR' || item.errorCode) {
        return 'EXECUTION';
    }
    const failedChecks = toStringArray(item.ruleChecks?.failedChecks);
    if (failedChecks.length > 0) {
        return 'RULE';
    }
    const labels = toStringArray(item.judgeOutput?.labels);
    if (labels.length > 0 || item.pass === false) {
        return 'JUDGE';
    }
    return 'UNKNOWN';
}

function FailureOriginBadge({ origin }: { origin: CaseFailureOrigin }) {
    if (origin === 'EXECUTION') {
        return <span className={badgePillClass('danger', 'xs')}>실행</span>;
    }
    if (origin === 'RULE') {
        return <span className={badgePillClass('warn', 'xs')}>룰</span>;
    }
    if (origin === 'JUDGE') {
        return <span className={badgePillClass('info', 'xs')}>AI</span>;
    }
    return <span className={badgePillClass('neutral', 'xs')}>기타</span>;
}

function resolveCaseFailureType(item: EvalCaseResultResponse): CaseFailureType {
    const errorCode = item.errorCode || '';
    if (errorCode.includes('TIMEOUT')) return '타임아웃';
    if (errorCode.includes('RATE_LIMIT')) return '요청 제한';
    if (errorCode.includes('UNAVAILABLE') || errorCode.includes('5XX')) return '업스트림 장애';
    if (errorCode) return '실행 오류';

    const failedChecks = toStringArray(item.ruleChecks?.failedChecks).map((v) => v.toLowerCase());
    if (failedChecks.includes('json_parse')) return 'JSON 형식 오류';
    if (failedChecks.includes('schema')) return '스키마 불일치';
    if (failedChecks.includes('max_chars') || failedChecks.includes('max_lines')) return '응답 길이 초과';

    const labels = toStringArray(item.judgeOutput?.labels).map((v) => v.toLowerCase());
    if (labels.some((v) => v.includes('missing_must_cover'))) return '핵심 포인트 누락';
    if (labels.some((v) => v.includes('missing_must_include'))) return '필수 키워드 누락';
    if (labels.some((v) => v.includes('forbidden_token_present'))) return '금지 키워드 포함';
    if (labels.some((v) => v.includes('hallucination') || v.includes('factual'))) return '사실성/환각';
    if (labels.some((v) => v.includes('tone') || v.includes('style'))) return '톤/스타일 이슈';

    if (item.pass === false) return '기타 품질 이슈';
    return '기타 품질 이슈';
}

function FailureTypeBadge({ type }: { type: CaseFailureType }) {
    const tone: BadgeTone = type === 'JSON 형식 오류'
        || type === '스키마 불일치'
        || type === '응답 길이 초과'
        || type === '핵심 포인트 누락'
        || type === '필수 키워드 누락'
        || type === '금지 키워드 포함'
        ? 'warn'
        : type === '타임아웃' || type === '요청 제한' || type === '업스트림 장애' || type === '실행 오류'
            ? 'danger'
            : type === '기타 품질 이슈'
                ? 'neutral'
                : 'info';

    return <span className={badgePillClass(tone, 'xs')}>{type}</span>;
}

function badgeToneClass(tone: BadgeTone): string {
    if (tone === 'danger') {
        return 'border-rose-400/40 bg-rose-500/15 text-rose-200';
    }
    if (tone === 'warn') {
        return 'border-amber-400/40 bg-amber-500/15 text-amber-200';
    }
    if (tone === 'info') {
        return 'border-sky-400/40 bg-sky-500/15 text-sky-200';
    }
    if (tone === 'good') {
        return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
    }
    return 'border-white/20 bg-white/10 text-gray-300';
}

function badgePillClass(tone: BadgeTone, size: 'sm' | 'xs' = 'sm'): string {
    const base = size === 'xs'
        ? 'inline-flex px-1.5 py-0.5 rounded border text-[10px]'
        : 'inline-flex px-2 py-0.5 rounded-full text-[11px] border items-center';
    return `${base} ${badgeToneClass(tone)}`;
}

function toStringArray(value: any): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => item != null).map((item) => String(item));
}

function topEntries(value: unknown): Array<[string, number]> {
    if (!isObject(value)) {
        return [];
    }
    return Object.entries(value)
        .map(([key, count]) => [key, toNullableNumber(count) ?? 0] as [string, number])
        .sort((a, b) => b[1] - a[1]);
}

function prettyJson(value: unknown): string {
    if (value == null) {
        return '-';
    }
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function truncateText(value: string | null | undefined, maxLength: number): string {
    const text = value ?? '';
    if (text.length <= maxLength) {
        return text || '-';
    }
    return `${text.slice(0, maxLength)}...`;
}

function summarizeCaseChecks(
    expectedJson: Record<string, any> | null | undefined,
    constraintsJson: Record<string, any> | null | undefined
): string {
    const pieces: string[] = [];
    const mustInclude = toStringArray(constraintsJson?.must_include ?? expectedJson?.must_include);
    if (mustInclude.length > 0) {
        pieces.push(`필수 포함: ${mustInclude.slice(0, 2).join(', ')}`);
    }

    const mustNotInclude = toStringArray(constraintsJson?.must_not_include ?? expectedJson?.must_not_include);
    if (mustNotInclude.length > 0) {
        pieces.push(`금지: ${mustNotInclude.slice(0, 2).join(', ')}`);
    }

    const maxChars = toNullableNumber(constraintsJson?.max_chars);
    if (maxChars != null) {
        pieces.push(`최대 글자수: ${Math.round(maxChars)}`);
    }

    const maxLines = toNullableNumber(constraintsJson?.max_lines);
    if (maxLines != null) {
        pieces.push(`최대 줄수: ${Math.round(maxLines)}`);
    }

    const format = constraintsJson?.format ? String(constraintsJson.format) : '';
    if (format) {
        pieces.push(`형식: ${format}`);
    }

    const requiredKeys = toStringArray(constraintsJson?.required_keys);
    if (requiredKeys.length > 0) {
        pieces.push(`필수 키: ${requiredKeys.slice(0, 2).join(', ')}`);
    }

    const keywordNormalizationRaw = constraintsJson?.keyword_normalization ?? constraintsJson?.keyword_normalize;
    const keywordNormalizationEnabled = String(
        typeof keywordNormalizationRaw === 'string'
            ? keywordNormalizationRaw
            : keywordNormalizationRaw === true
                ? 'BASIC'
                : ''
    ).toUpperCase() === 'BASIC';
    if (keywordNormalizationEnabled) {
        pieces.push('키워드 정규화: ON');
    }

    if (pieces.length === 0) {
        return '없음';
    }
    return pieces.join(' / ');
}

function extractErrorMessage(error: unknown): string {
    const anyError = error as any;
    if (anyError?.response?.data?.message) {
        return String(anyError.response.data.message);
    }
    if (anyError?.message) {
        return String(anyError.message);
    }
    return '알 수 없는 오류';
}

function createDefaultCustomRubricForm(nextId?: () => string): CustomRubricFormState {
    return {
        description: '',
        minOverallScore: '70',
        criteria: [createEmptyCriterionRow(nextId, { criterion: 'quality', weight: '1.0', minScore: '' })],
    };
}

function createEmptyCriterionRow(
    nextId?: () => string,
    seed?: Partial<Omit<CustomCriterionInputRow, 'id'>>
): CustomCriterionInputRow {
    if (!nextId) {
        fallbackCustomCriterionIdSeed += 1;
    }
    return {
        id: nextId ? nextId() : `criterion-default-${fallbackCustomCriterionIdSeed}`,
        criterion: seed?.criterion ?? '',
        weight: seed?.weight ?? '',
        minScore: seed?.minScore ?? '',
    };
}

function normalizeCustomRubricForm(
    form: CustomRubricFormState,
    nextId: () => string
): CustomRubricFormState {
    const normalizedCriteria = form.criteria.length > 0
        ? form.criteria.map((row) => ({
            ...row,
            id: row.id || nextId(),
            criterion: row.criterion ?? '',
            weight: row.weight ?? '',
            minScore: row.minScore ?? '',
        }))
        : [createEmptyCriterionRow(nextId)];

    return {
        description: form.description ?? '',
        minOverallScore: form.minOverallScore ?? '',
        criteria: normalizedCriteria,
    };
}

function buildCustomRubricOverrides(form: CustomRubricFormState): Record<string, any> {
    const overrides: Record<string, any> = {};
    const description = form.description.trim();
    if (description) {
        overrides.description = description;
    }

    const weights: Record<string, number> = {};
    const minCriterionScores: Record<string, number> = {};

    form.criteria.forEach((row) => {
        const criterion = row.criterion.trim();
        if (!criterion) {
            return;
        }

        const weight = parseNumberValue(row.weight);
        if (weight !== null) {
            weights[criterion] = weight;
        }

        const minScore = parseNumberValue(row.minScore);
        if (minScore !== null) {
            minCriterionScores[criterion] = minScore;
        }
    });

    if (Object.keys(weights).length > 0) {
        overrides.weights = weights;
    }

    const gates: Record<string, any> = {};
    const minOverallScore = parseNumberValue(form.minOverallScore);
    if (minOverallScore !== null) {
        gates.minOverallScore = minOverallScore;
    }
    if (Object.keys(minCriterionScores).length > 0) {
        gates.minCriterionScores = minCriterionScores;
    }
    if (Object.keys(gates).length > 0) {
        overrides.gates = gates;
    }

    return overrides;
}

function buildCustomRubricFormFromOverrides(
    overrides: Record<string, any>,
    nextId: () => string
): CustomRubricFormState {
    const description = typeof overrides.description === 'string' ? overrides.description : '';

    const weights = isObject(overrides.weights) ? overrides.weights : {};
    const gates = isObject(overrides.gates) ? overrides.gates : {};
    const minCriterionScores = isObject(gates.minCriterionScores) ? gates.minCriterionScores : {};
    const minOverallScore = gates.minOverallScore != null ? String(gates.minOverallScore) : '';

    const criterionNames = new Set<string>();
    Object.keys(weights).forEach((key) => criterionNames.add(key));
    Object.keys(minCriterionScores).forEach((key) => criterionNames.add(key));

    const criteria = Array.from(criterionNames).map((criterion) => createEmptyCriterionRow(nextId, {
        criterion,
        weight: weights[criterion] != null ? String(weights[criterion]) : '',
        minScore: minCriterionScores[criterion] != null ? String(minCriterionScores[criterion]) : '',
    }));

    return {
        description,
        minOverallScore,
        criteria: criteria.length > 0 ? criteria : [createEmptyCriterionRow(nextId)],
    };
}

function parseNumberValue(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return parsed;
}

type ConstraintStrengthInfo = {
    level: '약함' | '보통' | '강함';
    score: number;
    conditionCount: number;
    badgeClass: string;
    ruleLabel: string;
    tooltip: string;
};

function evaluateConstraintStrength(
    _expectedObj: Record<string, any>,
    constraintsObj: Record<string, any>
): ConstraintStrengthInfo {
    const maxChars = toNullableNumber(constraintsObj.max_chars);
    const maxLines = toNullableNumber(constraintsObj.max_lines);
    const jsonOnly = constraintsObj.format === 'json_only';
    const requiredKeys = toStringArray(constraintsObj.required_keys);
    const mustInclude = toStringArray(constraintsObj.must_include);
    const mustNotInclude = toStringArray(constraintsObj.must_not_include);
    const keywordNormalizationRaw = constraintsObj.keyword_normalization ?? constraintsObj.keyword_normalize;
    const keywordNormalizationEnabled = String(
        typeof keywordNormalizationRaw === 'string'
            ? keywordNormalizationRaw
            : keywordNormalizationRaw === true
                ? 'BASIC'
                : ''
    ).toUpperCase() === 'BASIC';

    const conditionCount = [
        maxChars != null,
        maxLines != null,
        jsonOnly,
        requiredKeys.length > 0,
        mustInclude.length > 0,
        mustNotInclude.length > 0,
        keywordNormalizationEnabled,
    ].filter(Boolean).length;

    const score = (
        + (maxChars != null && maxChars <= 200 ? 2 : maxChars != null && maxChars <= 500 ? 1 : 0)
        + (maxLines != null && maxLines <= 3 ? 1 : maxLines != null && maxLines <= 6 ? 0.5 : 0)
        + (jsonOnly ? 2 : 0)
        + (requiredKeys.length > 0 ? 1 : 0)
        + (mustInclude.length > 0 ? 1 : 0)
        + (mustNotInclude.length > 0 ? 1 : 0)
    );

    if (score >= 4) {
        return {
            level: '강함',
            score,
            conditionCount,
            badgeClass: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
            ruleLabel: `점수 ${score}`,
            tooltip: '계산 기준: max_chars/max_lines 임계값 + json_only/required_keys + must_include/must_not_include (+ 키워드 정규화)',
        };
    }

    if (score >= 2) {
        return {
            level: '보통',
            score,
            conditionCount,
            badgeClass: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
            ruleLabel: `점수 ${score}`,
            tooltip: '계산 기준: max_chars/max_lines 임계값 + json_only/required_keys + must_include/must_not_include (+ 키워드 정규화)',
        };
    }

    return {
        level: '약함',
        score,
        conditionCount,
        badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
        ruleLabel: `점수 ${score}`,
        tooltip: '계산 기준: max_chars/max_lines 임계값 + json_only/required_keys + must_include/must_not_include (+ 키워드 정규화)',
    };
}

function StructureToggleCard({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onChange(!checked);
                }
            }}
            className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                checked
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/10 bg-black/20 text-gray-300 hover:bg-black/30'
            }`}
        >
            <span className="inline-flex items-center gap-2">
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                    checked
                        ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100'
                        : 'border-white/25 text-gray-400'
                }`}>
                    {checked ? '✓' : ''}
                </span>
                {label}
            </span>
        </button>
    );
}

function normalizeStringArray(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    values.forEach((value) => {
        const trimmed = String(value ?? '').trim();
        if (!trimmed) return;
        if (seen.has(trimmed)) return;
        seen.add(trimmed);
        result.push(trimmed);
    });
    return result;
}

function parseObjectTextLoose(text: string): Record<string, any> {
    const trimmed = text.trim();
    if (!trimmed) {
        return {};
    }
    try {
        const parsed = JSON.parse(trimmed);
        return isObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function cleanupJsonObject(value: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    Object.entries(value).forEach(([key, rawValue]) => {
        if (rawValue == null) {
            return;
        }
        if (typeof rawValue === 'string') {
            const trimmed = rawValue.trim();
            if (trimmed) {
                result[key] = trimmed;
            }
            return;
        }
        if (Array.isArray(rawValue)) {
            const cleanedArray = normalizeStringArray(rawValue.map((item) => String(item)));
            if (cleanedArray.length > 0) {
                result[key] = cleanedArray;
            }
            return;
        }
        if (isObject(rawValue)) {
            const cleanedObject = cleanupJsonObject(rawValue);
            if (Object.keys(cleanedObject).length > 0) {
                result[key] = cleanedObject;
            }
            return;
        }
        result[key] = rawValue;
    });
    return result;
}

function TagListEditor({
    label,
    values,
    placeholder,
    onChange,
}: {
    label: string;
    values: string[];
    placeholder: string;
    onChange: (next: string[]) => void;
}) {
    const [draft, setDraft] = useState('');

    const addTag = () => {
        const next = normalizeStringArray([...values, draft]);
        setDraft('');
        onChange(next);
    };

    return (
        <div className="space-y-2">
            <p className="text-[11px] text-gray-300">{label}</p>
            <div className="flex flex-wrap gap-1">
                {values.length === 0 ? (
                    <span className="text-[11px] text-gray-500">아직 추가된 항목이 없습니다.</span>
                ) : values.map((value) => (
                    <span
                        key={value}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/20 bg-white/5 text-[11px] text-gray-200"
                    >
                        {value}
                        <button
                            type="button"
                            className="text-gray-400 hover:text-white"
                            onClick={() => onChange(values.filter((item) => item !== value))}
                            aria-label={`${label} ${value} 삭제`}
                        >
                            x
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <input
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    placeholder={placeholder}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!draft.trim()) return;
                            addTag();
                        }
                    }}
                />
                <button
                    type="button"
                    className="px-2 py-1 rounded-md bg-white/10 border border-white/20 text-[11px] text-gray-200 hover:bg-white/15"
                    onClick={addTag}
                    disabled={!draft.trim()}
                >
                    추가
                </button>
            </div>
        </div>
    );
}

function createEmptyCaseFormRow(nextId?: string): CaseFormRow {
    if (!nextId) {
        fallbackCaseRowIdSeed += 1;
    }
    return {
        id: nextId ?? `case-default-${fallbackCaseRowIdSeed}`,
        externalId: '',
        input: '',
        contextJsonText: '',
        expectedJsonText: '',
        constraintsJsonText: '',
    };
}

function parseCaseRows(rows: CaseFormRow[]): EvalTestCaseCreateRequest[] {
    if (!rows || rows.length === 0) {
        return [];
    }

    return rows.map((row, idx) => {
        const caseNo = idx + 1;
        const input = row.input.trim();
        if (!input) {
            throw new Error(`${caseNo}번 케이스의 input은 필수입니다.`);
        }

        return {
            externalId: row.externalId.trim() || undefined,
            input,
            contextJson: parseOptionalObjectText(row.contextJsonText, `${caseNo}번 contextJson`),
            expectedJson: parseOptionalObjectText(row.expectedJsonText, `${caseNo}번 expectedJson`),
            constraintsJson: parseOptionalObjectText(row.constraintsJsonText, `${caseNo}번 constraintsJson`),
        };
    });
}

function parseOptionalObjectText(text: string, fieldLabel: string): Record<string, any> | undefined {
    const trimmed = text.trim();
    if (!trimmed) {
        return undefined;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        throw new Error(`${fieldLabel}은(는) JSON 객체 형식이어야 합니다.`);
    }

    if (!isObject(parsed)) {
        throw new Error(`${fieldLabel}은(는) JSON 객체 형식이어야 합니다.`);
    }

    return parsed;
}

function buildCaseRowsFromCases(
    cases: EvalTestCaseCreateRequest[],
    nextId: () => string
): CaseFormRow[] {
    if (!cases || cases.length === 0) {
        return [createEmptyCaseFormRow(nextId())];
    }

    return cases.map((item) => ({
        id: nextId(),
        externalId: item.externalId ?? '',
        input: item.input ?? '',
        contextJsonText: item.contextJson ? JSON.stringify(item.contextJson, null, 2) : '',
        expectedJsonText: item.expectedJson ? JSON.stringify(item.expectedJson, null, 2) : '',
        constraintsJsonText: item.constraintsJson ? JSON.stringify(item.constraintsJson, null, 2) : '',
    }));
}

function parseCaseInput(raw: string): EvalTestCaseCreateRequest[] {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
            throw new Error('JSON Array 형식이어야 합니다.');
        }
        return parsed.map(normalizeCase);
    }

    const lines = trimmed
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    return lines.map((line) => normalizeCase(JSON.parse(line)));
}

function normalizeCase(value: any): EvalTestCaseCreateRequest {
    if (!value || typeof value !== 'object') {
        throw new Error('케이스는 JSON 객체여야 합니다.');
    }
    if (!value.input || typeof value.input !== 'string') {
        throw new Error('각 케이스는 input(string) 필드가 필요합니다.');
    }
    return {
        externalId: typeof value.externalId === 'string' ? value.externalId : undefined,
        input: value.input,
        contextJson: isObject(value.contextJson) ? value.contextJson : undefined,
        expectedJson: isObject(value.expectedJson) ? value.expectedJson : undefined,
        constraintsJson: isObject(value.constraintsJson) ? value.constraintsJson : undefined,
    };
}

function isObject(value: any): value is Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function sampleTestCaseText() {
    return `[{"input":"환불 규정 알려줘","contextJson":{"locale":"ko-KR"},"expectedJson":{"must_include":["환불"]},"constraintsJson":{"max_chars":400}}]`;
}

function sampleRubricOverrideText() {
    return `{
  "description": "학부모 안내문 품질 평가",
  "weights": {
    "정확성": 1.4,
    "친절성": 1.0,
    "행동가능성": 1.2
  },
  "gates": {
    "minOverallScore": 75,
    "minCriterionScores": {
      "정확성": 4
    }
  }
}`;
}
