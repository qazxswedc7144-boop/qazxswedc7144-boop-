
import React, { useEffect, useState } from 'react';
import { Card } from './SharedUI';
import { AlertCenter } from '../services/AlertCenter';
import { ProfitHealthAnalyzer } from '../services/ProfitHealthAnalyzer';
import { BehaviorMonitor } from '../services/BehaviorMonitor';
import { db } from '../services/database';
import { AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, Activity, Users, FileText, Clock } from 'lucide-react';

export const AISummaryPanel: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [riskyUsers, setRiskyUsers] = useState<any[]>([]);
  const [mostEdited, setMostEdited] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const activeAlerts = await AlertCenter.getActiveAlerts();
      setAlerts(activeAlerts);
      
      const latestHealth = await ProfitHealthAnalyzer.getLatestHealth();
      setHealth(latestHealth);
      
      const risky = await BehaviorMonitor.getRiskyUsers();
      setRiskyUsers(risky);
      
      const sales = await db.getSales();
      const purchases = await db.getPurchases();
      const all = [...sales, ...purchases];
      const most = all.sort((a, b) => ((b as any).versionNumber || 0) - ((a as any).versionNumber || 0))[0];
      setMostEdited(most);
    };
    fetchData();
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Alerts Summary */}
      <Card className="flex flex-col justify-between h-40 border-b-4 border-red-500 group hover:shadow-2xl transition-all !p-6 bg-white relative overflow-hidden !rounded-[32px]">
        <div className="flex justify-between items-start relative z-10">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] opacity-80">تنبيهات نشطة</p>
            <h2 className="text-2xl font-black text-[#1E4D4D] leading-none">{alerts.length} <span className="text-[10px] opacity-30 font-bold uppercase">تنبيه</span></h2>
          </div>
          <div className="w-12 h-12 bg-slate-50 text-red-600 rounded-2xl flex items-center justify-center text-[24px] shadow-inner group-hover:scale-110 transition-transform shrink-0">
            <AlertTriangle size={24} />
          </div>
        </div>
        <div className="flex items-center gap-1 mt-4 relative z-10">
          <ShieldAlert size={12} className="text-red-500" />
          <span className="text-[10px] font-black text-red-600">منها {alerts.filter(a => a.severity === 'CRITICAL').length} حرجة</span>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
      </Card>

      {/* Health Status */}
      <Card className="flex flex-col justify-between h-40 border-b-4 border-emerald-500 group hover:shadow-2xl transition-all !p-6 bg-white relative overflow-hidden !rounded-[32px]">
        <div className="flex justify-between items-start relative z-10">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] opacity-80">حالة الربحية</p>
            <h2 className={`text-xl font-black leading-none ${health?.healthStatus === 'Healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {health?.healthStatus || 'جاري التحليل...'}
            </h2>
          </div>
          <div className={`w-12 h-12 bg-slate-50 ${health?.healthStatus === 'Healthy' ? 'text-emerald-600' : 'text-amber-600'} rounded-2xl flex items-center justify-center text-[24px] shadow-inner group-hover:scale-110 transition-transform shrink-0`}>
            {health?.netMovement >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-4 relative z-10">
          <Activity size={12} className="text-emerald-500" />
          <span className="text-[10px] font-black text-emerald-600">هامش الربح: {health?.grossProfitPercent?.toFixed(1)}%</span>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
      </Card>

      {/* Risky User */}
      <Card className="flex flex-col justify-between h-40 border-b-4 border-purple-500 group hover:shadow-2xl transition-all !p-6 bg-white relative overflow-hidden !rounded-[32px]">
        <div className="flex justify-between items-start relative z-10">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] opacity-80">المستخدم الأكثر نشاطاً</p>
            <h2 className="text-lg font-black text-[#1E4D4D] leading-none truncate max-w-[120px]">
              {riskyUsers[0]?.userId || 'لا يوجد'}
            </h2>
          </div>
          <div className="w-12 h-12 bg-slate-50 text-purple-600 rounded-2xl flex items-center justify-center text-[24px] shadow-inner group-hover:scale-110 transition-transform shrink-0">
            <Users size={24} />
          </div>
        </div>
        <div className="flex items-center gap-1 mt-4 relative z-10">
          <ShieldAlert size={12} className="text-purple-500" />
          <span className="text-[10px] font-black text-purple-600">درجة المخاطرة: {riskyUsers[0]?.riskScore?.toFixed(0)}</span>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
      </Card>

      {/* Most Edited Invoice */}
      <Card className="flex flex-col justify-between h-40 border-b-4 border-blue-500 group hover:shadow-2xl transition-all !p-6 bg-white relative overflow-hidden !rounded-[32px]">
        <div className="flex justify-between items-start relative z-10">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] opacity-80">الفاتورة الأكثر تعديلاً</p>
            <h2 className="text-xl font-black text-[#1E4D4D] leading-none">
              #{mostEdited?.SaleID || mostEdited?.invoiceId || '---'}
            </h2>
          </div>
          <div className="w-12 h-12 bg-slate-50 text-blue-600 rounded-2xl flex items-center justify-center text-[24px] shadow-inner group-hover:scale-110 transition-transform shrink-0">
            <FileText size={24} />
          </div>
        </div>
        <div className="flex items-center gap-1 mt-4 relative z-10">
          <Clock size={12} className="text-blue-500" />
          <span className="text-[10px] font-black text-blue-600">عدد التعديلات: {mostEdited?.versionNumber || 0}</span>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
      </Card>
    </div>
  );
};
