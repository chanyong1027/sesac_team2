import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, extractData, ApiClientError, isFieldErrorDetails } from '@/lib/api-client';
import type { OnboardingStep, PromptTemplate, Provider, OnboardingWizardRequest } from '@/types';

const wizardSchema = z.object({
  provider: z.string().min(1, 'Provider is required.'),
  providerApiKey: z.string().min(6, 'API key is required.'),
  templateId: z.string().min(1, 'Template is required.'),
  promptKey: z.string().min(3, 'Prompt key is required.'),
  promptName: z.string().min(2, 'Prompt name is required.'),
});

type WizardForm = z.infer<typeof wizardSchema>;

const providers: Provider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'AZURE_OPENAI', 'COHERE'];

export default function OnboardingPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const { data: steps, isLoading: stepsLoading } = useQuery({
    queryKey: ['onboarding-tour'],
    queryFn: async () => {
      const response = await apiClient.get<OnboardingStep[]>('/onboarding/tour');
      return extractData(response);
    },
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['prompt-templates'],
    queryFn: async () => {
      const response = await apiClient.get<PromptTemplate[]>('/prompt-templates');
      return extractData(response);
    },
  });

  const form = useForm<WizardForm>({
    resolver: zodResolver(wizardSchema),
  });

  const applyTemplate = useMutation({
    mutationFn: async (payload: { templateId: string; promptKey: string; name: string }) => {
      const response = await apiClient.post<{ id: string }>(
        `/workspaces/${workspaceId}/prompt-templates/${payload.templateId}/apply`,
        { promptKey: payload.promptKey, name: payload.name }
      );
      return extractData(response);
    },
    onSuccess: () => {
      toast.success('Template applied.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to apply template.');
    },
  });

  const runWizard = useMutation({
    mutationFn: async (payload: OnboardingWizardRequest) => {
      const response = await apiClient.post<{ success: boolean }>(
        `/workspaces/${workspaceId}/onboarding/wizard`,
        payload
      );
      return extractData(response);
    },
    onSuccess: () => {
      toast.success('Wizard completed.');
      form.reset();
    },
    onError: (error) => {
      if (error instanceof ApiClientError && isFieldErrorDetails(error.details)) {
        Object.entries(error.details).forEach(([key, messages]) => {
          form.setError(key as keyof WizardForm, { message: messages?.[0] });
        });
      }
      toast.error(error instanceof Error ? error.message : 'Wizard failed.');
    },
  });

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Complete the guided setup and apply templates."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Setup steps</CardTitle>
            <CardDescription>Track your progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stepsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              steps?.map((step) => (
                <div key={step.id} className="rounded-lg border p-3">
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.completed ? 'Completed' : 'Pending'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>1-minute setup wizard</CardTitle>
            <CardDescription>Connect a provider and deploy a template.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((data) =>
                runWizard.mutate({
                  provider: data.provider as Provider,
                  providerApiKey: data.providerApiKey,
                  templateId: data.templateId,
                  promptKey: data.promptKey,
                  promptName: data.promptName,
                })
              )}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select id="provider" {...form.register('provider')}>
                    <option value="">Select provider</option>
                    {providers.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </Select>
                  {form.formState.errors.provider && (
                    <p className="text-sm text-destructive">{form.formState.errors.provider.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="providerApiKey">Provider API key</Label>
                  <Input id="providerApiKey" type="password" {...form.register('providerApiKey')} />
                  {form.formState.errors.providerApiKey && (
                    <p className="text-sm text-destructive">{form.formState.errors.providerApiKey.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateId">Template</Label>
                <Select id="templateId" {...form.register('templateId')}>
                  <option value="">Select template</option>
                  {templates?.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.category}
                    </option>
                  ))}
                </Select>
                {form.formState.errors.templateId && (
                  <p className="text-sm text-destructive">{form.formState.errors.templateId.message}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="promptKey">Prompt key</Label>
                  <Input id="promptKey" {...form.register('promptKey')} placeholder="support-bot" />
                  {form.formState.errors.promptKey && (
                    <p className="text-sm text-destructive">{form.formState.errors.promptKey.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promptName">Prompt name</Label>
                  <Input id="promptName" {...form.register('promptName')} placeholder="Support Bot" />
                  {form.formState.errors.promptName && (
                    <p className="text-sm text-destructive">{form.formState.errors.promptName.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={runWizard.isPending}>
                  {runWizard.isPending ? 'Running...' : 'Create and test'}
                </Button>
              </div>
            </form>

            <div className="mt-6">
              <h3 className="text-sm font-medium">Templates</h3>
              {templatesLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {templates?.map((template) => (
                    <Card key={template.id}>
                      <CardHeader>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">Model: {template.model}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() =>
                            applyTemplate.mutate({
                              templateId: template.id,
                              promptKey: `${template.name.toLowerCase().replace(/\s+/g, '-')}-prompt`,
                              name: template.name,
                            })
                          }
                        >
                          Apply template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



