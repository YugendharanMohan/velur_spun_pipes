import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

interface Props {
  children: React.ReactNode;
  redirectTo: string;
}

export default function ProtectedRoute({ children, redirectTo }: Props) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
