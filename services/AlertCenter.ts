
import { db } from './database';
import { SystemAlert } from '../types';
import { IS_PREVIEW } from '../constants';

export class AlertCenter {
  static async addAlert(alert: Omit<SystemAlert, 'id' | 'timestamp' | 'isRead' | 'resolvedStatus'>) {
    // Check for existing unread duplicate to prevent flooding
    const existing = await db.db.systemAlerts
      .where('isRead').equals(0)
      .filter(a => a.message === alert.message && a.severity === alert.severity)
      .first();
      
    if (existing) return existing;

    const newAlert: SystemAlert = {
      ...alert,
      id: `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      isRead: false,
      resolvedStatus: 'OPEN'
    };
    
    await db.db.systemAlerts.put(newAlert);
    
    // If critical, we might want to trigger safe mode if too many in 24h
    if (alert.severity === 'CRITICAL') {
      await this.checkCriticalThreshold();
    }
    
    return newAlert;
  }

  private static async checkCriticalThreshold() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const criticalAlerts = await db.db.systemAlerts
      .where('timestamp').above(oneDayAgo)
      .filter(a => a.severity === 'CRITICAL')
      .toArray();
      
    if (criticalAlerts.length >= 10) {
      console.error("CRITICAL THRESHOLD REACHED: Switching to Audit Intensive Mode 🛡️", {
        count: criticalAlerts.length,
        messages: criticalAlerts.map(a => a.message)
      });

      if (IS_PREVIEW) {
        console.warn("PREVIEW GUARD: Critical threshold reached, but bypassing RECOVERY_MODE and Audit Intensive Mode.");
        return;
      }

      const { AnomalyScoringEngine } = await import('./AnomalyScoringEngine');
      await AnomalyScoringEngine.calculateCurrentRiskScore();
      
      await db.saveSetting('AUDIT_INTENSIVE_MODE', 'TRUE');
    }
  }

  static async getActiveAlerts() {
    return await db.db.systemAlerts
      .where('resolvedStatus').equals('OPEN')
      .reverse()
      .sortBy('timestamp');
  }

  static async resolveAlert(id: string) {
    await db.db.systemAlerts.update(id, { 
      resolvedStatus: 'RESOLVED',
      isRead: true 
    });
  }

  static async resetSystemStatus() {
    await db.saveSetting('SYSTEM_STATUS', 'ACTIVE');
    await db.saveSetting('AUDIT_INTENSIVE_MODE', 'FALSE');
    console.log("System status reset to ACTIVE. Audit Intensive Mode disabled. ✅");
  }

  static async clearCriticalAlerts() {
    const criticalAlerts = await db.db.systemAlerts
      .filter(a => a.severity === 'CRITICAL')
      .toArray();
    
    for (const alert of criticalAlerts) {
      await db.db.systemAlerts.delete(alert.id);
    }
    console.log(`Cleared ${criticalAlerts.length} critical alerts. 🧹`);
  }
}
