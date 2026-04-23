
import { db } from '../lib/database';
import { SystemAlert, PerformanceMetric } from '../types';
import { LoadTestService } from './LoadTestService';

import { IS_PREVIEW } from '../constants';

export class IntegritySweepService {
  
  /**
   * Main entry point to run the integrity sweep
   */
  static async runSweep(autoFix = false): Promise<boolean> {
    console.log(`Starting Integrity Sweep (autoFix: ${autoFix})...`);
    const startTime = performance.now();
    let isHealthy = true;
    const errors: string[] = [];

    try {
      // 1. Validate Journal Balance
      try {
        const journalBalance = await this.validateJournal(autoFix);
        if (!journalBalance) {
          isHealthy = false;
          errors.push("Journal imbalance detected (Debits != Credits)");
        }
      } catch (e) { console.error("Journal check failed", e); }

      // 2. Validate Stock Balance
      try {
        const stockBalance = await this.validateStock(autoFix);
        if (!stockBalance) {
          isHealthy = false;
          errors.push("Stock balance mismatch detected (Transactions != StockQuantity)");
        }
      } catch (e) { console.error("Stock check failed", e); }

      // 3. Validate AR/AP Consistency
      try {
        const arapConsistency = await this.validateARAP(autoFix);
        if (!arapConsistency) {
          isHealthy = false;
          errors.push("AR/AP consistency mismatch detected");
        }
      } catch (e) { console.error("AR/AP check failed", e); }

      // 4. Validate No Orphan References
      try {
        const noOrphans = await this.validateOrphans(autoFix);
        if (!noOrphans) {
          isHealthy = false;
          errors.push("Orphan references detected in transactions");
        }
      } catch (e) { console.error("Orphans check failed", e); }

      // 5. Validate Voucher Consistency
      try {
        const voucherConsistency = await this.validateVouchers(autoFix);
        if (!voucherConsistency) {
          isHealthy = false;
          errors.push("Voucher allocation inconsistency detected");
        }
      } catch (e) { console.error("Voucher check failed", e); }

      // 6. Validate Date Formats (New)
      try {
        const datesHealthy = await this.validateDates(autoFix);
        if (!datesHealthy) {
          isHealthy = false;
          errors.push("Malformed date strings detected in records");
        }
      } catch (e) { console.error("Date check failed", e); }

      if (!isHealthy) {
        await this.handleCriticalError(errors);
      }

      const endTime = performance.now();
      await LoadTestService.logMetric("INTEGRITY_SWEEP_TIME", Math.round(endTime - startTime), { isHealthy, errors });
      
      console.log(`Integrity Sweep Completed. Healthy: ${isHealthy}`);
      return isHealthy;
    } catch (error) {
      console.error("Integrity Sweep Failed:", error);
      return false;
    }
  }

  private static async validateJournal(autoFix = false): Promise<boolean> {
    const entries = await db.getJournalEntries();
    let healthy = true;
    for (const entry of entries) {
      const debits = entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const credits = entry.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
      if (Math.abs(debits - credits) > 0.01) {
        if (autoFix && entry.id) {
          console.warn(`AUTO_FIX: Deleting imbalanced journal entry [${entry.id}]`);
          await db.db.journalEntries.delete(entry.id);
        } else if (!autoFix) {
          healthy = false;
        }
      }
    }
    return healthy;
  }

  private static async validateStock(autoFix = false): Promise<boolean> {
    const products = await db.getProducts();
    let healthy = true;
    for (const p of products) {
      if (!p.id) continue;
      const transactions = await db.db.inventoryTransactions.where('productId').equals(p.id).toArray();
      const calculatedStock = transactions.reduce((sum, t) => sum + (t.QuantityChange || 0), 0);
      
      if (Math.abs(calculatedStock - p.StockQuantity) > 0.01) {
        if (autoFix && p.id) {
          console.warn(`AUTO_FIX: Correcting stock for [${p.Name}] from ${p.StockQuantity} to ${calculatedStock}`);
          await db.db.products.update(p.id, { StockQuantity: calculatedStock });
        } else if (!autoFix) {
          healthy = false;
        }
      }
    }
    return healthy;
  }

  private static async validateARAP(autoFix = false): Promise<boolean> {
    const sales = await db.getSales();
    let healthy = true;

    for (const s of sales) {
      if (s.InvoiceStatus === 'CANCELLED') continue;
      const balance = s.finalTotal - (s.paidAmount || 0);
      if (balance < -0.01) {
        if (autoFix && s.id) {
          console.warn(`AUTO_FIX: Correcting overpaid sale [${s.SaleID}]`);
          await db.db.sales.update(s.id, { paidAmount: s.finalTotal });
        } else if (!autoFix) {
          healthy = false;
        }
      }
    }

    const purchases = await db.getPurchases();
    for (const p of purchases) {
      if (p.invoiceStatus === 'CANCELLED') continue;
      const balance = p.totalAmount - (p.paidAmount || 0);
      if (balance < -0.01) {
        if (autoFix && p.id) {
          console.warn(`AUTO_FIX: Correcting overpaid purchase [${p.invoiceId}]`);
          await db.db.purchases.update(p.id, { paidAmount: p.totalAmount });
        } else if (!autoFix) {
          healthy = false;
        }
      }
    }

    return healthy;
  }

