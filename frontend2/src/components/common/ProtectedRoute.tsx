import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // 현재 경로를 state로 전달하여 로그인 후 돌아올 수 있도록
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
