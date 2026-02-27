import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
    type CaseFormRow,
    type CaseJsonField,
    type JsonObject,
    parseObjectTextLoose,
    toStringArray,
    truncateText,
} from './CaseEditorUtils';
import { buildContextJsonExample } from './templateVariableUtils';

type EditableCaseField = Exclude<keyof CaseFormRow, 'id'>;

interface CaseEditorRowProps {
    row: CaseFormRow;
    idx: number;
    caseCount: number;
    expandedEditorCaseId: string | null;
    setExpandedEditorCaseId: Dispatch<SetStateAction<string | null>>;
    removeCaseRow: (rowId: string) => void;
    updateCaseRow: (rowId: string, field: EditableCaseField, value: string) => void;
    setCaseArrayField: (rowId: string, field: CaseJsonField, key: string, values: string[]) => void;
    setConstraintJsonOnly: (rowId: string, checked: boolean) => void;
    updateCaseJsonObject: (rowId: string, field: CaseJsonField, updater: (current: JsonObject) => JsonObject) => void;
    templateVariables: string[];
    inputBindingVariable: string;
}

type TagTone = 'emerald' | 'sky' | 'rose' | 'neutral';

interface TagListEditorProps {
    values: string[];
    placeholder: string;
    onChange: (values: string[]) => void;
    tone?: TagTone;
}

