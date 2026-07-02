import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const Section = React.memo(({ 
  title, 
  desc, 
  icon: Icon, 
  isOpen, 
  toggle, 
  children,
  badge
}: { 
  title: string; 
  desc: string; 
  icon: any; 
  isOpen: boolean; 
  toggle: () => void; 
  children: React.ReactNode;
  badge?: string;
}) => {
  return (
    <motion.div
      layout
      className={`bg-white dark:bg-gray-800 rounded-2xl border overflow-hidden cursor-pointer shadow-sm transition-all duration-200 ${
        isOpen
          ? "border-indigo-500/50 dark:border-indigo-400/50 shadow-md shadow-indigo-500/5"
          : "border-gray-100 dark:border-gray-700/70 hover:border-gray-200 dark:hover:border-gray-600"
      }`}
      whileHover={{ scale: 1.002 }}
      whileTap={{ scale: 0.998 }}
      onClick={toggle}
    >
      <div className="flex justify-between items-center px-5 py-4">
        <div className="flex items-center gap-3.5 text-right">
          <span className={`transition-colors duration-200 ${
            isOpen ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
          }`}>
            <Icon size={22} strokeWidth={2} />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span
                className={`font-bold text-base transition-colors duration-200 ${
                  isOpen
                    ? "text-indigo-500 dark:text-indigo-400"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {title}
              </span>
              {badge && (
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-100/60 dark:border-indigo-500/20 font-bold uppercase tracking-tighter">
                  {badge}
                </span>
              )}
            </div>
            {!isOpen && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{desc}</p>}
          </div>
        </div>
        <motion.span
          className={`text-[10px] p-1.5 rounded-lg transition-colors ${
            isOpen
              ? "bg-indigo-50 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-400"
              : "bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-slate-400"
          }`}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          ▼
        </motion.span>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 29 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-3 border-t border-gray-50 dark:border-gray-700/40" onClick={(e) => e.stopPropagation()}>
               {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
