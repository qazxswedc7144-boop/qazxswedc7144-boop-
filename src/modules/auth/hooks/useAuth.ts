import { useState, useEffect } from 'react';

export function useAuth() {
  const [simulatedRole, setSimulatedRole] = useState(() => {
    return localStorage.getItem('pharmaflow_simulated_role') || 'Admin';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setSimulatedRole(localStorage.getItem('pharmaflow_simulated_role') || 'Admin');
    };
    window.addEventListener('storage', handleStorageChange);
    // Also poll occasionally to react instantly on same-tab changes
    const interval = setInterval(handleStorageChange, 500);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const [user] = useState<any>({ id: 'local-user', email: 'local@example.com' });
  
  const profile = {
    id: 'local-user',
    name: 'Local Admin',
    role: simulatedRole,
    email: 'local@example.com'
  };

  const [loading] = useState(false);

  const signInWithEmail = async () => ({ data: { user: null }, error: null });
  const signOut = async () => {
    localStorage.removeItem('pharmaflow_simulated_role');
    window.location.reload();
  };
  const refreshProfile = async () => {};

  return { user, profile, loading, signInWithEmail, signOut, refreshProfile };
}
