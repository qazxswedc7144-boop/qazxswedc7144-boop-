// server/modules/consolidation/consolidation.types.ts

export interface ConsolidatedBalanceSheet {
  timestamp: string;
  assets: {
    cashAndCashEquivalents: number;
    accountsReceivable: number;
    inventoryValue: number;
    otherCurrentAssets: number;
    nonCurrentAssets: number;
    totalAssets: number;
  };
  liabilities: {
    accountsPayable: number;
    otherCurrentLiabilities: number;
    nonCurrentLiabilities: number;
    totalLiabilities: number;
  };
  equity: {
    shareCapital: number;
    retainedEarnings: number;
    totalEquity: number;
  };
  isBalanced: boolean;
  branchBreakdown: {
    [branchId: string]: {
      branchName: string;
      assets: number;
      liabilities: number;
      equity: number;
    };
  };
  eliminations: EliminationRecord[];
}

export interface ConsolidatedIncomeStatement {
  timestamp: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: {
    salary: number;
    rent: number;
    utilities: number;
    marketing: number;
    other: number;
    totalOPEX: number;
  };
  operatingProfit: number;
  tax: number;
  netIncome: number;
  branchBreakdown: {
    [branchId: string]: {
      branchName: string;
      revenue: number;
      cogs: number;
      grossProfit: number;
      opex: number;
      netIncome: number;
    };
  };
  eliminations: EliminationRecord[];
}

export interface ConsolidatedCashFlow {
  timestamp: string;
  operatingActivities: {
    cashInflowSales: number;
    cashOutflowInventory: number;
    cashOutflowOPEX: number;
    netOperatingCash: number;
  };
  investingActivities: {
    capitalExpenditure: number;
    netInvestingCash: number;
  };
  financingActivities: {
    equityIssued: number;
    debtServicing: number;
    netFinancingCash: number;
  };
  netChangeInCash: number;
  beginningCashBalance: number;
  endingCashBalance: number;
  branchBreakdown: {
    [branchId: string]: {
      branchName: string;
      netOperating: number;
      netInvesting: number;
      netFinancing: number;
      endingChange: number;
    };
  };
  eliminations: EliminationRecord[];
}

export interface ConsolidatedTrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  netBalance: number; // Positive for Debit preference, Negative for Credit preference depending on standard rules
  balanceType: "DEBIT" | "CREDIT";
  branchBreakdowns: {
    [branchId: string]: {
      branchName: string;
      debit: number;
      credit: number;
      netBalance: number;
    };
  };
}

export interface ConsolidatedTrialBalance {
  timestamp: string;
  rows: ConsolidatedTrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  eliminations: EliminationRecord[];
}

export interface ConsolidatedInventoryValuation {
  timestamp: string;
  totalInventoryQuantity: number;
  totalInventoryValue: number;
  averageItemCost: number;
  uniqueSKUsCount: number;
  branchBreakdown: {
    [branchId: string]: {
      branchName: string;
      quantity: number;
      value: number;
      percentageOfTotal: number;
    };
  };
  slowMovingProducts: Array<{
    id: string;
    sku: string;
    name: string;
    stockQuantity: number;
    cost: number;
    totalValue: number;
    daysSinceLastSale: number;
  }>;
  fastMovingProducts: Array<{
    id: string;
    sku: string;
    name: string;
    salesVolume: number;
    revenueGenerated: number;
    stockQuantity: number;
    turnoverRate: number; // ratio of sales to current stock
  }>;
  deadStock: Array<{
    id: string;
    sku: string;
    name: string;
    stockQuantity: number;
    cost: number;
    totalValue: number;
    expiryDate: string | null;
    status: "EXPIRED" | "EXPIRING_SOON" | "NO_SALES";
  }>;
}

export interface EliminationRecord {
  id: string;
  type: "TRANSFER" | "INTERNAL_SALE" | "INTERNAL_PURCHASE" | "INTERNAL_MOVEMENT";
  description: string;
  amount: number;
  referenceId?: string;
  sourceId?: string;
  targetId?: string;
  timestamp: string;
}

export interface AIConsolidationInsights {
  revenueGrowthTrends: string;
  profitabilityAnalysis: string;
  inventoryTurnoverAnalysis: string;
  stockRiskWarnings: string[];
  reorderRecommendations: Array<{
    productId: string;
    sku: string;
    productName: string;
    currentStock: number;
    reorderQuantity: number;
    percentageGap: number;
  }>;
}

export interface ConsolidationSummary {
  runId: string;
  timestamp: string;
  aggregateRevenue: number;
  aggregateNetIncome: number;
  aggregateAssets: number;
  aggregateLiabilities: number;
  aggregateEquity: number;
  aggregateInventoryValue: number;
  totalEliminationsDone: number;
  activeBranchesCount: number;
  insights: AIConsolidationInsights;
}
