
import React, { useState, useCallback, useEffect } from 'react';
import { FinancialEngine } from '../services/financialEngine';
import { testSuite } from '../services/testSuite.service';
import { integrityVerifier } from '../services/integrityVerifier';
import { eventBus, EVENTS } from '../services/eventBus';
import { Card, Button, Badge } from './SharedUI';
import { useEventBus } from '../store/AppContext';
import { ShieldCheck, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'passed' | 'failed';
  message?: string;
}

const SystemHealthModule: React.FC<{ onNavigate?: (v: any) => void }> = ({ onNavigate }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [integrityStatus, setIntegrityStatus] = useState<{ isValid: boolean; checking: boolean }>({ isValid: true, checking: false });

  const checkIntegrity = async () => {
    setIntegrityStatus(p => ({ ...p, checking: true }));
    const result = await integrityVerifier.verifyChain();
    setIntegrityStatus({ isValid: result.isValid, checking: false });
  };

  useEffect(() => {
    checkIntegrity();
  }, []);

  const runTests = useCallback(async () => {
    setIsRunning(true);
    const { reports, passed, failed } = await testSuite.runAllTests();
    
    setResults(reports.map(r => ({
      name: r.substring(2),
      status: r.startsWith('✅') ? 'passed' : 'failed'
    })));
    
    setIsRunning(false);
    eventBus.emit(EVENTS.SYSTEM_TEST_RUN, { passed, failed });
  }, []);

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 font-['Cairo']" dir="rtl">
      <div className="flex items-center justify-between bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-[#1E4D4D] text-white rounded-3xl flex items-center justify-center text-3xl shadow-xl"><ShieldCheck size={32} /></div>
          <div>
            <h2 className="text-3xl font-black text-[#1E4D4D]">حماية ونزاهة النظام</h2>
            <p className="text-slate-400 font-bold text-sm">التدقيق الرقمي واختبارات سلامة المحرك المالي</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" onClick={runTests} isLoading={isRunning} icon="🧪">تشغيل الاختبارات</Button>
          <button onClick={() => onNavigate?.('dashboard')} className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-[#1E4D4D] text-2xl font-black shadow-sm">➦</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
           
           <Card className={`border-r-8 ${integrityStatus.isValid ? 'border-emerald-500' : 'border-red-600'}`}>
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <Activity className={integrityStatus.isValid ? 'text-emerald-500' : 'text-red-500'} />
                    <div>
                       <h3 className="font-black text-[#1E4D4D]">نزاهة سلسلة القيود (Financial Chain)</h3>
                       <p className="text-[10px] text-slate-400 font-bold">التأكد من عدم تعديل البيانات مباشرة في قاعدة البيانات</p>
                    </div>
                 </div>
                 <Badge variant={integrityStatus.isValid ? 'success' : 'danger'}>
                    {integrityStatus.checking ? 'جاري الفحص...' : integrityStatus.isValid ? 'سلسلة القيود سليمة' : 'تلاعب مكتشف! 🚨'}
                 </Badge>
              </div>
           </Card>

           <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">نتائج اختبارات الوحدة (Unit Tests)</h4>
              {results.map((res, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-50 flex items-center justify-between shadow-sm">
                   <div className="flex items-center gap-3">
                      {res.status === 'passed' ? <CheckCircle2 className="text-emerald-500" size={18} /> : <AlertCircle className="text-red-500" size={18} />}
                      <span className="text-xs font-bold text-slate-600">{res.name}</span>
                   </div>
                   <span className={`text-[9px] font-black uppercase ${res.status === 'passed' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {res.status === 'passed' ? 'Passed' : 'Failed'}
                   </span>
                </div>
              ))}
              {results.length === 0 && !isRunning && <p className="text-center py-10 text-slate-300 italic font-bold">لا توجد اختبارات مسجلة</p>}
           </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
           <Card className="bg-[#1E4D4D] text-white p-8">
              <h3 className="text-sm font-black uppercase tracking-widest mb-6 border-b border-white/10 pb-4">مواصفات الأمان النشطة</h3>
              <div className="space-y-5">
                 <div className="flex gap-4">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">🔐</div>
                    <div>
                       <p className="text-xs font-black">تشفير AES-256-GCM</p>
                       <p className="text-[9px] opacity-60">تشفير البيانات في IndexedDB</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">🔗</div>
                    <div>
                       <p className="text-xs font-black">SHA-256 Hashing</p>
                       <p className="text-[9px] opacity-60">ربط متسلسل للقيود المالية</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">📜</div>
                    <div>
                       <p className="text-xs font-black">Audit Trail</p>
                       <p className="text-[9px] opacity-60">سجل رقابة غير قابل للحذف</p>
                    </div>
                 </div>
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthModule;
