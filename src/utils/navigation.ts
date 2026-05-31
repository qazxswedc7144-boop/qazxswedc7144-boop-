
export const ROUTES = {
  DASHBOARD: '/',
  SALES: '/sales',
  PURCHASES: '/purchases',
  INVENTORY: '/inventory',
  ACCOUNTING: '/accounting',
  REPORTS: '/reports',
  SETTINGS: '/settings',
};

export const navigateTo = (path: string) => {
  window.location.hash = path;
};

export function useSafeNavigation() {
  return {
    navigate: (path: string) => navigateTo(path),
    goBack: () => window.history.back(),
    goDebts: () => navigateTo(ROUTES.ACCOUNTING),
    goReports: () => navigateTo(ROUTES.REPORTS),
    goDashboard: () => navigateTo(ROUTES.DASHBOARD),
  };
}
