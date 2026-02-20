import { useState } from 'react';

// --- Types ---
export type CaseFormRow = {
    id: string;
    externalId: string;
    input: string;
    contextJsonText: string;
    expectedJsonText: string;
    constraintsJsonText: string;
};

export type CaseJsonField = 'contextJsonText' | 'expectedJsonText' | 'constraintsJsonText';

const CASE_LANGUAGE_OPTIONS = [
    { value: '', label: '자동/미지정' },
    { value: 'ko', label: '한국어 (ko)' },
    { value: 'en', label: '영어 (en)' },
    { value: 'ja', label: '일본어 (ja)' },
];

// --- Component ---
export function CaseEditorRow({
    row,
    idx,
    expandedEditorCaseId,
    setExpandedEditorCaseId,
    removeCaseRow,
    caseFormRowsLength,
    advancedJsonOpenByRow,
    setAdvancedJsonOpenByRow,
    updateCaseRow,
    setContextLanguage,
    setCaseArrayField,
    setCaseBooleanFlag,
    setConstraintMaxChars,
    setConstraintLanguage,
    setConstraintKeywordNormalization,
    setConstraintJsonOnly,
    updateCaseJsonObject,
}: {
    row: CaseFormRow;
    idx: number;
    expandedEditorCaseId: string | null;
    setExpandedEditorCaseId: React.Dispatch<React.SetStateAction<string | null>>;
    removeCaseRow: (id: string) => void;
    caseFormRowsLength: number;
    advancedJsonOpenByRow: Record<string, boolean>;
    setAdvancedJsonOpenByRow: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    updateCaseRow: (rowId: string, field: keyof Omit<CaseFormRow, 'id'>, value: string) => void;
    setContextLanguage: (rowId: string, language: string) => void;
    setCaseArrayField: (rowId: string, field: CaseJsonField, key: string, values: string[]) => void;
    setCaseBooleanFlag: (rowId: string, key: string, checked: boolean) => void;
    setConstraintMaxChars: (rowId: string, value: string) => void;
    setConstraintLanguage: (rowId: string, language: string) => void;
    setConstraintKeywordNormalization: (rowId: string, enabled: boolean) => void;
    setConstraintJsonOnly: (rowId: string, checked: boolean) => void;
    updateCaseJsonObject: (
        rowId: string,
        field: CaseJsonField,
        updater: (current: Record<string, any>) => Record<string, any>
    ) => void;
}) {
    const [editorTab, setEditorTab] = useState<'BASIC' | 'AI_CHECK' | 'RULE_CHECK' | 'ADVANCED'>('BASIC');

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
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
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
                        disabled={caseFormRowsLength <= 1}
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
                    {/* Editor Tabs */}
                    <div className="flex items-center gap-1 border-b border-white/10 pb-2 mb-3">
                        <button
                            type="button"
                            onClick={() => setEditorTab('BASIC')}
                            className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
                                editorTab === 'BASIC'
                                    ? 'text-white border-b-2 border-[var(--primary)] bg-white/5'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                        >
                            기본 정보
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditorTab('AI_CHECK')}
                            className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
                                editorTab === 'AI_CHECK'
                                    ? 'text-emerald-300 border-b-2 border-emerald-500 bg-emerald-500/10'
                                    : 'text-gray-400 hover:text-emerald-200 hover:bg-emerald-500/5'
                            }`}
                        >
                            AI 체크 (의미)
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditorTab('RULE_CHECK')}
                            className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
                                editorTab === 'RULE_CHECK'
                                    ? 'text-sky-300 border-b-2 border-sky-500 bg-sky-500/10'
                                    : 'text-gray-400 hover:text-sky-200 hover:bg-sky-500/5'
                            }`}
                        >
                            룰 체크 (형식)
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditorTab('ADVANCED')}
                            className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
                                editorTab === 'ADVANCED'
                                    ? 'text-amber-300 border-b-2 border-amber-500 bg-amber-500/10'
                                    : 'text-gray-400 hover:text-amber-200 hover:bg-amber-500/5'
                            }`}
                        >
                            고급 (JSON)
                        </button>
                    </div>

                    {editorTab === 'BASIC' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
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
                        </div>
                    )}

                    {editorTab === 'AI_CHECK' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
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
                                    필수/금지 키워드(문자 그대로)는 <span className="text-sky-200 font-semibold">룰 체크(형식)</span> 탭에서 설정하세요.
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
                        </div>
                    )}

                    {editorTab === 'RULE_CHECK' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
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
                        </div>
                    )}

                    {editorTab === 'ADVANCED' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                            <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 space-y-3">
                                <p className="text-[11px] uppercase tracking-wide text-amber-300 font-semibold">고급 설정 (JSON 직접 편집)</p>
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
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}

// --- Utils ---

export function createEmptyCaseFormRow(nextId?: string): CaseFormRow {
    // Note: fallback counter logic might need to be handled by parent if IDs are critical
    return {
        id: nextId ?? `case-new-${Math.random().toString(36).substr(2, 9)}`,
        externalId: '',
        input: '',
        contextJsonText: '',
        expectedJsonText: '',
        constraintsJsonText: '',
    };
}

export function parseCaseRows(rows: CaseFormRow[]): any[] {
    if (!rows || rows.length === 0) return [];
    return rows.map((row, idx) => {
        const caseNo = idx + 1;
        const input = row.input.trim();
        if (!input) throw new Error(`${caseNo}번 케이스의 input은 필수입니다.`);
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
    if (!trimmed) return undefined;
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

// --- Helpers ---

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

function toStringArray(value: any): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => item != null).map((item) => String(item));
}

function isObject(value: any): value is Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function toNullableNumber(value: any): number | null {
    if (value == null || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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

function truncateText(value: string | null | undefined, maxLength: number): string {
    const text = value ?? '';
    if (text.length <= maxLength) {
        return text || '-';
    }
    return `${text.slice(0, maxLength)}...`;
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
