
type EventCallback = (data: any) => void;

/**
 * EventBus - المحرك المركزي للأحداث بنمط Namespacing صارم: [DOMAIN]:[ACTION]
 * تم تحديثه لضمان التطهير الكامل للمستمعين ومنع تسريب الذاكرة.
 */
class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) EventBus.instance = new EventBus();
    return EventBus.instance;
  }

  /**
   * إلغاء الاشتراك (إزالة المستمع)
   */
  public off(event: string, callback: EventCallback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) this.listeners.delete(event);
    }
  }

  /**
   * الاشتراك في حدث مع إرجاع دالة التنظيف فوراً (إلزامي في React useEffect)
   */
  public subscribe(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  /**
   * إطلاق حدث مع عزل الأخطاء لضمان استمرار عمل بقية المستمعين
   */
  public emit(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;
    
    // تنفيذ نسخة من القائمة لتجنب تضارب التعديلات أثناء المعالجة (Snapshot execution)
    Array.from(eventListeners).forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[EventBus Exception] ${event}:`, err);
      }
    });
  }
}

export const eventBus = EventBus.getInstance();

/**
 * قاموس الأحداث المركزي - يمنع استخدام نصوص عشوائية في النظام
 */
export const EVENTS = Object.freeze({
  // العمليات المالية
  ACCOUNTING_SALE_FINALIZED: 'ACC:SALE_SUCCESS',
  ACCOUNTING_PURCHASE_FINALIZED: 'ACC:PURCHASE_SUCCESS',
  ACCOUNTING_JOURNAL_POSTED: 'ACC:JOURNAL_POSTED',
  SALE_COMPLETED: 'ACC:SALE_SUCCESS',
  
  // العمليات المخزنية
  INVENTORY_STOCK_CRITICAL: 'INV:STOCK_LOW',
  INVENTORY_BATCH_EXPIRED: 'INV:BATCH_EXPIRY',
  
  // مزامنة البيانات
  SYNC_REMOTE_PUSH_REQUIRED: 'SYNC:PUSH_NEEDED',
  SYNC_DATA_CONSOLIDATED: 'SYNC:DATA_REFRESHED',
  SYNC_REQUIRED: 'SYNC:PUSH_NEEDED',
  DATA_REFRESHED: 'SYNC:DATA_REFRESHED',
  
  // صحة النظام
  SYSTEM_INTEGRITY_CHECK: 'SYS:INTEGRITY_RUN',
  SYSTEM_ERROR_CRITICAL: 'SYS:FATAL_ERROR',
  SYSTEM_TEST_RUN: 'SYS:TEST_RUN',
  
  // واجهة المستخدم
  UI_NOTIFICATIONS_UPDATED: 'UI:NOTIF_REFRESH',
  CURRENCY_CHANGED: 'UI:CURRENCY_CHANGED'
});