  private static async validateOrphans(autoFix = false): Promise<boolean> {
    const transactions = await db.db.inventoryTransactions.toArray();
    let healthy = true;
    for (const t of transactions) {
      if (t.SourceDocumentType === 'SALE') {
        const sale = await db.db.sales.get(t.SourceDocumentID);
        if (!sale) {
          if (autoFix) {
            console.warn(`AUTO_FIX: Deleting orphan inventory transaction [${t.TransactionID}]`);
            await db.db.inventoryTransactions.delete(t.TransactionID);
          } else {
            healthy = false;
          }
        }
      } else if (t.SourceDocumentType === 'PURCHASE') {
        const purchase = await db.db.purchases.get(t.SourceDocumentID);
        if (!purchase) {
          if (autoFix) {
            console.warn(`AUTO_FIX: Deleting orphan inventory transaction [${t.TransactionID}]`);
            await db.db.inventoryTransactions.delete(t.TransactionID);
          } else {
            healthy = false;
          }
        }
      }
    }
    return healthy;
  }

  private static async validateVouchers(autoFix = false): Promise<boolean> {
    const settlements = await db.db.settlements.toArray();
    const cashFlow = await db.getCashFlow();
    const vouchers = cashFlow.filter(c => c.notes?.includes('سند #'));
    let healthy = true;

    for (const v of vouchers) {
      const vIdMatch = v.notes?.match(/سند #([A-Z0-9-]+)/);
      if (vIdMatch) {
        const vId = vIdMatch[1];
        const vSettlements = settlements.filter(s => s.voucherId === vId);
        const settledTotal = vSettlements.reduce((sum, s) => sum + s.amount, 0);
        if (settledTotal > v.amount + 0.01) {
          if (autoFix) {
            console.warn(`AUTO_FIX: Correcting over-allocated voucher #${vId}`);
            // Simple fix: delete settlements for this voucher to allow re-allocation
            await db.db.settlements.bulkDelete(vSettlements.map(s => s.id));
          } else {
            healthy = false;
          }
        }
      }
    }
    return healthy;
  }

  private static async validateDates(autoFix = false): Promise<boolean> {
    const tables = [
      'sales', 'purchases', 'journalEntries', 'Audit_Log', 'financialTransactions', 
      'inventoryTransactions', 'cashFlow', 'settlements', 'Accounting_Periods',
      'systemAlerts', 'systemPerformanceLog', 'userBehavior', 'historicalMetrics'
    ] as const;
    let healthy = true;

    for (const tableName of tables) {
      const table = (db.db as any)[tableName];
      if (!table) continue;

      try {
        const records = await table.toArray();
        for (const record of records) {
          // Check common date fields
          const dateFields = ['date', 'TransactionDate', 'timestamp', 'Created_At', 'Modified_At', 'Last_Updated', 'deleted_at', 'updatedAt', 'Start_Date', 'End_Date'];
          
          for (const field of dateFields) {
            const dateVal = record[field];
            if (dateVal === undefined || dateVal === null) continue;

            let d: Date;
            if (typeof dateVal === 'number') {
              d = new Date(dateVal);
            } else {
              d = new Date(dateVal);
            }

            if (isNaN(d.getTime())) {
              healthy = false;
              if (autoFix) {
                console.warn(`AUTO_FIX: Repairing invalid date in ${tableName}.${field} for record ${record.id || record.TransactionID || record.Log_ID}`);
                const now = new Date().toISOString();
                const update: any = {};
                update[field] = typeof dateVal === 'number' ? Date.now() : now;
                
                await table.update(record.id || record.TransactionID || record.Log_ID || record.id, update);
              }
            }
          }
        }
      } catch (e) {
        console.error(`Failed to validate dates in table ${tableName}:`, e);
      }
    }
    return healthy;
  }

  private static async handleCriticalError(errors: string[]) {
    const now = new Date().toISOString();
    
    // Check if we already have a recent critical alert for the same issues to prevent flooding
    const recentAlerts = await db.db.systemAlerts
      .where('timestamp').above(new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .filter(a => a.severity === 'CRITICAL')
      .toArray();
    
    if (recentAlerts.length > 0) {
      console.warn("Critical error detected but skipping alert creation to prevent flooding.");
      return;
    }

    // Log CRITICAL_ERROR
    const alert: SystemAlert = {
      id: db.generateId('CRIT'),
      type: 'SYSTEM',
      severity: 'CRITICAL',
      message: `خطأ فادح في نزاهة البيانات: ${errors.join(' | ')}`,
      timestamp: now,
      isRead: false
    };
    await db.db.systemAlerts.put(alert);

    if (IS_PREVIEW) {
      console.warn("PREVIEW GUARD: Critical data integrity failure detected, but bypassing RECOVERY_MODE switch.");
      return;
    }

    // Instead of direct switch, we trigger the AnomalyScoringEngine
    // which will evaluate the overall risk score and decide if RECOVERY_MODE is needed.
    const { AnomalyScoringEngine } = await import('./AnomalyScoringEngine');
    await AnomalyScoringEngine.calculateCurrentRiskScore();
    
    console.error("CRITICAL ERROR DETECTED: AnomalyScoringEngine triggered to evaluate system safety. 🛡️");
  }
}
