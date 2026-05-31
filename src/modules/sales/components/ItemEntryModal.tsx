import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button } from '@/components/shared/SharedUI';
import { db } from '@/core/db';
import { Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/hooks/useAppStore';

interface ProductItem {
  id: string;
  Name: string;
  categoryName?: string;
  Category?: string;
  category?: string;
  ExpiryDate?: string;
  Expiry_Date?: string;
  expiryDate?: string;
  UnitPrice?: number;
  StockQuantity?: number;
  stock?: number;
}

interface FinalItemPayload {
  id: string;
  productId: string | null;
  name: string;
  qty: number;
  price: number;
  expiryDate: string;
  note: string;
  category: string;
  sum: number;
}

interface ItemEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: FinalItemPayload) => void;
  mode: 'purchase' | 'sale';
  initialData?: {
    id?: string;
    name?: string;
    qty?: string | number;
    price?: string | number;
    expiryDate?: string;
    note?: string;
    category?: string;
    productId?: string | null;
    product?: ProductItem | null;
  } | null;
}

export const ItemEntryModal: React.FC<ItemEntryModalProps> = ({
  isOpen, onClose, onAdd, mode, initialData
}) => {
  const [manualItemName, setManualItemName] = useState<string>('');
  const [tempQty, setTempQty] = useState<string | number>('');
  const [tempPrice, setTempPrice] = useState<string | number>('');
  const [tempExpiry, setTempExpiry] = useState<string>('');
  const [tempNote, setTempNote] = useState<string>('');
  const [categoryName, setCategoryName] = useState<string>('');
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [filteredProducts, setFilteredProducts] = useState<ProductItem[]>([]);
  const [isConfirmNewProductOpen, setIsConfirmNewProductOpen] = useState<boolean>(false);
  const [isConfirmedNewProduct, setIsConfirmedNewProduct] = useState<boolean>(false);
  
  // تتبع الارتفاع المتبقي ديناميكياً لتأمين لقطة التطبيق الأصيل
  const [isKeyboardUp, setIsKeyboardUp] = useState<boolean>(false);

  const { currency } = useAppStore();

  const itemNameInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const expiryInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const categoryInputRef = useRef<HTMLSelectElement>(null);

  // مراقبة الـ Visual Viewport للتعامل مع كيبورد أندرويد كروم بدقة دوت-نت ميكرو
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      const totalHeight = window.innerHeight;
      const currentVisualHeight = vv.height;
      const keyboardHeight = totalHeight - currentVisualHeight;

      if (keyboardHeight > 120) {
        setIsKeyboardUp(true);
      } else {
        setIsKeyboardUp(false);
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setManualItemName(initialData.name || '');
        setTempQty(initialData.qty || '');
        setTempPrice(initialData.price || '');
        setTempExpiry(initialData.expiryDate || '');
        setTempNote(initialData.note || '');
        setCategoryName(initialData.category || '');
      } else {
        resetForm();
      }
      setTimeout(() => itemNameInputRef.current?.focus(), 120);
    }
  }, [isOpen, initialData]);

  const resetForm = () => {
    setManualItemName(''); setTempQty(''); setTempPrice(''); setTempExpiry(''); setTempNote(''); setCategoryName(''); setIsConfirmedNewProduct(false);
  };

  useEffect(() => {
    const search = async () => {
      if (manualItemName.length > 1) {
        let results = await db.products.filter(p => {
          const nameMatch = !!(p.Name && p.Name.toLowerCase().includes(manualItemName.toLowerCase()));
          const barcodeMatch = !!(p.barcode && p.barcode.includes(manualItemName));
          return nameMatch || barcodeMatch;
        }).limit(10).toArray();
        if (mode === 'sale') results = results.filter(p => (p.StockQuantity || p.stock || 0) > 0);
        setFilteredProducts(results as ProductItem[]);
      } else { setFilteredProducts([]); }
    };
    search();
  }, [manualItemName, mode]);

  const selectProduct = (p: ProductItem) => {
    setManualItemName(p.Name || ''); 
    setCategoryName(p.categoryName || p.category || ''); 
    setTempExpiry(p.ExpiryDate || p.expiryDate || ''); 
    setShowSearchDropdown(false); 
    qtyInputRef.current?.focus();
  };

  const handleFinalize = async () => {
    if (!manualItemName || !tempQty || !tempPrice) return;
    
    // محاولة جلب الصنف بطريقة غامضة وحالة عدم الحساسية للحالة (Case-insensitive)
    let existing = await db.products.where('Name').equals(manualItemName).first();
    if (!existing) {
      existing = await db.products.filter(p => (p.Name || '').toLowerCase() === manualItemName.toLowerCase()).first();
    }

    let finalProductId = existing?.id || null;

    // في حال وضع البيع وعدم تسجيل المنتج، نسمح بالإضافة كمنتج غير مسجل يدوياً لمنع تجميد المودال
    if (!existing && mode === 'sale') {
      finalProductId = 'manual-' + Date.now();
    }

    if (!existing && mode === 'purchase' && !isConfirmedNewProduct) { 
      setIsConfirmNewProductOpen(true); 
      return; 
    }

    if (!existing && mode === 'purchase' && isConfirmedNewProduct) {
      const newProd = { id: 'PROD-' + Date.now(), Name: manualItemName, categoryName: categoryName || 'عام', UnitPrice: parseFloat(tempPrice as string), Is_Active: 1, created_at: new Date().toISOString() };
      await db.products.add(newProd as any); 
      finalProductId = newProd.id;
    }

    onAdd({ 
      id: initialData?.id || Date.now().toString(), 
      productId: finalProductId, 
      name: manualItemName, 
      qty: parseFloat(tempQty as string), 
      price: parseFloat(tempPrice as string), 
      expiryDate: tempExpiry, 
      note: tempNote, 
      category: categoryName || 'عام', 
      sum: parseFloat(tempQty as string) * parseFloat(tempPrice as string) 
    });
    if (initialData) {
      onClose();
    } else {
      resetForm();
      setTimeout(() => itemNameInputRef.current?.focus(), 100);
    }
  };

  const handleConfirmRegister = async () => {
    setIsConfirmNewProductOpen(false);
    setIsConfirmedNewProduct(true);
    const newProd = { 
      id: 'PROD-' + Date.now(), 
      Name: manualItemName, 
      categoryName: categoryName || 'عام', 
      UnitPrice: parseFloat(tempPrice as string) || 0, 
      Is_Active: 1, 
      created_at: new Date().toISOString() 
    };
    await db.products.add(newProd as any);
    
    onAdd({ 
      id: initialData?.id || Date.now().toString(), 
      productId: newProd.id, 
      name: manualItemName, 
      qty: parseFloat(tempQty as string), 
      price: parseFloat(tempPrice as string), 
      expiryDate: tempExpiry, 
      note: tempNote, 
      category: categoryName || 'عام', 
      sum: parseFloat(tempQty as string) * parseFloat(tempPrice as string) 
    });
    if (initialData) {
      onClose();
    } else {
      resetForm();
      setTimeout(() => itemNameInputRef.current?.focus(), 100);
    }
  };

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="" 
        showCloseButton={false} 
        isCompact={false} 
        noPadding={true} 
        noOuterPadding={true}
        maxWidth="max-w-[420px] w-[95vw]"
        transparentContainer={true}
        positionClass="items-center"
      >
        <div 
          dir="rtl" 
          className="w-full max-w-[420px] mx-auto bg-white rounded-[28px] overflow-hidden flex flex-col box-border p-0 m-0 border-0 shadow-2xl transition-all duration-150 ease-out"
          style={{ 
            maxHeight: isKeyboardUp ? '52vh' : '88vh', // تقليص الارتفاع بذكاء لمنع التعدي عند ظهور الكيبورد
            transform: isKeyboardUp ? 'translateY(-4vh)' : 'none' // رفعة خفيفة لتوسيط هندسي ناصع
          }}
        >
          {/* حقل البحث والمطابقة */}
          <div className="px-3 pt-3 pb-1.5 border-b border-slate-100 flex-shrink-0 w-full box-border">
            <label className="text-[11px] font-bold text-slate-400 mb-0.5 block text-right">اسم الصنف</label>
            <div className="relative w-full box-border">
              <input 
                ref={itemNameInputRef} value={manualItemName} onChange={e => { setManualItemName(e.target.value); setShowSearchDropdown(true); }} onFocus={() => setShowSearchDropdown(true)}
                className="w-full box-border h-10 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-[14px] font-semibold text-[#1E4D4D] outline-none focus:bg-white text-right"
                placeholder="ابحث عن صنف أو اكتب اسماً..." 
              />
              <AnimatePresence>
                {showSearchDropdown && filteredProducts.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 3 }} className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] mt-0.5 max-h-32 overflow-y-auto box-border">
                    {filteredProducts.map(p => (
                      <button key={p.id} type="button" onClick={() => selectProduct(p)} className="w-full px-3 py-1.5 text-right hover:bg-slate-50 border-b border-slate-50 last:border-0 text-[13px] font-medium text-[#1E4D4D] block font-semibold">
                        {p.Name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* الحقول المدمجة القابلة للتمرير الداخلي في حالة ضيق المساحة المرئية */}
          <div className="px-3 py-1.5 space-y-2 overflow-y-auto flex-1 box-border w-full min-w-0 scrollbar-none">
            {/* صف 1: الكمية | الصلاحية */}
            <div className="grid grid-cols-2 gap-2 w-full min-w-0 box-border">
              <div className="space-y-0.5 min-w-0">
                <label className="text-[11px] font-bold text-slate-400 text-right block">الكمية</label>
                <input ref={qtyInputRef} type="number" value={tempQty} onChange={e => setTempQty(e.target.value)} onKeyDown={e => e.key === 'Enter' && expiryInputRef.current?.focus()} className="w-full box-border h-10 bg-slate-50 border border-slate-200 rounded-xl px-2 text-center text-[14px] font-semibold text-[#1E4D4D] outline-none" placeholder="0" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <label className="text-[11px] font-bold text-slate-400 text-right block">تاريخ الصلاحية</label>
                <input ref={expiryInputRef} type="date" disabled={mode === 'sale'} readOnly={mode === 'sale'} value={tempExpiry} onChange={e => setTempExpiry(e.target.value)} onKeyDown={e => e.key === 'Enter' && priceInputRef.current?.focus()} className={`w-full box-border h-10 bg-slate-50 border border-slate-200 rounded-xl px-2 text-[14px] font-semibold text-[#1E4D4D] outline-none text-right appearance-none ${mode === 'sale' ? 'opacity-60 bg-slate-100' : ''}`} />
              </div>
            </div>

            {/* صف 2: السعر | التصنيف */}
            <div className="grid grid-cols-2 gap-2 w-full min-w-0 box-border">
              <div className="space-y-0.5 min-w-0">
                <label className="text-[11px] font-bold text-slate-400 text-right block">{mode === 'purchase' ? 'سعر الشراء' : 'سعر البيع'}</label>
                <input ref={priceInputRef} type="number" step="any" value={tempPrice} onChange={e => setTempPrice(e.target.value)} onKeyDown={e => e.key === 'Enter' && categoryInputRef.current?.focus()} className="w-full box-border h-10 bg-slate-50 border border-slate-200 rounded-xl px-2 text-center text-[14px] font-semibold text-[#1E4D4D] outline-none" placeholder="0.00" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <label className="text-[11px] font-bold text-slate-400 text-right block">التصنيف</label>
                <select ref={categoryInputRef} disabled={mode === 'sale'} value={categoryName} onChange={e => setCategoryName(e.target.value)} onKeyDown={e => e.key === 'Enter' && noteInputRef.current?.focus()} className="w-full box-border h-10 bg-slate-50 border border-slate-200 rounded-xl px-2 text-[14px] font-semibold text-[#1E4D4D] outline-none text-right appearance-none">
                  <option value="">{mode === 'sale' ? categoryName || 'عام' : 'اختر تصنيفاً...'}</option>
                  {['أدوية', 'مستلزمات طبية', 'مستحضر تجميلي', 'مكملات غذائية', 'أجهزة طبية', 'مواد استهلاكية', 'أصناف أخرى'].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

            {/* شريط الإجمالي المحسوب كبسولة مدمجة */}
            <div className="w-full box-border h-8 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-[12px] font-black text-emerald-800">الإجمالي: {((parseFloat(tempQty as string) || 0) * (parseFloat(tempPrice as string) || 0)).toLocaleString()} {currency}</span>
            </div>

            {/* حقل الملاحظة الموفر للمساحة */}
            <div className="w-full box-border">
              <input ref={noteInputRef} value={tempNote} onChange={e => setTempNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFinalize()} className="w-full box-border h-10 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-[14px] font-semibold text-[#1E4D4D] outline-none focus:bg-white text-right" placeholder="أضف ملاحظة هنا..." />
            </div>
          </div>

          {/* الأزرار الأساسية محاذية وملتصقة بالأسفل تماماً لمنع أي قص */}
          <div className="flex gap-2 px-3 pt-1.5 pb-2 border-t border-slate-100 flex-nowrap w-full box-border bg-white flex-shrink-0 m-0">
            <Button className="flex-[2] !h-10 !rounded-xl !text-[14px] font-bold" variant="primary" onClick={handleFinalize}>
              {initialData ? 'تعديل الصنف' : 'إضافة الصنف'}
            </Button>
            <Button className="flex-1 !h-10 !rounded-xl !text-[14px] font-bold" variant="neutral" onClick={onClose}>
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

      {/* نافذة التأكيد */}
      <Modal isOpen={isConfirmNewProductOpen} onClose={() => setIsConfirmNewProductOpen(false)} title="" maxWidth="max-w-[320px] w-[90vw]" noPadding={true} showCloseButton={false} positionClass="items-center">
        <div dir="rtl" className="p-4 text-center space-y-3 bg-white rounded-2xl box-border w-full">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600"><Package size={24} /></div>
          <div className="space-y-1"><h3 className="text-[15px] font-black text-[#1E4D4D]">صنف غير مسجل!</h3><p className="text-[12px] font-medium text-slate-500 leading-relaxed">هل ترغب في تسجيل <span className="text-[#1E4D4D] font-bold underline">{manualItemName}</span> كمنتج جديد؟</p></div>
          <div className="flex gap-2 pt-1 box-border">
            <button type="button" onClick={handleConfirmRegister} className="flex-[2] h-10 bg-[#1E4D4D] text-white rounded-xl text-[13px] font-bold">نعم، سجل الآن</button>
            <button type="button" onClick={() => setIsConfirmNewProductOpen(false)} className="flex-1 h-10 bg-slate-100 text-slate-600 rounded-xl text-[13px] font-bold">إلغاء</button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ItemEntryModal;
