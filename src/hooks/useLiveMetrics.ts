import { useLiveQuery } from 'dexie-react-hooks';
import { getLiveMetrics } from '@/core/reports/liveDashboard';

/**
 * useLiveMetrics - Hook for reactive financial metrics
 * Highly efficient: Uses Dexie LiveQuery to watch DB changes directly.
 */
export const useLiveMetrics = () => {
  const metrics = useLiveQuery(async () => {
    return await getLiveMetrics();
  }, [], {
    cash: 0,
    revenue: 0,
    expenses: 0,
    netProfit: 0,
    receivables: 0,
    payables: 0,
    timestamp: new Date().toISOString()
  });

  const isLoading = metrics === undefined;

  return { 
    metrics: metrics || {
      cash: 0,
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      receivables: 0,
      payables: 0,
      timestamp: new Date().toISOString()
    }, 
    isLoading 
  };
};
