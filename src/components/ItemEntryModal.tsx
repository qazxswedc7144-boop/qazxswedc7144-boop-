
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button } from './SharedUI';
import { ghostValueService } from '../services/ghostValueService';
import { db } from '../lib/database';
import { Plus, Search, Package, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/useAppStore';

interface ItemEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: any) => void;
  mode: 'purchase' | 'sale';
  initialData?: any;
}

export const ItemEntryModal: React.FC<ItemEntryModalProps> = ({
  isOpen, onClose, onAdd, mode, initialData
}) => {
  const [manualItemName, setManualItemName] = useState('');
  const [tempQty, setTempQty] = useState<string | number>('');
  const [tempPrice, setTempPrice] = useState<string | number>('');
  const [tempExpiry, setTempExpiry] = useState('');
  const [tempNote, setTempNote] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [isConfirmNewProductOpen, setIsConfirmNewProductOpen] = useState(false);
  const [isConfirmedNewProduct, setIsConfirmedNewProduct] = useState(false);
  const [hints, setHints] = useState({ lastPrice: 0, stock: 0 });

  const { currency } = useAppStore();

  const itemNameInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const expiryInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const categoryInputRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setManualItemName(initialData.name || '');
        setTempQty(initialData.qty || '');
        setTempPrice(initialData.price || '');
        setTempExpiry(initialData.expiryDate || '');
        setTempNote(initialData.note || '');
        setCategoryName(initialData.category || '');
        setSelectedProduct(initialData.product || null);
        if (initialData.productId) {
            loadHints(initialData.productId);
        }
      } else {
        resetForm();
      }
      setTimeout(() => itemNameInputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  const resetForm = () => {
    setManualItemName('');
    setTempQty('');
    setTempPrice('');
    setTempExpiry('');
    setTempNote('');
    setCategoryName('');
    setSelectedProduct(null);
    setHints({ lastPrice: 0, stock: 0 });
    setIsConfirmedNewProduct(false);
  };

  const loadHints = async (productId: string) => {
    if (mode === 'purchase') {
      const h = await ghostValueService.getPurchaseHints(productId);
      setHints({ lastPrice: h.lastPurchasePrice, stock: h.currentStock });
    } else {
      const h = await ghostValueService.getSalesHints(productId);
      setHints({ lastPrice: h.lastSalePrice, stock: h.availableStock });
    }
  };

  useEffect(() => {
    const search = async () => {
      if (manualItemName.length > 1) {
        const results = await db.products
          .filter(p => 
            p.Name.toLowerCase().includes(manualItemName.toLowerCase()) || 
            (p.barcode && p.barcode.includes(manualItemName))
          )
          .limit(10)
          .toArray();
        setFilteredProducts(results);
      } else {
        setFilteredProducts([]);
      }
    };
    search();
  }, [manualItemName]);

  const selectProduct = (p: any) => {
    setSelectedProduct(p);
    setManualItemName(p.Name);
    setCategoryName(p.categoryName || '');
    setShowSearchDropdown(false);
    loadHints(p.id);
    qtyInputRef.current?.focus();
  };

  const handleFinalize = async () => {
    if (!manualItemName || !tempQty || !tempPrice) return;

    if (mode === 'sale' && !selectedProduct) {
      const existing = await db.products.where('Name').equals(manualItemName).first();
      if (!existing) {
        alert("لا يمكن إضافة صنف جديد في وضع المبيعات");
        return;
      }
    }

    // Check if product exists
    const existing = await db.products.where('Name').equals(manualItemName).first();
    
    if (!existing && mode === 'purchase' && !isConfirmedNewProduct) {
      setIsConfirmNewProductOpen(true);
      return;
    }

    let finalProductId = existing?.id || null;

    if (!existing && mode === 'purchase' && isConfirmedNewProduct) {
      // Create product in DB
      const newProd: any = {
        id: 'PROD-' + Date.now(),
        Name: manualItemName,
        categoryName: categoryName || 'عام',
        UnitPrice: parseFloat(tempPrice as string),
        Is_Active: 1,
        created_at: new Date().toISOString()
      };
      await db.products.add(newProd);
      finalProductId = newProd.id;
    }

    const item = {
      id: initialData?.id || Date.now().toString(),
      productId: finalProductId,
      name: manualItemName,
      qty: parseFloat(tempQty as string),
      price: parseFloat(tempPrice as string),
      expiryDate: tempExpiry,
      note: tempNote,
      category: categoryName,
      sum: parseFloat(tempQty as string) * parseFloat(tempPrice as string)
    };

    onAdd(item);
    onClose();
  };

  const confirmAddNewProduct = () => {
    setIsConfirmedNewProduct(true);
    setIsConfirmNewProductOpen(false);
    // User can now press "Add" again
  };

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title=""
        maxWidth="w-full sm:w-[380px]"
        noPadding={true}
        noOuterPadding={true}
        showCloseButton={false}
      >
        <div className="p-0 space-y-0 bg-white" dir="rtl">
          {/* Row 1: اسم الصنف */}
          <div className="p-3 space-y-1 border-b border-slate-50">
            <label className="text-[10px] font-bold text-slate-500">اسم الصنف</label>
            <div className="relative">
              <input 
                ref={itemNameInputRef}
                className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]"
                placeholder="ابحث عن صنف..." 
                value={manualItemName} 
                onChange={e => { setManualItemName(e.target.value); setShowSearchDropdown(true); }} 
                onFocus={() => setShowSearchDropdown(true)}
              />
              <AnimatePresence>
                {showSearchDropdown && filteredProducts.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-xl z-[100] mt-1 overflow-hidden"
                  >
                    {filteredProducts.map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => selectProduct(p)}
                        className="w-full px-4 py-3 text-right hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <p className="text-xs font-bold text-[#1E4D4D]">{p.Name}</p>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {/* Row 2: الكمية (Right) | تاريخ الإنتهاء (Left) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500">الكمية</label>
                  {hints.stock < 10 && hints.stock > 0 && (
                    <span className="text-[9px] font-bold text-red-500 flex items-center gap-0.5">
                      <AlertCircle size={10} /> مخزون منخفض
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input 
                    ref={qtyInputRef} 
                    type="number" 
                    className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-center text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]" 
                    placeholder={hints.stock > 0 ? `تلميح: ${hints.stock}` : "0"} 
                    value={tempQty} 
                    onChange={e => setTempQty(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && expiryInputRef.current?.focus()}
                  />
                  {hints.stock > 0 && !tempQty && (
                    <button 
                      onClick={() => setTempQty(hints.stock)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-400 hover:bg-slate-200 transition-colors"
                      title="استخدم التلميح"
                    >
                      {hints.stock}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">تاريخ الصلاحية</label>
                <input 
                  ref={expiryInputRef}
                  type="date"
                  className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]"
                  value={tempExpiry} 
                  onChange={e => setTempExpiry(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && priceInputRef.current?.focus()}
                />
              </div>
            </div>

            {/* Row 3: السعر (Right) | التصنيف (Left) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">
                  {mode === 'purchase' ? 'سعر الشراء' : 'سعر البيع'}
                </label>
                <div className="relative">
                  <input 
                    ref={priceInputRef}
                    type="number" 
                    className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-center text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]" 
                    placeholder={hints.lastPrice > 0 ? `تلميح: ${hints.lastPrice}` : "0.00"} 
                    value={tempPrice} 
                    onChange={e => setTempPrice(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && categoryInputRef.current?.focus()}
                  />
                  {hints.lastPrice > 0 && !tempPrice && (
                    <button 
                      onClick={() => setTempPrice(hints.lastPrice)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-slate-100 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-400 hover:bg-slate-200 transition-colors"
                      title="استخدم التلميح"
                    >
                      {hints.lastPrice}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">التصنيف</label>
                <select 
                  ref={categoryInputRef}
                  className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D] appearance-none"
                  value={categoryName} 
                  onChange={e => setCategoryName(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && noteInputRef.current?.focus()}
                >
                  <option value="">اختر تصنيفاً...</option>
                  {['أدوية', 'مستلزمات طبية', 'مستحضرات تجميل', 'مكملات غذائية', 'أجهزة طبية', 'مواد استهلاكية', 'أصناف أخرى'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: الإجمالي */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500">الإجمالي</label>
              <div className="w-full h-[40px] bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center">
                <span className="text-xs font-black text-emerald-700">
                  {((parseFloat(tempQty as string) || 0) * (parseFloat(tempPrice as string) || 0)).toLocaleString()} {currency}
                </span>
              </div>
            </div>

            {/* Row 5: ملاحظة الصنف */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500">ملاحظة الصنف</label>
              <input 
                ref={noteInputRef}
                className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]"
                placeholder="أضف ملاحظة هنا..." 
                value={tempNote} 
                onChange={e => setTempNote(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleFinalize()}
              />
            </div>
          </div>

          {/* Bottom Actions: إضافة (Right) | إلغاء (Left) */}
          <div className="flex gap-3 p-3 border-t border-slate-100">
            <Button 
              className="flex-1 !h-[44px] !rounded-xl"
              variant="primary"
              onClick={handleFinalize}
            >
              {initialData ? 'تعديل الصنف' : 'إضافة الصنف'}
            </Button>
            <Button 
              className="flex-1 !h-[44px] !rounded-xl"
              variant="neutral"
              onClick={onClose}
            >
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation New Product Modal */}
      <Modal 
        isOpen={isConfirmNewProductOpen} 
        onClose={() => setIsConfirmNewProductOpen(false)}
        title=""
        maxWidth="w-full sm:w-[340px]"
        noPadding={true}
      >
        <div className="p-6 text-center space-y-5 bg-white">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <Package size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-[#1E4D4D]">صنف جديد؟</h3>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              هل تريد إضافة <span className="text-[#1E4D4D] underline">{manualItemName}</span> كصنف جديد في النظام؟
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <button 
              onClick={confirmAddNewProduct}
              className="flex-[2] h-11 bg-[#1E4D4D] text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
            >
              نعم، إضافة
            </button>
            <button 
              onClick={() => setIsConfirmNewProductOpen(false)}
              className="flex-1 h-11 bg-slate-100 text-slate-500 rounded-xl text-xs font-black active:scale-95 transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
