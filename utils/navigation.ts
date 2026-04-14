import { useCallback } from 'react';

export function useSafeNavigation() {
  const go = useCallback((view: string, params: any = null) => {
    const url = params?.id ? `#/${view}/${params.id}` : `#/${view}`;
    window.location.hash = url;
  }, []);

  return {
    goDashboard: () => go('dashboard'),
    goDebts: () => go('aging-report'),
    goReports: () => go('reports'),
    go: (view: string, params?: any) => go(view, params)
  };
}
