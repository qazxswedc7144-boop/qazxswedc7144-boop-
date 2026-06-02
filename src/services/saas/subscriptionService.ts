// src/services/saas/subscriptionService.ts
import { db } from "@/core/db";

export interface SubscriptionStatus {
  isActive: boolean;
  isTrial: boolean;
  planCode: 'TRIAL' | 'BASIC' | 'BUSINESS' | 'ENTERPRISE';
  planName: string;
  currentUsage: number;
  maxLimit: number;
  remaining: number;
  isBlocked: boolean;
  isWarning: boolean;
  expiresAt: string;
  allowedBranches: number;
  allowedUsers: number;
}

export class SubscriptionService {
  /**
   * Calculates structural operations performed by active tenant.
   * Scans local IndexedDB tables for high-integrity audit.
   */
  static async getLocalUsageCount(): Promise<number> {
    try {
      // Operations counted: sales, purchases, transfers, returns
      const invoices = await db.invoices.toArray();
      const salesCount = invoices.filter(i => i.type === 'SALE' && !i.isReturn).length;
      const purchasesCount = invoices.filter(i => i.type === 'PURCHASE').length;
      const returnsCount = invoices.filter(i => i.isReturn).length;
      const transfersCount = await db.branchTransfers.count();

      // Get any offset stored for demo testing
      const simOffset = parseInt(localStorage.getItem('saas_demo_usage_offset') || '0', 10);

      const actualTransactions = salesCount + purchasesCount + returnsCount + transfersCount;
      return actualTransactions + simOffset;
    } catch (e) {
      console.warn("[SaaS Local Count] Dexie query skipped during sync fallback:", e);
      return parseInt(localStorage.getItem('saas_demo_simulated_count') || '45', 10);
    }
  }

  /**
   * Retrieves full subscription metadata context and evaluates blockade states.
   */
  static async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const usage = await this.getLocalUsageCount();
    const plan = localStorage.getItem('saas_active_plan') || 'TRIAL';
    const expires = localStorage.getItem('saas_active_expiry') || '2027-01-01';

    let maxLimit = 200;
    let planName = 'نسخة تجريبية مجانية';

    if (plan === 'BASIC') {
      maxLimit = 10000;
      planName = 'الخطة الأساسية';
    } else if (plan === 'BUSINESS') {
      maxLimit = 50000;
      planName = 'خطة الأعمال المتقدمة';
    } else if (plan === 'ENTERPRISE') {
      maxLimit = 999999;
      planName = 'خطة المؤسسات القوية';
    }

    const isTrial = plan === 'TRIAL';
    const currentUsage = usage;
    const remaining = Math.max(0, maxLimit - currentUsage);
    
    // License block evaluation bounds
    const isBlocked = isTrial && currentUsage >= maxLimit;
    const isWarning = isTrial && currentUsage >= 180 && currentUsage < maxLimit;

    const allowedBranches = plan === 'TRIAL' ? 1 : plan === 'BASIC' ? 2 : plan === 'BUSINESS' ? 4 : 12;
    const allowedUsers = plan === 'TRIAL' ? 1 : plan === 'BASIC' ? 4 : plan === 'BUSINESS' ? 12 : 50;

    return {
      isActive: true,
      isTrial,
      planCode: plan as any,
      planName,
      currentUsage,
      maxLimit,
      remaining,
      isBlocked,
      isWarning,
      expiresAt: expires,
      allowedBranches,
      allowedUsers
    };
  }

  /**
   * Safe set for sim testing
   */
  static setDemoUsageOffset(offset: number) {
    localStorage.setItem('saas_demo_usage_offset', String(offset));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('saas-usage-updated'));
  }

  /**
   * Set Active Plan
   */
  static setPlan(planCode: 'TRIAL' | 'BASIC' | 'BUSINESS' | 'ENTERPRISE') {
    localStorage.setItem('saas_active_plan', planCode);
    if (planCode === 'TRIAL') {
      localStorage.setItem('saas_active_expiry', '2026-07-02');
    } else {
      localStorage.setItem('saas_active_expiry', '2027-01-01');
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('saas-usage-updated'));
  }
}
