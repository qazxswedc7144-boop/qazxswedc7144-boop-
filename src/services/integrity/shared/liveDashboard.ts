
import { DashboardAggregationService } from '@/services/dashboard/DashboardAggregationService';

export const getLiveMetrics = async () => {
  return await DashboardAggregationService.getLiveFinancials();
};

export const liveDashboardService = {
  subscribeToMetrics: (_callback: (metrics: any) => void) => {
    // Subscription logic
    return () => {};
  },
  refreshMetrics: async () => {
    // Refresh logic
  },
  getLiveMetrics
};
