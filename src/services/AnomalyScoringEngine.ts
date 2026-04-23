
import { db } from '../lib/database';
import { IS_PREVIEW } from '../constants';
import { safeWhereEqual, safeWhereAbove } from '../utils/dexieSafe';

export interface AnomalyReport {
  riskScore: number;
  factors: {
    imbalance: number;
    duplicates: number;
    missingLinks: number;
    volumeSpike: number;
    securityFlag: number;
  };
  timestamp: string;
}

export class AnomalyScoringEngine {
  private static readonly WEIGHTS = {
    imbalance: 0.4,
    duplicates: 0.2,
    missingLinks: 0.15,
    volumeSpike: 0.15,
    securityFlag: 0.1,
  };

  /**
   * Recalculates the system-wide risk score
   */
  static async calculateCurrentRiskScore(): Promise<AnomalyReport> {
    const factors = {
      imbalance: await this.checkFinancialImbalance(),
      duplicates: await this.checkDuplicateTransactions(),
      missingLinks: await this.checkMissingJournalLinks(),
      volumeSpike: await this.checkVolumeSpike(),
      securityFlag: await this.checkSecurityFlags(),
    };

    const riskScore = Math.min(100, Math.round(
      (factors.imbalance * this.WEIGHTS.imbalance) +
      (factors.duplicates * this.WEIGHTS.duplicates) +
      (factors.missingLinks * this.WEIGHTS.missingLinks) +
      (factors.volumeSpike * this.WEIGHTS.volumeSpike) +
      (factors.securityFlag * this.WEIGHTS.securityFlag)
    ));

    const report: AnomalyReport = {
      riskScore,
      factors,
      timestamp: new Date().toISOString(),
    };

    // Save score to settings for UI access
    await db.saveSetting('SYSTEM_RISK_SCORE', riskScore);
    await db.saveSetting('LAST_ANOMALY_REPORT', JSON.stringify(report));

    // --- MULTI-LEVEL PROTECTION ENGINE ---

    // Level 1: RiskScore >= 30 (Warning Banner)
    // Handled in UI by reading SYSTEM_RISK_SCORE

    // Level 2: RiskScore >= 50 (Disable Journal Editing + Log Security Incident)
    if (riskScore >= 50) {
      await db.saveSetting('JOURNAL_EDIT_LOCKED', 'TRUE');
      
      // Log security incident if not already logged recently for this score level
      const lastIncident = await db.getSetting('LAST_SECURITY_INCIDENT_SCORE', '0');
      if (parseInt(lastIncident) < 50) {
        await db.addAuditLog('SYSTEM', 'SYSTEM', 'RISK_ENGINE', `Security Incident: Risk score reached ${riskScore}. Journal editing disabled.`);
        await db.saveSetting('LAST_SECURITY_INCIDENT_SCORE', riskScore.toString());
      }
    } else {
      await db.saveSetting('JOURNAL_EDIT_LOCKED', 'FALSE');
    }

    // Level 3: RiskScore >= 75 (Freeze Operations + SAFE_MODE)
    if (riskScore >= 75) {
      if (IS_PREVIEW) {
        console.warn(`[AnomalyScoringEngine] CRITICAL RISK SCORE: ${riskScore}. Preview bypass active for SAFE_MODE.`);
      } else {
        const currentStatus = await db.getSetting('SYSTEM_STATUS', 'ACTIVE');
        if (currentStatus !== 'RECOVERY_MODE') {
          await db.saveSetting('SYSTEM_STATUS', 'RECOVERY_MODE');
          await db.addAuditLog('SYSTEM', 'SYSTEM', 'RISK_ENGINE', `CRITICAL: Risk score ${riskScore} triggered SAFE_MODE (RECOVERY_MODE).`);
          console.error(`[AnomalyScoringEngine] SYSTEM SECURED: Risk Score ${riskScore} triggered RECOVERY_MODE.`);
        }
      }
    }

    return report;
  }

  private static async checkFinancialImbalance(): Promise<number> {
    const entries = await db.db.journalEntries.toArray();
    let imbalancedCount = 0;
    for (const entry of entries) {
      const debits = entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
      const credits = entry.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
      if (Math.abs(debits - credits) > 0.01) imbalancedCount++;
    }
    // Scale: 0-100 based on percentage of imbalanced entries (max 100 if > 10 entries)
    return Math.min(100, imbalancedCount * 10);
  }

  private static async checkDuplicateTransactions(): Promise<number> {
    const sales = await db.db.sales.toArray();
    const hashes = new Set();
    let duplicates = 0;
    for (const s of sales) {
      if (s.hash && hashes.has(s.hash)) duplicates++;
      hashes.add(s.hash);
    }
    // Threshold: > 10 duplicates is a risk
    return Math.min(100, duplicates * 10);
  }

  private static async checkMissingJournalLinks(): Promise<number> {
    const sales = await db.db.sales.filter(s => s.InvoiceStatus === 'POSTED').toArray();
    const purchases = await db.db.purchases.filter(p => p.invoiceStatus === 'POSTED').toArray();
    
    let missing = 0;
    for (const s of sales) {
      if (!s.id) continue;
      const entries = await safeWhereEqual(db.db.journalEntries, 'sourceId', s.id);
      const entry = entries[0] || null;
      if (!entry) missing++;
    }
    for (const p of purchases) {
      if (!p.id) continue;
      const entries = await safeWhereEqual(db.db.journalEntries, 'sourceId', p.id);
      const entry = entries[0] || null;
      if (!entry) missing++;
    }
    
    const total = sales.length + purchases.length;
    if (total === 0) return 0;
    return Math.min(100, (missing / total) * 100);
  }

  private static async checkVolumeSpike(): Promise<number> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
    if (!db.db.sales) {
      console.error("[AnomalyScoringEngine] sales table not found");
      return 0;
    }
    if (!oneHourAgo) return 0;
    const recentSales = await safeWhereAbove(db.db.sales, 'date', oneHourAgo);
    const count = recentSales.length;
    
    // Threshold: > 100 transactions per hour is a spike (increased for development)
    if (count > 100) return 100;
    if (count > 50) return 50;
    return 0;
  }

  private static async checkSecurityFlags(): Promise<number> {
    const logs = await db.db.Audit_Log.filter(l => l.Change_Type === 'UPDATE').toArray();
    // Check for unauthorized modification attempts (e.g. non-admin trying to edit posted invoices)
    // This is a simplified check based on audit logs
    const suspicious = logs.filter(l => l.Table_Name === 'Audit_Log').length; // Audit log itself shouldn't be updated
    // Threshold: > 5 suspicious logs is a risk
    return Math.min(100, suspicious * 20);
  }
}
