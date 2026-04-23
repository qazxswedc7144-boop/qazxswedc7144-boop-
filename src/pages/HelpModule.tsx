import React, { useState } from 'react';
import { Card, Badge, Button } from '../components/SharedUI';

interface HelpModuleProps {
  onNavigate?: (view: any) => void;
}

const SectionTitle: React.FC<{ children: React.ReactNode; icon: string }> = ({ children, icon }) => (
  <h3 className="text-lg font-black text-[#1E4D4D] flex items-center gap-2 mb-4">
    <span>{icon}</span> {children}
  </h3>
);

const CodeBlock = ({ code }: { code: string }) => (
  <pre className="bg-slate-900 text-emerald-400 p-4 rounded-2xl text-[10px] font-mono overflow-x-auto my-3 dir-ltr text-left">
    <code>{code}</code>
  </pre>
);

const HelpModule: React.FC<HelpModuleProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'user' | 'dev' | 'errors'>('user');

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-32" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg">📖</div>
          <div>
            <h2 className="text-3xl font-black text-[#1E4D4D]">الدليل التقني والتوثيق</h2>
            <p className="text-slate-400 font-bold text-sm">مرجع شامل لاستخدام وتطوير نظام PharmaFlow</p>
          </div>
        </div>
        <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] text-xl font-black shadow-sm hover:bg-slate-50 transition-colors">➦</button>
      </div>

      <div className="flex p-1.5 bg-white border border-slate-100 rounded-[28px] shadow-sm w-fit overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('user')} className={`px-8 py-3.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'user' ? 'bg-[#1E4D4D] text-white shadow-xl' : 'text-slate-400'}`}>دليل المستخدم</button>
        <button onClick={() => setActiveTab('dev')} className={`px-8 py-3.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'dev' ? 'bg-[#1E4D4D] text-white shadow-xl' : 'text-slate-400'}`}>وثائق المطورين (API)</button>
        <button onClick={() => setActiveTab('errors')} className={`px-8 py-3.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'errors' ? 'bg-[#1E4D4D] text-white shadow-xl' : 'text-slate-400'}`}>الأخطاء والحلول</button>
      </div>

      <div className="space-y-6">
        {activeTab === 'user' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <Card>
              <SectionTitle icon="💰">إدارة المبيعات والمقبوضات</SectionTitle>
              <p className="text-sm text-slate-500 leading-relaxed font-bold">
                نظام المبيعات يعتمد على مبدأ "القيد الفوري". عند إتمام عملية بيع:
              </p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-xs font-bold text-slate-600 mr-2">
                <li>يتم فحص توفر الكمية في المخزن (Batch Tracking).</li>
                <li>يتم إنشاء قيد محاسبي مزدوج (مدين: الصندوق/العملاء، دائن: المبيعات).</li>
                <li>يتم إنشاء قيد تكلفة البضاعة المباعة (مدين: التكلفة، دائن: المخزون) بناءً على سعر التكلفة الفعلي.</li>
              </ul>
            </Card>

            <Card>
              <SectionTitle icon="⚖️">إدارة الدليل المحاسبي</SectionTitle>
              <p className="text-sm text-slate-500 leading-relaxed font-bold">
                يمكنك إضافة حسابات فرعية من "الدليل المحاسبي". الحسابات تنقسم إلى 5 أنواع أساسية:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                {['الأصول (Assets)', 'الخصوم (Liabilities)', 'حقوق الملكية (Equity)', 'الإيرادات (Revenue)', 'المصروفات (Expenses)'].map((t, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                    <p className="text-[10px] font-black text-[#1E4D4D]">{t}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle icon="🔍">الجرد الدوري</SectionTitle>
              <p className="text-sm text-slate-500 leading-relaxed font-bold">
                يوصى باستخدام "وحدة الجرد" يومياً لمطابقة 5 أصناف عشوائية. في حال وجود فارق، يقوم النظام آلياً بتسجيل قيد تسوية مخزنية لضمان دقة الميزانية العمومية.
              </p>
            </Card>
          </div>
        )}

        {activeTab === 'dev' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <Card>
              <SectionTitle icon="⚙️">هيكلية البيانات (LocalStorage Schema)</SectionTitle>
              <p className="text-sm text-slate-500 font-bold mb-4">يعتمد النظام على تخزين محلي مشفر بصيغة JSON. إليك أهم الجداول:</p>
              
              <div className="space-y-4">
                <div>
                  <Badge variant="info">db_products</Badge>
                  <CodeBlock code={`interface Product {
  product_id: string;
  name: string;
  quantityinstock: number;
  costPrice: number; // المتوسط المرجح
  batches: InventoryBatch[]; // تتبع تاريخ الصلاحية
}`} />
                </div>
                <div>
                  <Badge variant="info">db_journal_entries</Badge>
                  <CodeBlock code={`interface AccountingEntry {
  id: string;
  lines: { accountId: string, amount: number, type: 'DEBIT'|'CREDIT' }[];
  sourceType: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'COGS';
}`} />
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'errors' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-red-100">
                <SectionTitle icon="❌">AccountingError</SectionTitle>
                <p className="text-xs font-bold text-slate-500 mb-2">تحدث عند محاولة ترحيل قيد غير متوازن.</p>
                <div className="bg-red-50 p-4 rounded-xl">
                  <p className="text-[10px] font-black text-red-600 italic">الحل: تأكد أن مجموع المبالغ المدينة يساوي مجموع الدائنة تماماً.</p>
                </div>
              </Card>

              <Card className="border-amber-100">
                <SectionTitle icon="⚠️">InventoryError</SectionTitle>
                <p className="text-xs font-bold text-slate-500 mb-2">تحدث عند محاولة بيع كمية تتجاوز المتوفر في المخزن.</p>
                <div className="bg-amber-50 p-4 rounded-xl">
                  <p className="text-[10px] font-black text-amber-600 italic">الحل: قم بتسجيل فاتورة مشتريات أولاً لرفع الرصيد أو عمل تسوية جردية.</p>
                </div>
              </Card>

              <Card className="border-slate-100">
                <SectionTitle icon="🔄">SyncConflict</SectionTitle>
                <p className="text-xs font-bold text-slate-500 mb-2">تعارض البيانات بين جهازين مختلفين.</p>
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-[10px] font-black text-slate-600 italic">الحل: قم بعمل "تصدير" ثم "استيراد" يدوي لتوحيد قاعدة البيانات.</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HelpModule;