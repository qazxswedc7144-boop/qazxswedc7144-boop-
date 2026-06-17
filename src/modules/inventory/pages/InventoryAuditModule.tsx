import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/core/db';
import { AuditItem, DailyAuditTask } from '@/types';
import { NotificationService } from '@/context/NotificationContext';
import { 
  InventoryConsistencyEngine, 
  ConsistencyAuditReport 
} from '@/modules/inventory/services/InventoryConsistencyEngine';
import { 
  AlertTriangle, CheckCircle, RefreshCw, 
  Sliders, AlertCircle, CheckSquare,
  Wrench, Activity, Database, Check, Cpu
} from 'lucide-react';

interface InventoryAuditModuleProps {
  lang: 'en' | 'ar';
  onNavigate?: (view: any) => void;
}

const InventoryAuditModule: React.FC<InventoryAuditModuleProps> = ({ lang, onNavigate }) => {
  const isAr = lang === 'ar';
  const [task, setTask] = useState<DailyAuditTask | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  // Active Tab: 'daily' (original checklist) or 'systemic' (Advanced consistency report)
  const [activeTab, setActiveTab] = useState<'daily' | 'systemic'>('daily');

  // advanced systemic audit states
  const [auditReport, setAuditReport] = useState<ConsistencyAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [systemicSearch, setSystemicSearch] = useState('');

  // Fetch task using await inside useEffect
  useEffect(() => {
    const fetchTask = async () => {
      try {
        const todayStr = new Date().toISOString().substring(0, 10);
        let currentTask = await db.getDailyAuditTask(todayStr);
        if (!currentTask) {
          const products = await db.getProducts();
          const items = products.slice(0, 10).map((p: any) => ({
            id: p.id,
            product_id: p.id,
            name: p.name,
            bookQty: p.stock ?? p.StockQuantity ?? 0,
            actualQty: undefined,
            status: 'pending',
            date: todayStr
          }));
          const id = db.generateId('DT');
          const newTask = {
            id,
            taskId: id,
            date: todayStr,
            items,
            completed: false,
            status: 'PENDING'
          };
          await db.createDailyAuditTask(newTask);
          currentTask = newTask as any;
        }
        if (currentTask) {
          setTask(currentTask);
          if (currentTask.completed) setIsFinished(true);
        }
      } catch (error) {
        console.error("Failed to fetch audit task:", error);
      }
    };
    fetchTask();
  }, []);

  const handleQtyChange = async (id: string, val: string) => {
    if (!task) return;
    const qty = parseInt(val);
    const updatedItems: AuditItem[] = task.items.map(item => {
      if (item.id === id) {
        const status: 'pending' | 'matched' | 'mismatch' = isNaN(qty) ? 'pending' : (qty === item.bookQty ? 'matched' : 'mismatch');
        return { ...item, actualQty: isNaN(qty) ? undefined : qty, status };
      }
      return item;
    });
    setTask({ ...task, items: updatedItems });
    await db.saveAuditProgress(updatedItems);
  };

  const handleReasonChange = async (id: string, reason: string) => {
    if (!task) return;
    const updatedItems: AuditItem[] = task.items.map(item => 
      item.id === id ? { ...item, reason } : item
    );
    setTask({ ...task, items: updatedItems });
    await db.saveAuditProgress(updatedItems);
  };

  const handleFinalize = async () => {
    if (!task) return;
    const allDone = task.items.every(i => i.status !== 'pending');
    if (!allDone) {
      NotificationService.warning(isAr ? "يرجى إكمال جرد كافة الأصناف" : "Please complete all items");
      return;
    }
    await db.finalizeAudit(task.id, { items: task.items, completed: true });
    setIsFinished(true);
  };

  const filteredItems = useMemo(() => {
    if (!task) return [];
    if (!searchTerm.trim()) return task.items;
    const term = searchTerm.toLowerCase();
    return task.items.filter(item => item.name.toLowerCase().includes(term));
  }, [task, searchTerm]);

  // Systemic Audit actions
  const runSystemicAudit = async () => {
    setIsAuditing(true);
    try {
      const report = await InventoryConsistencyEngine.runFullAudit();
      setAuditReport(report);
      if (report.success) {
        if (report.mismatchedProductsCount > 0) {
          NotificationService.warning(
            isAr 
              ? `تم رصد عدد ${report.mismatchedProductsCount} انحراف في حركة المخازن!` 
              : `Found ${report.mismatchedProductsCount} ledger discrepancies!`
          );
        } else {
          NotificationService.success(
            isAr ? "جميع سجلات وجرد المخازن متطابقة بنسبة 100%!" : "100% complete and verified ledger!"
          );
        }
      }
    } catch (err: any) {
      NotificationService.error(isAr ? "فشل تشغيل محرك الجرد" : "Failed running systemic audit");
    } finally {
      setIsAuditing(false);
    }
  };

  const repairSystemicMismatches = async () => {
    if (!auditReport) return;
    setIsRepairing(true);
    try {
      const patch = await InventoryConsistencyEngine.repairMismatches(auditReport);
      if (patch.success) {
        NotificationService.success(
          isAr 
            ? `تمت تسوية وإصلاح عدد ${patch.repairedCount} فوارق دفتري وتشغيلات وتكرارات بنجاح!` 
            : `Successfully repaired ${patch.repairedCount} discrepancies!`
        );
        // Re-run audit to show everything clean and green
        const freshReport = await InventoryConsistencyEngine.runFullAudit();
        setAuditReport(freshReport);
      } else {
        NotificationService.error(isAr ? "فشلت عملية الإصلاح التلقائي" : "Repair execution failed");
      }
    } catch (err: any) {
      NotificationService.error(err.message || "Error during automatic repair");
    } finally {
      setIsRepairing(false);
    }
  };

  // Filter reconciliation table items
  const filteredReconciliation = useMemo(() => {
    if (!auditReport) return [];
    if (!systemicSearch.trim()) return auditReport.reconciliationItems;
    const term = systemicSearch.toLowerCase();
    return auditReport.reconciliationItems.filter(item => 
      item.name.toLowerCase().includes(term) || item.productId.toLowerCase().includes(term)
    );
  }, [auditReport, systemicSearch]);

  if (isFinished) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-500 min-h-full bg-[#F0F7F7]">
        <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-6xl shadow-inner mb-4">✨</div>
        <h2 className="text-3xl font-black text-[#1E4D4D]">{isAr ? 'رائع! عمل متقن' : 'Amazing! Great Job'}</h2>
        <p className="max-w-md text-slate-500 font-bold leading-relaxed">
          {isAr 
            ? 'لقد ساهمت في الحفاظ على دقة المخزون بنسبة 100% اليوم. تم تحديث كافة السجلات وتوثيق الفوارق بنجاح.' 
            : 'You helped maintain 100% stock accuracy today. All records updated and mismatches logged successfully.'}
        </p>
        <button 
          onClick={() => onNavigate?.('dashboard')}
          className="bg-[#1E4D4D] text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform"
        >
          {isAr ? 'العودة للرئيسية ➦' : 'Back to Dashboard ➦'}
        </button>
      </div>
    );
  }

  const progress = task ? (task.items.filter(i => i.status !== 'pending').length / task.items.length) * 100 : 0;

  return (
    <div className="p-6 md:p-10 space-y-8 bg-[#F0F7F7] min-h-full" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => onNavigate?.('inventory')}
            className="w-12 h-12 bg-white rounded-2xl text-[#1E4D4D] flex items-center justify-center shadow-md active:scale-90 transition-transform"
          >
            {isAr ? '➔' : '➔'}
          </button>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-[#1E4D4D]">
              {isAr ? 'فحص وجرد اتساق المخزون' : 'Stock Consistency & Auditing'}
            </h2>
            <p className="text-slate-400 text-sm font-bold">
              {isAr 
                ? 'تدقيق الحركات وجدول القيود ومعاملات التشغيلات مع سلامة الأرصدة التجميعية' 
                : 'Process ledger verification, movements consistency, duplicates and automated repairs'}
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-white/70 p-1.5 rounded-2xl border border-slate-100 gap-2 shrink-0">
          <button 
            onClick={() => setActiveTab('daily')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'daily' ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-500 hover:text-[#1E4D4D]'
            }`}
          >
            <CheckSquare size={14} />
            <span>{isAr ? 'مهمة الجرد اليومي' : 'Daily Auditing'}</span>
          </button>
          <button 
            onClick={() => {
              setActiveTab('systemic');
              if (!auditReport) runSystemicAudit();
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'systemic' ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-500 hover:text-[#1E4D4D]'
            }`}
          >
            <Cpu size={14} />
            <span>{isAr ? 'مطابق اتساق القيود والمخزن' : 'Systemic Consistency Ledger'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'daily' ? (
        // TAB 1: DAILY COUNT AUDITING TASK
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <input 
                type="text" 
                placeholder={isAr ? 'بحث عن صنف في مهمة اليوم...' : 'Search item in task...'}
                className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-3 text-xs font-black focus:outline-none focus:border-[#1E4D4D] shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
            </div>
            
            <div className="flex flex-col gap-1 w-full md:w-64 shrink-0">
              <div className="w-full bg-white rounded-full h-3 p-0.5 shadow-inner border border-slate-100 overflow-hidden">
                <div className="bg-[#1E4D4D] h-full rounded-full transition-all duration-700" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-[10px] font-black text-slate-400 text-left uppercase">{Math.round(progress)}% {isAr ? 'مكتمل' : 'Completed'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredItems.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-[40px] p-8 border-2 border-white shadow-sm flex flex-col md:flex-row items-center gap-8 transition-all hover:shadow-md">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-4xl shadow-inner shrink-0">
                  {idx % 2 === 0 ? '💊' : '🩹'}
                </div>
                
                <div className="flex-1 text-center md:text-right">
                  <h3 className="text-xl font-black text-[#1E4D4D] mb-1">{item.name}</h3>
                  <div className="flex items-center justify-center md:justify-start gap-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? 'الرصيد الدفتري:' : 'Book Balance:'}</span>
                    <span className="text-lg font-black text-slate-700">{item.bookQty}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-48">
                  <label className="text-[10px] font-black text-[#1E4D4D] uppercase tracking-widest text-center">{isAr ? 'العدد الفعلي' : 'Actual Count'}</label>
                  <input 
                    type="number"
                    placeholder="0"
                    value={item.actualQty ?? ''}
                    onChange={(e) => handleQtyChange(item.id, e.target.value)}
                    className={`w-full text-center py-4 rounded-2xl text-xl font-black border-4 focus:outline-none transition-all ${
                      item.status === 'matched' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 
                      item.status === 'mismatch' ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-100 bg-slate-50 text-slate-400'
                    }`}
                  />
                </div>

                {item.status === 'mismatch' && (
                  <div className="w-full md:w-64 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-2">{isAr ? 'سبب الفارق' : 'Reason for mismatch'}</label>
                    <select 
                      className="w-full bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm font-bold text-red-700 focus:outline-none"
                      value={item.reason || ''}
                      onChange={(e) => handleReasonChange(item.id, e.target.value)}
                    >
                      <option value="">-- {isAr ? 'اختر السبب' : 'Select Reason'} --</option>
                      <option value="Damage">{isAr ? 'تلف صنف' : 'Damaged Item'}</option>
                      <option value="Entry Error">{isAr ? 'خطأ في الإدخال' : 'Data Entry Error'}</option>
                      <option value="Missing">{isAr ? 'فقدان / ضياع' : 'Missing Item'}</option>
                      <option value="Expired Not Removed">{isAr ? 'منتهي لم يستبعد' : 'Expired not removed'}</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
            
            {filteredItems.length === 0 && (
              <div className="py-20 text-center text-slate-300 italic font-black">
                {isAr ? 'لا توجد أصناف تطابق بحثك في مهمة اليوم' : 'No matching items in today\'s task'}
              </div>
            )}
          </div>

          <div className="pt-10 flex justify-center pb-10">
            <button 
              onClick={handleFinalize}
              disabled={progress < 100}
              className={`px-16 py-6 rounded-3xl font-black text-xl shadow-2xl transition-all active:scale-95 ${
                progress === 100 ? 'bg-[#1E4D4D] text-white hover:bg-[#2A6666]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isAr ? 'تأكيد وحفظ الجرد 🔒' : 'Confirm & Save Audit 🔒'}
            </button>
          </div>
        </div>
      ) : (
        // TAB 2: ADVANCED LEgER CONSISTENCY & RECONCILIATION ENGINE Dashboard
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Top Actions Panel */}
          <div className="bg-white rounded-[40px] p-8 border-2 border-white shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-[#F0F7F7] text-[#1E4D4D] rounded-[24px] flex items-center justify-center text-3xl shadow-inner">
                <Database size={28} />
              </div>
              <div className="space-y-2 text-center lg:text-right">
                <h3 className="text-xl font-black text-[#1E4D4D]">{isAr ? 'تدقيق الحسابات والمخزن المتكامل' : 'Steel-Clad Ledger Reconciliator'}</h3>
                <p className="text-xs text-slate-400 font-bold max-w-xl">
                  {isAr 
                    ? 'فحص جرد كامل ضد قيود فواتير التوريد والبيع والتسويات والمرتجعات وفروق باتشات الصيدلية.' 
                    : 'Analyze Dexie transaction history records to re-calculate ideal on-hand balances.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
              <button
                onClick={runSystemicAudit}
                disabled={isAuditing}
                className="flex-1 lg:flex-none h-14 px-8 bg-[#1E4D4D] text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                <RefreshCw size={16} className={isAuditing ? "animate-spin" : ""} />
                <span>{isAuditing ? (isAr ? "جاري الفحص المتقدم..." : "Examining Database...") : (isAr ? "تشغيل تدقيق الفواتير والمخزن 🔎" : "Execute Balance Audit 🔎")}</span>
              </button>

              {auditReport && auditReport.mismatchedProductsCount > 0 && (
                <button
                  onClick={repairSystemicMismatches}
                  disabled={isRepairing}
                  className="flex-1 lg:flex-none h-14 px-8 bg-amber-500 text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 border border-amber-600/10"
                >
                  <Wrench size={16} className={isRepairing ? "animate-spin" : ""} />
                  <span>{isRepairing ? (isAr ? "جاري إعادة التوازن التام..." : "Balancing Ledger...") : (isAr ? "إصلاح وتصفير الانحرافات آلياً 🛠️" : "Overwrite Mismatch & Repair 🛠️")}</span>
                </button>
              )}
            </div>
          </div>

          {auditReport && (
            <>
              {/* Metric Breakdown Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                
                <div className="bg-white p-6 rounded-[32px] border-2 border-white shadow-sm flex flex-col justify-between min-h-[140px]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? 'إصدارات الأصناف المفحوصة' : 'Products Audited'}</p>
                  <div className="flex items-baseline justify-between mt-4">
                    <span className="text-4xl font-black text-slate-800">{auditReport.totalProductsCount}</span>
                    <span className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-sm font-bold">📦</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border-2 border-white shadow-sm flex flex-col justify-between min-h-[140px]">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{isAr ? 'أرصدة سليمة 100%' : 'Perfect Records'}</p>
                  <div className="flex items-baseline justify-between mt-4">
                    <span className="text-4xl font-black text-emerald-600">{auditReport.matchedProductsCount}</span>
                    <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle size={14} /></span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border-2 border-white shadow-sm flex flex-col justify-between min-h-[140px]">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{isAr ? 'الفروقات والانحرافات' : 'Inventory Deviations'}</p>
                  <div className="flex items-baseline justify-between mt-4">
                    <span className="text-4xl font-black text-amber-500">{auditReport.mismatchedProductsCount}</span>
                    <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center"><AlertTriangle size={14} /></span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border-2 border-white shadow-sm flex flex-col justify-between min-h-[140px]">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{isAr ? 'الكميات السالبة الحرجة' : 'Negative Stock Incidents'}</p>
                  <div className="flex items-baseline justify-between mt-4">
                    <span className="text-4xl font-black text-red-500">{auditReport.negativeStockCount}</span>
                    <span className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center"><AlertCircle size={14} /></span>
                  </div>
                </div>

              </div>

              {/* Mismatch & Recommendation Report Container */}
              <div className="bg-white rounded-[40px] p-8 border-2 border-white shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                  <Activity className="text-[#1E4D4D]" size={20} />
                  <h3 className="text-lg font-black text-[#1E4D4D]">{isAr ? 'تقرير تتبع وتحليل العيوب البرمجية والبيانات المخزنية' : 'Integrity Mismatch & System recommendations'}</h3>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                  {auditReport.mismatches.map((err) => (
                    <div 
                      key={err.id} 
                      className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${
                        err.type === 'NEGATIVE_STOCK' || err.type === 'ORPHAN'
                          ? 'bg-red-50/50 border-red-100 text-red-900'
                          : err.type === 'DUPLICATE' 
                            ? 'bg-amber-50/50 border-amber-100 text-amber-900'
                            : 'bg-indigo-50/50 border-indigo-100 text-indigo-900'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {err.severity === 'HIGH' ? (
                          <AlertCircle size={18} className="text-red-600 animate-pulse" />
                        ) : (
                          <AlertTriangle size={18} className="text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2 text-right">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black uppercase bg-white/75 px-2 py-0.5 rounded-full border border-current">
                            {err.type}
                          </span>
                          {err.productName && (
                            <span className="text-xs font-black text-slate-700"> {err.productName} </span>
                          )}
                        </div>
                        <p className="text-xs font-bold font-sans">{err.description}</p>
                        <p className="text-[11px] opacity-75 font-serif italic">{isAr ? 'التوصية البرمجية:' : 'Recommendation:'} {err.recommendation}</p>
                      </div>
                    </div>
                  ))}

                  {auditReport.mismatches.length === 0 && (
                    <div className="py-10 text-center flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                        <Check size={24} strokeWidth={3} />
                      </div>
                      <h4 className="text-sm font-black text-[#1E4D4D]">{isAr ? 'تكامل تام ومثالي لبنائك!' : 'Perfect Integrity Verified!'}</h4>
                      <p className="text-xs text-slate-400 font-bold">{isAr ? 'لا توجد أي فوارق دفتري، قيود مكررة، أو حركات يتيمة في السجلات.' : 'All ledger transactions and hand-counts are balanced 100%'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Table Ledger Reconciliation Listing */}
              <div className="bg-white rounded-[40px] p-8 border-2 border-white shadow-sm space-y-6">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Sliders className="text-[#1E4D4D]" size={20} />
                    <h3 className="text-base font-black text-[#1E4D4D]">{isAr ? 'جدول المطابقة الشاملة للأرصدة (Stock Reconciliation Report)' : 'Detailed Stock Reconciliation Report'}</h3>
                  </div>

                  <div className="relative w-full md:w-64">
                    <input 
                      type="text" 
                      placeholder={isAr ? 'بحث بالمنتج أو المعرف...' : 'Search product...'}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-2.5 text-xs font-black focus:outline-none focus:border-[#1E4D4D] shadow-inner"
                      value={systemicSearch}
                      onChange={e => setSystemicSearch(e.target.value)}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-50">
                  <table className="w-full text-right min-w-[800px]">
                    <thead className="bg-[#1E4D4D]/5 text-[11px] font-black text-[#1E4D4D] uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">{isAr ? 'المنتج' : 'Product'}</th>
                        <th className="px-6 py-4 text-center">{isAr ? 'الافتتاحي' : 'Opening'}</th>
                        <th className="px-6 py-4 text-center">{isAr ? 'الوارد (+)' : 'Purchases (+)'}</th>
                        <th className="px-6 py-4 text-center">{isAr ? 'المنصرف (-)' : 'Sales (-)'}</th>
                        <th className="px-6 py-4 text-center">{isAr ? 'تسويات (+/-)' : 'Adjustments'}</th>
                        <th className="px-6 py-4 text-center">{isAr ? 'الرصيد الدفتري' : 'Listed DB Stock'}</th>
                        <th className="px-6 py-4 text-center">{isAr ? 'الرصيد الرياضي' : 'Calculated Stock'}</th>
                        <th className="px-6 py-4 text-center">{isAr ? 'التشغيلات' : 'Batches Total'}</th>
                        <th className="px-6 py-4 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs font-bold text-slate-500">
                      {filteredReconciliation.map((item) => (
                        <tr key={item.productId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-black text-slate-800">{item.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {item.productId}</p>
                          </td>
                          <td className="px-6 py-4 text-center">{item.openingStock}</td>
                          <td className="px-6 py-4 text-emerald-600 text-center">+{item.purchases}</td>
                          <td className="px-6 py-4 text-red-500 text-center">-{item.sales}</td>
                          <td className="px-6 py-4 text-blue-600 text-center">{item.adjustments >= 0 ? '+' : ''}{item.adjustments}</td>
                          <td className="px-6 py-4 text-slate-800 text-center font-black">{item.currentStock}</td>
                          <td className="px-6 py-4 text-slate-800 text-center font-black">{item.calculatedStock}</td>
                          <td className="px-6 py-4 text-center">{item.batchesSum}</td>
                          <td className="px-6 py-4 text-center">
                            {item.mismatch ? (
                              <span className="inline-flex flex-col items-center">
                                <span className="bg-red-50 text-red-700 text-[10px] px-2.5 py-1 rounded-full border border-red-100 font-bold">
                                  {isAr ? '❌ غير متطابق' : '❌ Discrepancy'}
                                </span>
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2.5 py-1 rounded-full border border-emerald-100 font-bold">
                                {isAr ? '✅ متطابق' : '✅ Balanced'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {filteredReconciliation.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-6 py-12 text-center text-slate-300 italic font-black">
                            {isAr ? 'لا توجد سجلات تطابق البحث' : 'No records match search criterion'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            </>
          )}

        </div>
      )}

    </div>
  );
};

export default InventoryAuditModule;
