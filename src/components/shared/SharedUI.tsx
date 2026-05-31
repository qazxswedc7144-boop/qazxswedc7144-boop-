
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export const Toast = React.memo(({ message, type }: { message: string; type: 'success' | 'error' | 'info' | 'warning'; onClose?: () => void }) => {
  const isSuccess = type === "success";
  
  // ألوان طبية متناسقة تماماً مع خلفيات PharmaFlow والوضع الداكن
  const bgClass = isSuccess
    ? "bg-emerald-50/95 dark:bg-emerald-950/95 text-emerald-800 dark:text-emerald-200 border-emerald-200/50 dark:border-emerald-800/40"
    : "bg-amber-50/95 dark:bg-amber-950/95 text-amber-900 dark:text-amber-200 border-amber-200/50 dark:border-amber-800/40";
  
  const accentBar = isSuccess ? "bg-emerald-500" : "bg-amber-500";
  const icon = isSuccess ? "✅" : "⚠️";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 360, damping: 29 }}
      className={`w-full max-w-[320px] ${bgClass} border p-3.5 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-sm pointer-events-auto relative overflow-hidden mb-3`}
    >
      {/* شريط جمالي جانبي */}
      <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${accentBar}`} />
      
      <span className="text-base shrink-0 mr-1.5">{icon}</span>
      <p className="text-sm font-bold tracking-wide leading-tight text-right w-full">
        {message?.replace(/^[✅⚠️]\s*/, "")}
      </p>
    </motion.div>
  );
});

export const Card = React.memo(({ children, className = "", noPadding = false, onClick, style }: { children: React.ReactNode; className?: string; noPadding?: boolean; onClick?: () => void; style?: React.CSSProperties }) => (
  <motion.div 
    whileHover={onClick ? { y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" } : {}}
    onClick={onClick}
    className={`bg-white border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 ${noPadding ? '' : 'p-4 md:p-6'} ${onClick ? 'cursor-pointer hover:border-emerald-100' : ''} ${className}`} 
    style={{ borderRadius: '24px', ...style }} 
  >
    {children}
  </motion.div>
));

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'neutral' | 'approve' | 'print';
  isLoading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.memo(({ 
  children, variant = 'primary', isLoading, icon, size = 'md', className = "", ...props 
}: ButtonProps) => {
  const baseStyles = "relative flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none select-none touch-manipulation";
  
  const variants = {
    primary: "bg-[#1E4D4D] text-white shadow-lg shadow-emerald-950/10 hover:bg-[#2a6363] hover:shadow-xl",
    approve: "bg-[#10B981] text-white shadow-lg hover:bg-[#0ea371] hover:shadow-xl",
    print: "bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl",
    secondary: "bg-[#EBF5F5] text-[#1E4D4D] border-2 border-emerald-100/50 hover:bg-emerald-100/50 hover:border-emerald-200",
    neutral: "bg-white text-slate-700 border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50",
    danger: "bg-red-500 text-white shadow-lg hover:bg-red-600 hover:shadow-xl",
    success: "bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 hover:shadow-xl",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700",
  };

  const isPrimarySave = props.type === 'submit' || className.includes('approve') || className.includes('primary') || className.includes('h-14');
  
  const sizes = {
    sm: "h-11 px-4 text-sm font-semibold rounded-2xl",
    md: "h-12 px-5 text-base font-semibold rounded-2xl",
    lg: "h-14 px-6 text-lg font-bold rounded-2xl"
  };

  const activeSize = (size === 'md' && isPrimarySave) ? 'lg' : size;

  return (
    <button className={`${baseStyles} ${variants[variant as keyof typeof variants]} ${sizes[activeSize as keyof typeof sizes]} ${className}`} {...props}>
      {isLoading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : (
        <>
          {icon && <span className="text-base shrink-0">{icon}</span>}
          <span className="truncate">{children}</span>
        </>
      )}
    </button>
  );
});

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.memo(React.forwardRef<HTMLInputElement, InputProps>(({ label, error, icon, className = "", ...props }, ref) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-sm font-bold text-slate-500 mr-1 select-none">{label}</label>}
    <div className="relative group">
      <input
        ref={ref}
        className={`w-full bg-[#F8FAFA] border-2 border-transparent rounded-2xl px-4 h-12 text-base font-medium text-[#1E4D4D] focus:bg-white focus:border-[#1E4D4D] transition-all outline-none shadow-sm ${error ? 'border-red-200' : ''} ${className}`}
        {...props}
      />
    </div>
    {error && <p className="text-sm font-medium text-red-500 mr-2">{error}</p>}
  </div>
)));

export const Modal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode; 
  noPadding?: boolean; 
  noOuterPadding?: boolean; 
  maxWidth?: string; 
  showCloseButton?: boolean; 
  centerOnMobile?: boolean; 
  isCompact?: boolean;
  positionClass?: string;
  transparentContainer?: boolean;
}> = ({
  isOpen, onClose, title, children, noPadding = false, maxWidth = "sm:max-w-md", showCloseButton = true, isCompact = false,
  positionClass = "items-end sm:items-center", transparentContainer = false
}) => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setIsKeyboardOpen(false);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 z-[9999] flex ${positionClass} justify-center p-2 bg-black/40`}>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={transparentContainer 
              ? `w-full ${maxWidth} relative transition-all duration-300 ${isKeyboardOpen ? 'transform -translate-y-[15vh] sm:translate-y-0' : ''}`
              : `${
                  isCompact
                    ? `bg-white w-full max-w-[340px] mx-auto rounded-xl p-2 max-h-[45vh] overflow-y-auto styleScrollbar custom-scrollbar flex flex-col shadow-2xl relative border border-slate-100`
                    : `bg-white w-full ${maxWidth} max-h-[92vh] rounded-3xl flex flex-col shadow-2xl relative border border-slate-100`
                } transition-all duration-300 ${
                  isKeyboardOpen ? 'transform -translate-y-[15vh] sm:translate-y-0' : ''
                }`
            }
            style={transparentContainer ? {} : { maxHeight: '92vh' }}
          >
            {!isCompact && (title || showCloseButton) && (
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50 shrink-0">
                 <h3 className="text-lg font-semibold text-[#1E4D4D] tracking-tight">{title}</h3>
                 {showCloseButton && (
                   <button onClick={onClose} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all">
                     <X size={18} />
                   </button>
                 )}
              </div>
            )}
            {isCompact ? (
              <div className="flex-1 w-full flex flex-col">
                {children}
              </div>
            ) : (
              <div className={`${noPadding ? 'p-0 pb-0' : 'p-6 pb-10 sm:pb-6'} overflow-y-auto custom-scrollbar flex-1`}>
                {children}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'success' | 'info' | 'warning' | 'danger' | 'neutral'; className?: string }> = ({
  children, variant = 'neutral', className = ""
}) => {
  const styles = {
    success: "bg-emerald-50 text-emerald-600 border-emerald-100",
    warning: "bg-amber-50 text-amber-600 border-amber-100",
    danger: "bg-red-50 text-red-600 border-red-100",
    info: "bg-blue-50 text-blue-600 border-blue-100",
    neutral: "bg-slate-50 text-slate-500 border-slate-100"
  };

  return (
    <span className={`px-3 py-1 rounded-xl text-sm font-semibold border tracking-wide inline-flex items-center justify-center ${styles[variant as keyof typeof styles]} ${className}`}>
      {children}
    </span>
  );
};
