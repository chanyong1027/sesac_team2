import { PromptEvaluateUnified } from './PromptEvaluateUnified';

interface PromptEvaluateTabProps {
    workspaceId: number;
    promptId: number;
}

export function PromptEvaluateTab({ workspaceId, promptId }: PromptEvaluateTabProps) {
    return (
        <div className="space-y-6">
            <PromptEvaluateUnified workspaceId={workspaceId} promptId={promptId} />
        </div>
    );
}
