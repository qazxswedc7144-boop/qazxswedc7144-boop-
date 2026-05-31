
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface UnifiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export const UnifiedModal: React.FC<UnifiedModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  width = 'max-w-2xl' 
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full ${width} bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-50">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{title}</h3>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
