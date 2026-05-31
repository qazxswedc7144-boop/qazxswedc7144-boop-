
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Logo, BrandName } from '@/components/shared/Logo';
import { appLockService } from '@/services/AppLockService';

export const LockScreen: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      // Check simple pass first, then secure service
      const isSimpleValid = await appLockService.verifySimplePin(password);
      const isSecureValid = await appLockService.verifyPassword(password);

      if (isSimpleValid || isSecureValid) {
        await appLockService.updateActivity();
        onUnlock();
      } else {
        setError(true);
        setPassword('');
        setTimeout(() => setError(false), 2000);
      }
    } catch (err) {
      console.error("Unlock error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-[#1E4D4D]/95 backdrop-blur-xl flex items-center justify-center p-6 text-right" 
      dir="rtl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl space-y-8"
      >
        <div className="flex flex-col items-center gap-4">
          <Logo size={80} />
          <div className="text-center">
            <BrandName className="text-2xl justify-center" />
            <p className="text-slate-400 font-bold text-xs mt-1">يرجى إدخال كلمة المرور للمتابعة</p>
          </div>
        </div>

        <form onSubmit={handleUnlock} className="space-y-6">
          <div className="space-y-2">
            <input 
              type="password" 
              autoFocus
              placeholder="كلمة المرور"
              className={`w-full h-16 bg-slate-50 border-2 rounded-2xl px-6 text-center text-xl font-black outline-none transition-all ${error ? 'border-red-500 bg-red-50 animate-bounce' : 'border-transparent focus:border-blue-500'}`}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {error && <p className="text-red-500 text-[10px] font-black text-center">كلمة المرور غير صحيحة</p>}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full h-16 bg-[#1E4D4D] text-white rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? 'جاري التحقق...' : <>فتح القفل <ArrowRight size={20} /></>}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};
