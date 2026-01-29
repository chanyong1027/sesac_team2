import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { LandingPage_v3 } from '@/pages/LandingPage_v3';
import { LandingPage_v2 } from '@/pages/LandingPage_v2';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { WorkspaceDetailPage } from '@/pages/WorkspaceDetailPage';
import { InvitationAcceptPage } from '@/pages/InvitationAcceptPage';
import { SettingsLayout } from '@/pages/settings/SettingsLayout';
import { SettingsMembersPage } from '@/pages/settings/SettingsMembersPage';
import { SettingsApiKeysPage } from '@/pages/settings/SettingsApiKeysPage';
import { SettingsProviderKeysPage } from '@/pages/settings/SettingsProviderKeysPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5분
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/workspaces/:id" element={<WorkspaceDetailPage />} />

            {/* Settings Routes */}
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="/settings/members" replace />} />
              <Route path="members" element={<SettingsMembersPage />} />
              <Route path="api-keys" element={<SettingsApiKeysPage />} />
              <Route path="provider-keys" element={<SettingsProviderKeysPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
