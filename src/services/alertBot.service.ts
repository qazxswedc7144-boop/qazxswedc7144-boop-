
import { db } from '../lib/database';
import { MedicineAlert } from '../types';
import { eventBus, EVENTS } from './eventBus';
import { ErrorManager } from './errorManager';

/**
 * Alert Bot Service - محاكي البوت الآلي
 */
export const alertBotService = {
  
  /**
   * تشغيل الفحص اليومي (Bot: Scheduled Event)
   */
  runDailyChecks: async () => {
    try {
      console.log('[AlertBot] Running daily scheduled checks...');
      
      const thresholdDays = await db.getSetting('expiry_threshold_days', 30);
      await db.clearOldAlerts();

      const batches = await db.getMedicineBatches();
      const products = await db.getProducts();
      const today = new Date();
      
      const threshold = new Date();
      threshold.setDate(today.getDate() + thresholdDays); 

      let expiryAlertsCount = 0;

      for (const batch of batches) {
        if (batch.Quantity > 0) {
          const expiryDate = new Date(batch.ExpiryDate);
          if (expiryDate <= threshold) {
            const product = products.find(p => p.id === batch.productId);
            const timeDiff = expiryDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            
            let severity: 'Critical' | 'Warning' = 'Warning';
            let msgPrefix = "قرب انتهاء صلاحية";

            if (daysLeft <= 0) {
               severity = 'Critical';
               msgPrefix = "منتهية الصلاحية";
            } else if (daysLeft <= Math.min(7, thresholdDays / 4)) {
               severity = 'Critical'; 
            }

            await alertBotService.createOrUpdateAlert({
              type: 'EXPIRY',
              referenceId: batch.BatchID,
              title: `${msgPrefix}: ${product?.Name || 'منتج غير معروف'}`,
              message: `تاريخ الصلاحية: ${batch.ExpiryDate} | الكمية المتأثرة: ${batch.Quantity} ${daysLeft <= 0 ? '(انتهت)' : `(متبقي ${daysLeft} يوم)`}`,
              severity: severity
            });
            expiryAlertsCount++;
          }
        }
      }

      let lowStockAlertsCount = 0;
      for (const product of products) {
        if (product.StockQuantity <= product.MinLevel) {
          await alertBotService.createOrUpdateAlert({
            type: 'LOW_STOCK',
            referenceId: product.id,
            title: `نقص في المخزون: ${product.Name}`,
            message: `الرصيد الحالي ${product.StockQuantity} (الحد الأدنى: ${product.MinLevel}). يرجى إعادة الطلب.`,
            severity: product.StockQuantity <= 0 ? 'Critical' : 'Warning'
          });
          lowStockAlertsCount++;
        }
      }

      if (expiryAlertsCount > 0 || lowStockAlertsCount > 0) {
        eventBus.emit(EVENTS.UI_NOTIFICATIONS_UPDATED);
      }
      
      console.log(`[AlertBot] Checks complete. Expiry threshold: ${thresholdDays} days. Alerts: ${expiryAlertsCount}`);
    } catch (error: any) {
      // TRIGGER: Log automation error on alert bot failure
      ErrorManager.logAutomationError('Medicine Alert Bot', error.message || 'Failure in daily pharmaceutical checks');
    }
  },

  /**
   * إنشاء أو تحديث تنبيه لضمان عدم التكرار اليومي
   */
  createOrUpdateAlert: async (data: { type: 'EXPIRY' | 'LOW_STOCK' | 'SEASONAL', referenceId: string, title: string, message: string, severity: 'Critical' | 'Warning' | 'Info' }) => {
    const existingAlerts = await db.getMedicineAlerts();
    
    const duplicate = existingAlerts.find(a => 
      a.Type === data.type && 
      a.ReferenceID === data.referenceId &&
      !a.IsRead 
    );

    if (duplicate) {
      if (duplicate.Message !== data.message || duplicate.Severity !== data.severity) {
        duplicate.Message = data.message;
        duplicate.Severity = data.severity;
        duplicate.Date = new Date().toISOString(); 
        await db.saveMedicineAlert(duplicate);
      }
    } else {
      const alertId = db.generateId('ALT');
      const newAlert: MedicineAlert = {
        id: alertId,
        AlertID: alertId,
        Type: data.type,
        ReferenceID: data.referenceId,
        Title: data.title,
        Message: data.message,
        Severity: data.severity,
        Date: new Date().toISOString(),
        IsRead: false
      };
      await db.saveMedicineAlert(newAlert);
    }
  },

  markAsRead: async (alertId: string) => {
    const alerts = await db.getMedicineAlerts();
    const alert = alerts.find(a => a.AlertID === alertId);
    if (alert) {
      alert.IsRead = true;
      await db.saveMedicineAlert(alert);
      eventBus.emit(EVENTS.UI_NOTIFICATIONS_UPDATED);
    }
  }
};
