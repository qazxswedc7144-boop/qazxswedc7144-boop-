import React from 'react';
import { ArrowRight, Shield, Database, Lock, Eye, CheckCircle2 } from 'lucide-react';
import { Logo, BrandName } from '../components/Logo';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#F8FAFA] font-sans text-slate-800" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 py-6 px-4 md:px-8 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <BrandName className="text-xl" />
          </div>
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#1E4D4D] transition-colors"
          >
            العودة 
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-4xl pr-2 md:text-5xl font-black text-[#1E4D4D] tracking-tight">سياسة الخصوصية</h1>
          <p className="text-slate-500 font-bold text-lg">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>
        </div>

        <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-xl shadow-emerald-900/5 border border-slate-50 space-y-12">
          
          <section className="space-y-6">
            <div className="flex items-center gap-4 text-[#1E4D4D]">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <Shield size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black">1. مقدمة</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-lg">
              نلتزم في منصتنا المحاسبية السحابية بحماية خصوصيتك وبياناتك المالية. توضح سياسة الخصوصية هذه نوع البيانات التي نجمعها عنك وعن مؤسستك، وكيف نستخدمها، والإجراءات الصارمة التي نتبعها لحمايتها وفقاً لمعايير أمن المعلومات العالمية.
            </p>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-4 text-[#1E4D4D]">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <Database size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black">2. البيانات التي نقوم بجمعها</h2>
            </div>
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed text-lg">نقوم بجمع نوعين من البيانات:</p>
              <ul className="space-y-3">
                 <li className="flex gap-3 text-slate-700">
                   <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />
                   <span><strong>بيانات الحساب الأساسية:</strong> كالاسم، البريد الإلكتروني، اسم المؤسسة، ومعلومات الاتصال لأغراض تسجيل الدخول (OAuth).</span>
                 </li>
                 <li className="flex gap-3 text-slate-700">
                   <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />
                   <span><strong>البيانات التشغيلية والمالية:</strong> وتشمل الفواتير، بيانات العملاء والموردين، القيود المحاسبية، وحركة المخزون. يتم تخزين هذه البيانات في بيئة معزولة تماماً وتُدار عبر مبدأ الفصل بين المستأجرين (Tenant Isolation).</span>
                 </li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-4 text-[#1E4D4D]">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <Eye size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black">3. كيف نستخدم بياناتك</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-lg mb-4">
              البيانات التي تُدخلها لمنشأتك هي ملك لك بالكامل. نستخدم البيانات بشكل حصري لـ:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <li className="bg-slate-50 p-4 rounded-xl text-slate-700 border border-slate-100 flex gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                تقديم وتشغيل الخدمات المحاسبية بدقة وموثوقية عالية.
              </li>
              <li className="bg-slate-50 p-4 rounded-xl text-slate-700 border border-slate-100 flex gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                المزامنة الفورية للبيانات عبر السحابة (Cloud Sync).
              </li>
              <li className="bg-slate-50 p-4 rounded-xl text-slate-700 border border-slate-100 flex gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                أخذ نسخ احتياطية دورية لحماية سجلاتك من الفقدان.
              </li>
              <li className="bg-slate-50 p-4 rounded-xl text-slate-700 border border-slate-100 flex gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                دعم التزامن للعمل دون اتصال (Offline-First) واستعادة البيانات.
              </li>
            </ul>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-4 text-[#1E4D4D]">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <Lock size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black">4. الأمان وأمن قواعد البيانات</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-lg">
              نطبق معايير أمنية صارمة تضمن عدم إمكانية تسرب البيانات:
            </p>
            <div className="bg-[#1E4D4D] text-white p-6 rounded-2xl space-y-4">
              <p className="font-bold flex items-center gap-2">
                <Shield size={20} className="text-emerald-400" /> 
                سياسة العزل البياني (Row Level Security - RLS):
              </p>
              <p className="text-emerald-50 text-sm leading-relaxed">
                يتم تطبيق سياسات العزل من خلال قاعدة بياناتنا السحابية، حيث يتم ربط كل مستند مالي بمعرف المنظمة (Organization ID). هذا يضمن تقنياً استحالة تصفح أي تنظيم أو مستخدم لبيانات كيان آخر مهما بلغت صلاحياته، حيث يُنفذ هذا الحظر جذرياً من طرف الخادم (Backend).
              </p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-8 text-center mt-20">
        <p className="text-slate-500 text-sm font-bold">
          © {new Date().getFullYear()} جميع الحقوق محفوظة لمنصة PharmaFlow المحاسبية
        </p>
      </footer>
    </div>
  );
}
