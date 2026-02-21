import { useState, useMemo, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { promptApi } from '@/api/prompt.api';
import { organizationApi } from '@/api/organization.api';
import type { EvalMode, EvalRunResponse, EvalCaseResultResponse } from '@/types/api.types';
import { 
    CaseEditorRow, 
    type CaseFormRow, 
    createEmptyCaseFormRow, 
    parseCaseRows 
} from './CaseEditorRow';
import { CaseDetailPanel } from './CaseDetailPanel';

// --- Interfaces ---
interface PromptEvaluateUnifiedProps {
    workspaceId: number;
    promptId: number;
    onSwitchToLegacy: () => void;
}

type UnifiedTab = 'EDITOR' | 'RESULT';

// --- Component ---
export function PromptEvaluateUnified({ workspaceId, promptId, onSwitchToLegacy }: PromptEvaluateUnifiedProps) {
    const queryClient = useQueryClient();
    const { orgId: orgIdParam } = useParams<{ orgId: string }>();
    const orgId = Number(orgIdParam);
    
    // --- Global State ---
    const [activeTab, setActiveTab] = useState<UnifiedTab>('EDITOR');
    const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
    const [compareMode, setCompareMode] = useState(false);
    
    // --- Data Queries ---
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
            try { return (await promptApi.getRelease(promptId)).data; } catch { return null; }
        },
    });

    const { data: providerCredentials } = useQuery({
        queryKey: ['providerCredentials', orgId],
        queryFn: async () => (await organizationApi.getCredentials(orgId)).data,
        enabled: Number.isFinite(orgId) && orgId > 0,
    });

    // Auto-select defaults
    useEffect(() => {
        if (datasets && datasets.length > 0 && !selectedDatasetId) setSelectedDatasetId(datasets[0].id);
    }, [datasets]);

    useEffect(() => {
        if (versions && versions.length > 0 && !selectedVersionId) setSelectedVersionId(versions[0].id);
    }, [versions]);


    return (
        <div className="flex h-[calc(100vh-200px)] min-h-[600px] gap-6 animate-in fade-in duration-500">
            {/* Left Panel: Control Center */}
            <div className="w-80 flex flex-col gap-4 shrink-0">
                <div className="glass-card rounded-2xl border border-white/10 p-5 flex flex-col gap-5 h-full overflow-y-auto">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-white">설정 (Configuration)</h3>
                            <button onClick={onSwitchToLegacy} className="text-[10px] text-gray-500 hover:text-gray-300 underline">
                                기존 UI 보기
                            </button>
                        </div>
                        <p className="text-xs text-gray-400">평가 대상과 데이터를 선택하세요.</p>
                    </div>

                    {/* Version Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Target Version</label>
                        <select 
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--primary)] outline-none"
                            value={selectedVersionId ?? ''}
                            onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                        >
                            {versions?.map(v => (
                                <option key={v.id} value={v.id}>v{v.versionNumber} ({v.model})</option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 cursor-pointer mt-2 group">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${compareMode ? 'bg-blue-500 border-blue-500' : 'border-white/30 group-hover:border-white/50'}`}>
                                {compareMode && <span className="material-symbols-outlined text-[10px] text-white font-bold">check</span>}
                            </div>
                            <input type="checkbox" className="hidden" checked={compareMode} onChange={e => setCompareMode(e.target.checked)} />
                            <span className="text-xs text-gray-300 group-hover:text-white transition-colors">운영 버전과 비교 (Compare)</span>
                        </label>
                        {compareMode && !release?.activeVersionId && (
                            <p className="text-[10px] text-amber-400 mt-1">⚠️ 운영 버전이 없습니다.</p>
                        )}
                    </div>

                    <div className="h-px bg-white/10" />

                    {/* Dataset Selector */}
                    <div className="space-y-2 flex-1">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Dataset</label>
                            <button className="text-[10px] text-[var(--primary)] hover:underline">+ NEW</button>
                        </div>
                        <div className="space-y-1 overflow-y-auto max-h-[300px] pr-1">
                            {datasets?.map(ds => (
                                <button
                                    key={ds.id}
                                    onClick={() => setSelectedDatasetId(ds.id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all border ${
                                        selectedDatasetId === ds.id 
                                            ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-white font-medium shadow-[0_0_10px_rgba(168,85,247,0.15)]' 
                                            : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-gray-200'
                                    }`}
                                >
                                    {ds.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Primary Action */}
                    <div className="mt-auto pt-4">
                        <button 
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2"
                            onClick={() => setActiveTab('RESULT')}
                        >
                            <span className="material-symbols-outlined">play_arrow</span>
                            RUN EVALUATION
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Workspace */}
            <div className="flex-1 glass-card rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                {/* Workspace Tabs */}
                <div className="flex items-center gap-1 px-4 pt-3 border-b border-white/10 bg-black/20">
                    <button 
                        onClick={() => setActiveTab('EDITOR')}
                        className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
                            activeTab === 'EDITOR' 
                                ? 'bg-white/10 text-white border-t border-x border-white/10' 
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                    >
                        <span className="mr-2">📝</span>데이터 편집 (Editor)
                    </button>
                    <button 
                        onClick={() => setActiveTab('RESULT')}
                        className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
                            activeTab === 'RESULT' 
                                ? 'bg-white/10 text-white border-t border-x border-white/10' 
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                    >
                        <span className="mr-2">📊</span>실행 결과 (Result)
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden relative bg-black/10">
                    {activeTab === 'EDITOR' ? (
                        <UnifiedDatasetEditor 
                            workspaceId={workspaceId}
                            promptId={promptId}
                            datasetId={selectedDatasetId}
                        />
                    ) : (
                        <UnifiedRunViewer 
                            workspaceId={workspaceId}
                            promptId={promptId}
                            datasetId={selectedDatasetId}
                            versionId={selectedVersionId}
                            compareMode={compareMode}
                            providerCredentials={providerCredentials}
                            versions={versions}
                            activeRelease={release}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Sub Components ---

function UnifiedDatasetEditor({ workspaceId, promptId, datasetId }: { workspaceId: number, promptId: number, datasetId: number | null }) {
    const queryClient = useQueryClient();
    const [rows, setRows] = useState<CaseFormRow[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({});

    const { data: cases, isLoading } = useQuery({
        queryKey: ['evalDatasetCases', workspaceId, promptId, datasetId],
        queryFn: async () => {
            if (!datasetId) return [];
            return (await promptApi.getEvalDatasetCases(workspaceId, promptId, datasetId)).data;
        },
        enabled: !!datasetId,
    });

    useEffect(() => {
        if (cases && cases.length > 0) {
            const formRows: CaseFormRow[] = cases.map(c => ({
                id: String(c.id),
                externalId: c.externalId || '',
                input: c.input,
                contextJsonText: c.contextJson ? JSON.stringify(c.contextJson, null, 2) : '',
                expectedJsonText: c.expectedJson ? JSON.stringify(c.expectedJson, null, 2) : '',
                constraintsJsonText: c.constraintsJson ? JSON.stringify(c.constraintsJson, null, 2) : '',
            }));
            setRows(formRows);
        } else {
            setRows([createEmptyCaseFormRow()]);
        }
    }, [cases]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!datasetId) throw new Error('데이터셋이 선택되지 않았습니다.');
            const testCases = parseCaseRows(rows);
            return await promptApi.bulkUploadEvalDatasetCases(workspaceId, promptId, datasetId, {
                testCases,
                replaceExisting: true
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['evalDatasetCases', workspaceId, promptId, datasetId] });
            alert('저장되었습니다.');
        },
        onError: (err: any) => alert('저장 실패: ' + err.message)
    });

    const updateRow = (id: string, field: keyof CaseFormRow, val: string) => 
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
    
    const _parse = (txt: string) => { try { return JSON.parse(txt) || {} } catch { return {} } };
    const _updateJson = (id: string, field: keyof CaseFormRow, updater: (prev: any) => any) => {
        setRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            const cur = _parse(r[field as string]);
            return { ...r, [field]: JSON.stringify(updater(cur), null, 2) };
        }));
    };

    const handlers = {
        updateCaseRow: (id: string, f: any, v: string) => updateRow(id, f, v),
        setContextLanguage: (id: string, v: string) => _updateJson(id, 'contextJsonText', o => ({...o, lang: v})),
        setCaseArrayField: (id: string, f: any, k: string, v: string[]) => _updateJson(id, f, o => { const n={...o}; if(v.length) n[k]=v; else delete n[k]; return n; }),
        setCaseBooleanFlag: (id: string, k: string, v: boolean) => _updateJson(id, 'expectedJsonText', o => { const f=o.structure_flags||{}; if(v) f[k]=true; else delete f[k]; return {...o, structure_flags: f} }),
        setConstraintMaxChars: (id: string, v: string) => _updateJson(id, 'constraintsJsonText', o => ({...o, max_chars: v?Number(v):undefined})),
        setConstraintLanguage: (id: string, v: string) => _updateJson(id, 'constraintsJsonText', o => ({...o, allowed_language: v})),
        setConstraintKeywordNormalization: (id: string, v: boolean) => _updateJson(id, 'constraintsJsonText', o => ({...o, keyword_normalization: v?'BASIC':undefined})),
        setConstraintJsonOnly: (id: string, v: boolean) => _updateJson(id, 'constraintsJsonText', o => ({...o, format: v?'json_only':undefined})),
        updateCaseJsonObject: (id: string, f: any, u: any) => _updateJson(id, f, u),
        removeCaseRow: (id: string) => setRows(prev => prev.filter(r => r.id !== id)),
        setExpandedEditorCaseId: setExpandedId,
        setAdvancedJsonOpenByRow: setAdvancedOpen,
    };

    if (!datasetId) return <div className="h-full flex items-center justify-center text-gray-500">좌측에서 데이터셋을 선택해주세요.</div>;
    if (isLoading) return <div className="p-8 text-gray-500">로딩 중...</div>;

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
                <h4 className="text-white font-bold">데이터셋 편집 ({rows.length}건)</h4>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setRows(prev => [...prev, createEmptyCaseFormRow()])}
                        className="px-3 py-1.5 rounded-lg border border-white/20 text-xs text-white hover:bg-white/10"
                    >
                        + 추가
                    </button>
                    <button 
                        onClick={() => saveMutation.mutate()}
                        className="px-4 py-1.5 rounded-lg bg-[var(--primary)] text-black text-xs font-bold hover:opacity-90"
                    >
                        {saveMutation.isPending ? '저장 중...' : '변경사항 저장'}
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {rows.map((row, idx) => (
                    <CaseEditorRow 
                        key={row.id} 
                        row={row} 
                        idx={idx} 
                        caseFormRowsLength={rows.length}
                        expandedEditorCaseId={expandedId}
                        advancedJsonOpenByRow={advancedOpen}
                        {...handlers} 
                    />
                ))}
            </div>
        </div>
    );
}

function UnifiedRunViewer({ workspaceId, promptId, datasetId, versionId, compareMode, providerCredentials, versions, activeRelease }: any) {
    const [runId, setRunId] = useState<number | null>(null);
    const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);

    const { data: run } = useQuery({
        queryKey: ['evalRun', workspaceId, promptId, runId],
        queryFn: async () => runId ? (await promptApi.getEvalRuns(workspaceId, promptId)).data.find(r => r.id === runId) : null,
        enabled: !!runId,
        refetchInterval: (data) => data?.status === 'RUNNING' || data?.status === 'QUEUED' ? 2000 : false
    });

    const { data: cases } = useQuery({
        queryKey: ['evalRunCases', workspaceId, promptId, runId],
        queryFn: async () => runId ? (await promptApi.getEvalRunCases(workspaceId, promptId, runId, 0, 100)).data.content : [],
        enabled: !!runId,
        refetchInterval: (data) => run?.status === 'RUNNING' ? 2000 : false
    });

    const startRun = useMutation({
        mutationFn: async () => {
            if (!datasetId || !versionId) throw new Error('설정 확인 필요');

            // Check Provider Keys
            const requiredProviders = new Set<string>();
            const targetVersion = versions?.find((v: any) => v.id === versionId);
            if (targetVersion?.provider) requiredProviders.add(String(targetVersion.provider));
            
            if (compareMode) {
                const activeVersion = versions?.find((v: any) => v.id === activeRelease?.activeVersionId);
                if (activeVersion?.provider) requiredProviders.add(String(activeVersion.provider));
            }
            requiredProviders.add('OPENAI'); // Judge

            const creds = providerCredentials || [];
            const normalize = (v: string) => (v || '').trim().toUpperCase();
            const missing = Array.from(requiredProviders).filter(req => 
                !creds.some((c: any) => normalize(c.provider) === normalize(req) && c.status === 'ACTIVE')
            );

            if (missing.length > 0) {
                throw new Error(`Provider Key가 없습니다: ${missing.join(', ')}. 설정에서 키를 등록해주세요.`);
            }

            const res = await promptApi.createEvalRun(workspaceId, promptId, {
                datasetId,
                promptVersionId: versionId,
                mode: compareMode ? 'COMPARE_ACTIVE' : 'CANDIDATE_ONLY',
                rubricTemplateCode: 'GENERAL_TEXT'
            });
            return res.data.id;
        },
        onSuccess: (id) => { setRunId(id); setSelectedCaseId(null); },
        onError: (e: any) => {
            const msg = e.response?.data?.message || e.message || '알 수 없는 오류가 발생했습니다.';
            alert(`실행 실패: ${msg}`);
        }
    });

    if (!runId) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-4xl text-gray-500">play_arrow</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">평가 실행 준비 완료</h3>
                <p className="text-gray-400 mb-8 max-w-md">
                    좌측 패널에서 데이터셋과 버전을 선택한 후, 아래 버튼을 눌러 평가를 시작하세요.
                </p>
                <button
                    onClick={() => startRun.mutate()}
                    disabled={startRun.isPending || !datasetId || !versionId}
                    className="px-8 py-4 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-lg shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:shadow-[0_0_50px_rgba(124,58,237,0.6)] hover:scale-105 transition-all disabled:opacity-50 disabled:transform-none"
                >
                    {startRun.isPending ? '시작 중...' : '지금 실행하기'}
                </button>
            </div>
        );
    }

    const isRunning = run?.status === 'RUNNING' || run?.status === 'QUEUED';
    const progress = cases ? Math.round((cases.filter((c: any) => c.status === 'COMPLETED').length / (run?.totalCases || 1)) * 100) : 0;

    return (
        <div className="flex h-full">
            {/* Left: Case List */}
            <div className="w-80 border-r border-white/10 flex flex-col bg-black/20">
                <div className="p-4 border-b border-white/10">
                    <div className="flex justify-between items-center mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${isRunning ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>
                            {isRunning ? `RUNNING ${progress}%` : 'COMPLETED'}
                        </span>
                        <span className="text-xs text-gray-500">#{runId}</span>
                    </div>
                    {isRunning && (
                        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto">
                    {cases?.map((c: any) => (
                        <div 
                            key={c.id}
                            onClick={() => setSelectedCaseId(c.id)}
                            className={`p-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${selectedCaseId === c.id ? 'bg-white/10 border-l-2 border-l-[var(--primary)]' : ''}`}
                        >
                            <div className="flex justify-between mb-1">
                                <span className="text-xs font-mono text-gray-400">#{c.testCaseId}</span>
                                <span className={`text-[10px] px-1.5 rounded ${c.pass ? 'bg-emerald-500/20 text-emerald-300' : c.pass === false ? 'bg-rose-500/20 text-rose-300' : 'bg-gray-700 text-gray-400'}`}>
                                    {c.status === 'COMPLETED' ? (c.pass ? 'PASS' : 'FAIL') : c.status}
                                </span>
                            </div>
                            <div className="text-xs text-gray-300 truncate">{c.input}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Detail */}
            <div className="flex-1 overflow-y-auto bg-black/10 p-6">
                {selectedCaseId && cases ? (
                    <CaseDetailPanel 
                        item={cases.find((c: any) => c.id === selectedCaseId)} 
                        inputText={cases.find((c: any) => c.id === selectedCaseId)?.input}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        케이스를 선택하여 상세 결과를 확인하세요.
                    </div>
                )}
            </div>
        </div>
    );
}
