import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import WorkspacesPage from './pages/workspaces/WorkspacesPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import PromptsListPage from './pages/prompts/PromptsListPage';
import PromptDetailPage from './pages/prompts/PromptDetailPage';
import CreatePromptPage from './pages/prompts/CreatePromptPage';
import LogsPage from './pages/logs/LogsPage';
import LogDetailPage from './pages/logs/LogDetailPage';
import SettingsApiKeysPage from './pages/settings/SettingsApiKeysPage';
import SettingsProviderKeysPage from './pages/settings/SettingsProviderKeysPage';
import SettingsMembersPage from './pages/settings/SettingsMembersPage';
import OnboardingPage from './pages/onboarding/OnboardingPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            
            {/* Workspace routes with shell */}
            <Route path="/w/:workspaceId" element={<AppShell />}>
              <Route path="dashboard" element={<DashboardPage />} />
              
              <Route path="prompts" element={<PromptsListPage />} />
              <Route path="prompts/new" element={<CreatePromptPage />} />
              <Route path="prompts/:promptId" element={<PromptDetailPage />} />
              
              <Route path="logs" element={<LogsPage />} />
              <Route path="logs/:traceId" element={<LogDetailPage />} />
              
              <Route path="settings/api-keys" element={<SettingsApiKeysPage />} />
              <Route path="settings/provider-keys" element={<SettingsProviderKeysPage />} />
              <Route path="settings/members" element={<SettingsMembersPage />} />
            </Route>
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </>
  );
}

function RootRedirect() {
  const workspaceId = localStorage.getItem('workspaceId');
  const token = localStorage.getItem('accessToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (workspaceId) {
    return <Navigate to={`/w/${workspaceId}/dashboard`} replace />;
  }

  return <Navigate to="/workspaces" replace />;
}
