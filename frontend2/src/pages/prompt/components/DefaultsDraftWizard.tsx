import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PromptEvalDefaultDraftResponse, EvalMode, RubricTemplateCode } from '@/types/api.types';
import { promptApi } from '@/api/prompt.api';

interface DefaultsDraftWizardProps {
    workspaceId: number;
    promptId: number;
    onComplete?: () => void;
}

type DraftStep = 'DATASET' | 'RUBRIC' | 'MODE' | 'AUTOMATION' | 'REVIEW';

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

const MODE_OPTIONS: Array<{ value: EvalMode; label: string; description: string }> = [
    { value: 'CANDIDATE_ONLY', label: '단독 평가', description: '현재 버전만 평가합니다.' },
    { value: 'COMPARE_ACTIVE', label: '비교 평가', description: '현재 버전과 운영 버전을 비교합니다.' },
];

export function DefaultsDraftWizard({ workspaceId, promptId, onComplete }: DefaultsDraftWizardProps) {
    const [currentStep, setCurrentStep] = useState<DraftStep>('DATASET');
    const [selectedDatasetId, setSelectedDatasetId] = useState<number | undefined>();
    const [selectedRubric, setSelectedRubric] = useState<RubricTemplateCode | undefined>();
    const [selectedMode, setSelectedMode] = useState<EvalMode | undefined>();
    const [autoEvalEnabled, setAutoEvalEnabled] = useState<boolean | undefined>();
    const queryClient = useQueryClient();

    // Fetch draft
    const { data: draft, isLoading } = useQuery<PromptEvalDefaultDraftResponse>({
        queryKey: ['evalDefaultsDraft', workspaceId, promptId],
        queryFn: async () => {
            return (await promptApi.getEvalDefaultsDraft(workspaceId, promptId)).data;
        },
    });

    // Fetch datasets
    const { data: datasets } = useQuery({
        queryKey: ['evalDatasets', workspaceId, promptId],
        queryFn: async () => {
            return (await promptApi.getEvalDatasets(workspaceId, promptId)).data;
        },
    });

    // Mutations for each section
    const patchDataset = useMutation({
        mutationFn: () => promptApi.patchEvalDefaultsDraftDataset(workspaceId, promptId, selectedDatasetId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evalDefaultsDraft', workspaceId, promptId] });
            setCurrentStep('RUBRIC');
        },
    });

    const patchRubric = useMutation({
        mutationFn: () => promptApi.patchEvalDefaultsDraftRubric(workspaceId, promptId, {
            rubricTemplateCode: selectedRubric,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evalDefaultsDraft', workspaceId, promptId] });
            setCurrentStep('MODE');
        },
    });

    const patchMode = useMutation({
        mutationFn: () => promptApi.patchEvalDefaultsDraftMode(workspaceId, promptId, selectedMode),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evalDefaultsDraft', workspaceId, promptId] });
            setCurrentStep('AUTOMATION');
        },
    });

    const patchAutomation = useMutation({
        mutationFn: () => promptApi.patchEvalDefaultsDraftAutomation(workspaceId, promptId, autoEvalEnabled),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evalDefaultsDraft', workspaceId, promptId] });
            setCurrentStep('REVIEW');
        },
    });

    const finalize = useMutation({
        mutationFn: () => promptApi.finalizeEvalDefaultsDraft(workspaceId, promptId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evalDefaults', workspaceId, promptId] });
            queryClient.invalidateQueries({ queryKey: ['evalDefaultsDraft', workspaceId, promptId] });
            onComplete?.();
        },
    });

    if (isLoading) {
        return <div className="p-8 text-center text-gray-400">로딩 중...</div>;
    }

    const completedSections = draft?.completedSections || [];
    const isSectionCompleted = (step: DraftStep) => completedSections.includes(step);

    return (
        <div className="space-y-6">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between">
                {(['DATASET', 'RUBRIC', 'MODE', 'AUTOMATION', 'REVIEW'] as DraftStep[]).map((step, idx) => (
                    <div key={step} className="flex items-center">
                        <button
                            onClick={() => setCurrentStep(step)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                currentStep === step
                                    ? 'bg-purple-500 text-white'
                                    : isSectionCompleted(step)
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                    : 'bg-black/20 text-gray-400 border border-white/10'
                            }`}
                        >
                            {isSectionCompleted(step) ? '✓' : idx + 1}
                        </button>
                        {idx < 4 && (
                            <div className={`w-12 h-0.5 mx-2 ${
                                isSectionCompleted(step) ? 'bg-emerald-500/50' : 'bg-white/10'
                            }`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step Content */}
            <div className="bg-black/20 rounded-xl p-6 border border-white/10">
                {currentStep === 'DATASET' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white">1. 데이터셋 선택</h3>
                        <p className="text-sm text-gray-400">평가에 사용할 기본 데이터셋을 선택하세요.</p>
                        <div className="grid grid-cols-2 gap-3">
                            {datasets?.map((dataset) => (
                                <button
                                    key={dataset.id}
                                    onClick={() => setSelectedDatasetId(dataset.id)}
                                    className={`p-4 rounded-lg border text-left transition-all ${
                                        selectedDatasetId === dataset.id
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="font-bold text-sm text-white">{dataset.name}</div>
                                    <div className="text-xs text-gray-400 mt-1">{dataset.description || '설명 없음'}</div>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => patchDataset.mutate()}
                            disabled={!selectedDatasetId || patchDataset.isPending}
                            className="w-full py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-lg text-sm font-bold"
                        >
                            {patchDataset.isPending ? '저장 중...' : '다음'}
                        </button>
                    </div>
                )}

                {currentStep === 'RUBRIC' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white">2. 루브릭 선택</h3>
                        <p className="text-sm text-gray-400">평가 기준 템플릿을 선택하세요.</p>
                        <div className="space-y-2">
                            {RUBRIC_OPTIONS.map((rubric) => (
                                <button
                                    key={rubric.code}
                                    onClick={() => setSelectedRubric(rubric.code)}
                                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                                        selectedRubric === rubric.code
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-sm text-white">{rubric.label}</span>
                                        {selectedRubric === rubric.code && (
                                            <span className="text-purple-400">✓</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">{rubric.description}</div>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentStep('DATASET')}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm"
                            >
                                이전
                            </button>
                            <button
                                onClick={() => patchRubric.mutate()}
                                disabled={!selectedRubric || patchRubric.isPending}
                                className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-lg text-sm font-bold"
                            >
                                {patchRubric.isPending ? '저장 중...' : '다음'}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 'MODE' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white">3. 평가 모드 선택</h3>
                        <p className="text-sm text-gray-400">평가 실행 방식을 선택하세요.</p>
                        <div className="space-y-2">
                            {MODE_OPTIONS.map((mode) => (
                                <button
                                    key={mode.value}
                                    onClick={() => setSelectedMode(mode.value)}
                                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                                        selectedMode === mode.value
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-sm text-white">{mode.label}</span>
                                        {selectedMode === mode.value && (
                                            <span className="text-purple-400">✓</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">{mode.description}</div>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentStep('RUBRIC')}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm"
                            >
                                이전
                            </button>
                            <button
                                onClick={() => patchMode.mutate()}
                                disabled={!selectedMode || patchMode.isPending}
                                className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-lg text-sm font-bold"
                            >
                                {patchMode.isPending ? '저장 중...' : '다음'}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 'AUTOMATION' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white">4. 자동 평가 설정</h3>
                        <p className="text-sm text-gray-400">버전 생성 시 자동으로 평가를 실행할지 설정하세요.</p>
                        <div className="space-y-2">
                            {[
                                { value: true, label: '자동 평가 활성화', desc: '새 버전이 생성될 때마다 자동으로 평가를 실행합니다.' },
                                { value: false, label: '자동 평가 비활성화', desc: '수동으로만 평가를 실행합니다.' },
                            ].map((option) => (
                                <button
                                    key={String(option.value)}
                                    onClick={() => setAutoEvalEnabled(option.value)}
                                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                                        autoEvalEnabled === option.value
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-sm text-white">{option.label}</span>
                                        {autoEvalEnabled === option.value && (
                                            <span className="text-purple-400">✓</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">{option.desc}</div>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentStep('MODE')}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm"
                            >
                                이전
                            </button>
                            <button
                                onClick={() => patchAutomation.mutate()}
                                disabled={autoEvalEnabled === undefined || patchAutomation.isPending}
                                className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 text-white rounded-lg text-sm font-bold"
                            >
                                {patchAutomation.isPending ? '저장 중...' : '다음'}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 'REVIEW' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white">5. 설정 확인 및 저장</h3>
                        <p className="text-sm text-gray-400">아래 설정을 확인하고 저장하세요.</p>
                        <div className="space-y-3 bg-black/30 rounded-lg p-4">
                            <ReviewItem
                                label="데이터셋"
                                value={datasets?.find((d) => d.id === draft?.datasetId)?.name || '미선택'}
                                completed={isSectionCompleted('DATASET')}
                            />
                            <ReviewItem
                                label="루브릭"
                                value={RUBRIC_OPTIONS.find((r) => r.code === draft?.rubricTemplateCode)?.label || '미선택'}
                                completed={isSectionCompleted('RUBRIC')}
                            />
                            <ReviewItem
                                label="평가 모드"
                                value={MODE_OPTIONS.find((m) => m.value === draft?.defaultMode)?.label || '미선택'}
                                completed={isSectionCompleted('MODE')}
                            />
                            <ReviewItem
                                label="자동 평가"
                                value={draft?.autoEvalEnabled ? '활성화' : '비활성화'}
                                completed={isSectionCompleted('AUTOMATION')}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentStep('AUTOMATION')}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm"
                            >
                                이전
                            </button>
                            <button
                                onClick={() => finalize.mutate()}
                                disabled={finalize.isPending || completedSections.length < 4}
                                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white rounded-lg text-sm font-bold"
                            >
                                {finalize.isPending ? '저장 중...' : '설정 저장'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ReviewItem({ label, value, completed }: { label: string; value: string; completed: boolean }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm text-white font-bold">{value}</span>
                {completed && <span className="text-emerald-400">✓</span>}
            </div>
        </div>
    );
}
