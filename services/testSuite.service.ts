
import { FinancialEngine } from './financialEngine';
import { logger } from './logger.service';

/**
 * Internal Test Suite - محرك الاختبارات الذاتية
 * يقوم بمحاكاة العمليات المالية والتأكد من النتائج المتوقعة
 */
export const testSuite = {
  
  async runAllTests(): Promise<{ passed: number; failed: number; reports: string[] }> {
    const reports: string[] = [];
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, name: string) => {
      if (condition) {
        passed++;
        reports.push(`✅ ${name}`);
      } else {
        failed++;
        reports.push(`❌ ${name}`);
        logger.critical("فشل اختبار نظام", "TestSuite", `الاختبار [${name}] لم ينجح، يرجى فحص الكود.`);
      }
    };

    // 1. اختبار توازن القيود (Journal Balancing)
    assert(
      FinancialEngine.isBalanced([
        { id: '1', lineId: '1', entryId: 'T', accountId: 'A', accountName: 'Test', debit: 500, credit: 0, amount: 500, type: 'DEBIT' },
        { id: '2', lineId: '2', entryId: 'T', accountId: 'B', accountName: 'Test', debit: 0, credit: 500, amount: 500, type: 'CREDIT' }
      ]),
      "محرك توازن القيود"
    );

    // 2. اختبار منطق الأرباح (Profit Calculation Logic)
    const profit = FinancialEngine.calculateNetProfit(1000, 700, 100);
    assert(profit === 200, "دقة حساب صافي الربح");

    // 3. اختبار وسم النزاهة (Integrity Signature Simulation)
    // سيتم إضافته لاحقاً عند ربط الـ Hashing

    return { passed, failed, reports };
  }
};
