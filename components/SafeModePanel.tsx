
import React from 'react';
import { ShieldAlert, RefreshCw, Database, Lock, RotateCcw } from 'lucide-react';
import { db } from '../services/database';
import { IntegritySweepService } from '../services/IntegritySweepService';
import { AlertCenter } from '../services/AlertCenter';

export const SafeModePanel: React.FC = () => {
  const [errors, setErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    const checkHealth = async () => {
      const { IntegritySweepService } = await import('../services/IntegritySweepService');
      const products = await db.getProducts();
      const entries = await db.getJournalEntries();
      const errs: string[] = [];
      
      // Quick check for display
      let totalDebit = 0, totalCredit = 0;
      entries.forEach(e => e.lines.forEach(l => { totalDebit += l.debit; totalCredit += l.credit; }));
      if (Math.abs(totalDebit - totalCredit) > 0.01) errs.push("عدم توازن في القيود المحاسبية");
      
      const negStock = products.filter(p => p.StockQuantity < 0);
      if (negStock.length > 0) errs.push(`وجود مخزون سالب لعدد ${negStock.length} صنف`);
      
      setErrors(errs);
    };
    checkHealth();
  }, []);

  const handleRepair = async () => {
    if (window.confirm("هل تريد تشغيل محرك الإصلاح التلقائي الشامل؟ سيقوم النظام بتصحيح الأرصدة، حذف الحركات اليتيمة، وتصفير التنبيهات الحرجة إذا نجح الإصلاح.")) {
      const isHealthy = await IntegritySweepService.runSweep(true);
      if (isHealthy) {
        await AlertCenter.clearCriticalAlerts();
        await AlertCenter.resetSystemStatus();
        alert("تم الإصلاح بنجاح! سيعاد تشغيل النظام الآن.");
        window.location.reload();
      } else {
        alert("فشل الإصلاح التلقائي في معالجة كافة المشاكل. يرجى مراجعة سجلات التدقيق أو استعادة نسخة احتياطية.");
      }
    }
  };

  const handleReset = async () => {
    if (window.confirm("هل أنت متأكد من إعادة ضبط النظام؟ سيتم مسح التنبيهات الحرجة والعودة للوضع الطبيعي.")) {
      await AlertCenter.clearCriticalAlerts();
      await AlertCenter.resetSystemStatus();
      window.location.reload();
    }
  };

  const handleDeactivateSafeMode = async () => {
    if (window.confirm("تحذير: إلغاء وضع الأمان قد يؤدي إلى تلف البيانات إذا لم يتم إصلاح الخلل. هل أنت متأكد؟")) {
      await db.saveSetting('SYSTEM_STATUS', 'ACTIVE');
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-red-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border-4 border-red-500">
        <div className="bg-red-500 p-6 text-white flex items-center gap-4">
          <ShieldAlert size={48} className="animate-pulse" />
          <div>
            <h2 className="text-2xl font-bold">وضع الأمان مفعل (SAFE MODE) 🛡️</h2>
            <p className="opacity-90">تم اكتشاف خلل فادح في نزاهة البيانات. تم تجميد كافة العمليات المالية.</p>
          </div>
        </div>
        
        <div className="p-8 space-y-6">
          {errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-amber-900 font-bold text-sm mb-2">المشاكل المكتشفة:</p>
              <ul className="list-disc list-inside text-amber-800 text-xs space-y-1">
                {errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-red-800 text-sm">
            <p className="font-bold mb-2">الإجراءات المقيدة:</p>
            <ul className="list-disc list-inside space-y-1 opacity-80">
              <li>منع إنشاء فواتير جديدة</li>
              <li>منع تعديل القيود المحاسبية</li>
              <li>منع ترحيل السندات المالية</li>
              <li>النظام متاح للعرض فقط (Read-Only)</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={handleRepair}
              className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg hover:shadow-emerald-200"
            >
              <RefreshCw size={20} />
              تشغيل الإصلاح التلقائي
            </button>
            
            <button 
              onClick={handleReset}
              className="flex items-center justify-center gap-3 bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg hover:shadow-amber-200"
            >
              <RotateCcw size={20} />
              تصفير التنبيهات والعودة (Reset)
            </button>
            
            <button 
              onClick={() => window.location.href = '/settings/backup'}
              className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg hover:shadow-blue-200"
            >
              <Database size={20} />
              استعادة نسخة احتياطية
            </button>
          </div>

          <div className="pt-4 border-top border-gray-100 flex justify-center">
            <button 
              onClick={handleDeactivateSafeMode}
              className="text-gray-400 hover:text-red-600 text-xs flex items-center gap-2 transition-colors"
            >
              <Lock size={12} />
              إلغاء وضع الأمان يدوياً (غير مستحسن)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
