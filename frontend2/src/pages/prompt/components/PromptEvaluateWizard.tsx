import { useState, useMemo, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { promptApi } from '@/api/prompt.api';
import { organizationApi } from '@/api/organization.api';
import type { EvalMode, EvalRunResponse, EvalCaseResultResponse } from '@/types/api.types';

// --- Types & Interfaces ---
type WizardStep = 'SETUP' | 'RUNNING' | 'REPORT';

interface PromptEvaluateWizardProps {
    workspaceId: number;
    promptId: number;
    onSwitchToAdvanced: () => void;
}

// --- Component ---
export function PromptEvaluateWizard({ workspaceId, promptId, onSwitchToAdvanced }: PromptEvaluateWizardProps) {
    const queryClient = useQueryClient();
    const [step, setStep] = useState<WizardStep>('SETUP');
    const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
    const [compareMode, setCompareMode] = useState<boolean>(false);
    const [currentRunId, setCurrentRunId] = useState<number | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // --- Queries ---
    const { data: datasets } = useQuery({
        queryKey: ['evalDatasets', workspaceId, promptId],
        queryFn: async () => (await promptApi.getEvalDatasets(workspaceId, promptId)).data,
    });

    const { data: versions } = useQuery({
        queryKey: ['promptVersions', promptId],
        queryFn: async () => (await promptApi.getVersions(promptId)).data,
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

    const { data: run } = useQuery({
        queryKey: ['evalRun', workspaceId, promptId, currentRunId],
        queryFn: async () => {
            if (!currentRunId) return null;
            return (await promptApi.getEvalRuns(workspaceId, promptId)).data.find(r => r.id === currentRunId);
        },
        enabled: !!currentRunId,
        refetchInterval: (data) => (data && (data.status === 'QUEUED' || data.status === 'RUNNING') ? 2000 : false),
    });

    const { data: runCases } = useQuery({
        queryKey: ['evalRunCases', workspaceId, promptId, currentRunId],
        queryFn: async () => {
            if (!currentRunId) return null;
            return (await promptApi.getEvalRunCases(workspaceId, promptId, currentRunId, 0, 100)).data.content;
        },
        enabled: !!currentRunId,
        refetchInterval: (data) => (run && (run.status === 'QUEUED' || run.status === 'RUNNING') ? 3000 : false),
    });

    // --- Effects ---
    useEffect(() => {
        if (datasets && datasets.length > 0 && !selectedDatasetId) {
            setSelectedDatasetId(datasets[0].id);
        }
    }, [datasets]);

    useEffect(() => {
        if (run && run.status === 'COMPLETED') {
            setStep('REPORT');
        }
    }, [run?.status]);

    useEffect(() => {
        if (runCases) {
            const newLogs: string[] = [];
            runCases.forEach(c => {
                if (c.status === 'COMPLETED') {
                    const icon = c.pass ? '✅' : '❌';
                    const msg = `Case #${c.testCaseId}: ${c.pass ? 'PASS' : 'FAIL'}`;
                    if (!logs.includes(msg) && !logs.includes(`${icon} ${msg}`)) {
                        // Simple dedup logic for demo
                        // In real app, track processed IDs
                    }
                }
            });
            // Simplified log simulation for visual effect
            const processed = runCases.filter(c => c.status === 'COMPLETED').length;
            if (processed > 0 && processed > logs.length) {
                const latest = runCases[processed - 1];
                const icon = latest.pass ? '✅' : '❌';
                setLogs(prev => [...prev, `${icon} Case #${latest.testCaseId} 완료`]);
            }
        }
    }, [runCases]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);


    const [isCreatingDataset, setIsCreatingDataset] = useState(false);
    const [quickDatasetForm, setQuickDatasetForm] = useState({ name: '', inputs: '' });

    // --- Mutations ---
    const createQuickDatasetMutation = useMutation({
        mutationFn: async () => {
            const name = quickDatasetForm.name.trim();
            const rawInputs = quickDatasetForm.inputs.trim();
            if (!name) throw new Error('데이터셋 이름을 입력해주세요.');
            if (!rawInputs) throw new Error('질문을 최소 1개 이상 입력해주세요.');

            const inputs = rawInputs.split('\n').map(s => s.trim()).filter(s => s.length > 0);
            if (inputs.length === 0) throw new Error('유효한 질문이 없습니다.');

            // 1. Create Dataset
            const dsRes = await promptApi.createEvalDataset(workspaceId, promptId, { name });
            const datasetId = dsRes.data.id;

            // 2. Upload Cases
            const testCases = inputs.map(input => ({
                input,
                expectedJson: { must_cover: [] }, // Default empty criteria
                constraintsJson: {}
            }));

            await promptApi.bulkUploadEvalDatasetCases(workspaceId, promptId, datasetId, {
                testCases,
                replaceExisting: true
            });

            return datasetId;
        },
        onSuccess: (newDatasetId) => {
            queryClient.invalidateQueries({ queryKey: ['evalDatasets', workspaceId, promptId] });
            setSelectedDatasetId(newDatasetId);
            setIsCreatingDataset(false);
            setQuickDatasetForm({ name: '', inputs: '' });
        },
        onError: (err) => {
            alert('데이터셋 생성 실패: ' + err);
        }
    });

    const startRunMutation = useMutation({
        mutationFn: async () => {
            if (!selectedDatasetId) throw new Error('데이터셋을 선택해주세요.');
            if (!versions || versions.length === 0) throw new Error('버전이 없습니다.');
            
            // Auto-select latest version for candidate
            const candidateVersionId = versions[0].id;
            
            const mode: EvalMode = compareMode ? 'COMPARE_ACTIVE' : 'CANDIDATE_ONLY';
            
            if (mode === 'COMPARE_ACTIVE' && !release?.activeVersionId) {
                throw new Error('비교할 운영(Active) 버전이 없습니다.');
            }

            return promptApi.createEvalRun(workspaceId, promptId, {
                datasetId: selectedDatasetId,
                promptVersionId: candidateVersionId,
                mode: mode,
                rubricTemplateCode: 'GENERAL_TEXT', // Default for wizard
            });
        },
        onSuccess: (data) => {
            setCurrentRunId(data.data.id);
            setStep('RUNNING');
            setLogs(['🚀 평가를 시작합니다...', '⏳ 환경 구성 중...']);
        },
        onError: (err) => {
            alert('실행 실패: ' + err);
        }
    });

    // --- Render Helpers ---
    const selectedDataset = datasets?.find(d => d.id === selectedDatasetId);
    const passRate = run?.summary?.passRate ?? 0;
    const score = run?.summary?.avgOverallScore ?? 0;
    
    const getGrade = (score: number) => {
        if (score >= 90) return { label: 'S', color: 'text-purple-400', border: 'border-purple-500' };
        if (score >= 80) return { label: 'A', color: 'text-emerald-400', border: 'border-emerald-500' };
        if (score >= 70) return { label: 'B', color: 'text-blue-400', border: 'border-blue-500' };
        if (score >= 60) return { label: 'C', color: 'text-amber-400', border: 'border-amber-500' };
        return { label: 'F', color: 'text-rose-400', border: 'border-rose-500' };
    };

    const grade = getGrade(score);

    // --- Step 1: SETUP ---
    if (step === 'SETUP') {
        return (
            <div className="max-w-4xl mx-auto py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-white tracking-tight">AI 품질 평가 위자드</h2>
                    <p className="text-gray-400">복잡한 설정 없이, 3번의 클릭으로 현재 프롬프트의 품질을 검증하세요.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Dataset Selection */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-purple-500/30 transition-all cursor-pointer group bg-gradient-to-br from-white/5 to-transparent flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300">1</span>
                                <h3 className="text-lg font-semibold text-white">데이터셋 선택</h3>
                            </div>
                            {isCreatingDataset ? (
                                <button 
                                    onClick={() => setIsCreatingDataset(false)}
                                    className="text-xs text-gray-400 hover:text-white"
                                >
                                    목록으로
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setIsCreatingDataset(true)}
                                    className="text-xs flex items-center gap-1 text-[var(--primary)] hover:underline"
                                >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    새로 만들기
                                </button>
                            )}
                        </div>

                        {isCreatingDataset ? (
                            <div className="space-y-4 flex-1 animate-in fade-in zoom-in-95 duration-200">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">데이터셋 이름</label>
                                    <input 
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--primary)] outline-none"
                                        placeholder="예: 2026-02-21 테스트용"
                                        value={quickDatasetForm.name}
                                        onChange={(e) => setQuickDatasetForm(prev => ({ ...prev, name: e.target.value }))}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-400 mb-1">질문 입력 (엔터로 구분)</label>
                                    <textarea 
                                        className="w-full h-40 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none focus:border-[var(--primary)] outline-none"
                                        placeholder={`환불 규정 알려줘\n상담원 연결해줘\n...`}
                                        value={quickDatasetForm.inputs}
                                        onChange={(e) => setQuickDatasetForm(prev => ({ ...prev, inputs: e.target.value }))}
                                    />
                                </div>
                                <button
                                    onClick={() => createQuickDatasetMutation.mutate()}
                                    disabled={createQuickDatasetMutation.isPending || !quickDatasetForm.name || !quickDatasetForm.inputs}
                                    className="w-full py-2 rounded-lg bg-[var(--primary)] text-black font-semibold hover:opacity-90 disabled:opacity-50"
                                >
                                    {createQuickDatasetMutation.isPending ? '생성 중...' : '생성하고 바로 선택'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                {datasets?.map(ds => (
                                    <button 
                                        key={ds.id}
                                        onClick={() => setSelectedDatasetId(ds.id)}
                                        className={`w-full p-3 rounded-xl border transition-all flex justify-between items-center text-left group/item ${
                                            selectedDatasetId === ds.id 
                                                ? 'bg-purple-500/20 border-purple-500 text-white' 
                                                : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{ds.name}</p>
                                            <p className="text-[10px] opacity-60 truncate">{ds.description || '설명 없음'}</p>
                                        </div>
                                        {selectedDatasetId === ds.id && <span className="material-symbols-outlined text-sm text-purple-400">check_circle</span>}
                                    </button>
                                ))}
                                {(!datasets || datasets.length === 0) && (
                                    <div className="text-sm text-gray-500 text-center py-8 border border-dashed border-white/10 rounded-xl">
                                        데이터셋이 없습니다.<br />
                                        <button onClick={() => setIsCreatingDataset(true)} className="text-[var(--primary)] underline mt-2">
                                            지금 바로 만드세요
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mode Selection */}
                    <div className="glass-card p-6 rounded-2xl border border-white/10 hover:border-blue-500/30 transition-all bg-gradient-to-br from-white/5 to-transparent">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300">2</span>
                            <h3 className="text-lg font-semibold text-white">비교 모드</h3>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => setCompareMode(false)}
                                className={`w-full p-4 rounded-xl border text-left transition-all ${
                                    !compareMode 
                                        ? 'bg-blue-500/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                                        : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/10'
                                }`}
                            >
                                <div className="font-semibold text-sm">⚡ 빠른 검증 (Fast Check)</div>
                                <div className="text-xs opacity-70 mt-1">현재 버전만 독립적으로 평가합니다.</div>
                            </button>
                            <button
                                onClick={() => setCompareMode(true)}
                                disabled={!release?.activeVersionId}
                                className={`w-full p-4 rounded-xl border text-left transition-all ${
                                    compareMode 
                                        ? 'bg-blue-500/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                                        : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-50'
                                }`}
                            >
                                <div className="font-semibold text-sm">⚖️ 운영 비교 (A/B Test)</div>
                                <div className="text-xs opacity-70 mt-1">
                                    {release?.activeVersionId 
                                        ? `현재 운영 버전(v${release.activeVersionNo})과 비교합니다.` 
                                        : '운영 버전이 없어 사용할 수 없습니다.'}
                                </div>
                            </button>
                        </div>

                        {selectedDatasetId && !isCreatingDataset && (
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <p className="text-xs text-gray-400 mb-2 font-semibold">선택한 데이터셋 미리보기</p>
                                <div className="bg-black/30 rounded-lg p-3 text-xs text-gray-300 space-y-1 max-h-32 overflow-y-auto">
                                    <p className="text-[10px] text-gray-500 mb-1">{selectedDataset?.name}</p>
                                    <p className="text-gray-400 italic text-[10px]">실제 데이터 로딩 기능은 간소화를 위해 생략됨 (Advanced에서 확인 가능)</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-center pt-6">
                    <button
                        onClick={() => startRunMutation.mutate()}
                        disabled={startRunMutation.isPending || !selectedDatasetId || isCreatingDataset}
                        className="group relative px-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                    >
                        {startRunMutation.isPending ? '준비 중...' : '평가 시작하기 🚀'}
                        <div className="absolute inset-0 rounded-full border-2 border-white opacity-50 group-hover:animate-ping" />
                    </button>
                </div>
                
                <div className="text-center">
                    <button onClick={onSwitchToAdvanced} className="text-xs text-gray-500 hover:text-gray-300 underline">
                        상세 설정이 필요하신가요? 고급 모드로 전환
                    </button>
                </div>
            </div>
        );
    }

    // --- Step 2: RUNNING ---
    if (step === 'RUNNING') {
        const progress = runCases 
            ? Math.round((runCases.filter(c => c.status === 'COMPLETED').length / (run?.totalCases || 1)) * 100)
            : 0;

        return (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="relative w-32 h-32 mx-auto">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle className="text-gray-800 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                        <circle 
                            className="text-purple-500 progress-ring__circle stroke-current" 
                            strokeWidth="8" 
                            strokeLinecap="round" 
                            cx="50" 
                            cy="50" 
                            r="40" 
                            fill="transparent" 
                            strokeDasharray="251.2" 
                            strokeDashoffset={251.2 - (251.2 * progress) / 100}
                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        ></circle>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white font-mono">
                        {progress}%
                    </div>
                </div>

                <div>
                    <h3 className="text-2xl font-bold text-white mb-2">AI가 열심히 채점 중입니다...</h3>
                    <p className="text-gray-400">잠시만 기다려주세요. {run?.totalCases}개의 케이스를 분석하고 있습니다.</p>
                </div>

                <div className="bg-black/50 rounded-xl border border-white/10 p-4 h-48 overflow-y-auto font-mono text-xs text-left shadow-inner">
                    {logs.map((log, i) => (
                        <div key={i} className="mb-1 text-gray-300 border-b border-white/5 pb-1 last:border-0">{log}</div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
        );
    }

    // --- Step 3: REPORT ---
    if (step === 'REPORT') {
        const failedCases = runCases?.filter(c => !c.pass) || [];

        return (
            <div className="max-w-4xl mx-auto py-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="text-center">
                    <p className="text-gray-400 uppercase tracking-widest text-xs font-bold mb-2">EVALUATION REPORT</p>
                    <div className={`inline-block text-8xl font-black ${grade.color} drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]`}>
                        {grade.label}
                    </div>
                    <div className="mt-4 flex justify-center gap-8">
                        <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase">Score</p>
                            <p className="text-2xl font-bold text-white">{score.toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase">Pass Rate</p>
                            <p className="text-2xl font-bold text-white">{passRate.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card rounded-2xl border border-white/10 p-6">
                        <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-400">warning</span>
                            오답 노트 ({failedCases.length})
                        </h4>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                            {failedCases.length === 0 ? (
                                <div className="text-emerald-400 text-sm py-4 text-center bg-emerald-500/10 rounded-lg">
                                    🎉 완벽합니다! 실패한 케이스가 없습니다.
                                </div>
                            ) : (
                                failedCases.map(c => (
                                    <div key={c.id} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-mono text-rose-300">Case #{c.testCaseId}</span>
                                            <span className="text-[10px] bg-rose-500/20 text-rose-200 px-1.5 rounded">FAIL</span>
                                        </div>
                                        <p className="text-xs text-gray-300 mb-2 line-clamp-2">{c.candidateOutput}</p>
                                        <p className="text-[10px] text-gray-500 bg-black/30 p-1.5 rounded">
                                            {c.errorMessage || 'AI 판단 기준 미달'}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl border border-white/10 p-6 flex flex-col justify-between">
                        <div>
                            <h4 className="text-white font-bold mb-4">다음 단계</h4>
                            <p className="text-sm text-gray-400 mb-6">
                                평가가 완료되었습니다. 결과가 만족스럽다면 배포하거나, 상세 분석을 통해 프롬프트를 개선하세요.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={onSwitchToAdvanced}
                                className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">analytics</span>
                                상세 분석 보기 (Advanced)
                            </button>
                            <button
                                onClick={() => {
                                    setStep('SETUP');
                                    setCurrentRunId(null);
                                    setLogs([]);
                                }}
                                className="w-full py-3 rounded-xl bg-[var(--primary)] text-black font-bold hover:opacity-90 transition-all"
                            >
                                다시 평가하기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
