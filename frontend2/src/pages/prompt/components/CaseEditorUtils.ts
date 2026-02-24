import type { EvalTestCaseCreateRequest } from '@/types/api.types';

export type CaseFormRow = {
    id: string;
    externalId: string;
    input: string;
    contextJsonText: string;
    expectedJsonText: string;
    constraintsJsonText: string;
};

export type CaseJsonField = 'contextJsonText' | 'expectedJsonText' | 'constraintsJsonText';

export type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasKeys(value: JsonObject): boolean {
    return Object.keys(value).length > 0;
}

export function parseObjectTextLoose(text: string): JsonObject {
    try {
        const parsed: unknown = JSON.parse(text || '{}');
        return isJsonObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item) => item != null)
        .map((item) => String(item));
}

export function truncateText(text: string, len: number): string {
    return text.length > len ? `${text.slice(0, len)}...` : text;
}

export function createEmptyCaseFormRow(nextId?: string): CaseFormRow {
    return {
        id: nextId ?? `case-${Math.random().toString(36).slice(2, 11)}`,
        externalId: '',
        input: '',
        contextJsonText: '',
        expectedJsonText: '',
        constraintsJsonText: '',
    };
}

export function parseCaseRows(rows: CaseFormRow[]): EvalTestCaseCreateRequest[] {
    if (rows.length === 0) {
        throw new Error('최소 1개 이상의 케이스가 필요합니다.');
    }

    return rows.map((row) => {
        if (!row.input.trim()) {
            throw new Error('질문(Input)은 필수입니다.');
        }

        const contextJson = parseObjectTextLoose(row.contextJsonText);
        const expectedJson = parseObjectTextLoose(row.expectedJsonText);
        const constraintsJson = parseObjectTextLoose(row.constraintsJsonText);

        return {
            externalId: row.externalId.trim() ? row.externalId.trim() : undefined,
            input: row.input,
            contextJson: hasKeys(contextJson) ? contextJson : undefined,
            expectedJson: hasKeys(expectedJson) ? expectedJson : undefined,
            constraintsJson: hasKeys(constraintsJson) ? constraintsJson : undefined,
        };
    });
}
