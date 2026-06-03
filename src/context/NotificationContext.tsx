import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import Dexie, { type Table } from 'dexie';

// الإشعارات المدعومة في PharmaFlow Pro
export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface DbNotification {
  id?: number;
  message: string;
  type: NotificationType;
  timestamp: number;
  isRead: number; // 0 = unread, 1 = read
}

export interface Notification {
  message: string;
  type: NotificationType;
  duration?: number;
}

// قاعدة بيانات مستقلّة كلياً لحفظ سجل الإشعارات دون المساس ببنية البيانات الأساسية
class PharmaFlowNotificationsDB extends Dexie {
  notifications!: Table<DbNotification>;

  constructor() {
    super('PharmaFlowNotificationsDB');
    this.version(1).stores({
      notifications: '++id, type, timestamp, isRead'
    });
  }
}

export const notificationsDb = new PharmaFlowNotificationsDB();

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType, duration?: number) => void;
  notifications: DbNotification[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// مسجل وصول خارجي static للإشعارات
let globalNotifier: ((message: string, type: NotificationType, duration?: number) => void) | null = null;

export const NotificationService = {
  show: (message: string, type: NotificationType = 'info', duration = 3000) => {
    if (globalNotifier) {
      globalNotifier(message, type, duration);
    } else {
      console.warn("[NotificationService] NotificationProvider is not mounted yet.");
    }
  },
  success: (message: string, duration = 3000) => NotificationService.show(message, 'success', duration),
  error: (message: string, duration = 3000) => NotificationService.show(message, 'error', duration),
  info: (message: string, duration = 3000) => NotificationService.show(message, 'info', duration),
  warning: (message: string, duration = 3000) => NotificationService.show(message, 'warning', duration),
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [dbNotifications, setDbNotifications] = useState<DbNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  
  const lastProcessed = useRef<{ [key: string]: number }>({});

  // جلب وتحديث الإشعارات من IndexedDB
  const refreshNotifications = useCallback(async () => {
    try {
      const list = await notificationsDb.notifications
        .orderBy('timestamp')
        .reverse()
        .toArray();
      setDbNotifications(list);
      
      const unread = list.filter(n => n.isRead === 0).length;
      setUnreadCount(unread);
    } catch (e) {
      console.error("[NotificationContext] Failed to load messages:", e);
    }
  }, []);

  // عند الإقلاع وجلب البيانات البدئية
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await notificationsDb.notifications.update(id, { isRead: 1 });
      await refreshNotifications();
    } catch (e) {
      console.error("[NotificationContext] markAsRead error:", e);
    }
  }, [refreshNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsDb.notifications.where({ isRead: 0 }).modify({ isRead: 1 });
      await refreshNotifications();
    } catch (e) {
      console.error("[NotificationContext] markAllAsRead error:", e);
    }
  }, [refreshNotifications]);

  const clearAll = useCallback(async () => {
    try {
      await notificationsDb.notifications.clear();
      await refreshNotifications();
    } catch (e) {
      console.error("[NotificationContext] clearAll error:", e);
    }
  }, [refreshNotifications]);

  const showNotification = useCallback((message: string, type: NotificationType, duration = 3000) => {
    if (!message) return;

    const fingerprint = `${type}_${message}`;
    const now = Date.now();
    const lastTime = lastProcessed.current[fingerprint] || 0;

    // 1. نظام طوابير ذكي: تفادي تكرار التنبيهات المتتالية بسرعة للحماية من الإسبام
    if (now - lastTime < 2500) {
      console.log(`[NotificationContext] Blocked duplicate notification: "${message}"`);
      return;
    }

    lastProcessed.current[fingerprint] = now;

    // 2. تفعيل التنبيه الأحادي في الشاشة لتركيز تجربة المستخدم
    setNotification({ message, type, duration });

    // 3. تخزين الإشعار في IndexedDB
    notificationsDb.notifications.add({
      message,
      type,
      timestamp: now,
      isRead: 0
    }).then(() => {
      // 4. الحفاظ على السعة الذكية للحد الأقصى (عبر حذف الأقدم عند تخطي 50)
      notificationsDb.notifications.toArray().then(async (all) => {
        if (all.length > 50) {
          const sorted = all.sort((a, b) => a.timestamp - b.timestamp);
          const toDeleteCount = sorted.length - 50;
          const idsToDelete = sorted.slice(0, toDeleteCount).map(item => item.id).filter(Boolean) as number[];
          if (idsToDelete.length > 0) {
            await notificationsDb.notifications.bulkDelete(idsToDelete);
          }
        }
        await refreshNotifications();
      });
    }).catch(e => {
      console.error("[NotificationContext] Failed to log to IndexedDB:", e);
      refreshNotifications();
    });
  }, [refreshNotifications]);

  // ربط معالج الإشعارات الخارجي
  useEffect(() => {
    globalNotifier = showNotification;
    return () => {
      globalNotifier = null;
    };
  }, [showNotification]);

  // إخفاء تلقائي بعد انتهاء المدة
  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => {
      setNotification(null);
    }, notification.duration || 3000);

    return () => clearTimeout(timer);
  }, [notification]);

  // الاستماع لزر الـ Escape للمقاييس الفضلى لإمكانية الوصول
  useEffect(() => {
    if (!notification) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotification(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notification]);

  let displayTitle = '';
  let displayBody = notification?.message || '';

  if (notification?.message) {
    const rawMsg = notification.message;
    if (rawMsg.includes(':')) {
      const index = rawMsg.indexOf(':');
      displayTitle = rawMsg.substring(0, index).trim();
      displayBody = rawMsg.substring(index + 1).trim();
    } else if (rawMsg.includes('：')) {
      const index = rawMsg.indexOf('：');
      displayTitle = rawMsg.substring(0, index).trim();
      displayBody = rawMsg.substring(index + 1).trim();
    } else {
      switch (notification.type) {
        case 'success':
          displayTitle = 'عملية ناجحة ✅';
          break;
        case 'error':
          displayTitle = 'خطأ في النظام ❌';
          break;
        case 'warning':
          displayTitle = 'تنبيه هام ⚠️';
          break;
        default:
          displayTitle = 'إشعار النظام ℹ️';
          break;
      }
    }
  }

  const getConfig = () => {
    switch (notification?.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/20',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-500" />,
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/20',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/20',
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-blue-500" />,
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
        };
    }
  };

  const currentStyle = getConfig();

  return (
    <NotificationContext.Provider value={{ 
      showNotification, 
      notifications: dbNotifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      clearAll 
    }}>
      {children}

      <AnimatePresence>
        {notification && (
          <div 
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none font-sans" 
            dir="rtl"
            role="alert"
            aria-live="assertive"
          >
            {/* الخلفية المعتمة */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] dark:bg-slate-950/50"
            />

            {/* قالب التنبيه الأحادي */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-[325px] md:max-w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl p-5 pointer-events-auto flex gap-4 overflow-hidden"
            >
              <div className={`absolute top-0 right-0 bottom-0 w-1.5 ${
                notification.type === 'success' ? 'bg-emerald-500' : 
                notification.type === 'error' ? 'bg-rose-500' : 
                notification.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />

              <div className="flex-shrink-0 flex items-start pt-0.5">
                <span className={`p-2 rounded-xl ${currentStyle.bgColor} ${currentStyle.borderColor} border`}>
                  {currentStyle.icon}
                </span>
              </div>

              <div className="flex-1 min-w-0 pr-1 pl-2 text-right">
                <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 tracking-wide mb-1 leading-normal select-none">
                  {displayTitle}
                </h4>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed break-words">
                  {displayBody}
                </p>
              </div>

              <div className="flex-shrink-0">
                <button 
                  onClick={() => setNotification(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-all duration-150 active:scale-90"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};

export const useAppNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useAppNotification must be used within a NotificationProvider');
  return context;
};