export function CaseEditorRow({
    row,
    idx,
    caseCount,
    expandedEditorCaseId,
    setExpandedEditorCaseId,
    removeCaseRow,
    updateCaseRow,
    setCaseArrayField,
    setConstraintJsonOnly,
    updateCaseJsonObject,
    templateVariables,
    inputBindingVariable,
}: CaseEditorRowProps) {
    const isExpanded = expandedEditorCaseId === row.id;
    const summaryInput = row.input.trim() ? truncateText(row.input, 50) : '새로운 질문';

    const expectedObj = parseObjectTextLoose(row.expectedJsonText);
    const constraintsObj = parseObjectTextLoose(row.constraintsJsonText);
    const contextObj = parseObjectTextLoose(row.contextJsonText);
    const versionTemplateVariables = templateVariables.filter((key) => key.trim().length > 0);
    const contextTemplateVariables = versionTemplateVariables.filter((key) => key !== inputBindingVariable);
    const contextJsonPlaceholder = `예: ${buildContextJsonExample(contextTemplateVariables)}`;

    const mustCover = toStringArray(expectedObj.must_cover);
    const mustInclude = toStringArray(constraintsObj.must_include);
    const mustNotInclude = toStringArray(constraintsObj.must_not_include);
    const requiredKeys = toStringArray(constraintsObj.required_keys);

    const jsonOnly = constraintsObj.format === 'json_only';
    const maxChars = toInputNumber(constraintsObj.max_chars);
    const maxLines = toInputNumber(constraintsObj.max_lines);
    const normalization = String(constraintsObj.keyword_normalization ?? '').toUpperCase() === 'BASIC';
    const hasContext = Object.keys(contextObj).length > 0;
    const hasExternalId = row.externalId.trim().length > 0;
    const canDelete = caseCount > 1;

    const conflicts = mustInclude.filter((word) => mustNotInclude.includes(word));

    return (
        <div
            className={`rounded-xl border transition-all duration-200 ${
                isExpanded
                    ? 'bg-[var(--muted)] border-[var(--primary)]/50 shadow-lg'
                    : 'bg-[var(--muted)] border-[var(--border)] hover:border-[var(--ring)]'
            }`}
        >
            <div
                className="flex items-start gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedEditorCaseId(isExpanded ? null : row.id)}
            >
                <div className="mt-1 w-6 h-6 rounded-full bg-[var(--muted)] flex items-center justify-center text-[10px] text-[var(--text-secondary)] shrink-0 font-mono">
                    {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm ${row.input ? 'text-[var(--foreground)]' : 'text-[var(--text-secondary)] italic'}`}>{summaryInput}</p>
                    {!isExpanded && (
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                            {mustCover.length > 0 && (
                                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    AI기준 {mustCover.length}개
                                </span>
                            )}
                            {(mustInclude.length > 0 || mustNotInclude.length > 0) && (
                                <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                                    키워드 {mustInclude.length + mustNotInclude.length}개
                                </span>
                            )}
                            {jsonOnly && (
                                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    JSON
                                </span>
                            )}
                            {(maxChars || maxLines) && (
                                <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--muted)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                                    길이체크
                                </span>
                            )}
                            {hasContext && (
                                <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                    Context 있음
                                </span>
                            )}
                            {hasExternalId && (
                                <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--accent)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                                    ID: {row.externalId.trim()}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {isExpanded && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            if (canDelete) {
                                removeCaseRow(row.id);
                            }
                        }}
                        className={`p-1 ${canDelete ? 'text-gray-500 hover:text-rose-400' : 'text-gray-600 cursor-not-allowed'}`}
                        title={canDelete ? '삭제' : '최소 1개 케이스는 필요합니다'}
                        disabled={!canDelete}
                    >
                        <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                )}
                <span className="material-symbols-outlined text-gray-500 text-sm mt-1">
                    {isExpanded ? 'expand_less' : 'expand_more'}
                </span>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-[var(--primary)]">chat_bubble</span>
                            질문 (핵심 입력)
                        </label>
                        <textarea
                            className="w-full bg-[var(--input)] border border-[var(--border)] rounded-xl px-4 py-4 text-base text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/40 outline-none resize-y min-h-[140px] shadow-inner"
                            placeholder="모델에게 던질 질문을 입력하세요. (예: 환불 규정 알려줘)"
                            value={row.input}
                            onChange={(event) => updateCaseRow(row.id, 'input', event.target.value)}
                            autoFocus
                        />
                        <p className="text-[11px] text-gray-500">
                            질문이 이 케이스의 기준점입니다. 먼저 질문을 충분히 명확하게 작성하세요.
                        </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-4 space-y-5">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">보조 설정</p>
                            <span className="text-[10px] text-gray-500">AI 기준 · 룰 · 컨텍스트</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-[var(--text-secondary)]">외부 식별자 (선택)</label>
                                <input
                                    className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30 outline-none"
                                    placeholder="테스트 케이스를 추적할 고유 ID를 입력하세요 (예: refund_policy_kr_001)"
                                    value={row.externalId}
                                    onChange={(event) => updateCaseRow(row.id, 'externalId', event.target.value)}
                                />
                                <p className="text-[10px] text-[var(--text-secondary)]">
                                    결과/로그에서 케이스를 식별할 때 사용합니다. 영문, 숫자, '-', '_' 조합을 권장합니다.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-[var(--text-secondary)]">추가 Context (JSON, 나머지 변수 입력)</label>
                                <textarea
                                    className="w-full bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30 outline-none resize-y min-h-[74px] font-mono"
                                    placeholder={contextJsonPlaceholder}
                                    value={row.contextJsonText}
                                    onChange={(event) => updateCaseRow(row.id, 'contextJsonText', event.target.value)}
                                />
                                <p className="text-[10px] text-[var(--text-secondary)]">
                                    {`질문(핵심 입력)은 {{${inputBindingVariable}}}로 자동 매핑됩니다. 나머지 변수는 JSON key/value로 입력하세요.`}
                                </p>
                                {contextTemplateVariables.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {contextTemplateVariables.map((key) => (
                                            <span
                                                key={key}
                                                className="text-[10px] px-2 py-0.5 rounded border bg-[var(--accent)] border-[var(--border)] text-[var(--text-secondary)] font-mono"
                                            >
                                                {`{{${key}}}`}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-[var(--text-secondary)]">
                                        현재 템플릿은 추가로 입력할 변수가 없습니다.
                                    </p>
                                )}
                                {!isJsonTextValid(row.contextJsonText) && (
                                    <p className="text-[10px] text-rose-400">유효한 JSON 형식이 아닙니다. 저장 시 빈 객체로 처리됩니다.</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-emerald-400">psychology</span>
                                AI 정답 가이드 (Expected)
                            </label>
                            <span className="text-[10px] text-gray-500">LLM Judge가 평가하는 기준입니다.</span>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                            <TagListEditor
                                placeholder="예: 7일 이내 환불 가능 안내 필수 (Enter)"
                                values={mustCover}
                                onChange={(values) => setCaseArrayField(row.id, 'expectedJsonText', 'must_cover', values)}
                                tone="emerald"
                            />
                        </div>
                    </div>

                        <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-sky-400">rule</span>
                            정밀 룰 체크 (Rules)
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-3">
                                <p className="text-[10px] text-sky-700 dark:text-sky-200 mb-2 font-semibold">필수 포함 단어</p>
                                <TagListEditor
                                    placeholder="예: 환불 (Enter)"
                                    values={mustInclude}
                                    onChange={(values) => setCaseArrayField(row.id, 'constraintsJsonText', 'must_include', values)}
                                    tone="sky"
                                />
                            </div>
                            <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
                                <p className="text-[10px] text-rose-700 dark:text-rose-200 mb-2 font-semibold">금지 단어</p>
                                <TagListEditor
                                    placeholder="예: 죄송 (Enter)"
                                    values={mustNotInclude}
                                    onChange={(values) => setCaseArrayField(row.id, 'constraintsJsonText', 'must_not_include', values)}
                                    tone="rose"
                                />
                            </div>
                        </div>
                        {conflicts.length > 0 && (
                            <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                                <span className="material-symbols-outlined text-sm">warning</span>
                                모순 발견: '{conflicts.join(', ')}' 단어가 필수와 금지에 모두 포함되어 있습니다.
                            </p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-3 space-y-3">
                                <p className="text-[10px] text-[var(--text-secondary)] font-semibold">길이 및 형식 제한</p>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">최대 글자</span>
                                        <input
                                            type="number"
                                            className="w-16 bg-[var(--input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)]"
                                            placeholder="∞"
                                            value={maxChars}
                                            onChange={(event) =>
                                                updateCaseJsonObject(row.id, 'constraintsJsonText', (object) =>
                                                    upsertNumericField(object, 'max_chars', event.target.value)
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">최대 줄수</span>
                                        <input
                                            type="number"
                                            className="w-16 bg-[var(--input)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--foreground)]"
                                            placeholder="∞"
                                            value={maxLines}
                                            onChange={(event) =>
                                                updateCaseJsonObject(row.id, 'constraintsJsonText', (object) =>
                                                    upsertNumericField(object, 'max_lines', event.target.value)
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={normalization}
                                        onChange={(event) =>
                                            updateCaseJsonObject(row.id, 'constraintsJsonText', (object) => {
                                                const next = { ...object };
                                                if (event.target.checked) {
                                                    next.keyword_normalization = 'BASIC';
                                                } else {
                                                    delete next.keyword_normalization;
                                                }
                                                return next;
                                            })
                                        }
                                        className="rounded border-[var(--border)] bg-[var(--accent)]"
                                    />
                                    <span className="text-xs text-gray-400">유연한 비교 (대소문자/공백 무시)</span>
                                </label>
                            </div>

                            <div
                                className={`border rounded-lg p-3 space-y-2 transition-colors ${
                                    jsonOnly ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[var(--muted)] border-[var(--border)]'
                                }`}
                            >
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div
                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                            jsonOnly ? 'bg-amber-500 border-amber-500' : 'border-[var(--border)]'
                                        }`}
                                    >
                                        {jsonOnly && <span className="material-symbols-outlined text-[10px] text-black font-bold">check</span>}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={jsonOnly}
                                        onChange={(event) => setConstraintJsonOnly(row.id, event.target.checked)}
                                    />
                                    <span className={`text-xs font-semibold ${jsonOnly ? 'text-amber-200' : 'text-gray-400'}`}>
                                        JSON 형식 필수 (json_only)
                                    </span>
                                </label>

                                {jsonOnly && (
                                    <div className="animate-in fade-in slide-in-from-top-1">
                                        <p className="text-[10px] text-amber-200/70 mb-1">필수 JSON 키 (Key)</p>
                                        <TagListEditor
                                            placeholder="예: reason (Enter)"
                                            values={requiredKeys}
                                            onChange={(values) => setCaseArrayField(row.id, 'constraintsJsonText', 'required_keys', values)}
                                            tone="neutral"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TagListEditor({ values, placeholder, onChange, tone = 'neutral' }: TagListEditorProps) {
    const [draft, setDraft] = useState('');

    const colors = {
        emerald: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-500/30',
        sky: 'bg-sky-500/20 text-sky-700 dark:text-sky-200 border-sky-500/30',
        rose: 'bg-rose-500/20 text-rose-700 dark:text-rose-200 border-rose-500/30',
        neutral: 'bg-[var(--accent)] text-[var(--text-secondary)] border-[var(--border)]',
    };

    const add = () => {
        const nextValue = draft.trim();
        if (!nextValue) return;
        if (values.includes(nextValue)) {
            setDraft('');
            return;
        }
        onChange([...values, nextValue]);
        setDraft('');
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2 min-h-[26px]">
                {values.map((value, index) => (
                    <span key={`${value}-${index}`} className={`text-xs px-2 py-1 rounded flex items-center gap-1 border ${colors[tone]}`}>
                        {value}
                        <button
                            type="button"
                            onClick={() => onChange(values.filter((_, currentIndex) => currentIndex !== index))}
                            className="hover:text-[var(--foreground)] opacity-60 hover:opacity-100"
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    className="bg-transparent text-xs text-[var(--foreground)] outline-none min-w-[120px] placeholder-[var(--text-secondary)]"
                    placeholder={values.length === 0 ? placeholder : '추가...'}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            add();
                        }
                    }}
                    onBlur={add}
                />
            </div>
        </div>
    );
}

function toInputNumber(value: unknown): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '';
    }
    return String(value);
}

function upsertNumericField(object: JsonObject, key: string, rawValue: string): JsonObject {
    const next = { ...object };
    const trimmed = rawValue.trim();
    if (!trimmed) {
        delete next[key];
        return next;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        delete next[key];
        return next;
    }
    next[key] = parsed;
    return next;
}

function isJsonTextValid(text: string): boolean {
    if (!text.trim()) return true;
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}
