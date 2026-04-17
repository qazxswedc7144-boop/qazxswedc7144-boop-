import { db } from '@/services/database';

/**
 * liveDashboard - Realtime Financial Metrics Engine
 * Highly reactive using Dexie LiveQuery
 */
export const getLiveMetrics = async () => {
  try {
    const accounts = await db.accounts.toArray();

    let cash = 0;
    let revenue = 0;
    let expenses = 0;
    let receivables = 0;
    let payables = 0;

    for (const acc of accounts) {
      if (!acc) continue;
      
      const accId = acc.id?.toLowerCase();
      const accType = acc.type?.toLowerCase();

      // Mapping IDs/Types to logical buckets
      if (accId === "cash") {
        cash = acc.Balance || 0;
      }

      if (accType === "revenue") {
        revenue += acc.Balance || 0;
      }

      if (accType === "expense") {
        expenses += acc.Balance || 0;
      }

      if (accId === "accounts_receivable" || accId === "receivables") {
        receivables = acc.Balance || 0;
      }

      if (accId === "accounts_payable" || accId === "payables") {
        payables = acc.Balance || 0;
      }
    }

    return {
      cash,
      revenue,
      expenses,
      netProfit: revenue - expenses,
      receivables,
      payables,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("[LiveDashboard] Engine Core Error:", error);
    return {
      cash: 0,
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      receivables: 0,
      payables: 0,
      timestamp: new Date().toISOString()
    };
  }
};
