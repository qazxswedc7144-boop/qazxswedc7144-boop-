import { db } from '@/core/db';
import { authService } from '@/modules/auth/services/authService';

export interface SystemError {
  id: string;
  errorId: string;
  timestamp: string;
  userId: string;
  tenantId: string;
  branchId: string;
  moduleName: string;
  screenName: string;
  errorMessage: string;
  stackTrace: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  browserInfo: string;
  applicationVersion: string;
}

export const ErrorTrackingService = {
  log: async (params: {
    moduleName: string;
    screenName: string;
    errorMessage: string;
    stackTrace?: string;
    severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  }): Promise<void> => {
    try {
      const user = (authService?.getCurrentUser() || { id: 'unknown', tenantId: 'unknown', branchId: 'unknown' }) as any;
      const systemError: SystemError = {
        id: `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        errorId: `ERR-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: user.id || user.UserId || 'unknown',
        tenantId: user.tenantId || user.TenantId || 'unknown',
        branchId: user.branchId || user.BranchId || 'unknown',
        moduleName: params.moduleName,
        screenName: params.screenName,
        errorMessage: params.errorMessage,
        stackTrace: params.stackTrace || new Error().stack || '',
        severity: params.severity || 'ERROR',
        browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
        applicationVersion: '1.0.0'
      };

      await db.system_errors.put(systemError);
      console.warn(`[ErrorTracker] Exception Logged: ${systemError.id} (${params.errorMessage})`);
    } catch (e) {
      console.error('Failed to write into system_errors log table:', e);
    }
  },

  getAll: async (): Promise<SystemError[]> => {
    try {
      return await db.system_errors.toArray();
    } catch (e) {
      console.error('Failed to retrieve system_errors:', e);
      return [];
    }
  },

  clearAll: async (): Promise<void> => {
    try {
      await db.system_errors.clear();
    } catch (e) {
      console.error('Failed to clear system_errors:', e);
    }
  }
};
