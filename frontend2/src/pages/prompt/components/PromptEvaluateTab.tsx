import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { promptApi } from '@/api/prompt.api';
import axios from 'axios';
import type {
    EvalCaseResultResponse,
    EvalMode,
    EvalRunStatus,
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
type CaseFormRow = {
    id: string;
    externalId: string;
    input: string;
    contextJsonText: string;
    expectedJsonText: string;
    constraintsJsonText: string;
};
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
        value: `[{"input":"환불 규정 알려줘","contextJson":{"locale":"ko-KR"},"expectedJson":{"must_include":["환불"]},"constraintsJson":{"max_chars":400}}]`,
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

let fallbackCustomCriterionIdSeed = 0;
let fallbackCaseRowIdSeed = 0;

export function PromptEvaluateTab({ workspaceId, promptId }: { workspaceId: number; promptId: number }) {
    const queryClient = useQueryClient();

    const [datasetName, setDatasetName] = useState('');
    const [datasetDescription, setDatasetDescription] = useState('');
    const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
    const [caseInputMode, setCaseInputMode] = useState<CaseInputMode>('FORM');
    const [caseFormRows, setCaseFormRows] = useState<CaseFormRow[]>(() => [createEmptyCaseFormRow('case-0')]);
    const [testcaseInput, setTestcaseInput] = useState('');
    const [replaceExisting, setReplaceExisting] = useState(false);

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
    const [activeTab, setActiveTab] = useState<EvalTab>('result');
    const [resultViewMode, setResultViewMode] = useState<ResultViewMode>('SUMMARY');
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
    const customCriterionIdRef = useRef(1);
    const caseRowIdRef = useRef(1);
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
        queryKey: ['evalRunCases', workspaceId, promptId, selectedRunId],
        queryFn: async () => {
            if (!selectedRunId) return null;
            return (await promptApi.getEvalRunCases(workspaceId, promptId, selectedRunId, 0, 30)).data;
        },
        enabled: !!selectedRunId,
        refetchInterval: () =>
            selectedRun && (selectedRun.status === 'QUEUED' || selectedRun.status === 'RUNNING') ? 4000 : false,
    });

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
        if (activeTab === 'result' && (!runs || runs.length === 0)) {
            setActiveTab('dataset');
        }
    }, [activeTab, runs]);

    useEffect(() => {
        setExpandedCaseId(null);
    }, [selectedRunId]);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                window.clearTimeout(toastTimerRef.current);
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

    const caseInputById = useMemo(() => {
        const map: Record<number, string> = {};
        (runDatasetCases || []).forEach((item) => {
            map[item.id] = item.input;
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
            setCaseFormRows([createEmptyCaseFormRow(nextCaseRowId())]);
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
            setCaseFormRows([createEmptyCaseFormRow(nextCaseRowId())]);
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

    const addCaseRow = () => {
        setCaseFormRows((prev) => [...prev, createEmptyCaseFormRow(nextCaseRowId())]);
    };

    const removeCaseRow = (rowId: string) => {
        setCaseFormRows((prev) => {
            const filtered = prev.filter((row) => row.id !== rowId);
            return filtered.length > 0 ? filtered : [createEmptyCaseFormRow(nextCaseRowId())];
        });
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

            <div className="glass-card rounded-2xl p-6 space-y-3">
                <h3 className="text-white font-semibold">프롬프트 평가 가이드</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <p className="text-[11px] text-gray-500">1단계</p>
                        <p className="text-xs text-gray-300">데이터셋/테스트케이스 준비</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <p className="text-[11px] text-gray-500">2단계</p>
                        <p className="text-xs text-gray-300">모드 + 루브릭 설정</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <p className="text-[11px] text-gray-500">3단계</p>
                        <p className="text-xs text-gray-300">Run 실행 후 케이스 결과 확인</p>
                    </div>
                </div>
                <p className="text-xs text-gray-400">
                    최종 통과 기준: <span className="text-gray-300">Judge pass</span> AND <span className="text-gray-300">룰 체크 pass</span> AND <span className="text-gray-300">게이트 통과</span>
                </p>
            </div>

            <div className="glass-card rounded-2xl p-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                    {EVAL_TABS.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveTab(tab.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                                activeTab === tab.value
                                    ? 'bg-[var(--primary)] text-black border-[var(--primary)] font-semibold'
                                    : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <p className="text-[11px] text-gray-500">
                    {EVAL_TABS.find((tab) => tab.value === activeTab)?.description}
                </p>
            </div>

            {activeTab === 'dataset' ? (
                <div className="glass-card rounded-2xl p-6 space-y-4">
                    <h3 className="text-white font-semibold">데이터셋 / 테스트케이스</h3>
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300 flex flex-wrap gap-3">
                        <span>데이터셋 {datasets?.length || 0}개</span>
                        <span>선택: {selectedDataset?.name || '없음'}</span>
                        <span>케이스: {selectedDatasetCases?.length || 0}개</span>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-gray-400">한 번에 만들기: 데이터셋 생성 + 테스트케이스 저장</label>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="데이터셋 이름 (예: cs-refund-eval-v1)"
                                    value={datasetName}
                                    onChange={(e) => setDatasetName(e.target.value)}
                                />
                                <input
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                    placeholder="설명(선택)"
                                    value={datasetDescription}
                                    onChange={(e) => setDatasetDescription(e.target.value)}
                                />
                            </div>

                            <p className="text-[11px] text-gray-500">
                                테스트케이스 입력은 기본적으로 폼에서 작성하고, JSON은 고급 모드에서만 직접 수정하세요.
                            </p>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleCaseModeChange('FORM')}
                                    className={`px-2 py-1 rounded-md text-[11px] border ${
                                        caseInputMode === 'FORM'
                                            ? 'bg-emerald-500/20 border-emerald-300/50 text-emerald-200'
                                            : 'bg-white/10 border-white/20 text-gray-200'
                                    }`}
                                >
                                    폼 입력 (추천)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCaseModeChange('JSON')}
                                    className={`px-2 py-1 rounded-md text-[11px] border ${
                                        caseInputMode === 'JSON'
                                            ? 'bg-blue-500/20 border-blue-300/50 text-blue-200'
                                            : 'bg-white/10 border-white/20 text-gray-200'
                                    }`}
                                >
                                    JSON 직접 입력 (고급)
                                </button>
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
                                <div className="space-y-2">
                                    {caseFormRows.map((row, idx) => (
                                        <div key={row.id} className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-gray-300">케이스 #{idx + 1}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => removeCaseRow(row.id)}
                                                    className="px-2 py-1 rounded bg-white/10 border border-white/20 text-[11px] text-gray-200"
                                                    disabled={caseFormRows.length <= 1}
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                            <div>
                                                <FieldTooltipLabel
                                                    label="input (필수)"
                                                    help='모델에 전달할 사용자 질문입니다. 예: "환불 규정 알려줘"'
                                                />
                                                <input
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                                    placeholder="예) 환불 규정 알려줘"
                                                    value={row.input}
                                                    onChange={(e) => updateCaseRow(row.id, 'input', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <FieldTooltipLabel
                                                    label="externalId (선택)"
                                                    help='케이스 식별용 ID입니다. 예: "refund_case_01"'
                                                />
                                                <input
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                                    placeholder="예) refund_case_01"
                                                    value={row.externalId}
                                                    onChange={(e) => updateCaseRow(row.id, 'externalId', e.target.value)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                <div>
                                                    <FieldTooltipLabel
                                                        label="contextJson (선택)"
                                                        help='추가 문맥 데이터입니다. JSON 객체만 허용됩니다. 예: {"locale":"ko-KR"}'
                                                    />
                                                    <textarea
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white h-20 font-mono"
                                                        placeholder={`{"locale":"ko-KR"}`}
                                                        value={row.contextJsonText}
                                                        onChange={(e) => updateCaseRow(row.id, 'contextJsonText', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <FieldTooltipLabel
                                                        label="expectedJson (선택)"
                                                        help='기대 결과 힌트입니다. 예: {"must_include":["환불"]}'
                                                    />
                                                    <textarea
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white h-20 font-mono"
                                                        placeholder={`{"must_include":["환불"]}`}
                                                        value={row.expectedJsonText}
                                                        onChange={(e) => updateCaseRow(row.id, 'expectedJsonText', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <FieldTooltipLabel
                                                        label="constraintsJson (선택)"
                                                        help='출력 제약 조건입니다. 예: {"max_chars":400} 또는 {"format":"json_only"}'
                                                    />
                                                    <textarea
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white h-20 font-mono"
                                                        placeholder={`{"max_chars":400}`}
                                                        value={row.constraintsJsonText}
                                                        onChange={(e) => updateCaseRow(row.id, 'constraintsJsonText', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={addCaseRow}
                                            className="px-2 py-1 rounded-md bg-white/10 border border-white/20 text-[11px] text-gray-200"
                                        >
                                            케이스 추가
                                        </button>
                                    </div>
                                    <details className="rounded border border-white/10 bg-black/20 p-2">
                                        <summary className="cursor-pointer text-[11px] text-gray-400">
                                            자동 생성 JSON 미리보기
                                        </summary>
                                        <pre className="mt-2 text-[11px] text-gray-300 whitespace-pre-wrap break-words">
                                            {JSON.stringify(preparedCaseInput.testCases, null, 2)}
                                        </pre>
                                    </details>
                                </div>
                            ) : (
                                <textarea
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white h-44 font-mono"
                                    placeholder={sampleTestCaseText()}
                                    value={testcaseInput}
                                    onChange={(e) => setTestcaseInput(e.target.value)}
                                />
                            )}

                            {preparedCaseInput.error ? (
                                <p className="text-[11px] text-red-300">입력 오류: {preparedCaseInput.error}</p>
                            ) : (
                                <p className="text-[11px] text-emerald-300">
                                    저장 준비 완료: {preparedCaseInput.count}개 케이스
                                </p>
                            )}

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => createDatasetWithCasesMutation.mutate()}
                                    disabled={
                                        createDatasetWithCasesMutation.isPending
                                        || !datasetName.trim()
                                        || preparedCaseInput.count === 0
                                        || !!preparedCaseInput.error
                                    }
                                    className="px-3 py-2 rounded-lg bg-[var(--primary)] text-black text-sm font-semibold disabled:opacity-50"
                                >
                                    데이터셋 생성 + 테스트케이스 저장
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('run')}
                                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
                                >
                                    평가 실행 설정으로 이동
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-gray-400">평가할 데이터셋 선택 / 확인</label>
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
                        {!hasDatasetCases ? (
                            <p className="text-[11px] text-yellow-300">선택한 데이터셋에 케이스가 없습니다. 위에서 한 번에 생성하거나 아래로 케이스를 추가하세요.</p>
                        ) : (
                            <p className="text-[11px] text-emerald-300">이 데이터셋으로 바로 평가 실행 가능합니다.</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-gray-400">기존 데이터셋에 케이스 추가/교체 (선택)</label>
                        <p className="text-[11px] text-gray-500">
                            선택한 데이터셋이 있을 때만 동작합니다.
                        </p>
                        <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                            <input
                                type="checkbox"
                                checked={replaceExisting}
                                onChange={(e) => setReplaceExisting(e.target.checked)}
                            />
                            기존 케이스 교체 후 업로드
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => uploadCasesMutation.mutate()}
                                disabled={uploadCasesMutation.isPending || preparedCaseInput.count === 0 || !!preparedCaseInput.error || !selectedDatasetId}
                                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm disabled:opacity-50"
                            >
                                선택 데이터셋에 케이스 업로드
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-gray-400">데이터셋 케이스 확인</label>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                            {!selectedDatasetId ? (
                                <p className="text-[11px] text-gray-500">데이터셋을 선택하면 케이스를 확인할 수 있습니다.</p>
                            ) : isSelectedDatasetCasesFetching ? (
                                <p className="text-[11px] text-gray-500">케이스 목록을 불러오는 중입니다...</p>
                            ) : (selectedDatasetCases?.length || 0) === 0 ? (
                                <p className="text-[11px] text-yellow-300">등록된 케이스가 없습니다.</p>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[11px] text-emerald-300">
                                        총 {(selectedDatasetCases || []).length}개 케이스
                                    </p>
                                    <div className="max-h-56 overflow-auto rounded border border-white/10">
                                        <table className="min-w-full text-[11px]">
                                            <thead>
                                                <tr className="text-left text-gray-400 border-b border-white/10 bg-black/30">
                                                    <th className="px-2 py-1.5">순서</th>
                                                    <th className="px-2 py-1.5">입력 미리보기</th>
                                                    <th className="px-2 py-1.5">검증 항목</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedDatasetCases || []).map((item) => (
                                                    <tr key={item.id} className="border-b border-white/5">
                                                        <td className="px-2 py-1.5 text-gray-300">{item.caseOrder}</td>
                                                        <td className="px-2 py-1.5 text-gray-200">{truncateText(item.input, 80)}</td>
                                                        <td className="px-2 py-1.5 text-gray-400">
                                                            {summarizeCaseChecks(item.expectedJson, item.constraintsJson)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            ) : null}

            {activeTab === 'run' ? (
                <div className="glass-card rounded-2xl p-6 space-y-4">
                    <h3 className="text-white font-semibold">평가 설정 / 실행</h3>
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-300 space-y-1">
                        <p>버전: {selectedVersion ? `v${selectedVersion.versionNumber} (${selectedVersion.model})` : '선택 필요'}</p>
                        <p>데이터셋: {selectedDataset?.name || '선택 필요'}</p>
                        <p>모드/루브릭: {renderModeLabel(mode)} / {selectedRubric?.label || rubricTemplateCode}</p>
                        <p>
                            현재 배포 버전: {activeRelease?.activeVersionNo ? `v${activeRelease.activeVersionNo}` : '없음'}
                        </p>
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
                                <FieldTooltipLabel label="최소 Pass Rate(%)" help="이 값보다 낮으면 HOLD" />
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
                        <p className="text-sm text-emerald-100 font-semibold">실행 전 예상치 (공식 기반 범위)</p>
                        {!canEstimateRun ? (
                            <p className="text-[11px] text-emerald-100/80">
                                버전/데이터셋을 선택하고, 비교 모드라면 운영 버전과 다른 테스트 버전을 선택하면 예상치를 확인할 수 있습니다.
                            </p>
                        ) : isRunEstimateFetching ? (
                            <p className="text-[11px] text-emerald-100/80">예상치를 계산 중입니다...</p>
                        ) : runEstimate ? (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs text-emerald-100">
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
                                    <p className="text-sm font-semibold">
                                        ${Number(runEstimate.estimatedCostUsdMin).toFixed(4)} ~ ${Number(runEstimate.estimatedCostUsdMax).toFixed(4)}
                                    </p>
                                    <p className="mt-1">{renderEstimateCostTier(runEstimate.estimatedCostTier)}</p>
                                    <p className="text-[11px] text-emerald-200/70">
                                        {runEstimate.estimatedDurationSecMin}s ~ {runEstimate.estimatedDurationSecMax}s
                                    </p>
                                </div>
                                <p className="md:col-span-4 text-[11px] text-emerald-100/80">{runEstimate.estimateNotice}</p>
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
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                        <div className="space-y-1 md:col-span-2">
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

                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs text-gray-400">루브릭 Override</label>
                            {rubricTemplateCode === 'CUSTOM' ? (
                                <div className="space-y-3">
                                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                                        <p className="text-xs text-gray-300">CUSTOM 빠른 설정</p>
                                        <p className="text-[11px] text-gray-500">
                                            항목별 가중치와 최소 점수를 입력하면 `weights`/`gates.minCriterionScores`를 자동 생성합니다.
                                        </p>
                                        <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-gray-300 space-y-1">
                                            <p><span className="text-gray-400">설명:</span> 이 평가가 무엇을 검증하는지 한 줄로 적어주세요.</p>
                                            <p><span className="text-gray-400">최소 전체 점수:</span> 0~100 기준 합격선입니다. 예: `75`</p>
                                            <p><span className="text-gray-400">평가 항목명:</span> 점수를 줄 기준 이름입니다. 예: `정확성`, `완성도`, `안전성`</p>
                                            <p><span className="text-gray-400">가중치:</span> 항목 중요도입니다. 보통 `1.0`부터 시작합니다.</p>
                                            <p><span className="text-gray-400">최소점수:</span> 해당 항목의 필수 하한선(1~5)입니다. 비우면 하한 없음.</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div>
                                                <FieldTooltipLabel
                                                    label="설명"
                                                    help="평가 목적을 짧게 적어주세요. 예: 학부모 안내문 품질 평가"
                                                />
                                                <input
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                                    placeholder="예: 학부모 안내문 품질 평가"
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
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={autoEvalEnabled}
                            onChange={(e) => setAutoEvalEnabled(e.target.checked)}
                        />
                        새 버전 생성 시 자동 평가
                    </label>

                    <div className="flex items-center gap-2">
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
                            disabled={createRunMutation.isPending || !selectedDatasetId || !selectedVersionId || !hasDatasetCases || parsedRubricOverrides === null}
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
                    {(!selectedDatasetId || !selectedVersionId || !hasDatasetCases || parsedRubricOverrides === null) ? (
                        <p className="text-[11px] text-yellow-300">
                            실행 전 확인: 데이터셋/버전 선택, 케이스 업로드, Override JSON 형식 확인이 필요합니다.
                        </p>
                    ) : null}
                </div>
            ) : null}

            {activeTab === 'result' ? (
                <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold">평가 실행 이력 (Eval Runs)</h3>
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
                        요약 보기 (추천)
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
                            ? '결론과 핵심 지표를 먼저 보여줍니다.'
                            : '운영/디버깅용 상세 정보를 함께 보여줍니다.'}
                    </p>
                </div>

                {selectedRun ? (
                    <div className="space-y-3">
                        <ReleaseDecisionCard decision={selectedRunDecision} />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <KpiCard
                                label="배포 판단"
                                value={selectedRunDecision.decisionLabel}
                                tone={selectedRunDecision.decision === 'HOLD' ? 'danger' : selectedRunDecision.decision === 'SAFE_TO_DEPLOY' ? 'good' : undefined}
                                emphasized
                            />
                            <KpiCard
                                label="위험도"
                                value={selectedRunDecision.riskLevelLabel}
                                tone={selectedRunDecision.riskLevelTone}
                                emphasized
                            />
                            <KpiCard
                                label="이전 대비 변화"
                                value={formatSignedNumber(toNullableNumber(selectedRun.summary?.avgScoreDelta))}
                                tone={scoreDeltaTone(toNullableNumber(selectedRun.summary?.avgScoreDelta))}
                                emphasized
                            />
                            <KpiCard
                                label="실패 케이스 수"
                                value={String(selectedRun.failedCases + selectedRun.errorCases)}
                                tone={(selectedRun.failedCases + selectedRun.errorCases) > 0 ? 'warn' : 'good'}
                                emphasized
                            />
                        </div>

                        {resultViewMode === 'ENGINEERING' ? (
                            <>
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
                                    <KpiCard label="Pass Rate" value={`${Number(selectedRun.summary?.passRate ?? 0).toFixed(2)}%`} tone="good" />
                                    <KpiCard label="평균 점수" value={formatOptionalNumber(toNullableNumber(selectedRun.summary?.avgOverallScore))} />
                                    <KpiCard label="통과" value={String(selectedRun.passedCases)} tone="good" />
                                    <KpiCard label="오류" value={String(selectedRun.errorCases)} tone={selectedRun.errorCases > 0 ? 'danger' : undefined} />
                                </div>
                            </>
                        ) : null}

                        <FailureClusterCard summary={selectedRun.summary} />
                        <RunInsightCard summary={selectedRun.summary} />
                    </div>
                ) : null}

                {resultViewMode === 'ENGINEERING' ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 border-b border-white/10">
                                    <th className="py-2 pr-3">Run ID</th>
                                    <th className="py-2 pr-3">상태</th>
                                    <th className="py-2 pr-3">진행률</th>
                                    <th className="py-2 pr-3">Pass Rate</th>
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
                ) : (
                    <details className="rounded-md border border-white/10 bg-black/20 p-2">
                        <summary className="cursor-pointer text-[11px] text-gray-300">실행 히스토리 보기 (기술 상세)</summary>
                        <div className="overflow-x-auto mt-2">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-white/10">
                                        <th className="py-2 pr-3">Run ID</th>
                                        <th className="py-2 pr-3">상태</th>
                                        <th className="py-2 pr-3">판정</th>
                                        <th className="py-2 pr-3">Pass Rate</th>
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
                )}

                <RunCaseList
                    cases={runCases?.content || []}
                    caseInputById={caseInputById}
                    expandedCaseId={expandedCaseId}
                    onToggleExpand={(caseId) => setExpandedCaseId((prev) => (prev === caseId ? null : caseId))}
                />
                </div>
            ) : null}
        </div>
    );
}

function RunCaseList({
    cases,
    caseInputById,
    expandedCaseId,
    onToggleExpand,
}: {
    cases: EvalCaseResultResponse[];
    caseInputById: Record<number, string>;
    expandedCaseId: number | null;
    onToggleExpand: (caseId: number) => void;
}) {
    const [filter, setFilter] = useState<'ALL' | 'ISSUE' | 'PASS' | 'FAIL' | 'ERROR'>('ISSUE');
    const [sortMode, setSortMode] = useState<'RISK_DESC' | 'CASE_ASC'>('RISK_DESC');
    const [query, setQuery] = useState('');

    if (cases.length === 0) {
        return <p className="text-xs text-gray-400">선택한 Run의 케이스 결과가 아직 없습니다.</p>;
    }

    const passCount = cases.filter((item) => item.pass === true).length;
    const failCount = cases.filter((item) => item.pass === false).length;
    const errorCount = cases.filter((item) => item.status === 'ERROR').length;

    const filteredCases = cases.filter((item) => {
        if (filter === 'ISSUE' && !(item.pass === false || item.status === 'ERROR')) return false;
        if (filter === 'PASS' && item.pass !== true) return false;
        if (filter === 'FAIL' && item.pass !== false) return false;
        if (filter === 'ERROR' && item.status !== 'ERROR') return false;
        if (!query.trim()) return true;

        const q = query.trim().toLowerCase();
        const inputPreview = (caseInputById[item.testCaseId] || '').toLowerCase();
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

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white">케이스 결과 (최근 30건)</h4>
            <p className="text-[11px] text-gray-500">
                행을 클릭하면 실제 입력/모델응답/형식 검사/AI 심사 근거를 확인할 수 있습니다.
            </p>
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <FilterChip label={`전체 ${cases.length}`} active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
                    <FilterChip label={`이슈 ${failCount + errorCount}`} active={filter === 'ISSUE'} onClick={() => setFilter('ISSUE')} />
                    <FilterChip label={`통과 ${passCount}`} active={filter === 'PASS'} onClick={() => setFilter('PASS')} />
                    <FilterChip label={`실패 ${failCount}`} active={filter === 'FAIL'} onClick={() => setFilter('FAIL')} />
                    <FilterChip label={`오류 ${errorCount}`} active={filter === 'ERROR'} onClick={() => setFilter('ERROR')} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-200">
                        고위험 {highRiskCount}
                    </span>
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/15 text-amber-200">
                        중위험 {mediumRiskCount}
                    </span>
                    <button
                        type="button"
                        onClick={() => setSortMode((prev) => (prev === 'RISK_DESC' ? 'CASE_ASC' : 'RISK_DESC'))}
                        className="px-2 py-1 rounded-md border bg-white/10 border-white/20 text-gray-200 hover:bg-white/15"
                    >
                        정렬: {sortMode === 'RISK_DESC' ? '위험도 우선' : '케이스 번호'}
                    </button>
                </div>
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
                        <p>- 비교(Δ): 이번 테스트 버전 점수 - 현재 운영 버전 점수</p>
                    </div>
                </details>
                <p className="text-[11px] text-gray-500">현재 표시: {sortedCases.length}건</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead className="sticky top-0 z-10">
                        <tr className="text-left text-gray-400 border-b border-white/10 bg-black/40 backdrop-blur">
                            <th className="py-2 pr-3">케이스</th>
                            <th className="py-2 pr-3">입력 요약</th>
                            <th className="py-2 pr-3">위험도</th>
                            <th className="py-2 pr-3">상태</th>
                            <th className="py-2 pr-3">Pass</th>
                            <th className="py-2 pr-3">점수</th>
                            <th className="py-2 pr-3">비교(Δ 이번-운영)</th>
                            <th className="py-2 pr-3">판정/오류 원인</th>
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
                                        <td className="py-2 pr-3 text-gray-300">{truncateText(caseInputById[item.testCaseId], 52)}</td>
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
                                        <td className="py-2 pr-3 text-gray-200">{item.overallScore ?? '-'}</td>
                                        <td className="py-2 pr-3 text-gray-200">
                                            {renderCompareCell(compare)}
                                        </td>
                                        <td className="py-2 pr-3 text-gray-300">{renderCaseReason(item)}</td>
                                    </tr>
                                    {expanded ? (
                                        <tr className="border-b border-white/5">
                                            <td className="py-3 pr-3" colSpan={8}>
                                                <CaseDetailPanel item={item} inputText={caseInputById[item.testCaseId]} />
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

function CaseDetailPanel({ item, inputText }: { item: EvalCaseResultResponse; inputText?: string }) {
    const compare = extractCompareSummary(item.judgeOutput);
    const candidateRuleChecks = extractCandidateRuleChecks(item.ruleChecks);
    const baselineRuleChecks = extractBaselineRuleChecks(item.ruleChecks);
    const candidateJudgeOutput = extractCandidateJudgeOutput(item.judgeOutput);
    const baselineJudgeOutput = extractBaselineJudgeOutput(item.judgeOutput);

    return (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <DetailBlock title="입력 (테스트케이스)" value={inputText || '입력 데이터를 찾지 못했습니다.'} mono />
                <DetailBlock title="모델 응답 (이번 테스트 버전)" value={item.candidateOutput || '-'} mono />
            </div>

            {item.baselineOutput ? (
                <DetailBlock title="모델 응답 (현재 운영 버전)" value={item.baselineOutput} mono />
            ) : null}

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

function ReleaseDecisionCard({ decision }: { decision: RunDecisionView }) {
    return (
        <div className={`rounded-lg border px-4 py-3 ${decision.cardClass}`}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs opacity-80">Release Decision</p>
                <span className={`px-2 py-0.5 rounded-full text-[11px] border ${decision.badgeClass}`}>
                    {decision.decisionLabel}
                </span>
            </div>
            <p className="mt-1 text-lg font-semibold">{decision.decisionLabel}</p>
            <p className="text-xs opacity-80">기준: 실행 당시 기준(snapshot)</p>
            {decision.reasons.length > 0 ? (
                <div className="mt-2 text-[11px] space-y-1">
                    {decision.reasons.slice(0, 3).map((reason) => (
                        <p key={reason}>- {reason}</p>
                    ))}
                </div>
            ) : (
                <p className="mt-2 text-[11px] opacity-80">판정 사유 없음</p>
            )}
        </div>
    );
}

function FailureClusterCard({ summary }: { summary: Record<string, any> | null }) {
    const ruleFails = topEntries(summary?.ruleFailCounts);
    const errorCodes = topEntries(summary?.errorCodeCounts);
    const labels = topEntries(summary?.labelCounts);

    return (
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-2">
            <p className="text-xs text-gray-300 font-medium">실패/이슈 클러스터 요약</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                <ClusterList title="룰 실패 Top" items={ruleFails} emptyText="룰 실패 없음" />
                <ClusterList title="에러 코드 Top" items={errorCodes} emptyText="에러 코드 없음" />
                <ClusterList title="Judge 라벨 Top" items={labels} emptyText="라벨 없음" />
            </div>
        </div>
    );
}

function RunInsightCard({ summary }: { summary: Record<string, any> | null }) {
    const plainSummary = typeof summary?.plainSummary === 'string' ? summary.plainSummary : null;
    const issues = toStringArray(summary?.topIssues);
    const insights = issues.length > 0 ? issues : buildRunInsights(summary);
    return (
        <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2 space-y-1">
            <p className="text-xs text-sky-100 font-medium">자동 인사이트 요약</p>
            {plainSummary ? (
                <p className="text-[11px] text-sky-100/85">{plainSummary}</p>
            ) : null}
            {insights.length === 0 ? (
                <p className="text-[11px] text-sky-100/80">현재 Run에서 도출된 추가 인사이트가 없습니다.</p>
            ) : (
                insights.slice(0, 3).map((line) => (
                    <p key={line} className="text-[11px] text-sky-100/90">- {line}</p>
                ))
            )}
        </div>
    );
}

function ClusterList({
    title,
    items,
    emptyText,
}: {
    title: string;
    items: Array<[string, number]>;
    emptyText: string;
}) {
    return (
        <div className="rounded-md border border-white/10 bg-black/25 px-2 py-2">
            <p className="text-gray-400 mb-1">{title}</p>
            {items.length === 0 ? (
                <p className="text-gray-500">{emptyText}</p>
            ) : (
                <div className="space-y-1">
                    {items.slice(0, 3).map(([name, count]) => (
                        <p key={name} className="text-gray-200">{name} ({count})</p>
                    ))}
                </div>
            )}
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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-2 py-1 rounded-md border transition-colors ${
                active
                    ? 'bg-[var(--primary)] text-black border-[var(--primary)] font-semibold'
                    : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/15'
            }`}
        >
            {label}
        </button>
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
            return 'Pass Rate가 설정 기준보다 낮습니다.';
        case 'AVG_SCORE_BELOW_THRESHOLD':
            return '평균 점수가 설정 기준보다 낮습니다.';
        case 'ERROR_RATE_ABOVE_THRESHOLD':
            return '오류율이 설정 기준을 초과했습니다.';
        case 'COMPARE_REGRESSION_DETECTED':
            return '현재 운영 버전 대비 점수가 하락했습니다.';
        case 'COMPARE_IMPROVEMENT_MINOR':
            return '점수는 상승했지만 개선폭이 작습니다.';
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
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                이번 {candidateScore}
            </span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border border-sky-400/30 bg-sky-500/10 text-sky-200">
                운영 {baselineScore}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border ${compareDeltaBadgeClass(tone)}`}>
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
        return 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30';
    }
    if (tone === 'danger') {
        return 'bg-rose-400/15 text-rose-200 border-rose-400/30';
    }
    if (tone === 'warn') {
        return 'bg-amber-400/15 text-amber-200 border-amber-400/30';
    }
    return 'bg-white/5 text-gray-200 border-white/20';
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
            <span className="group relative inline-flex items-center">
                <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] text-gray-300 cursor-help"
                    title={help}
                >
                    ?
                </span>
                <span className="pointer-events-none absolute left-0 top-5 z-30 hidden w-64 rounded-md border border-white/20 bg-black/90 px-2 py-1 text-[11px] text-gray-200 shadow-lg group-hover:block">
                    {help}
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
            <span className="px-2 py-0.5 rounded-full text-[11px] border border-rose-400/40 bg-rose-400/15 text-rose-200">
                배포 보류
            </span>
        );
    }
    if (decision === 'SAFE_TO_DEPLOY') {
        return (
            <span className="px-2 py-0.5 rounded-full text-[11px] border border-emerald-400/40 bg-emerald-400/15 text-emerald-200">
                배포 가능
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 rounded-full text-[11px] border border-white/20 bg-white/5 text-gray-300">
            -
        </span>
    );
}

function renderEstimateCostTier(tier: string | null | undefined) {
    if (tier === 'HIGH') {
        return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] border border-rose-400/40 bg-rose-400/15 text-rose-200">비용 높음</span>;
    }
    if (tier === 'MEDIUM') {
        return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] border border-amber-400/40 bg-amber-400/15 text-amber-200">비용 중간</span>;
    }
    if (tier === 'LOW') {
        return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] border border-emerald-400/40 bg-emerald-400/15 text-emerald-200">비용 낮음</span>;
    }
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] border border-white/20 bg-white/10 text-gray-300">비용 미정</span>;
}

function runStatusBadgeClass(status: EvalRunStatus): string {
    switch (status) {
        case 'COMPLETED':
            return 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/40';
        case 'FAILED':
            return 'bg-red-400/15 text-red-300 border border-red-400/40';
        case 'RUNNING':
            return 'bg-blue-400/15 text-blue-300 border border-blue-400/40';
        case 'CANCELLED':
            return 'bg-gray-400/15 text-gray-300 border border-gray-400/40';
        default:
            return 'bg-white/5 text-gray-300 border border-white/20';
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
        return 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/40';
    }
    if (pass === false) {
        return 'bg-amber-400/15 text-amber-200 border border-amber-400/40';
    }
    return 'bg-white/5 text-gray-300 border border-white/20';
}

function caseStatusBadgeClass(status: string): string {
    if (status === 'OK') {
        return 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/40';
    }
    if (status === 'ERROR') {
        return 'bg-red-400/15 text-red-300 border border-red-400/40';
    }
    if (status === 'RUNNING') {
        return 'bg-blue-400/15 text-blue-300 border border-blue-400/40';
    }
    return 'bg-white/5 text-gray-300 border border-white/20';
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
        return 'bg-rose-400/15 text-rose-300 border border-rose-400/40';
    }
    if (risk === 'MEDIUM') {
        return 'bg-amber-400/15 text-amber-200 border border-amber-400/40';
    }
    return 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/40';
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

function buildRunInsights(summary: Record<string, any> | null | undefined): string[] {
    if (!summary) {
        return [];
    }
    const insights: string[] = [];

    const delta = toNullableNumber(summary.avgScoreDelta);
    if (delta != null) {
        if (delta < 0) {
            insights.push(`현재 운영 버전 대비 평균 점수가 ${Math.abs(delta).toFixed(2)} 하락했습니다.`);
        } else if (delta > 0) {
            insights.push(`현재 운영 버전 대비 평균 점수가 ${delta.toFixed(2)} 상승했습니다.`);
        } else {
            insights.push('현재 운영 버전과 평균 점수가 동일합니다.');
        }
    }

    const topRuleFail = topEntries(summary.ruleFailCounts)[0];
    if (topRuleFail) {
        insights.push(`가장 많이 실패한 룰은 '${topRuleFail[0]}' (${topRuleFail[1]}건)입니다.`);
    }

    const topLabel = topEntries(summary.labelCounts)[0];
    if (topLabel) {
        insights.push(`Judge 라벨 기준 주요 이슈는 '${topLabel[0]}' (${topLabel[1]}건)입니다.`);
    }

    return insights;
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
