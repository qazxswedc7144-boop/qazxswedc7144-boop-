
type Callback = (data: any) => void;

export const EVENTS = {
  SALE_COMPLETED: 'SALE_COMPLETED',
  PURCHASE_COMPLETED: 'PURCHASE_COMPLETED',
  DATA_REFRESHED: 'DATA_REFRESHED',
  SYNC_REQUIRED: 'SYNC_REQUIRED',
  UI_NOTIFICATIONS_UPDATED: 'UI_NOTIFICATIONS_UPDATED',
  SYSTEM_TEST_RUN: 'SYSTEM_TEST_RUN',
  CURRENCY_CHANGED: 'CURRENCY_CHANGED',
};

class EventBus {
  private listeners: Record<string, Callback[]> = {};

  subscribe(event: string, callback: Callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.unsubscribe(event, callback);
  }

  unsubscribe(event: string, callback: Callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, data?: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(data));
  }
}

export const eventBus = new EventBus();
