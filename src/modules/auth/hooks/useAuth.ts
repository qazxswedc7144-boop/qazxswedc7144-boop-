import { useState } from 'react';

export function useAuth() {
  const [user] = useState<any>({ id: 'local-user', email: 'local@example.com' });
  const [profile] = useState<any>({
    id: 'local-user',
    name: 'Local Admin',
    role: 'Admin',
    email: 'local@example.com'
  });
  const [loading] = useState(false);

  const signInWithEmail = async () => ({ data: { user: null }, error: null });
  const signOut = async () => {};
  const refreshProfile = async () => {};

  return { user, profile, loading, signInWithEmail, signOut, refreshProfile };
}
