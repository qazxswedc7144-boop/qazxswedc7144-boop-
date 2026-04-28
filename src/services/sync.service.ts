
import { db } from '../lib/database';
import { PendingOperation, Sale } from '../types';
import { eventBus, EVENTS } from './eventBus';
import { logger } from './logger.service';
import { SalesRepository } from './repositories/SalesRepository';
import { ErrorManager } from '@/services/ErrorManager';

let syncTimer: any = null;

export const syncService = {
  isProcessing: false,

  /**
   * تنفيذ المزامنة على دفعات (Batch Sync)
   */
  performSync: async (): Promise<boolean> => {
    if (syncService.isProcessing || !navigator.onLine) return false;
    
    syncService.isProcessing = true;
    const queue = await db.getPendingOperations();

    if (queue.length === 0) {
      syncService.isProcessing = false;
      return true;
    }

    logger.info("مزامنة دفعات", "SyncService", `جاري معالجة وتأكيد ${queue.length} سجلات معلقة...`);

    // معالجة الدفعة بالكامل
    for (const op of queue) {
      try {
        await syncService.processOperation(op);
      } catch (error: any) {
        // TRIGGER: Log automation error on sync failure
        ErrorManager.logAutomationError('Sync Service', error.message, op.id);
        
        logger.error("فشل مزامنة سجل", "SyncService", `خطأ في العملية ${op.id}`, error);
        if (!navigator.onLine) break;
      }
    }

    syncService.isProcessing = false;
    await db.updateSyncDate();
    eventBus.emit(EVENTS.DATA_REFRESHED);
    return true;
  },

  processOperation: async (op: PendingOperation) => {
    await db.updatePendingOperation({ ...op, status: 'syncing' });

    // منطق "تأكيد الرقم النهائي" (Confirm Global Sequential ID)
    if (op.type === 'SALE' && op.payload?.invoiceId?.startsWith('PROV-')) {
      const provId = op.payload.invoiceId;
      const internalId = op.payload.id || op.payload.invoiceId;
      
      // تحديد النوع من الرقم المؤقت (A هو بيع، R هو مرتجع)
      const isReturn = provId.includes('-R-');
      
      // جلب الرقم التسلسلي العالمي القادم (بناءً على الحالة الحالية للسجلات) بالتنسيق الجديد
      const finalId = await SalesRepository.getSafeUniqueNumber(isReturn);
      
      logger.info("تأكيد رقم فاتورة", "SyncService", `تحويل الرقم المؤقت ${provId} إلى الرقم النهائي ${finalId}`);

      // 1. تحديث السجل المحلي والقيود المحاسبية التابعة له
      await SalesRepository.promoteToFinalNumber(internalId, finalId);

      // 2. تحديث بيانات العملية المعلقة (Payload) لضمان إرسال الرقم الصحيح للسيرفر عند المحاكاة
      op.payload.invoiceId = finalId;
    }

    // محاكاة إتمام المزامنة مع السيرفر المركزي (200ms delay)
    await new Promise(resolve => setTimeout(resolve, 200)); 
    
    await db.removePendingOperation(op.id);
  },

  /**
   * إضافة للانتظار مع جدولة المزامنة (Debounced Sync)
   */
  enqueue: async (type: string, payload: any) => {
    await db.addPendingOperation({ 
        id: db.generateId('OP'), 
        type, 
        payload, 
        status: 'pending', 
        retries: 0, 
        createdAt: new Date().toISOString() 
    });

    const isDelayed = await db.getSetting('delayed_sync_enabled', true);

    if (!isDelayed || navigator.onLine) {
      syncService.performSync();
    } else {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => syncService.performSync(), 30000);
    }
  }
};
