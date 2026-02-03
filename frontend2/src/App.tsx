import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { LandingPage_v3 } from '@/pages/LandingPage_v3';
import { LandingPage_v2 } from '@/pages/LandingPage_v2';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { OrganizationDashboardPage } from '@/pages/dashboard/OrganizationDashboardPage';
import { WorkspaceDashboardPage } from '@/pages/dashboard/WorkspaceDashboardPage';
import { PromptEntryPage } from '@/pages/prompt/PromptEntryPage';
import { PromptCreatePage } from '@/pages/prompt/PromptCreatePage';
import { PromptDetailPage } from '@/pages/prompt/PromptDetailPage';
import { DocumentListPage } from '@/pages/document/DocumentListPage';
import { AuthInitializer } from '@/features/auth/components/AuthInitializer';
import { InvitationAcceptPage } from '@/pages/InvitationAcceptPage';
import { SettingsMembersPage } from '@/pages/settings/SettingsMembersPage';
import { SettingsApiKeysPage } from '@/pages/settings/SettingsApiKeysPage';
import { SettingsProviderKeysPage } from '@/pages/settings/SettingsProviderKeysPage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useOrganizationStore } from '@/features/organization/store/organizationStore';
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces';
import { OnboardingPage } from '@/pages/OnboardingPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5분
    },
  },
});

const OrgScopedDashboardLayout = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { currentOrgId, setCurrentOrgId } = useOrganizationStore();

  useEffect(() => {
    if (!orgId) return;
    const parsedOrgId = Number(orgId);
    if (!Number.isNaN(parsedOrgId) && parsedOrgId !== currentOrgId) {
      setCurrentOrgId(parsedOrgId);
    }
  }, [orgId, currentOrgId, setCurrentOrgId]);

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
};

function NavigateToOrgDashboard() {
  const { currentOrgId } = useOrganizationStore();
  const { data: workspaces, isLoading } = useWorkspaces();
  const orgId = currentOrgId ?? workspaces?.[0]?.organizationId;

  if (isLoading) {
    return <div className="p-6 text-gray-500">조직 정보를 불러오는 중...</div>;
  }

  if (!orgId) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to={`/orgs/${orgId}/dashboard`} replace />;
}

function LegacyWorkspaceRedirect() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const location = useLocation();
  const { data: workspaces, isLoading } = useWorkspaces();
  const parsedWorkspaceId = Number(workspaceId);
  const workspace = workspaces?.find((ws) => ws.id === parsedWorkspaceId);

  if (isLoading) {
    return <div className="p-6 text-gray-500">워크스페이스 정보를 불러오는 중...</div>;
  }

  if (!workspace || Number.isNaN(parsedWorkspaceId)) {
    return <Navigate to="/dashboard" replace />;
  }

  const suffix = location.pathname.replace(`/workspaces/${workspaceId}`, '');
  const target = `/orgs/${workspace.organizationId}/workspaces/${parsedWorkspaceId}${suffix}${location.search}`;
  return <Navigate to={target} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage_v3 />} />
          <Route path="/landing-v2" element={<LandingPage_v2 />} />
          <Route path="/landing-v1" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/invitations/accept" element={<InvitationAcceptPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/dashboard" element={<NavigateToOrgDashboard />} />
            <Route path="/workspaces/:workspaceId/*" element={<LegacyWorkspaceRedirect />} />
            <Route path="/orgs/:orgId" element={<OrgScopedDashboardLayout />}>
              <Route path="dashboard" element={<OrganizationDashboardPage />} />
              <Route path="workspaces/:workspaceId" element={<WorkspaceDashboardPage />} />
              <Route path="workspaces/:workspaceId/prompts" element={<PromptEntryPage />} />
              <Route path="workspaces/:workspaceId/prompts/new" element={<PromptCreatePage />} />
              <Route path="workspaces/:workspaceId/prompts/:promptId" element={<PromptDetailPage />} />
              <Route path="workspaces/:workspaceId/documents" element={<DocumentListPage />} />

              {/* Settings Routes (Integrated) */}
              <Route path="settings/members" element={<SettingsMembersPage />} />
              <Route path="settings/api-keys" element={<SettingsApiKeysPage />} />
              <Route path="settings/provider-keys" element={<SettingsProviderKeysPage />} />

              {/* Statistics Dashboard */}
              <Route path="stats" element={<DashboardPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
