import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Lock, Eye, EyeOff, ShieldAlert, Loader2, Info, Building2, HelpCircle, Check, ArrowRight
} from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRemembered, setIsRemembered] = useState(false);
  const [errorStatus, setErrorStatus] = useState<'IDLE' | 'LOADING' | 'ERROR_CREDENTIALS' | 'ERROR_DISABLED' | 'ERROR_SERVER'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  
  // Load remembered username if it exists
  useEffect(() => {
    const remembered = localStorage.getItem('pharmaflow_remembered_username');
    if (remembered) {
      setUsername(remembered);
      setIsRemembered(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorStatus('ERROR_CREDENTIALS');
      setErrorMessage('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setErrorStatus('LOADING');
    setErrorMessage('');

    try {
      const result = await login(username, password);
      
      // Handle "Remember Me"
      if (isRemembered) {
        localStorage.setItem('pharmaflow_remembered_username', username);
      } else {
        localStorage.removeItem('pharmaflow_remembered_username');
      }

      // Check if user is active
      if (result?.user && !result.user.isActive) {
        setErrorStatus('ERROR_DISABLED');
        setErrorMessage('هذا الحساب معطل حالياً من قبل إدارة النظام لدواعي أمنية ورقابية.');
        return;
      }

      setErrorStatus('IDLE');
      onSuccess();
    } catch (err: any) {
      console.error('Login error details:', err);
      const isSuspended = err.message?.toLowerCase().includes('suspend') || 
                          err.message?.toLowerCase().includes('disable') ||
                          err.message?.includes('معطل') ||
                          err.message?.includes('موقوف');
      
      if (isSuspended) {
        setErrorStatus('ERROR_DISABLED');
        setErrorMessage('هذا الحساب معطل حالياً من قبل إدارة النظام لدواعي أمنية ورقابية.');
      } else if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('credential') || err.message.toLowerCase().includes('invalid'))) {
        setErrorStatus('ERROR_CREDENTIALS');
        setErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التحقق والمحاولة مرة أخرى.');
      } else {
        setErrorStatus('ERROR_SERVER');
        setErrorMessage(err.message || 'فشل الاتصال بخوادم رخص الأمان السيادية. يرجى المحاولة لاحقاً.');
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFA] flex items-center justify-center p-4 relative overflow-hidden font-sans select-none" dir="rtl">
      {/* Visual background decor */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-50 rounded-full blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-50 rounded-full blur-3xl opacity-60 pointer-events-none" />

      <div className="w-full max-w-[460px] relative z-10">
        {/* Logo / Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#1E4D4D] text-white rounded-[22px] flex items-center justify-center mx-auto mb-4 shadow-xl border border-teal-800 shadow-teal-950/10">
            <Building2 size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-[#1E4D4D] tracking-tight mb-1">فارما فلو برو <span className="text-emerald-500 font-medium text-lg">ERP</span></h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[2px]">منظومة إدارة المؤسسات الدوائية السيادية</p>
        </div>

        {/* Login Card Container */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white border border-slate-100 rounded-[32px] shadow-2xl p-8 shadow-slate-200/50"
        >
          <div className="mb-6">
            <h2 className="text-lg font-black text-[#1E4D4D] mb-1">تسجيل الدخول للمنظومة</h2>
            <p className="text-xs font-medium text-slate-400">يرجى إدخال بيانات الاعتماد للوصول إلى الواجهات المصرحة لك.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 mr-1">اسم المستخدم</label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <User size={18} />
                </span>
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={errorStatus === 'LOADING'}
                  placeholder="أدخل اسم المستخدم"
                  className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-100 focus:border-[#1E4D4D]/20 outline-none text-slate-700 text-sm font-semibold pr-11 pl-4 py-3.5 rounded-2xl transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex justify-between items-center mb-2 mr-1">
                <label className="text-xs font-bold text-slate-500">كلمة المرور</label>
                <button 
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-bold text-emerald-600 hover:text-[#1E4D4D] transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={18} />
                </span>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={errorStatus === 'LOADING'}
                  placeholder="أدخل كلمة المرور السرية"
                  className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-100 focus:border-[#1E4D4D]/20 outline-none text-slate-700 text-sm font-semibold pr-11 pl-11 py-3.5 rounded-2xl transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center gap-2 mr-1 py-1">
              <button 
                type="button"
                onClick={() => setIsRemembered(!isRemembered)}
                className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isRemembered ? 'bg-[#1E4D4D] border-[#1E4D4D] text-white' : 'bg-slate-50 border-slate-200 text-transparent hover:border-slate-300'}`}
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <span 
                onClick={() => setIsRemembered(!isRemembered)}
                className="text-xs font-bold text-slate-500 cursor-pointer select-none"
              >
                تذكر هوية الدخول في هذا الجهاز
              </span>
            </div>

            {/* Error Message Notification */}
            <AnimatePresence mode="wait">
              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`p-4 rounded-2xl flex gap-3 border text-right leading-relaxed ${
                    errorStatus === 'ERROR_DISABLED' 
                    ? 'bg-rose-50/40 border-rose-100/60 text-rose-700' 
                    : errorStatus === 'ERROR_SERVER'
                    ? 'bg-amber-50/40 border-amber-100/60 text-amber-700'
                    : 'bg-red-50/40 border-red-100/60 text-red-700'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <ShieldAlert size={16} />
                  </div>
                  <div className="flex-1 text-xs font-bold">
                    {errorMessage}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={errorStatus === 'LOADING'}
              className="w-full bg-[#1E4D4D] hover:bg-teal-900 text-white font-black text-sm py-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-teal-900/10 disabled:opacity-75 disabled:cursor-wait"
            >
              {errorStatus === 'LOADING' ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>جاري التحقق من الهوية...</span>
                </>
              ) : (
                <>
                  <span>الوصول الآمن للمنصة</span>
                  <ArrowRight size={18} className="rotate-180" />
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Bottom Security Footer Details */}
        <div className="text-center mt-6 flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400">
          <Info size={14} className="text-emerald-500" />
          <span>تخضع جميع عمليات تسجيل الدخول للمراقبة المستمرة لمكافحة الاختراق.</span>
        </div>
      </div>

      {/* Forgot Password Placeholder Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white max-w-sm w-full rounded-[28px] border border-slate-100 shadow-2xl p-6 relative text-right"
            >
              <div className="w-12 h-12 bg-emerald-50 text-[#1E4D4D] rounded-2xl mb-4 flex items-center justify-center">
                <HelpCircle size={24} />
              </div>
              <h3 className="text-lg font-black text-[#1E4D4D] mb-2">استعادة كلمة المرور</h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed mb-6">
                لدواعي الأمان السيادي ووفقاً لسياسة نظام الحماية الصارمة للمؤسسات الدوائية، لا يتم تغيير أو تصفير كلمات المرور ذاتياً. 
                <br /><br />
                يرجى التواصل مع <strong>مسؤول نظام التدقيق الأمني</strong> بالمؤسسة لإصدار تذكرة تصفير معتمدة يدوياً.
              </p>
              <button 
                onClick={() => setShowForgotModal(false)}
                className="w-full bg-[#1E4D4D] text-white py-3.5 rounded-xl font-bold text-xs"
              >
                فهمت الأمر
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
