import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, extractData } from '@/lib/api-client';
import type { Prompt, PromptStatus } from '@/types';
import { formatDate } from '@/lib/utils';

export default function PromptsListPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PromptStatus | 'ALL'>('ALL');
  const [includeActiveRelease, setIncludeActiveRelease] = useState('ALL');

  const { data: prompts, isLoading } = useQuery({
    queryKey: ['prompts', workspaceId, includeActiveRelease],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (includeActiveRelease !== 'ALL') {
        query.set('includeActiveRelease', includeActiveRelease);
      }
      const response = await apiClient.get<Prompt[]>(
        `/workspaces/${workspaceId}/prompts${query.toString() ? `?${query}` : ''}`
      );
      return extractData(response);
    },
    enabled: !!workspaceId,
  });

  const filteredPrompts = prompts?.filter((prompt) => {
    const matchesSearch =
      prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.promptKey.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || prompt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusVariant = (status: PromptStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PAUSED':
        return 'secondary';
      case 'ARCHIVED':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <div>
      <PageHeader
        title="Prompts"
        description="Manage PromptKeys, versions, and releases."
        breadcrumbs={[
          { label: 'Dashboard', href: `/w/${workspaceId}/dashboard` },
          { label: 'Prompts' },
        ]}
        actions={
          <Button onClick={() => navigate(`/w/${workspaceId}/prompts/new`)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Prompt
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PromptStatus | 'ALL')}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={includeActiveRelease}
            onChange={(e) => setIncludeActiveRelease(e.target.value)}
          >
            <option value="ALL">All Releases</option>
            <option value="true">Active Release Only</option>
            <option value="false">No Active Release</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prompt Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active Version</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrompts && filteredPrompts.length > 0 ? (
                filteredPrompts.map((prompt) => (
                  <TableRow
                    key={prompt.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/w/${workspaceId}/prompts/${prompt.id}`)}
                  >
                    <TableCell className="font-mono text-sm">{prompt.promptKey}</TableCell>
                    <TableCell className="font-medium">{prompt.name}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(prompt.status)}>{prompt.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {prompt.activeVersionId || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {prompt.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {prompt.tags && prompt.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{prompt.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(prompt.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {searchQuery || statusFilter !== 'ALL'
                      ? 'No prompts found matching your filters.'
                      : 'No prompts yet. Create your first prompt to get started.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}



