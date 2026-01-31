import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { LandingPage_v3 } from '@/pages/LandingPage_v3';
import { LandingPage_v2 } from '@/pages/LandingPage_v2';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { OrganizationDashboardPage } from '@/pages/dashboard/OrganizationDashboardPage';
import { WorkspaceDashboardPage } from '@/pages/dashboard/WorkspaceDashboardPage';
import { PromptListPage } from '@/pages/prompt/PromptListPage';
import { PromptCreatePage } from '@/pages/prompt/PromptCreatePage';
import { PromptDetailPage } from '@/pages/prompt/PromptDetailPage';
import { DocumentListPage } from '@/pages/document/DocumentListPage';
import { AuthInitializer } from '@/features/auth/components/AuthInitializer';
// import { DashboardPage } from '@/pages/DashboardPage'; // Deprecated
// import { WorkspaceDetailPage } from '@/pages/WorkspaceDetailPage'; // Deprecated
import { InvitationAcceptPage } from '@/pages/InvitationAcceptPage';
// import { SettingsLayout } from '@/pages/settings/SettingsLayout';
import { SettingsMembersPage } from '@/pages/settings/SettingsMembersPage';
import { SettingsApiKeysPage } from '@/pages/settings/SettingsApiKeysPage';
import { SettingsProviderKeysPage } from '@/pages/settings/SettingsProviderKeysPage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5분
    },
  },
});

const DashboardLayoutWrapper = () => (
  <DashboardLayout>
    <Outlet />
  </DashboardLayout>
);

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
            <Route element={<DashboardLayoutWrapper />}>
              <Route path="/dashboard" element={<OrganizationDashboardPage />} />
              <Route path="/workspaces/:id" element={<WorkspaceDashboardPage />} />
              <Route path="/workspaces/:id/prompts" element={<PromptListPage />} />
              <Route path="/workspaces/:id/prompts/new" element={<PromptCreatePage />} />
              <Route path="/workspaces/:id/prompts/:promptId" element={<PromptDetailPage />} />
              <Route path="/workspaces/:id/documents" element={<DocumentListPage />} />

              {/* Settings Routes (Integrated) */}
              <Route path="/settings/members" element={<SettingsMembersPage />} />
              <Route path="/settings/api-keys" element={<SettingsApiKeysPage />} />
              <Route path="/settings/provider-keys" element={<SettingsProviderKeysPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
