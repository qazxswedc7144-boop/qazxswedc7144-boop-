import { db } from '@/core/db';
import { UserBehavior } from '@/types';
import { AlertCenter } from '@/services/notifications/AlertCenter';

export class BehaviorMonitor {
  static async trackAction(userId: string, action: 'EDIT' | 'UNLOCK' | 'REPOST' | 'DELETE' | 'LOGIN' | 'SECURITY_BREACH', metadata?: any) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const isAfterHours = now.getHours() < 7 || now.getHours() > 21;
    
    const behaviorId = `${userId}_${today}`;
    const settingKey = `user_behavior_${behaviorId}`;
    let behavior = (await db.getSetting(settingKey, null)) as UserBehavior | null;
    
    if (!behavior) {
      behavior = {
        id: behaviorId,
        userId,
        date: today || '',
        numberOfEdits: 0,
        unlockAttempts: 0,
        repostFrequency: 0,
        deleteAttempts: 0,
        afterHoursActions: 0,
        failedLogins: 0,
        lastActionAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
    }
    
    // Update behavior metrics
    if (action === 'EDIT') behavior.numberOfEdits++;
    if (action === 'UNLOCK') behavior.unlockAttempts++;
    if (action === 'REPOST') behavior.repostFrequency++;
    if (action === 'DELETE') behavior.deleteAttempts++;
    if (action === 'SECURITY_BREACH' && metadata?.type === 'INVALID_PASSWORD') behavior.failedLogins++;
    if (isAfterHours) behavior.afterHoursActions++;
    
    behavior.lastActionAt = now.toISOString();
    
    // Log specific actions to audit log for high-level tracking
    if (action === 'LOGIN' || action === 'SECURITY_BREACH') {
      await db.addAuditLog(
        userId,
        action,
        'USER_ACTIVITY',
        `${action}: ${metadata?.message || 'User action tracked'}`
      );
    }
    
    // Check for after-hours activity (10 PM - 6 AM)
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      behavior.afterHoursActions++;
      await AlertCenter.addAlert({
        type: 'BEHAVIORAL',
        severity: 'WARNING',
        message: `نشاط مشبوه خارج أوقات العمل للمستخدم ${userId} في الساعة ${hour}:00`,
        metadata: { userId, hour }
      });
    }

    await db.saveSetting(settingKey, behavior);
    
    // Check for abnormal patterns
    await this.checkAnomalies(behavior);
  }

  private static async checkAnomalies(behavior: UserBehavior) {
    // 1. High edit frequency
    if (behavior.numberOfEdits > 50) {
      await AlertCenter.addAlert({
        type: 'BEHAVIORAL',
        severity: 'WARNING',
        message: `نشاط تعديل مرتفع للمستخدم [${behavior.userId}]: ${behavior.numberOfEdits} تعديل اليوم ⚠️`,
        metadata: { userId: behavior.userId, edits: behavior.numberOfEdits }
      });
    }
    
    // 2. Multiple unlock attempts
    if (behavior.unlockAttempts > 10) {
      await AlertCenter.addAlert({
        type: 'BEHAVIORAL',
        severity: 'CRITICAL',
        message: `محاولات فك قفل أرشيف متكررة للمستخدم [${behavior.userId}] 🛡️`,
        metadata: { userId: behavior.userId, attempts: behavior.unlockAttempts }
      });
    }
    
    // 3. After hours activity
    if (behavior.afterHoursActions > 20) {
      await AlertCenter.addAlert({
        type: 'BEHAVIORAL',
        severity: 'WARNING',
        message: `نشاط خارج ساعات العمل للمستخدم [${behavior.userId}] 🌙`,
        metadata: { userId: behavior.userId, actions: behavior.afterHoursActions }
      });
    }

    // 4. Multiple failed logins
    if (behavior.failedLogins > 5) {
      await AlertCenter.addAlert({
        type: 'SECURITY',
        severity: 'CRITICAL',
        message: `محاولات دخول فاشلة متكررة للمستخدم [${behavior.userId}] 🔐`,
        metadata: { userId: behavior.userId, attempts: behavior.failedLogins }
      });
    }
  }

  static async getRiskyUsers() {
    const settingsList = await db.db.settings.toArray();
    const behaviors = settingsList
      .filter((s: { key: string; value: any }) => s.key.startsWith('user_behavior_'))
      .map((s: { key: string; value: any }) => s.value as UserBehavior);

    return behaviors
      .map((b: UserBehavior) => ({
        userId: b.userId,
        riskScore: (b.numberOfEdits * 0.5) + (b.unlockAttempts * 5) + (b.deleteAttempts * 10) + (b.afterHoursActions * 2)
      }))
      .sort((a: { riskScore: number }, b: { riskScore: number }) => b.riskScore - a.riskScore)
      .slice(0, 5);
  }
}
