
import React, { useState, useEffect, useMemo } from 'react';
import { useAccounting, useUI } from '../store/AppContext';
import { accountingService } from '../services/accounting.service';
import { IntegrityReport, ReconciliationPoint } from '../types';
import { Card, Button, Badge } from '../components/SharedUI';

const ReconciliationModule: React.FC<{ onNavigate?: (v: any) => void }> = ({ onNavigate }) => {
  const { refreshAccounting } = useAccounting();
  const { addToast, currency } = useUI();
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    handleScan();
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    // محاكاة تأخير الفحص الشامل للجداول
    await new Promise(r => setTimeout(r, 1200));
    // Fix: Await the integrity check result
    const newReport = await accountingService.runIntegrityCheck();
    setReport(newReport);
    setIsScanning(false);
    if (!newReport.isHealthy) {
       addToast("تم اكتشاف فوارق مالية بين السجلات. يرجى المراجعة.", "warning");
    } else {
       addToast("كافة السجلات متطابقة بنجاح ✅", "success");
    }
  };

  const handleAutoAdjust = async (point: ReconciliationPoint) => {
    if (confirm(`هل أنت متأكد من رغبتك في ترحيل قيد تسوية بقيمة ${point.diff} د.إ لتصحيح الفرق في ${point.label}؟`)) {
       await accountingService.performAutoAdjustment(point.id, point.diff);
       refreshAccounting();
       handleScan();
       addToast("تمت التسوية بنجاح 🛠️", "success");
    }
  };

  return (
    <div className="space-y-8 p-6 md:p-10 pb-32 animate-in fade-in duration-500 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-[24px] flex items-center justify-center text-4xl shadow-xl">⚖️</div>
          <div>
            <h2 className="text-3xl font-black text-[#1E4D4D]">محرك المطابقة والتدقيق</h2>
            <p className="text-slate-400 font-bold text-sm">التدقيق المتقاطع بين الأستاذ العام والسجلات الفرعية</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" onClick={handleScan} isLoading={isScanning} icon="🔍">تحديث الفحص</Button>
          <button onClick={() => onNavigate?.('dashboard')} className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-[#1E4D4D] text-2xl font-black shadow-sm">➦</button>
        </div>
      </div>

      {!report ? (
        <div className="h-96 flex flex-col items-center justify-center space-y-4">
           <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
           <p className="font-black text-slate-400">جاري مسح قواعد البيانات وتدقيق الحسابات...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              {report.points.map(point => (
                <Card key={point.id} className={`border-r-8 transition-all hover:scale-[1.01] ${
                  point.status === 'balanced' ? 'border-emerald-500' : 
                  point.status === 'discrepancy' ? 'border-amber-500' : 'border-red-500'
                }`}>
                   <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                         <div className="flex items-center gap-3">
                            <h3 className="text-xl font-black text-[#1E4D4D]">{point.label}</h3>
                            <Badge variant={point.status === 'balanced' ? 'success' : point.status === 'discrepancy' ? 'warning' : 'danger'}>
                               {point.status === 'balanced' ? 'متطابق' : 'يوجد فرق'}
                            </Badge>
                         </div>
                         <p className="text-xs text-slate-400 font-bold leading-relaxed">{point.details}</p>
                         
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                            <div className="p-4 bg-slate-50 rounded-2xl">
                               <p className="text-[9px] font-black text-slate-400 uppercase mb-1">رصيد الأستاذ العام</p>
                               <p className="text-sm font-black text-[#1E4D4D]">{point.ledgerBalance.toLocaleString()} <span className="text-[10px] opacity-40">{currency}</span></p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl">
                               <p className="text-[9px] font-black text-slate-400 uppercase mb-1">رصيد السجلات الفرعية</p>
                               <p className="text-sm font-black text-[#1E4D4D]">{point.subledgerBalance.toLocaleString()} <span className="text-[10px] opacity-40">{currency}</span></p>
                            </div>
                            <div className={`p-4 rounded-2xl border-2 ${Math.abs(point.diff) > 0.01 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                               <p className="text-[9px] font-black text-slate-400 uppercase mb-1">الفارق الحالي</p>
                               <p className={`text-sm font-black ${Math.abs(point.diff) > 0.01 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {point.diff.toLocaleString()}
                               </p>
                            </div>
                         </div>
                      </div>

                      <div className="shrink-0 flex md:flex-col justify-end gap-3">
                         {point.status !== 'balanced' && (
                            <Button variant="secondary" size="sm" icon="🛠️" onClick={() => handleAutoAdjust(point)}>تسوية آلية</Button>
                         )}
                         <Button variant="ghost" size="sm" icon="📂">تفاصيل الحركات</Button>
                      </div>
                   </div>
                </Card>
              ))}
           </div>

           <div className="lg:col-span-1 space-y-6">
              <Card className="bg-[#1E4D4D] text-white overflow-hidden relative border-4 border-emerald-900/20 h-fit">
                 <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-center">
                       <h3 className="text-sm font-black uppercase tracking-widest">مؤشر جودة البيانات</h3>
                       <div className={`w-4 h-4 rounded-full animate-pulse ${report.isHealthy ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                    </div>
                    <div className="text-center py-4">
                       <p className="text-5xl font-black mb-2">{report.isHealthy ? '100%' : '92%'}</p>
                       <p className="text-[10px] opacity-60 font-bold uppercase tracking-[2px]">Data Integrity Score</p>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-white/10">
                       <div className="flex justify-between text-xs">
                          <span className="opacity-70">إجمالي الفروقات:</span>
                          <span className="font-black text-emerald-300">{report.totalDiff.toLocaleString()} AED</span>
                       </div>
                       <div className="flex justify-between text-xs">
                          <span className="opacity-70">تاريخ آخر تدقيق:</span>
                          <span className="font-black opacity-90">{new Date(report.timestamp).toLocaleDateString('ar-SA')}</span>
                       </div>
                    </div>
                 </div>
                 <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
              </Card>

              <Card className="space-y-4">
                 <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">تنبيهات المحرك الذكي</h4>
                 <div className="space-y-3">
                    {report.points.some(p => p.status === 'critical') ? (
                       <div className="p-4 bg-red-50 border border-red-100 rounded-3xl flex gap-4">
                          <span className="text-2xl">🚨</span>
                          <div className="space-y-1">
                             <p className="text-xs font-black text-red-800">فرق نقدي حرج!</p>
                             <p className="text-[10px] text-red-600 font-bold leading-relaxed">يتجاوز الفرق المكتشف حاجز الـ 500 د.إ. يوصى بمراجعة الكاميرات وجرد الصندوق يدوياً.</p>
                          </div>
                       </div>
                    ) : (
                       <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-3xl flex gap-4">
                          <span className="text-2xl">🛡️</span>
                          <div className="space-y-1">
                             <p className="text-xs font-black text-emerald-800">الحماية المحاسبية نشطة</p>
                             <p className="text-[10px] text-emerald-600 font-bold leading-relaxed">كافة المعادلات المحاسبية متزنة والميزانية تعكس الواقع المخزني بدقة.</p>
                          </div>
                       </div>
                    )}
                 </div>
              </Card>
           </div>
        </div>
      )}
    </div>
  );
};

export default ReconciliationModule;
