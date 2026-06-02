import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

// تعريف أنواع الإشعارات المدعومة في PharmaFlow Pro
export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface Notification {
  message: string;
  type: NotificationType;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// مغير إشعارات خارجي static للوصول الشامل من خارج وداخل بيئة ريأكت
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
  
  // تتبع الطابع الزمني ومحتوى الرسالة لمنع التكرار (fingerprinting)
  const lastProcessed = useRef<{ [key: string]: number }>({});

  // دالة إطلاق الإشعار مع تطبيق شروط الاستثناء والتفرد
  const showNotification = useCallback((message: string, type: NotificationType, duration = 3000) => {
    if (!message) return;

    const fingerprint = `${type}_${message}`;
    const now = Date.now();
    const lastTime = lastProcessed.current[fingerprint] || 0;

    // 1. منع تكرار نفس التنبيه في فترات قصيرة جداً (أقل من 2.5 ثانية)
    if (now - lastTime < 2500) {
      console.log(`[NotificationContext] Blocked duplicate notification: "${message}"`);
      return;
    }

    lastProcessed.current[fingerprint] = now;

    // 2. تفعيل التنبيه الفردي فوراً (إن كان هناك تنبيه سابق يتم استبداله ليبقى تنبيه واحد دائماً في الشاشة)
    setNotification({ message, type, duration });
  }, []);

  // تسجيل المغير الشامل للخدمة الثابتة
  useEffect(() => {
    globalNotifier = showNotification;
    return () => {
      globalNotifier = null;
    };
  }, [showNotification]);

  // إخفاء التنبيه تلقائياً مع انتهاء المدة لمكافحة جمود الواجهة
  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => {
      setNotification(null);
    }, notification.duration || 3000);

    return () => clearTimeout(timer);
  }, [notification]);

  // استماع لزر الـ Escape لإغلاق الإجراء بسرعة وسلاسة (إمكانية الوصول)
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

  // تفكيك النص لفرز العناوين عن القيمة المعمولة لمد طابع النظافة الصيدلانية
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
      // عناوين افتراضية في غياب الفصل الصريح بالنقاط
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

  // ميزات الألوان والأمور البصرية والحدود المتناغمة مع هوية PharmaFlow Pro
  const getConfig = () => {
    switch (notification?.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/20',
          textColor: 'text-emerald-400',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-6 h-6 text-rose-500" />,
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/20',
          textColor: 'text-rose-400',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/20',
          textColor: 'text-amber-400',
        };
      default:
        return {
          icon: <Info className="w-6 h-6 text-blue-500" />,
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
          textColor: 'text-blue-400',
        };
    }
  };

  const currentStyle = getConfig();

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}

      <AnimatePresence>
        {notification && (
          <div 
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none font-sans" 
            dir="rtl"
            role="alert"
            aria-live="assertive"
          >
            {/* خلفية غامقة خفيفة معتمة لتركيز الانتباه وحل مشكلة العوم العشوائي */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]"
            />

            {/* نافذة التنبيه المعلقة في المنتصف */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-[320px] md:max-w-[420px] bg-slate-900/95 dark:bg-slate-950/95 border border-slate-800 text-slate-100 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] p-5 pointer-events-auto flex gap-4 overflow-hidden"
            >
              {/* شريط زينة جانبي لتعزيز الطابع */}
              <div className={`absolute top-0 right-0 bottom-0 w-1.5 ${notification.type === 'success' ? 'bg-emerald-500' : notification.type === 'error' ? 'bg-rose-500' : notification.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />

              <div className="flex-shrink-0 flex items-start pt-0.5">
                <span className={`p-2 rounded-xl ${currentStyle.bgColor} ${currentStyle.borderColor} border`}>
                  {currentStyle.icon}
                </span>
              </div>

              <div className="flex-1 min-w-0 pr-1 pl-2">
                <h4 className="text-sm font-bold text-slate-100 tracking-wide mb-1 leading-normal select-none">
                  {displayTitle}
                </h4>
                <p className="text-base font-semibold text-slate-200 leading-relaxed break-words">
                  {displayBody}
                </p>
              </div>

              {/* زر الإغلاق اليدوي الدائري الصغير */}
              <div className="flex-shrink-0">
                <button 
                  onClick={() => setNotification(null)}
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-xl transition-all duration-150 active:scale-90"
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

// Custom Hook لاستدعاء الإشعار بسهولة في أي ملف
export const useAppNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useAppNotification must be used within a NotificationProvider');
  return context;
};
