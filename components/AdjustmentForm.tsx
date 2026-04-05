
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/database';
import { InvoiceAdjustment } from '../types';
import { Modal, Button, Badge } from './SharedUI';
import { Tag, Wallet, Percent, Banknote, Scale, Check, X } from 'lucide-react';

interface AdjustmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  currency: string;
  initialType?: 'Discount' | 'Additional Fee' | 'Tax Adjustment';
  onSave: (adj: Omit<InvoiceAdjustment, 'AdjustmentID' | 'InvoiceID'>) => void;
}

const AdjustmentForm: React.FC<AdjustmentFormProps> = ({ isOpen, onClose, invoiceId, currency, onSave, initialType }) => {
  const [formData, setFormData] = useState<Omit<InvoiceAdjustment, 'AdjustmentID' | 'InvoiceID'>>({
    id: '',
    Type: 'Discount',
    Value: 0,
    IsPercentage: false,
    Note: ''
  });

  const [inputValue, setInputValue] = useState<number>(0);

  // App Formula: حساب القيمة النهائية الموقعة تفاعلياً
  // الخصومات تخزن كقيم سالبة، الرسوم موجبة
  const finalCalculatedValue = useMemo(() => {
    const rawVal = Math.abs(inputValue);
    return formData.Type === 'Discount' ? -rawVal : rawVal;
  }, [inputValue, formData.Type]);

  useEffect(() => {
    if (isOpen && initialType) {
      setFormData(prev => ({ ...prev, Type: initialType }));
    }
  }, [isOpen, initialType]);

  const handleSave = () => {
    if (inputValue <= 0) return;
    
    const id = db.generateId('ADJ');
    onSave({
      ...formData,
      id,
      Value: finalCalculatedValue
    });
    
    onClose();
    setFormData({ id: '', Type: 'Discount', Value: 0, IsPercentage: false, Note: '' });
    setInputValue(0);
  };

  const getHeaderTitle = () => {
    switch (formData.Type) {
      case 'Discount': return 'إضافة خصم مالي';
      case 'Additional Fee': return 'إضافة رسوم إضافية';
      case 'Tax Adjustment': return 'إضافة تسوية ضريبية';
      default: return 'تعديل مالي';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getHeaderTitle()}>
      <div className="space-y-6 py-2" dir="rtl">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">نوع التعديل</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'Discount', label: 'خصم', icon: <Tag size={14} />, color: 'peer-checked:bg-red-500 peer-checked:text-white text-red-500 bg-red-50' },
              { id: 'Additional Fee', label: 'رسوم', icon: <Wallet size={14} />, color: 'peer-checked:bg-[#1E4D4D] peer-checked:text-white text-[#1E4D4D] bg-slate-50' },
              { id: 'Tax Adjustment', label: 'ضريبة', icon: <Scale size={14} />, color: 'peer-checked:bg-blue-600 peer-checked:text-white text-blue-600 bg-blue-50' }
            ].map(type => (
              <label key={type.id} className="relative cursor-pointer group">
                <input 
                  type="radio" 
                  name="adjType" 
                  className="sr-only peer" 
                  checked={formData.Type === type.id}
                  onChange={() => setFormData({ ...formData, Type: type.id as any })}
                />
                <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 border-transparent transition-all active:scale-90 ${type.color} peer-checked:shadow-lg`}>
                  {type.icon}
                  <span className="text-[9px] font-black mt-1">{type.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">القيمة</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input 
                type="number" 
                autoFocus
                className="w-full h-14 bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl px-5 text-xl font-black text-center outline-none focus:bg-white focus:border-[#1E4D4D] transition-all shadow-inner"
                placeholder="0.00"
                value={inputValue || ''}
                onChange={e => setInputValue(parseFloat(e.target.value) || 0)}
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">
                {formData.IsPercentage ? '%' : currency}
              </span>
            </div>
            
            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 h-14 w-28 shadow-sm shrink-0">
               <button 
                 onClick={() => setFormData({ ...formData, IsPercentage: true })}
                 className={`flex-1 rounded-xl text-[9px] font-black transition-all flex items-center justify-center ${formData.IsPercentage ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-400'}`}
               ><Percent size={12} /></button>
               <button 
                 onClick={() => setFormData({ ...formData, IsPercentage: false })}
                 className={`flex-1 rounded-xl text-[9px] font-black transition-all flex items-center justify-center ${!formData.IsPercentage ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-400'}`}
               ><Banknote size={12} /></button>
            </div>
          </div>
        </div>

        {/* Displaying Formula Result */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">الأثر المالي النهائي (Formula)</p>
           <p className={`text-xl font-black ${finalCalculatedValue < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {finalCalculatedValue > 0 ? '+' : ''}{finalCalculatedValue.toLocaleString()} {formData.IsPercentage ? '%' : currency}
           </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">البيان / الملاحظة</label>
          <div className="relative">
            <textarea 
              className="w-full bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl p-4 text-xs font-bold min-h-[100px] outline-none focus:bg-white focus:border-[#1E4D4D] transition-all shadow-inner"
              placeholder="اكتب سبب التعديل..."
              value={formData.Note}
              onChange={e => setFormData({ ...formData, Note: e.target.value })}
            />
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <Button variant="secondary" className="flex-1 !rounded-2xl" onClick={onClose}>إلغاء</Button>
          <Button 
            variant="primary" 
            className="flex-[2] !rounded-2xl shadow-xl" 
            onClick={handleSave}
            icon="💾"
          >تأكيد الحفظ</Button>
        </div>
      </div>
    </Modal>
  );
};

export default AdjustmentForm;
