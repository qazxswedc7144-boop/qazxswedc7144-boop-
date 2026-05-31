
import { eventBus, EVENTS } from '@/services/eventBus';
import { db } from '@/core/db';

export interface Notification {
  id: string;
  type: 'inventory' | 'finance' | 'system';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

/**
 * Notification Service - مدير الإشعارات الذكي
 */
class NotificationManager {
  private notifications: Notification[] = [];

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    eventBus.subscribe(EVENTS.SALE_COMPLETED, () => this.checkInventoryAlerts());
    
    eventBus.subscribe(EVENTS.SYNC_REQUIRED, () => {
      this.addNotification({
        type: 'system',
        title: 'مزامنة معلقة',
        message: 'توجد عمليات لم يتم ترحيلها للسيرفر بسبب انقطاع الإنترنت.',
        severity: 'warning'
      });
    });
  }

  // Fix: Made async to await db.getProducts()
  public async checkInventoryAlerts() {
    const products = await db.getProducts();
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);

    products.forEach(p => {
      // 1. Stock Level Alerts
      const stock = Number(p.stock || p.StockQuantity || 0);
      const name = p.name || p.Name;
      const minLevel = p.MinLevel || 5;

      if (stock <= minLevel && stock > 0) {
        this.addNotification({
          type: 'inventory',
          title: 'نقص مخزون',
          message: `الصنف [${name}] وصل للحد الأدنى (${stock} وحدة متبقية).`,
          severity: 'warning'
        });
      } else if (stock <= 0) {
        this.addNotification({
          type: 'inventory',
          title: 'نفاد مخزون',
          message: `الصنف [${name}] غير متوفر حالياً.`,
          severity: 'error'
        });
      }

      // 2. Expiry Alerts (User Request)
      if (p.ExpiryDate) {
        const expiry = new Date(p.ExpiryDate);
        if (expiry < today) {
          this.addNotification({
            type: 'inventory',
            title: 'صنف منتهي الصلاحية',
            message: `الصنف [${name}] انتهت صلاحيته بتاريخ ${p.ExpiryDate}. يرجى استبعاده فوراً.`,
            severity: 'error'
          });
        } else if (expiry < nextMonth) {
          this.addNotification({
            type: 'inventory',
            title: 'قرب انتهاء صلاحية',
            message: `الصنف [${name}] ستنتهي صلاحيته قريباً (${p.ExpiryDate}).`,
            severity: 'warning'
          });
        }
      }
    });
  }

  private addNotification(n: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const newNote: Notification = {
      ...n,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      read: false
    };
    
    const exists = this.notifications.find(existing => 
      existing.title === newNote.title && 
      existing.message === newNote.message &&
      !existing.read
    );

    if (!exists) {
      this.notifications = [newNote, ...this.notifications].slice(0, 50);
      eventBus.emit('notifications.updated', this.notifications);
    }
  }

  public getNotifications() {
    return this.notifications;
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    eventBus.emit('notifications.updated', this.notifications);
  }
}

export const notificationService = new NotificationManager();
