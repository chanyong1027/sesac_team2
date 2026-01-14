import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, extractData } from '@/lib/api-client';
import type { Prompt } from '@/types';
import { PromptOverviewTab } from '@/components/prompts/PromptOverviewTab';
import { PromptVersionsTab } from '@/components/prompts/PromptVersionsTab';
import { PromptReleaseTab } from '@/components/prompts/PromptReleaseTab';
import { PromptPlaygroundTab } from '@/components/prompts/PromptPlaygroundTab';

export default function PromptDetailPage() {
  const { workspaceId, promptId } = useParams<{ workspaceId: string; promptId: string }>();

  const { data: prompt, isLoading } = useQuery({
    queryKey: ['prompt', workspaceId, promptId],
    queryFn: async () => {
      const response = await apiClient.get<Prompt>(
        `/workspaces/${workspaceId}/prompts/${promptId}`
      );
      return extractData(response);
    },
    enabled: !!workspaceId && !!promptId,
  });

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!prompt) {
    return <div>Prompt not found</div>;
  }

  return (
    <div>
      <PageHeader
        title={prompt.name}
        description={prompt.description}
        breadcrumbs={[
          { label: 'Dashboard', href: `/w/${workspaceId}/dashboard` },
          { label: 'Prompts', href: `/w/${workspaceId}/prompts` },
          { label: prompt.promptKey },
        ]}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="release">Release</TabsTrigger>
          <TabsTrigger value="playground">Playground</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PromptOverviewTab prompt={prompt} />
        </TabsContent>

        <TabsContent value="versions">
          <PromptVersionsTab prompt={prompt} />
        </TabsContent>

        <TabsContent value="release">
          <PromptReleaseTab prompt={prompt} />
        </TabsContent>

        <TabsContent value="playground">
          <PromptPlaygroundTab prompt={prompt} />
        </TabsContent>
      </Tabs>
    </div>
  );
}



