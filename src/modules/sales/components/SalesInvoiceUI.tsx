
import React from 'react';
import { motion } from 'motion/react';
import { Trash2 } from 'lucide-react';

// Memoized Item Row Component for Sales
export const SaleItemRow = React.memo(({ 
  item, 
  onDelete, 
  onClick,
  idx,
  isLocked,
  isRecovery
}: { 
  item: any; 
  onDelete: (idx: number) => void; 
  onClick: () => void;
  idx: number;
  isLocked: boolean;
  isRecovery: boolean;
}) => (
  <motion.div 
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="flex items-center px-2 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer w-full group relative"
    onClick={() => {
      if (!isLocked && !isRecovery) {
        onClick();
      }
    }}
  >
    <div className="flex-[2] flex flex-col items-start overflow-hidden pr-1">
      <span className="text-[11px] font-black text-[#1E4D4D] truncate w-full text-right">{item.name}</span>
    </div>
    <div className="flex-1 text-center">
      <span className={`text-[11px] font-black rounded-md px-1 sm:px-2 py-0.5 ${
        item.qty < 5 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-[#1E4D4D]'
      }`}>
        {item.qty}
      </span>
    </div>
    <div className="flex-1 text-center text-[11px] font-black text-slate-500">
      {item.price.toLocaleString()}
    </div>
    <div className="flex-1 text-center text-[11px] font-black text-[#1E4D4D]">
      {item.sum.toLocaleString()}
    </div>

    <div className="w-10 flex items-center justify-center shrink-0">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onDelete(idx);
        }}
        className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        title="حذف الصنف"
      >
        <Trash2 size={15} />
      </button>
    </div>
  </motion.div>
));
