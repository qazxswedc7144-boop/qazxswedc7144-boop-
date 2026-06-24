import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { financialApiClient } from '@/shared/network/idempotency';
import { db } from '@/core/db';

interface User {
  id: string;
  username: string;
  role: string;
  tenantId: string | null;
  isActive: boolean;
  lastLoginAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: {
    id: string;
    name: string;
    role: string;
    email: string;
    tenantId: string | null;
  } | null;
  accessToken: string | null;
  refreshTokenState: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ user: User; accessToken: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string>;
  signInWithEmail: () => Promise<{ data: { user: null }; error: null }>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  authenticationEnabled: boolean;
  setAuthenticationEnabled: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BYPASS_USER: User = {
  id: "local-admin",
  role: "ADMIN",
  username: "Administrator",
  tenantId: "local-tenant-01",
  isActive: true
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authenticationEnabled, setAuthenticationEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem('pharmaflow_auth_enabled');
    return stored === 'true'; // Defaults to false
  });

  const [user, setUser] = useState<User | null>(() => {
    const authEnabled = localStorage.getItem('pharmaflow_auth_enabled') === 'true';
    if (!authEnabled) {
      return BYPASS_USER;
    }
    try {
      const stored = localStorage.getItem('pharmaflow_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const authEnabled = localStorage.getItem('pharmaflow_auth_enabled') === 'true';
    if (!authEnabled) {
      return 'local-admin-token';
    }
    return localStorage.getItem('pharmaflow_token');
  });

  const [refreshTokenState, setRefreshTokenState] = useState<string | null>(() => {
    const authEnabled = localStorage.getItem('pharmaflow_auth_enabled') === 'true';
    if (!authEnabled) {
      return 'local-admin-refresh-token';
    }
    return localStorage.getItem('pharmaflow_refresh_token');
  });

  const [loading, setLoading] = useState(false);

  // Synchronize initial local storage session with useAuthStore on mount
  useEffect(() => {
    if (user && accessToken) {
      useAuthStore.getState().login(user, accessToken);
    } else {
      useAuthStore.getState().logout();
    }
  }, [user, accessToken]);

  // Load and sync authenticationEnabled status from Dexie on mount
  useEffect(() => {
    const syncWithDexie = async () => {
      try {
        const item = await db.systemSettings.get('authenticationEnabled');
        if (item !== undefined) {
          const isEnabled = item.value === true;
          setAuthenticationEnabledState(isEnabled);
          localStorage.setItem('pharmaflow_auth_enabled', isEnabled ? 'true' : 'false');
          
          if (!isEnabled) {
            setUser(BYPASS_USER);
            setAccessToken('local-admin-token');
            setRefreshTokenState('local-admin-refresh-token');
            useAuthStore.getState().login(BYPASS_USER, 'local-admin-token');
          }
        }
      } catch (e) {
        console.error("Failed to load authenticationEnabled from Dexie systemSettings:", e);
      }
    };
    syncWithDexie();
  }, []);

  const logout = useCallback(async () => {
    if (localStorage.getItem('pharmaflow_auth_enabled') !== 'true') {
      // No logout allowed/needed in bypass mode
      return;
    }
    setLoading(true);
    try {
      const currentRefresh = localStorage.getItem('pharmaflow_refresh_token');
      if (currentRefresh) {
        await axios.post('/api/auth/logout', { refreshToken: currentRefresh }).catch(() => {});
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('pharmaflow_token');
      localStorage.removeItem('pharmaflow_refresh_token');
      localStorage.removeItem('pharmaflow_user');

      setAccessToken(null);
      setRefreshTokenState(null);
      setUser(null);

      useAuthStore.getState().logout();
      setLoading(false);
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<string> => {
    const currentRefresh = localStorage.getItem('pharmaflow_refresh_token');
    if (!currentRefresh) {
      await logout();
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post('/api/auth/refresh', { refreshToken: currentRefresh });
      const { accessToken: newAccess, refreshToken: newRefresh, user: newUser } = response.data;

      localStorage.setItem('pharmaflow_token', newAccess);
      localStorage.setItem('pharmaflow_refresh_token', newRefresh);
      localStorage.setItem('pharmaflow_user', JSON.stringify(newUser));

      setAccessToken(newAccess);
      setRefreshTokenState(newRefresh);
      setUser(newUser);

      useAuthStore.getState().login(newUser, newAccess);

      return newAccess;
    } catch (err) {
      await logout();
      throw err;
    }
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      const { accessToken: access, refreshToken: refresh, user: authenticatedUser } = response.data;

      localStorage.setItem('pharmaflow_token', access);
      localStorage.setItem('pharmaflow_refresh_token', refresh);
      localStorage.setItem('pharmaflow_user', JSON.stringify(authenticatedUser));

      setAccessToken(access);
      setRefreshTokenState(refresh);
      setUser(authenticatedUser);

      // Force-enable authentication configuration on successful login
      localStorage.setItem('pharmaflow_auth_enabled', 'true');
      setAuthenticationEnabledState(true);

      useAuthStore.getState().login(authenticatedUser, access);

      return { user: authenticatedUser, accessToken: access };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithEmail = useCallback(async () => {
    return { data: { user: null }, error: null };
  }, []);

  const refreshProfile = useCallback(async () => {}, []);

  const setAuthenticationEnabled = useCallback(async (enabled: boolean) => {
    localStorage.setItem('pharmaflow_auth_enabled', enabled ? 'true' : 'false');
    setAuthenticationEnabledState(enabled);
    
    try {
      await db.systemSettings.put({ key: 'authenticationEnabled', value: enabled });
    } catch (e) {
      console.error("Failed to persist authenticationEnabled in Dexie systemSettings:", e);
    }

    if (!enabled) {
      // Purge active network tokens
      localStorage.removeItem('pharmaflow_token');
      localStorage.removeItem('pharmaflow_refresh_token');
      localStorage.removeItem('pharmaflow_user');
      
      setUser(BYPASS_USER);
      setAccessToken('local-admin-token');
      setRefreshTokenState('local-admin-refresh-token');
      useAuthStore.getState().login(BYPASS_USER, 'local-admin-token');
    } else {
      // Enable authentication: transition to strictly secure login sequence
      localStorage.removeItem('pharmaflow_token');
      localStorage.removeItem('pharmaflow_refresh_token');
      localStorage.removeItem('pharmaflow_user');
      
      setUser(null);
      setAccessToken(null);
      setRefreshTokenState(null);
      useAuthStore.getState().logout();
    }
  }, []);

  // Set up robust response interceptor for token expiration 401 handling
  useEffect(() => {
    const interceptor = financialApiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const freshToken = await refreshToken();
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${freshToken}`;
            }
            return financialApiClient(originalRequest);
          } catch (refreshErr) {
            await logout();
            return Promise.reject(refreshErr);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      financialApiClient.interceptors.response.eject(interceptor);
    };
  }, [refreshToken, logout]);

  // Derived profile structure for backward compatibility
  const profile = user ? {
    id: user.id,
    name: user.username,
    role: user.role,
    email: `${user.username}@local.host`,
    tenantId: user.tenantId
  } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        accessToken,
        refreshTokenState,
        loading,
        login,
        logout,
        refreshToken,
        signInWithEmail,
        refreshProfile,
        signOut: logout,
        authenticationEnabled,
        setAuthenticationEnabled
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

