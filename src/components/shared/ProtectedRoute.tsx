import React, { useEffect, useState } from 'react';
import { Permission } from '@/types';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { can } from '@/utils/permissions';
import LoginPage from '@/modules/auth/pages/LoginPage';
import { ShieldAlert, Home } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: Permission;
}

/**
 * ProtectedRoute: Enforces secure authentications and correct role permissions.
 * - Redirects to /login if not authenticated.
 * - Redirects to /403 if role lacks permission.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const { user, accessToken, profile, loading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      const authed = !!(user && accessToken && user.isActive !== false);
      setIsAuthenticated(authed);
      
      if (!authed) {
        if (window.location.hash !== '#/login') {
          window.location.hash = '#/login';
        }
      } else {
        const permitted = permission ? can(profile?.role, permission) : true;
        setHasPermission(permitted);
        if (!permitted) {
          if (window.location.hash !== '#/403') {
            window.location.hash = '#/403';
          }
        }
      }
    }
  }, [user, accessToken, profile, loading, permission]);

  if (loading || isAuthenticated === null || (isAuthenticated && hasPermission === null)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If not authenticated: redirect /login
  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => { window.location.hash = '#/dashboard'; }} />;
  }

  // If role lacks permission: redirect /403
  if (!hasPermission) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white border border-slate-100 rounded-[32px] shadow-sm max-w-lg mx-auto my-12" dir="rtl">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-rose-200/40">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-black text-[#1E4D4D] mb-2">وصول مقيد (403)</h2>
        <p className="text-xs font-bold text-slate-400 max-w-sm leading-relaxed mb-6">
          عذراً، ليست لديك صلاحيات أمنية كافية للدخول إلى هذا القسم من المنظومة السيادية. تم تسجيل هذه التجربة كجزء من سجل التدقيق الأمني.
        </p>
        <div className="flex gap-3 justify-center w-full">
          <button 
            onClick={() => { window.location.hash = '#/dashboard'; }}
            className="flex-1 bg-[#1E4D4D] hover:bg-teal-900 text-white font-black text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-900/10"
          >
            <Home size={16} />
            <span>العودة للوحة التحكم</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
