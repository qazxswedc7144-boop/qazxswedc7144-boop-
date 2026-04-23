
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UI_CONFIG } from '../constants';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; onClose: () => void }> = ({ message, type, onClose }) => {
  const styles = {
    success: "bg-[#10B981] border-emerald-400/30 shadow-emerald-500/20",
    error: "bg-red-600 border-red-500/30 shadow-red-500/20",
    info: "bg-[#1E4D4D] border-slate-700/30 shadow-slate-900/20",
    warning: "bg-amber-500 border-amber-400/30 shadow-amber-500/20"
  };

  const icons = {
    success: <CheckCircle2 size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />,
    warning: <AlertTriangle size={20} />
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`fixed bottom-28 left-4 right-4 z-[999] p-4 rounded-[24px] border-2 border-white/20 text-white flex items-center justify-between gap-4 shadow-2xl backdrop-blur-xl ${styles[type]}`}
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0">{icons[type]}</span>
        <p className="text-[13px] font-bold leading-tight">{message}</p>
      </div>
      <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
        <X size={16} />
      </button>
    </motion.div>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; noPadding?: boolean; onClick?: () => void; style?: React.CSSProperties }> = ({ children, className = "", noPadding = false, onClick, style }) => (
  <motion.div 
    whileHover={onClick ? { y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" } : {}}
    onClick={onClick}
    className={`bg-white border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 ${noPadding ? '' : 'p-6'} ${onClick ? 'cursor-pointer hover:border-emerald-100' : ''} ${className}`} 
    style={{ borderRadius: '24px', ...style }} 
  >
    {children}
  </motion.div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'neutral' | 'approve' | 'print';
  isLoading?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', isLoading, icon, size = 'md', className = "", ...props 
}) => {
  const baseStyles = "relative flex items-center justify-center gap-3 font-bold transition-all active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none select-none touch-manipulation min-h-[36px]";
  
  const variants = {
    primary: "bg-[#1E4D4D] text-white shadow-lg shadow-emerald-950/10 hover:bg-[#2a6363] hover:shadow-xl",
    approve: "bg-[#10B981] text-white shadow-lg hover:bg-[#0ea371] hover:shadow-xl",
    print: "bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl",
    secondary: "bg-emerald-50 text-[#1E4D4D] border-2 border-emerald-100/50 hover:bg-emerald-100 hover:border-emerald-200",
    neutral: "bg-white text-slate-600 border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50",
    danger: "bg-red-500 text-white shadow-lg hover:bg-red-600 hover:shadow-xl",
    success: "bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 hover:shadow-xl",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700",
  };

  const sizes = {
    sm: "px-4 py-2 text-[12px] rounded-[14px] min-h-[40px]",
    md: "px-6 py-3 text-[14px] rounded-[18px]",
    lg: "px-8 py-4 text-base rounded-[22px]"
  };

  return (
    <button className={`${baseStyles} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${className}`} {...props}>
      {isLoading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : (
        <>
          {icon && <span className="text-lg">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

export const GroupedActions: React.FC<{ actions: any[]; className?: string }> = ({ actions, className = "" }) => {
  return (
    <div className={`flex items-center gap-2 p-1 bg-slate-50 rounded-[24px] ${className}`}>
      {actions.map((action, idx) => (
        <Button
          key={action.id || idx}
          variant={action.variant || 'neutral'}
          size="sm"
          className={`flex-1 !rounded-[18px] !h-11 ${action.className || ''}`}
          onClick={action.onClick}
          disabled={action.disabled}
          isLoading={action.isLoading}
          icon={action.icon}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, icon, className = "", ...props }, ref) => (
  <div className="space-y-1 w-full">
    {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">{label}</label>}
    <div className="relative group">
      {icon && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1E4D4D] transition-colors">{icon}</div>}
      <input
        ref={ref}
        className={`w-full bg-[#F8FAFA] border-2 border-transparent rounded-[12px] ${icon ? 'pr-10' : 'px-4'} py-1.5 h-[32px] text-[13px] font-black text-[#1E4D4D] focus:bg-white focus:border-[#1E4D4D] transition-all outline-none shadow-sm ${error ? 'border-red-200' : ''} ${className}`}
        {...props}
      />
    </div>
    {error && <p className="text-[9px] font-bold text-red-500 mr-2">{error}</p>}
  </div>
));

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; noPadding?: boolean; noOuterPadding?: boolean; maxWidth?: string; showCloseButton?: boolean }> = ({
  isOpen, onClose, title, children, noPadding = false, noOuterPadding = false, maxWidth = "sm:w-[450px]", showCloseButton = true
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 z-[1000] flex items-center justify-center ${noOuterPadding ? '' : 'p-2'}`}>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`bg-white w-full ${maxWidth} max-h-[90vh] rounded-[16px] flex flex-col shadow-2xl relative overflow-hidden border border-white/20`}
          >
            {(title || showCloseButton) && (
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50 shrink-0">
                 <h3 className="text-[11px] font-bold text-[#1E4D4D] uppercase tracking-widest">{title}</h3>
                 {showCloseButton && (
                   <button onClick={onClose} className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all">
                     <X size={16} />
                   </button>
                 )}
              </div>
            )}
            <div className={`${noPadding ? '' : 'p-4'} overflow-y-auto custom-scrollbar flex-1`}>
              {children}
            </div>
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
    neutral: "bg-slate-50 text-slate-400 border-slate-100"
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-[10px] text-[8px] font-black border uppercase tracking-wider ${styles[variant as keyof typeof styles]} ${className}`}>
      {children}
    </span>
  );
};
