import React from 'react';
import { ArrowRight, ShieldCheck, Scale, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Logo, BrandName } from '../components/Logo';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#F8FAFA] font-sans text-slate-800" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 py-6 px-4 md:px-8 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <BrandName className="text-xl" />
          </div>
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#1E4D4D] transition-colors bg-slate-50 px-4 py-2 rounded-xl"
          >
            العودة 
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-4xl pr-2 md:text-5xl font-black text-[#1E4D4D] tracking-tight">شروط الخدمة</h1>
          <p className="text-slate-500 font-bold text-lg">آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>
        </div>

        <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-xl shadow-emerald-900/5 border border-slate-50 space-y-12">
          
          <section className="space-y-6">
            <div className="flex items-center gap-4 text-[#1E4D4D]">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <FileText size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black">1. قبول الشروط</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-lg">
              باستخدامك لمنصة PharmaFlow ("الخدمة")، فإنك توافق على الالتزام بشروط الخدمة هذه. إذا كنت لا توافق على أي جزء من هذه الشروط، فلا تقوم باستخدام نظامنا المحاسبي السحابي. يشكل استخدامك للخدمة عقداً ملزماً بينك وبيننا.
            </p>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-4 text-[#1E4D4D]">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <ShieldCheck size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black">2. الحسابات والمؤسسات</h2>
            </div>
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed text-lg">شروط الاستخدام المتعلقة بتسجيل الكيانات التجارية:</p>
              <ul className="space-y-3">
                 <li className="flex gap-3 text-slate-700">
                   <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />
                   <span><strong>الوصول والحماية:</strong> تُساءل أنت شخصياً عن الحفاظ على أمان حسابك. نحن نستخدم مُعرّفات OAuth الحديثة (مثل Google) لضمان أمان الدخول، ونوفر طبقة حماية عزل المستأجرين (Tenant Isolation)، ولكن يجب عليك حماية أجهزتك.</span>
                 </li>
                 <li className="flex gap-3 text-slate-700">
                   <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />
                   <span><strong>دقة المعلومات:</strong> توافق على تقديم معلومات دقيقة وكاملة عن مؤسستك عند فتح الحساب وتحديثها باستمرار.</span>
                 </li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-4 text-[#1E4D4D]">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <Scale size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black">3. حقوق ملكية البيانات</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-lg">
              جميع البيانات المالية التشغيلية لك (Invoices, Customers, Products, etc.) هي **مِلك حصري لمؤسستك**. 
              نحن نلتزم بعزل البيانات عبر سياسات Row Level Security (RLS) الصارمة، ولا نقوم متعمّدين بالوصول لها إلا للصيانة بعد إذن رسمي منك، أو تلبية لأوامر قضائية.
            </p>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-4 text-[#1E4D4D]">
              <div className="p-3 bg-red-50 rounded-2xl">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-black">4. إخلاء المسؤولية والدقة المالية</h2>
            </div>
            <div className="bg-red-50 text-red-900 border border-red-100 p-6 rounded-2xl space-y-4">
              <p className="leading-relaxed">
                يُقدم نظام PharmaFlow "كما هو" لتسهيل إدارة العمليات المحاسبية. رغم أننا نبني أنظمتنا على معايير الحوسبة السحابية العالية والتزامن الدقيق (Cloud Sync):
                <br /><br />
                <strong>لا نتحمل المسؤولية</strong> عن أية أخطاء إدخال بيانات بشرية أو خسائر مالية أو أضرار غير مباشرة تنشأ عن استخدام الخدمة. تقع مراجعة التقارير المحاسبية والمخزونية وطباعة الفواتير بشكل دوري على عاتق المستخدم ومحاسب الدار.
              </p>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-4 text-[#1E4D4D]">
              <div className="p-3 bg-emerald-50 rounded-2xl">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black">5. تعديل الشروط</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-lg">
              نحتفظ بالحق في تعديل شروط الخدمة هذه في أي وقت لتعكس أي تغييرات برمجية (SaaS Updates) أو قوانين تنظيمية. سيتم إخطار المستخدمين بأي تغييرات جوهرية قبل أن تصبح سارية المفعول عبر رسالة داخل النظام المالي.
            </p>
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
