import { useState, useEffect } from 'react';
import { authService } from '../services/auth.service';

export function useAuth() {
  const [user, setUser] = useState<any>({ id: 'local-admin-123', email: 'admin@pharmaflow.local' });
  const [profile, setProfile] = useState<any>({ id: 'local-admin-123', name: 'مدير الصيدلية', role: 'Admin', email: 'admin@pharmaflow.local' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Sync local synchronous cache for legacy parts
    authService.setLocalUserCache(profile);
  }, [profile]);

  const signInWithEmail = async (email: string, password: string) => {
    return { data: { user, session: {} }, error: null };
  };

  const signOut = async () => {
    // Just a placeholder since auth is bypassed
    console.log("Offline mode: Sign out clicked");
  };

  const refreshProfile = async () => {
    // Do nothing in offline mode
  };

  return { user, profile, loading, signInWithEmail, signOut, refreshProfile };
}
