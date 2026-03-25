
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { db } from '../services/database';
import { Currency } from '../types';
import { Globe, Plus, Check } from 'lucide-react';

export const CurrencySelector: React.FC = () => {
  const currency = useAppStore(state => state.currency);
  const setCurrency = useAppStore(state => state.setCurrency);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  useEffect(() => {
    const loadCurrencies = async () => {
      const list = await db.getCurrencies();
      setCurrencies(list);
    };
    loadCurrencies();
  }, []);

  const handleCurrencyChange = async (val: string) => {
    if (val === 'CUSTOM') {
      setIsAddingCustom(true);
    } else {
      const selected = currencies.find(c => c.code === val);
      await setCurrency(val, selected?.name);
    }
  };

  const handleAddCustom = async () => {
    if (!customCode || !customLabel) return;
    await setCurrency(customCode.toUpperCase(), customLabel);
    
    // Refresh list
    const list = await db.getCurrencies();
    setCurrencies(list);
    
    setIsAddingCustom(false);
    setCustomCode('');
    setCustomLabel('');
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Globe size={18} className="text-[#1E4D4D]" />
        <span className="text-sm font-black text-[#1E4D4D]">عملة النظام</span>
      </div>

      {!isAddingCustom ? (
        <select 
          value={currency}
          onChange={(e) => handleCurrencyChange(e.target.value)}
          className="w-full p-3 bg-[#F8FAFA] border border-slate-100 rounded-2xl text-xs font-bold text-[#1E4D4D] focus:outline-none focus:ring-2 focus:ring-[#10B981]/20"
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
      ) : (
        <div className="space-y-2 animate-in slide-in-from-top-2">
          <input 
            type="text" 
            placeholder="رمز العملة (مثلاً: EGP)"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            className="w-full p-3 bg-[#F8FAFA] border border-slate-100 rounded-2xl text-xs font-bold text-[#1E4D4D]"
          />
          <input 
            type="text" 
            placeholder="اسم العملة (مثلاً: جنيه مصري)"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            className="w-full p-3 bg-[#F8FAFA] border border-slate-100 rounded-2xl text-xs font-bold text-[#1E4D4D]"
          />
          <div className="flex gap-2">
            <button 
              onClick={handleAddCustom}
              className="flex-1 py-3 bg-[#1E4D4D] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2"
            >
              <Check size={14} /> حفظ
            </button>
            <button 
              onClick={() => setIsAddingCustom(false)}
              className="px-4 py-3 bg-slate-100 text-slate-500 rounded-2xl text-xs font-black"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
