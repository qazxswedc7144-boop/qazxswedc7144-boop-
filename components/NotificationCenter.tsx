
import React, { useState, useEffect } from 'react';
import { db } from '../services/database';
import { alertBotService } from '../services/alertBot.service';
import { MedicineAlert } from '../types';
import { useEventBus, useUI } from '../store/AppContext'; 
import { Badge } from './SharedUI';
import { Bell, Package, AlertCircle, Clock, Calendar } from 'lucide-react';
import { EVENTS } from '../services/eventBus';

const NotificationCenter: React.FC = () => {
  const [alerts, setAlerts] = useState<MedicineAlert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { version } = useUI(); 

  // Fix: Made loadAlerts async to await db response
  const loadAlerts = async () => {
    const allAlerts = await db.getMedicineAlerts();
    const visibleAlerts = allAlerts
      .filter(a => !a.IsRead)
      .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
    setAlerts(visibleAlerts);
  };

  useEffect(() => {
    loadAlerts();
  }, [version, isOpen]);

  useEventBus(EVENTS.UI_NOTIFICATIONS_UPDATED, () => {
    loadAlerts();
  });

  const handleMarkRead = async (id: string) => {
    await alertBotService.markAsRead(id);
    await loadAlerts();
  };

  const unreadCount = alerts.filter(n => !n.IsRead).length;

  return (
    <div className="relative font-['Cairo']" dir="rtl">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#1E4D4D] transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-12 w-80 bg-white rounded-[32px] shadow-2xl border border-slate-100 z-[110] overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xs font-black text-[#1E4D4D]">التنبيهات الدوائية</h3>
                <Badge variant={unreadCount > 0 ? 'danger' : 'neutral'}>{unreadCount} جديد</Badge>
             </div>

             <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {alerts.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <div className="text-3xl opacity-20">✅</div>
                    <p className="text-[10px] font-bold text-slate-400">نظامك سليم، لا توجد تنبيهات</p>
                  </div>
                ) : (
                  alerts.map(alert => (
                    <div 
                      key={alert.AlertID} 
                      onClick={() => handleMarkRead(alert.AlertID)}
                      className={`p-4 border-b border-slate-50 cursor-pointer transition-colors ${alert.IsRead ? 'opacity-50' : 'bg-red-50/10 hover:bg-red-50/30'}`}
                    >
                       <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                            alert.Severity === 'Critical' ? 'bg-red-100 text-red-600' : 
                            alert.Severity === 'Warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-500'
                          }`}>
                            {alert.Type === 'LOW_STOCK' ? <Package size={14} /> : alert.Type === 'EXPIRY' ? <Calendar size={14} /> : <AlertCircle size={14} />}
                          </div>
                          <div className="min-w-0">
                             <h4 className="text-[11px] font-black text-slate-700">{alert.Title}</h4>
                             <p className="text-[9px] text-slate-500 font-bold leading-relaxed mt-0.5">{alert.Message}</p>
                             <span className="text-[8px] text-slate-300 font-bold mt-2 flex items-center gap-1">
                               <Clock size={8} /> {new Date(alert.Date).toLocaleTimeString('ar-SA')}
                             </span>
                          </div>
                       </div>
                    </div>
                  ))
                )}
             </div>
             
             {alerts.length > 0 && (
               <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-3 bg-slate-50 text-[10px] font-black text-slate-400 hover:text-[#1E4D4D] transition-colors"
               >إغلاق</button>
             )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
