import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  withAudio?: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, withAudio = false }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (withAudio) {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'ar-SA';
      synth.speak(utterance);
    }

    // Shrink progress bar over time
    const interval = 30; // ms
    const duration = 4000; // ms (aligned with useAppStore timeout)
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - step;
      });
    }, interval);

    const closeTimer = setTimeout(onClose, duration);

    return () => {
      clearInterval(timer);
      clearTimeout(closeTimer);
    };
  }, [message, onClose, withAudio]);

  const config = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      border: "border-emerald-500/20 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200",
      progressBg: "bg-emerald-500"
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-rose-500" />,
      border: "border-rose-500/20 bg-rose-50/95 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200",
      progressBg: "bg-rose-500"
    },
    info: {
      icon: <Info className="w-5 h-5 text-sky-500" />,
      border: "border-sky-500/20 bg-sky-50/95 dark:bg-sky-950/90 text-sky-800 dark:text-sky-200",
      progressBg: "bg-sky-500"
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      border: "border-amber-500/20 bg-amber-50/95 dark:bg-amber-950/90 text-amber-800 dark:text-amber-200",
      progressBg: "bg-amber-500"
    }
  };

  const currentConfig = config[type] || config.info;

  return (
    <div className="relative overflow-hidden w-full max-w-[340px] rounded-2xl border backdrop-blur-md shadow-lg pointer-events-auto" dir="rtl">
      {/* Dynamic progress bar showing remaining duration */}
      <div 
        className={`absolute bottom-0 right-0 h-1 transition-all ease-linear ${currentConfig.progressBg}`} 
        style={{ width: `${progress}%`, transitionDuration: '30ms' }}
      />
      <div className={`flex items-center gap-3.5 p-4 pr-4 pl-3 ${currentConfig.border}`}>
        <div className="flex-shrink-0">{currentConfig.icon}</div>
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-xs font-bold leading-relaxed">{message}</p>
        </div>
        <button 
          onClick={onClose} 
          className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-95"
          aria-label="إغلاق التنبيه"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
