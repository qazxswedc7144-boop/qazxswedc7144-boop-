import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/core/db';
import { alertBotService } from '@/modules/ai/services/alertBotService';
import { MedicineAlert } from '@/types';
import { useEventBus, useUI } from '@/contexts/AppContext'; 
import { 
  Bell, Package, AlertCircle, Clock, Calendar, Check, 
  CheckCircle2, Trash2, Info, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { EVENTS } from '@/services/eventBus';
import { useAppNotification } from '@/context/NotificationContext';

const NotificationCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'system' | 'medicine'>('system');
  const [medicineAlerts, setMedicineAlerts] = useState<MedicineAlert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { version } = useUI(); 
  const { 
    notifications, 
    unreadCount: systemUnreadCount, 
    markAsRead: markSystemAsRead, 
    markAllAsRead: markSystemAllAsRead, 
    clearAll: clearSystemAll 
  } = useAppNotification();

  // جلب تنبيهات الأدوية
  const loadMedicineAlerts = useCallback(async () => {
    try {
      const allAlerts = await db.getMedicineAlerts();
      const visibleAlerts = allAlerts
        .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
      setMedicineAlerts(visibleAlerts);
    } catch (e) {
      console.error("[NotificationCenter] Error loading medicine alerts:", e);
    }
  }, []);

  useEffect(() => {
    loadMedicineAlerts();
  }, [version, isOpen, loadMedicineAlerts]);

  // تحديث فوري للتنبيهات عند إطلاق حدث المزامنة أو التحديث الجاري
  useEventBus(EVENTS.UI_NOTIFICATIONS_UPDATED, () => {
    loadMedicineAlerts();
  });

  const handleMarkMedicineRead = async (id: string) => {
    try {
      await alertBotService.markAsRead(id);
      await loadMedicineAlerts();
    } catch (e) {
      console.error("[NotificationCenter] Error marking medicine alert as read:", e);
    }
  };

  const handleMarkMedicineAllAsRead = async () => {
    try {
      const unread = medicineAlerts.filter(a => !a.IsRead);
      for (const alert of unread) {
        await alertBotService.markAsRead(alert.AlertID);
      }
      await loadMedicineAlerts();
    } catch (e) {
      console.error("[NotificationCenter] Error marking all medicine alerts as read:", e);
    }
  };

  const handleClearMedicineAll = async () => {
    try {
      // حذف التنبيهات من قاعدة البيانات الأساسية
      await db.systemAlerts.clear();
      await loadMedicineAlerts();
    } catch (e) {
      console.error("[NotificationCenter] Error clearing medicine alerts:", e);
    }
  };

  const medicineUnreadCount = medicineAlerts.filter(n => !n.IsRead).length;
  const totalUnreadCount = systemUnreadCount + medicineUnreadCount;

  // تنسيق طابع التاريخ المقروء
  const formatTime = (timestamp: number) => {
    try {
      const diff = Date.now() - timestamp;
      if (diff < 60000) return 'الآن';
      if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} دقيقة`;
      if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} ساعة`;
      return new Date(timestamp).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // أيقونة والوان الإشعار حسب النوع
  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
          colorClass: 'bg-emerald-50 border-emerald-150 text-emerald-800 dark:bg-emerald-950/35 dark:border-emerald-900/40 dark:text-emerald-300'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-500" />,
          colorClass: 'bg-rose-50 border-rose-150 text-rose-800 dark:bg-rose-950/35 dark:border-rose-900/40 dark:text-rose-300'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
          colorClass: 'bg-amber-50 border-amber-150 text-amber-800 dark:bg-amber-950/35 dark:border-amber-900/45 dark:text-amber-300'
        };
      default:
        return {
          icon: <Info className="w-3.5 h-3.5 text-blue-500" />,
          colorClass: 'bg-blue-50 border-blue-150 text-blue-850 dark:bg-blue-950/35 dark:border-blue-950/50 dark:text-blue-300'
        };
    }
  };

  return (
    <div className="relative font-cairo" dir="rtl">
      {/* زر الجرس التفاعلي */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#1E4D4D] dark:hover:text-emerald-400 hover:bg-[#1E4D4D]/5 dark:hover:bg-slate-800 transition-all active:scale-95 border border-slate-100 dark:border-slate-800 shadow-sm"
        title="مركز التنبيهات"
      >
        <Bell size={19} className={totalUnreadCount > 0 ? 'animate-swing' : ''} />
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-md animate-in zoom-in-50 duration-100">
            {totalUnreadCount}
          </span>
        )}
      </button>

      {/* لوحة عرض الإشعارات المنسدلة */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-12 w-[340px] md:w-[380px] bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 z-[110] overflow-hidden animate-in zoom-in-95 duration-100">
             
             {/* ترويسة مركز الإشعارات */}
             <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-[#1E4D4D] dark:text-emerald-400">مركز الإشعارات الشامل</h3>
                  {totalUnreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 text-[9px] font-extrabold rounded-md">
                      {totalUnreadCount} غير مقروء
                    </span>
                  )}
                </div>
                
                {/* أدوات التحكم الجماعية */}
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => {
                      if (activeTab === 'system') markSystemAllAsRead();
                      else handleMarkMedicineAllAsRead();
                    }}
                    className="p-1 px-1.5 bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700 text-slate-500 rounded-md text-[9px] font-bold hover:bg-slate-50 dark:hover:bg-slate-750 hover:text-emerald-600 transition-colors flex items-center gap-1"
                    title="تعليم الكل كمقروء"
                  >
                    <Check size={10} />
                    <span>مقروء</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (activeTab === 'system') clearSystemAll();
                      else handleClearMedicineAll();
                    }}
                    className="p-1 bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-700 text-slate-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 transition-colors"
                    title="تصفير السجل"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
             </div>

             {/* التبويبات الفاخرة للفرز السريري والمالي */}
             <div className="flex border-b border-slate-100 dark:border-slate-800 p-1 bg-slate-50/50 dark:bg-slate-950/30">
                <button 
                  onClick={() => setActiveTab('system')}
                  className={`flex-1 py-1.5 text-center text-[10px] font-black rounded-lg transition-all relative ${
                    activeTab === 'system' 
                      ? 'bg-white dark:bg-slate-800 text-[#1E4D4D] dark:text-emerald-400 shadow-sm border border-slate-100 dark:border-slate-700' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>تحركات النظام والعمليات</span>
                    {systemUnreadCount > 0 && (
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    )}
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('medicine')}
                  className={`flex-1 py-1.5 text-center text-[10px] font-black rounded-lg transition-all relative ${
                    activeTab === 'medicine' 
                      ? 'bg-white dark:bg-slate-800 text-[#1E4D4D] dark:text-emerald-400 shadow-sm border border-slate-100 dark:border-slate-700' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>الرقابة والتحذيرات الدوائية</span>
                    {medicineUnreadCount > 0 && (
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    )}
                  </div>
                </button>
             </div>

             {/* مساحة العرض الدوارة */}
             <div className="max-h-80 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
                
                {/* 1. تبويب النظام والعمليات المحاسبية */}
                {activeTab === 'system' && (
                  notifications.length === 0 ? (
                    <div className="p-8 text-center space-y-2 select-none">
                      <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <ShieldCheck size={20} className="text-emerald-500" />
                      </div>
                      <h4 className="text-[11px] font-black text-slate-600 dark:text-slate-300">سجل الإجراءات نظيف بالكامل</h4>
                      <p className="text-[9px] text-slate-400 font-bold max-w-[200px] mx-auto">سيتم إدراج تقارير العمليات وفواتير البيع والمشتريات وحالة الخادم هنا تلقائياً.</p>
                    </div>
                  ) : (
                    notifications.map(item => {
                      const styles = getNotificationStyles(item.type);
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => { if (item.isRead === 0 && item.id) markSystemAsRead(item.id); }}
                          className={`p-3.5 border-b border-slate-50 dark:border-slate-800/50 cursor-pointer transition-all flex justify-between items-start gap-2 ${
                            item.isRead === 1 
                              ? 'opacity-65 hover:bg-slate-50/50 dark:hover:bg-slate-850/30' 
                              : 'bg-emerald-50/5 hover:bg-emerald-50/10 dark:bg-emerald-950/5 border-r-[3px] border-r-emerald-500 dark:border-r-emerald-600'
                          }`}
                        >
                           <div className="flex gap-3 min-w-0">
                              <span className={`p-1.5 rounded-lg shrink-0 flex items-center justify-center border h-7 w-7 ${styles.colorClass}`}>
                                {styles.icon}
                              </span>
                              <div className="min-w-0 text-right">
                                 <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed break-words">{item.message}</p>
                                 <span className="text-[8px] text-slate-400 font-bold mt-1.5 flex items-center gap-1">
                                   <Clock size={8} /> {formatTime(item.timestamp)}
                                 </span>
                              </div>
                           </div>
                           
                           {item.isRead === 0 && (
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (item.id) markSystemAsRead(item.id);
                               }}
                               className="p-1 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-500 rounded-md border border-slate-150 dark:border-slate-700 active:scale-95 transition-all text-[8px]"
                               title="تعليم كمقروء"
                             >
                               <Check size={9} />
                             </button>
                           )}
                        </div>
                      );
                    })
                  )
                )}

                {/* 2. تبويب الرقابة والتنبيهات الطبية */}
                {activeTab === 'medicine' && (
                  medicineAlerts.length === 0 ? (
                    <div className="p-8 text-center space-y-2 select-none">
                      <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <Check className="text-emerald-500 w-5 h-5" />
                      </div>
                      <h4 className="text-[11px] font-black text-slate-600 dark:text-slate-300">أدويتك ومخزونك بسلامة تامة</h4>
                      <p className="text-[9px] text-slate-400 font-bold max-w-[200px] mx-auto">لا توجد أدوية منتهية الصلاحية أو ناقصة بالرفوف بالوقت الراهن.</p>
                    </div>
                  ) : (
                    medicineAlerts.map(alert => (
                      <div 
                        key={alert.AlertID} 
                        onClick={() => handleMarkMedicineRead(alert.AlertID)}
                        className={`p-3.5 border-b border-slate-50 dark:border-slate-800/50 cursor-pointer transition-all flex justify-between items-start gap-2 ${
                          alert.IsRead 
                            ? 'opacity-60 hover:bg-slate-50/50 dark:hover:bg-slate-850/30' 
                            : 'bg-red-50/10 hover:bg-red-50/20 dark:bg-red-950/5 border-r-[3px] border-r-red-500'
                        }`}
                      >
                         <div className="flex gap-3 min-w-0">
                            <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border text-[11px] font-bold ${
                              alert.Severity === 'Critical' 
                                ? 'bg-red-50 dark:bg-red-950/40 border-red-150 dark:border-red-900/40 text-red-600' 
                                : alert.Severity === 'Warning' 
                                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-150 dark:border-amber-900/40 text-amber-600' 
                                  : 'bg-blue-50 dark:bg-blue-950/40 border-blue-150 dark:border-blue-900/40 text-blue-505'
                            }`}>
                              {alert.Type === 'LOW_STOCK' ? <Package size={13} /> : alert.Type === 'EXPIRY' ? <Calendar size={13} /> : <AlertCircle size={13} />}
                            </div>
                            <div className="min-w-0 text-right">
                               <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-200">{alert.Title}</h4>
                               <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold leading-normal mt-0.5">{alert.Message}</p>
                               <span className="text-[8px] text-slate-350 font-bold mt-2 flex items-center gap-1">
                                 <Clock size={8} /> {new Date(alert.Date).toLocaleTimeString('ar-SA')}
                               </span>
                            </div>
                         </div>

                         {!alert.IsRead && (
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               handleMarkMedicineRead(alert.AlertID);
                             }}
                             className="p-1 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-500 rounded-md border border-slate-150 dark:border-slate-700 active:scale-95 transition-all text-[8px]"
                             title="تعليم كمقروء"
                           >
                             <Check size={9} />
                           </button>
                         )}
                      </div>
                    ))
                  )
                )}

             </div>
             
             {/* تذييل النافذة */}
             <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 text-center">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-[10px] font-black text-slate-400 hover:text-[#1E4D4D] dark:hover:text-emerald-400 transition-colors select-none"
                >إغلاق اللوحة</button>
             </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
