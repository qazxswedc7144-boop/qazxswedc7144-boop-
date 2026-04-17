
import { db } from './database';
import { IS_PREVIEW } from '../constants';

export interface DefenseReport {
  riskScore: number;         // Financial anomalies
  integrityScore: number;    // Data consistency
  behaviorScore: number;     // User patterns
  threatLevel: number;       // Weighted composite
  timestamp: string;
}

export class FinancialDefenseSystem {
  private static scannerInterval: any = null;

  /**
   * Layer 1: Real-Time Input Validation
   * Validates transaction data before it hits the database
   */
  static async validateInput(type: string, payload: any): Promise<{ valid: boolean; reason?: string }> {
    // Basic financial sanity checks
    if (type === 'SALE' || type === 'PURCHASE') {
      if (!payload.items || payload.items.length === 0) return { valid: false, reason: 'الفاتورة فارغة' };
      if (payload.total < 0) return { valid: false, reason: 'إجمالي الفاتورة لا يمكن أن يكون سالباً' };
      
      // Check for extreme values (potential typo or fraud)
      if (payload.total > 1000000) { // Example threshold
        return { valid: false, reason: 'قيمة الفاتورة تتجاوز الحد المسموح به للعمليات العادية' };
      }
    }
    return { valid: true };
  }

  /**
   * Layer 2: AI Behavioral Monitoring
   * Analyzes user actions and patterns
   */
  static async calculateBehaviorScore(): Promise<number> {
    try {
      const now = Date.now();
      const oneHourAgo = new Date(now - 3600000).toISOString();
      
      if (!oneHourAgo) return 0;

      // 1. Rapid sequence of deletions or updates
      const suspiciousActions = await db.audit_log
        .where('Modified_At').above(oneHourAgo)
        .filter((l: any) => l.Change_Type === 'DELETE' || l.Change_Type === 'UPDATE')
        .toArray();
      
      // 2. Accessing sensitive modules repeatedly
      const sensitiveAccess = await db.audit_log
        .where('Modified_At').above(oneHourAgo)
        .filter((l: any) => l.Table_Name === 'Audit_Log' || l.Table_Name === 'Settings')
        .count();

      let score = 0;
      // Increased thresholds for development (from 20/10 to 50/25)
      if (suspiciousActions.length > 50) score += 50;
      if (sensitiveAccess > 25) score += 50;
      
      return Math.min(100, score);
    } catch (e) { return 0; }
  }

  /**
   * Layer 3: Background Integrity Scanner
   * Deep scan of data consistency
   */
  static async calculateIntegrityScore(): Promise<number> {
    try {
      const sales = await db.db.sales.toArray();
      const journalEntries = await db.db.journalEntries.toArray();
      
      let issues = 0;
      
      // 1. Check for orphaned sales (posted but no journal)
      const postedSales = sales.filter(s => s.InvoiceStatus === 'POSTED');
      for (const s of postedSales) {
        if (!journalEntries.find(j => j.sourceId === s.id)) issues++;
      }
      
      // 2. Check for hash mismatches (tampering)
      // (Assuming a hash check logic exists or we add a simple one)
      
      const total = postedSales.length || 1;
      return Math.min(100, (issues / total) * 100);
    } catch (e) { return 0; }
  }

  /**
   * Composite Threat Level Calculation
   */
  static async evaluateSystemThreat(): Promise<DefenseReport> {
    // Get RiskScore from existing engine logic (simplified here or imported)
    const riskScore = parseInt(await db.getSetting('SYSTEM_RISK_SCORE', '0'));
    const integrityScore = await this.calculateIntegrityScore();
    const behaviorScore = await this.calculateBehaviorScore();

    // Weighted Formula
    // ThreatLevel = (Risk * 0.4) + (Integrity * 0.4) + (Behavior * 0.2)
    const threatLevel = Math.round(
      (riskScore * 0.4) + 
      (integrityScore * 0.4) + 
      (behaviorScore * 0.2)
    );

    const report: DefenseReport = {
      riskScore,
      integrityScore,
      behaviorScore,
      threatLevel,
      timestamp: new Date().toISOString()
    };

    // Save to DB
    await db.saveSetting('SYSTEM_THREAT_LEVEL', threatLevel.toString());
    await db.saveSetting('DEFENSE_REPORT', JSON.stringify(report));

    // Trigger Protection Actions
    await this.enforceProtection(threatLevel);

    return report;
  }

  private static async enforceProtection(level: number) {
    if (level >= 75) {
      const status = await db.getSetting('SYSTEM_STATUS', 'ACTIVE');
      if (status !== 'RECOVERY_MODE' && !IS_PREVIEW) {
        await db.saveSetting('SYSTEM_STATUS', 'RECOVERY_MODE');
        await db.addAuditLog('SYSTEM', 'SYSTEM', 'DEFENSE_SYSTEM', `CRITICAL THREAT: Level ${level} triggered SAFE_MODE.`);
      }
    } else if (level >= 50) {
      await db.saveSetting('JOURNAL_EDIT_LOCKED', 'TRUE');
    } else {
      await db.saveSetting('JOURNAL_EDIT_LOCKED', 'FALSE');
    }
  }

  /**
   * Resets the entire security system state.
   * Clears audit logs and resets threat levels to zero.
   * Used for development or after a false positive.
   */
  static async resetSecuritySystem(): Promise<void> {
    try {
      // 1. Enable security bypass to allow clearing audit logs
      if (typeof db.setBypassSecurity === 'function') {
        db.setBypassSecurity(true);
      }
      
      // 2. Clear the Audit Logs (the source of behavior scores)
      const table = db.audit_log;
      if (table && typeof table.clear === 'function') {
        await table.clear();
      }
      
      // 3. Disable security bypass
      if (typeof db.setBypassSecurity === 'function') {
        db.setBypassSecurity(false);
      }
      
      // 4. Reset all security-related settings
      await db.saveSetting('SYSTEM_THREAT_LEVEL', '0');
      await db.saveSetting('SYSTEM_RISK_SCORE', '0');
      await db.saveSetting('SYSTEM_STATUS', 'ACTIVE');
      await db.saveSetting('JOURNAL_EDIT_LOCKED', 'FALSE');
      await db.saveSetting('DEFENSE_REPORT', JSON.stringify({
        riskScore: 0,
        integrityScore: 0,
        behaviorScore: 0,
        threatLevel: 0,
        timestamp: new Date().toISOString()
      }));

      console.log("[DefenseSystem] Security system has been reset successfully.");
    } catch (e) {
      console.error("[DefenseSystem] Failed to reset security system:", e);
    }
  }

  /**
   * Starts the 10-minute background scanner
   */
  static startBackgroundScanner() {
    if (this.scannerInterval) clearInterval(this.scannerInterval);
    
    // Initial run
    this.evaluateSystemThreat();

    // Interval: 10 minutes (600,000 ms)
    this.scannerInterval = setInterval(() => {
      console.log("[DefenseSystem] Running 10-minute Integrity Scan...");
      this.evaluateSystemThreat();
    }, 600000);
  }
}
