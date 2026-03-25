
import React from 'react';
import { Permission } from '../types';
import { authService } from '../services/auth.service';

interface RoleGuardProps {
  children: React.ReactNode;
  permission?: Permission;
  fallback?: React.ReactNode;
  hideOnFailure?: boolean;
}

/**
 * حارس الصلاحيات: يعرض المحتوى فقط إذا كان المستخدم يملك الإذن المطلوب
 */
const RoleGuard: React.FC<RoleGuardProps> = ({ 
  children, 
  permission, 
  fallback,
  hideOnFailure = false 
}) => {
  const hasAccess = permission ? authService.hasPermission(permission) : true;

  if (!hasAccess) {
    if (hideOnFailure) return null;
    return (
      fallback || (
        <div className="p-8 bg-red-50 border-2 border-red-100 rounded-[32px] text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h3 className="text-lg font-black text-red-800">وصول مقيد</h3>
          <p className="text-xs text-red-600 font-bold">عذراً، لا تملك الصلاحيات الكافية للوصول لهذا القسم.</p>
        </div>
      )
    );
  }

  return <>{children}</>;
};

export default RoleGuard;
