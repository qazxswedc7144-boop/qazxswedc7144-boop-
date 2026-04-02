import React from 'react';
import { X, Download, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  image: string;
  onDelete: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ isOpen, onClose, image, onDelete }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = image;
    link.download = `invoice-document-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] bg-black flex flex-col font-['Cairo']">
          {/* Action Header */}
          <div className="h-16 px-4 flex items-center justify-between bg-slate-900/80 backdrop-blur-md border-b border-white/10">
            {/* Option 1 (Left - '✓' Icon): Confirm and return */}
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 transition-colors"
              title="تأكيد"
            >
              <Check size={20} />
            </button>

            {/* Option 2 (Center - 'Download' Icon): Save directly */}
            <button 
              onClick={handleDownload}
              className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              title="تحميل"
            >
              <Download size={20} />
            </button>

            {/* Option 3 (Right - '×' Icon): Delete and return */}
            <button 
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-colors"
              title="حذف"
            >
              <X size={20} />
            </button>
          </div>

          {/* Image Container */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={image} 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              alt="Document"
            />
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
