import React, { useState, useEffect } from 'react';

export interface InvoiceItem {
  id: string;
  name: string;
  qty: number;
  price: number; // يمثل سعر الشراء أو سعر البيع للمستهلك حسب الشاشة
  expiryDate: string;
  category: string;
  notes?: string;
}

interface InvoiceItemEditModalProps {
  isOpen: boolean;
  item: InvoiceItem | null;
  mode: 'sale' | 'purchase'; // لتخصيص السلوك والعناوين تلقائياً
  currency?: string; // العملة الافتراضية المعتمدة (YER)
  onSave: (updatedItem: InvoiceItem) => void;
  onClose: () => void;
}

export const InvoiceItemEditModal: React.FC<InvoiceItemEditModalProps> = ({
  isOpen,
  item,
  mode,
  currency = "YER",
  onSave,
  onClose
}) => {
  // فصل الحالة الأصلية عن المدخلات للسماح بالتعديل الفوري دون تجميد
  const [localItem, setLocalItem] = useState<InvoiceItem | null>(null);

  useEffect(() => {
    if (item) {
      setLocalItem({ ...item, notes: item.notes || "" });
    }
  }, [item]);

  if (!isOpen || !localItem) return null;

  const handleFieldChange = (field: keyof InvoiceItem, value: any) => {
    setLocalItem(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans" dir="rtl">
      <div className="bg-white dark:bg-slate-950 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        
        {/* رأس النافذة الديناميكي */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">
            {mode === 'purchase' ? '📝 تعديل بيانات صنف المشتريات' : '🧾 تعديل بيانات صنف المبيعات'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="space-y-4">
          {/* حقل اسم الصنف - مفتوح وقابل للتعديل والتنقل الآن */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">اسم الصنف / الدواء</label>
            <input 
              type="text"
              value={localItem.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              placeholder="أدخل اسم الدواء..."
            />
          </div>

          {/* صف الكمية وتاريخ الصلاحية */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">الكمية</label>
              <input 
                type="number"
                value={localItem.qty === 0 ? '' : localItem.qty}
                onChange={(e) => handleFieldChange('qty', Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-center text-slate-800 dark:text-white font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">تاريخ الصلاحية</label>
              <input 
                type="date"
                value={localItem.expiryDate}
                onChange={(e) => handleFieldChange('expiryDate', e.target.value)}
                disabled={mode === 'sale'} // مقفل في البيع لضمان الارتباط التلقائي برقم الدفعة والمخزن
                className={`w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-center font-mono text-slate-800 dark:text-white outline-none ${mode === 'sale' ? 'bg-slate-100 dark:bg-slate-900/50 text-slate-400 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500'}`}
              />
            </div>
          </div>

          {/* صف السعر والمجموعة */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                {mode === 'purchase' ? 'سعر الشراء' : 'سعر البيع'}
              </label>
              <input 
                type="number"
                value={localItem.price === 0 ? '' : localItem.price}
                onChange={(e) => handleFieldChange('price', Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">المجموعة الدوائية</label>
              <input 
                type="text"
                value={localItem.category}
                disabled
                className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-900/50 text-slate-400 cursor-not-allowed font-medium"
              />
            </div>
          </div>

          {/* حقل الملاحظات الإضافية السريع */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات الصنف</label>
            <input 
              type="text"
              value={localItem.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="أضف ملاحظة هنا..."
            />
          </div>

          {/* شريط احتساب الإجمالي التلقائي الموحد بالعملة المحلية */}
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl text-center">
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              الإجمالي: { (localItem.qty * localItem.price).toLocaleString() } {currency}
            </span>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex gap-2 mt-5">
          <button 
            onClick={() => onSave(localItem)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/10 active:scale-[0.98] transition-all"
          >
            تعديل الصنف
          </button>
          <button 
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2.5 px-4 rounded-xl active:scale-[0.98] transition-all"
          >
            إلغاء
          </button>
        </div>

      </div>
    </div>
  );
};
