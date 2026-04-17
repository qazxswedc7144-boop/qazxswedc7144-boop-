
import { db } from './database';
import { Sale, Purchase, InvoiceItem, SystemAlert } from '../types';
import { AlertCenter } from './AlertCenter';
import { BehaviorMonitor } from './BehaviorMonitor';
import { createSafeDateRange } from '../utils/safeRange';
import { safeWhereEqual } from '../utils/dexieSafe';

export class AIAuditEngine {
  
  static async auditInvoice(type: 'SALE' | 'PURCHASE', invoice: Sale | Purchase, items: InvoiceItem[], userId: string) {
    console.log(`[AI_AuditEngine] Auditing ${type} Invoice #${invoice.id}...`);
    
    let baseScore = 0;
    const anomalies: string[] = [];
    
    // 1. Financial Anomaly Detection
    const total = type === 'SALE' ? (invoice as Sale).finalTotal : (invoice as Purchase).totalAmount;
    
    // Check for high variance compared to entity history
    const entityId = type === 'SALE' ? (invoice as Sale).customerId : (invoice as Purchase).partnerId;
    const avgAmount = await this.getEntityAvgAmount(entityId, type);
    
    if (avgAmount > 0 && total > avgAmount * 3) {
      baseScore += 20;
      anomalies.push(`Invoice total (${total}) is unusually high compared to entity average (${avgAmount.toFixed(2)}) 💰`);
    }
    
    // Check for sales below average (potential under-billing)
    if (type === 'SALE' && avgAmount > 0 && total < avgAmount * 0.6) {
      baseScore += 10;
      anomalies.push(`Sale amount (${total}) is significantly below entity average (${avgAmount.toFixed(2)}) 📉`);
    }
    
    // Check for negative margin
    if (type === 'SALE') {
      const sale = invoice as Sale;
      if (sale.totalCost > 0 && sale.finalTotal < sale.totalCost) {
        baseScore += 30;
        anomalies.push(`Negative margin detected: Sale (${sale.finalTotal}) < Cost (${sale.totalCost}) 💸`);
      }
    }
    
    // Check for duplicate amounts in short period
    const isDuplicate = await this.checkDuplicateAmount(total, type, invoice.id);
    if (isDuplicate) {
      baseScore += 15;
      anomalies.push(`Duplicate amount (${total}) detected in a short period 🔄`);
    }
    
    // Check for repeated edits
    const editCount = (invoice as any).versionNumber || 0;
    if (editCount > 3) {
      baseScore += 15;
      anomalies.push(`Repeated edits detected: Version #${editCount} 📝`);
    }
    
    // Check for rapid repost cycles
    if ((invoice as any).lastPostedAt) {
      const lastPosted = new Date((invoice as any).lastPostedAt).getTime();
      const now = Date.now();
      if (now - lastPosted < 5 * 60 * 1000) { // 5 minutes
        baseScore += 10;
        anomalies.push(`Rapid repost cycle detected ⚡`);
      }
    }
    
    // Check for manual journal edits (if any linked)
    const journalEntries = await db.getJournalEntries();
    const manualEntry = journalEntries.find(e => e.sourceId === invoice.id && e.sourceType === 'MANUAL');
    if (manualEntry) {
      baseScore += 25;
      anomalies.push(`Manual journal modification detected for this invoice ⚖️`);
    }

    // 2. Risk Level Mapping
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (baseScore > 80) riskLevel = 'HIGH';
    else if (baseScore > 40) riskLevel = 'MEDIUM';
    
    // 3. Store Results
    const auditData = {
      auditScore: Math.min(baseScore, 100),
      riskLevel,
      lastAuditedAt: new Date().toISOString()
    };
    
    // 4. Generate Alerts
    for (const anomaly of anomalies) {
      await AlertCenter.addAlert({
        type: 'FINANCIAL',
        severity: riskLevel === 'HIGH' ? 'CRITICAL' : 'WARNING',
        message: anomaly,
        linkedInvoiceId: invoice.id,
        metadata: { auditScore: baseScore, riskLevel }
      });
    }
    
    // 5. Track Behavior
    await BehaviorMonitor.trackAction(userId, 'EDIT');
    
    return auditData;
  }

  private static async getEntityAvgAmount(entityId: string, type: 'SALE' | 'PURCHASE'): Promise<number> {
    if (!entityId) return 0;
    if (type === 'SALE') {
      const sales = await safeWhereEqual(db.db.sales, 'customerId', entityId);
      if (sales.length === 0) return 0;
      return sales.reduce((sum, s) => sum + s.finalTotal, 0) / sales.length;
    } else {
      const purchases = await safeWhereEqual(db.db.purchases, 'partnerId', entityId);
      if (purchases.length === 0) return 0;
      return purchases.reduce((sum, p) => sum + p.totalAmount, 0) / purchases.length;
    }
  }

  private static async checkDuplicateAmount(amount: number, type: 'SALE' | 'PURCHASE', currentId: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    if (!oneHourAgo) return false;
    if (type === 'SALE') {
      if (!db.db.sales) return false;
      const duplicates = await db.db.sales
        .where('date').above(oneHourAgo)
        .filter(s => s.finalTotal === amount && s.id !== currentId)
        .toArray();
      return duplicates.length > 0;
    } else {
      if (!db.db.purchases) return false;
      const duplicates = await db.db.purchases
        .where('date').above(oneHourAgo)
        .filter(p => p.totalAmount === amount && p.id !== currentId)
        .toArray();
      return duplicates.length > 0;
    }
  }

  static async runDailyScan() {
    console.log("[AI_AuditEngine] Running Daily Integrity Scan...");
    const sales = await db.getSales();
    const purchases = await db.getPurchases();
    
    for (const sale of sales) {
      await this.auditInvoice('SALE', sale, sale.items, sale.Created_By);
    }
    for (const purchase of purchases) {
      await this.auditInvoice('PURCHASE', purchase, purchase.items, purchase.Created_By);
    }
    
    console.log("[AI_AuditEngine] Daily Integrity Scan Completed.");
  }

  static async storeMonthlyMetrics() {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const sales = await db.getSales();
    const purchases = await db.getPurchases();
    
    const avgSale = sales.length > 0 ? sales.reduce((sum, s) => sum + s.finalTotal, 0) / sales.length : 0;
    const avgPurchase = purchases.length > 0 ? purchases.reduce((sum, p) => sum + p.totalAmount, 0) / purchases.length : 0;
    const avgEdits = sales.length > 0 ? sales.reduce((sum, s) => sum + (s.versionNumber || 0), 0) / sales.length : 0;
    
    const metrics = [
      { id: `AVG_SALE-${month}`, month, type: 'AVG_SALE' as const, value: avgSale },
      { id: `AVG_PURCHASE-${month}`, month, type: 'AVG_PURCHASE' as const, value: avgPurchase },
      { id: `AVG_EDITS-${month}`, month, type: 'AVG_EDITS' as const, value: avgEdits }
    ];
    
    for (const m of metrics) {
      await db.db.historicalMetrics.put(m);
    }
    
    console.log(`[AI_AuditEngine] Monthly metrics stored for ${month}`);
  }

  static async getHistoricalMetric(type: 'AVG_SALE' | 'AVG_PURCHASE' | 'AVG_MARGIN' | 'AVG_EDITS'): Promise<number> {
    const metrics = await safeWhereEqual(db.db.historicalMetrics, 'type', type);
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }
}
