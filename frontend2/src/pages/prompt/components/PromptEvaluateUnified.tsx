import { PromptEvalStudio } from './PromptEvalStudio';

interface PromptEvaluateUnifiedProps {
    workspaceId: number;
    promptId: number;
}

export function PromptEvaluateUnified({ workspaceId, promptId }: PromptEvaluateUnifiedProps) {
    return <PromptEvalStudio workspaceId={workspaceId} promptId={promptId} />;
}
