
import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { db } from '@/core/db';
import { Currency } from '@/types';
import { Globe, Check } from 'lucide-react';

export const CurrencySelector: React.FC = () => {
  const currency = useAppStore(state => state.currency);
  const setCurrency = useAppStore(state => state.setCurrency);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const list = await db.getCurrencies();
        setCurrencies(list);
      } catch (e) {
        console.error("Failed to load currencies:", e);
      }
    };
    loadCurrencies();
  }, []);

  const handleCurrencyChange = async (val: string) => {
    try {
      if (val === 'CUSTOM') {
        setIsAddingCustom(true);
      } else {
        const selected = currencies.find(c => c.code === val);
        await setCurrency(val, selected?.name);
      }
    } catch (e) {
      console.error("Failed to change currency:", e);
    }
  };

  const handleAddCustom = async () => {
    try {
      if (!customCode || !customLabel) return;
      await setCurrency(customCode.toUpperCase(), customLabel);
      
      // Refresh list
      const list = await db.getCurrencies();
      setCurrencies(list);
      
      setIsAddingCustom(false);
      setCustomCode('');
      setCustomLabel('');
    } catch (e) {
      console.error("Failed to add custom currency:", e);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm w-full min-w-[220px]">
      <div className="flex items-center gap-2 mb-2">
        <Globe size={18} className="text-[#1E4D4D] shrink-0" />
        <span className="text-sm font-black text-[#1E4D4D] select-none">عملة النظام</span>
      </div>

      {!isAddingCustom ? (
        <div className="relative w-full min-w-[220px]">
          <select 
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="w-full min-w-[220px] h-12 py-3 pl-12 pr-12 bg-[#F8FAFA] hover:bg-[#F0F4F4] border border-slate-100 hover:border-slate-300 rounded-2xl text-xs font-bold text-[#1E4D4D] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20 appearance-none cursor-pointer transition-all leading-none"
          >
            <option value="YER">يمني YER</option>
            <option value="SAR">سعودي SAR</option>
            <option value="USD">دولار USD</option>
            <option value="AED">درهم إماراتي AED</option>
            {currencies.filter(c => !['YER', 'SAR', 'USD', 'AED'].includes(c.code)).map(c => (
              <option key={c.id} value={c.code}>{c.name} {c.code}</option>
            ))}
            <option value="CUSTOM">+ إضافة عملة أخرى...</option>
          </select>
          {/* Isolated globe icon, placed beautifully inside with padding */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#1E4D4D] opacity-70 shrink-0">
            <Globe size={16} />
          </div>
          {/* Dropdown chevron to designate select functionality */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#1E4D4D] opacity-50 shrink-0">
             <Check size={14} />
          </div>
        </div>
      ) : (
        <div className="space-y-2 animate-in slide-in-from-top-2 w-full min-w-[220px]">
          <input 
            type="text" 
            placeholder="رمز العملة (مثلاً: EGP)"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            className="w-full h-12 p-3 bg-[#F8FAFA] border border-slate-100 rounded-2xl text-xs font-bold text-[#1E4D4D] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20"
          />
          <input 
            type="text" 
            placeholder="اسم العملة (مثلاً: جنيه مصري)"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            className="w-full h-12 p-3 bg-[#F8FAFA] border border-slate-100 rounded-2xl text-xs font-bold text-[#1E4D4D] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20"
          />
          <div className="flex gap-2">
            <button 
              onClick={handleAddCustom}
              className="flex-1 h-12 bg-[#1E4D4D] hover:bg-[#153636] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Check size={14} /> حفظ
            </button>
            <button 
              onClick={() => setIsAddingCustom(false)}
              className="px-4 h-12 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl text-xs font-black transition-all active:scale-95"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
