import { db } from '../../lib/database';

/**
 * محرك التقارير المحاسبية المتقدم - Reporting Engine
 * يعتمد على الأرصدة المباشرة من دفتر الأستاذ (Ledger) لتقديم أداء فوري
 */

/**
 * تقرير الأرباح والخسائر (Profit & Loss)
 * يقيس الأداء المالي خلال فترة معينة بناءً على الإيرادات والمصروفات
 */
export const getProfitLoss = async () => {
  const accounts = (await db.accounts?.toArray()) || [];

  let revenue = 0;
  let expenses = 0;

  if (Array.isArray(accounts)) {
    for (const acc of accounts) {
      if (acc.type === "revenue") {
        revenue += acc.balance || 0;
      }
      if (acc.type === "expense") {
        expenses += acc.balance || 0;
      }
    }
  }

  // ملاحظة: الأرصدة في الميزانية عادة ما تكون مدينة أو دائنة. 
  // هنا نتعامل مع القيم المطلقة للتبسيط في التقارير الأولية
  return {
    revenue: Math.abs(revenue),
    expenses: Math.abs(expenses),
    netProfit: Math.abs(revenue) - Math.abs(expenses)
  };
};

/**
 * الميزانية العمومية (Balance Sheet)
 * تعكس الحالة المالية للنظام في لحظة معينة: الأصول = الخصوم + حقوق الملكية
 */
export const getBalanceSheet = async () => {
  const accounts = (await db.accounts?.toArray()) || [];

  let assets = 0;
  let liabilities = 0;
  let equity = 0;

  if (Array.isArray(accounts)) {
    for (const acc of accounts) {
      if (acc.type === "assets") {
        assets += acc.balance || 0;
      }
      if (acc.type === "liabilities") {
        liabilities += acc.balance || 0;
      }
      if (acc.type === "equity") {
        equity += acc.balance || 0;
      }
    }
  }

  return {
    assets: Math.abs(assets),
    liabilities: Math.abs(liabilities),
    equity: Math.abs(equity),
    // المعادلة المحاسبية الأساسية
    isBalanced: Math.abs(assets) === (Math.abs(liabilities) + Math.abs(equity))
  };
};

/**
 * تقرير التدفق النقدي (Cash Flow)
 * يعرض السيولة النقدية المتوفرة حالياً في الصندوق
 */
export const getCashFlow = async () => {
  const cash = await db.accounts.get("cash");

  return {
    currentCash: cash?.balance || 0
  };
};

/**
 * ملخص مالي سريع للوحة التحكم
 */
export const getFinancialSummary = async () => {
  const [pl, bs, cf] = await Promise.all([
    getProfitLoss(),
    getBalanceSheet(),
    getCashFlow()
  ]);

  return {
    revenue: pl.revenue,
    netProfit: pl.netProfit,
    cashOnHand: cf.currentCash,
    totalAssets: bs.assets,
    isBalanced: bs.isBalanced
  };
};
