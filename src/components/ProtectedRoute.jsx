
import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const RouteLoadingState = () => (
  <div
    className="min-h-screen flex items-center justify-center bg-background px-4"
    role="status"
    aria-live="polite"
    aria-label="Memeriksa hak akses akun"
  >
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="h-11 w-11 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-700 dark:border-t-slate-200" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        Menyiapkan dashboard...
      </p>
    </div>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, profileLoading, role } = useAuth();
  const location = useLocation();
  const roleIsAllowed = !allowedRoles || allowedRoles.includes(role);
  // Track whether initial authorization has been granted at least once.
  // Once true, background profile refreshes must NOT unmount children.
  const hasAuthorized = useRef(false);

  useEffect(() => {
    console.log('ProtectedRoute mounting/updating', {
      path: location.pathname,
      isLoading: loading,
      isProfileLoading: profileLoading,
      isAuthenticated: !!user,
      userId: user?.id,
      role,
      allowedRoles,
    });
  }, [user, loading, profileLoading, location, role, allowedRoles]);

  // Record first successful authorization
  if (user && role && roleIsAllowed) {
    hasAuthorized.current = true;
  }

  // Initial auth and role resolution are one authorization phase. Waiting for
  // both prevents a valid user from briefly seeing the forbidden state.
  if (loading) {
    return <RouteLoadingState />;
  }

  if (!user) {
    // Only redirect to login if we haven't previously authorized in this session.
    // If we have, the user is just refreshing their profile in background.
    if (hasAuthorized.current) {
      // Keep current children mounted — do not flash to login mid-session.
      return children;
    }
    console.log('Unauthorized access attempt to', location.pathname, '- Redirecting to /login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // While profile is loading in the background after initial auth,
  // keep existing children mounted with their current role.
  if (profileLoading && hasAuthorized.current) {
    return children;
  }

  if (profileLoading) {
    return <RouteLoadingState />;
  }

  if (!roleIsAllowed) {
    console.warn('Forbidden route access attempt', {
      path: location.pathname,
      role,
      allowedRoles,
    });

    if (location.pathname !== '/dashboard') {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <ShieldAlert className="mx-auto mb-4 h-9 w-9 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <h1 className="mb-2 text-xl font-bold text-slate-950 dark:text-slate-50">Akses Ditolak</h1>
          <p className="text-slate-600 dark:text-slate-300">
            Akun Anda tidak memiliki izin untuk membuka halaman ini.
          </p>
        </div>
      </div>
    );
  }

  console.log('Access granted to protected route:', location.pathname);
  return children;
};

export default ProtectedRoute;
