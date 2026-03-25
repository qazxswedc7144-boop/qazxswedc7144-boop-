
import React, { useEffect, useState } from 'react';
import { Card } from './SharedUI';
import { AlertCenter } from '../services/AlertCenter';
import { ProfitHealthAnalyzer } from '../services/ProfitHealthAnalyzer';
import { BehaviorMonitor } from '../services/BehaviorMonitor';
import { db } from '../services/database';
import { AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, Activity, Users, FileText } from 'lucide-react';

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Alerts Summary */}
      <Card className="!p-6 !rounded-[32px] bg-white border-2 border-red-50 shadow-sm relative overflow-hidden group">
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">تنبيهات نشطة</p>
            <h3 className="text-3xl font-black text-red-600">{alerts.length}</h3>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 relative z-10">
          <span className="text-[10px] font-bold text-slate-400">منها {alerts.filter(a => a.severity === 'CRITICAL').length} حرجة</span>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-red-50 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-700"></div>
      </Card>

      {/* Health Status */}
      <Card className="!p-6 !rounded-[32px] bg-white border-2 border-emerald-50 shadow-sm relative overflow-hidden group">
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">حالة الربحية</p>
            <h3 className={`text-xl font-black ${health?.healthStatus === 'Healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {health?.healthStatus || 'جاري التحليل...'}
            </h3>
          </div>
          <div className={`w-12 h-12 ${health?.healthStatus === 'Healthy' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} rounded-2xl flex items-center justify-center`}>
            {health?.netMovement >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 relative z-10">
          <Activity size={12} className="text-emerald-500" />
          <span className="text-[10px] font-bold text-slate-500">هامش الربح: {health?.grossProfitPercent?.toFixed(1)}%</span>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-50 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-700"></div>
      </Card>

      {/* Risky User */}
      <Card className="!p-6 !rounded-[32px] bg-white border-2 border-purple-50 shadow-sm relative overflow-hidden group">
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المستخدم الأكثر نشاطاً</p>
            <h3 className="text-lg font-black text-purple-600 truncate max-w-[120px]">
              {riskyUsers[0]?.userId || 'لا يوجد'}
            </h3>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <Users size={24} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 relative z-10">
          <ShieldAlert size={12} className="text-purple-500" />
          <span className="text-[10px] font-bold text-slate-500">درجة المخاطرة: {riskyUsers[0]?.riskScore?.toFixed(0)}</span>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-purple-50 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-700"></div>
      </Card>

      {/* Most Edited Invoice */}
      <Card className="!p-6 !rounded-[32px] bg-white border-2 border-blue-50 shadow-sm relative overflow-hidden group">
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الفاتورة الأكثر تعديلاً</p>
            <h3 className="text-lg font-black text-blue-600">
              #{mostEdited?.SaleID || mostEdited?.invoiceId || '---'}
            </h3>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <FileText size={24} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 relative z-10">
          <span className="text-[10px] font-bold text-slate-500">عدد التعديلات: {mostEdited?.versionNumber || 0}</span>
        </div>
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-50 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-700"></div>
      </Card>
    </div>
  );
};
