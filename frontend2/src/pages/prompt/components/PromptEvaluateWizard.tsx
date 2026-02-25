import { PromptEvalStudio } from './PromptEvalStudio';

interface PromptEvaluateWizardProps {
    workspaceId: number;
    promptId: number;
}

export function PromptEvaluateWizard({ workspaceId, promptId }: PromptEvaluateWizardProps) {
    return <PromptEvalStudio workspaceId={workspaceId} promptId={promptId} />;
}
