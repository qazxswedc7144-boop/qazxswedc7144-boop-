
/**
 * Mock Auth Service for Local-Only Operation
 * Replacing Supabase-dependent authService
 */

export const authService = {
  getCurrentUser: () => ({
    id: 'local-user',
    User_Email: 'admin@local.host',
    Role: 'Admin',
    User_Name: 'Admin'
  }),

  isSignedIn: () => true,

  assertPermission: (permission: string, operation: string) => {
    console.log(`Permission ${permission} granted for ${operation} (Local Admin Mode)`);
    return true;
  },

  can: (_permission: string) => true,

  logout: async () => {
    console.log("Logout called in local mode - no action taken");
  }
};
