import { describe, expect, it } from 'vitest';
import { buildContextJsonExample, extractTemplateVariables } from './templateVariableUtils';

describe('templateVariableUtils', () => {
    it('extracts variables from both double and single brace templates', () => {
        const variables = extractTemplateVariables(
            '질문: {{question}} / 상품: {productName}',
            '시스템 컨텍스트: {{tone}} / 언어: {locale}'
        );

        expect(variables).toEqual(['question', 'productName', 'tone', 'locale']);
    });

    it('deduplicates repeated variables', () => {
        const variables = extractTemplateVariables(
            '{{question}}',
            '질문: {question}'
        );

        expect(variables).toEqual(['question']);
    });

    it('returns empty JSON example when no keys exist', () => {
        expect(buildContextJsonExample([])).toBe('{}');
    });
});
