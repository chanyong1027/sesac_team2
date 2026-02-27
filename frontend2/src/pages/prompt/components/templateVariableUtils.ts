export function extractTemplateVariables(...templates: Array<string | null | undefined>): string[] {
    const result = new Set<string>();

    templates.forEach((template) => {
        if (!template) {
            return;
        }

        const doubleBraceMatches = template.match(/\{\{\s*[^{}\s]+\s*\}\}/g) ?? [];
        doubleBraceMatches.forEach((token) => {
            const key = token.replace(/\{\{|\}\}/g, '').trim();
            if (key) {
                result.add(key);
            }
        });

        // Remove double-brace variables first so single-brace pattern does not re-capture them.
        const singleBraceSource = template.replace(/\{\{\s*[^{}\s]+\s*\}\}/g, ' ');
        const singleBraceMatches = singleBraceSource.match(/\{\s*[^{}\s]+\s*\}/g) ?? [];
        singleBraceMatches.forEach((token) => {
            const key = token.replace(/\{|\}/g, '').trim();
            if (key) {
                result.add(key);
            }
        });
    });

    return [...result];
}

export function sampleVariableValue(key: string): string {
    const lower = key.toLowerCase();
    if (lower.includes('locale') || lower.includes('lang')) return 'ko-KR';
    if (lower.includes('product')) return 'premium_plus';
    if (lower.includes('tone')) return '친절한 톤';
    if (lower.includes('category')) return 'refund';
    if (lower.includes('channel')) return 'email';
    if (lower.includes('name')) return '홍길동';
    return `sample_${key}`;
}

export function buildContextJsonExample(keys: string[]): string {
    if (keys.length === 0) {
        return '{}';
    }
    const fields = keys.map((key) => `"${key}":"${sampleVariableValue(key)}"`).join(', ');
    return `{${fields}}`;
}
