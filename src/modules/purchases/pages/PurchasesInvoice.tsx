
import React from 'react';
import { Button, Modal } from '@/components/shared/SharedUI';
import { ItemEntryModal } from '@/modules/sales/components/ItemEntryModal';
import { 
  Search, Trash2, Plus, Camera, RotateCcw, CheckCircle2,
  ShoppingBag, Package, Percent, Edit3, Clock,
  User, FileText, ArrowRight, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePurchases } from '@/modules/purchases/hooks/usePurchases';
import { useUI } from '@/contexts/AppContext';
import { CameraModule } from '@/modules/shared/pages/CameraModule';
import { DocumentViewer } from '@/components/shared/DocumentViewer';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { InvoiceItemEditModal } from '@/components/shared/InvoiceItemEditModal';
import { UnifiedModal } from '@/components/shared/UnifiedModal';
import { SaveSuccessModal } from '@/components/shared/SaveSuccessModal';
import { DraftRecoveryDialog } from '@/components/shared/DraftRecoveryDialog';

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
  if (parts.length === 3) {
    const year = parts[0] || '';
    const month = parseInt(parts[1] || '0', 10);
    const day = parseInt(parts[2] || '0', 10);
    return `${year}/${month}/${day}`;
  }
  return dateStr;
};

// Memoized Item Row Component for Performance
const InvoiceItemRow = React.memo(({ 
  item, 
  onDelete, 
  onClick,
  isExpirySoon, 
  isPriceHigher,
  idx
}: { 
  item: any; 
  onDelete: (idx: number) => void; 
  onClick?: () => void;
  isExpirySoon: (date: string) => boolean;
  isPriceHigher: (item: any) => boolean;
  idx: number;
}) => (
  <motion.div 
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="flex items-center px-4 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer w-full group relative"
    onClick={() => {
      onClick?.();
    }}
  >
    <div className="flex-[2] flex flex-col pr-1">
      <span className="text-[9px] font-black text-[#1E4D4D] truncate w-full">{item.name}</span>
      {item.expiryDate && (
        <span className={`text-[9px] font-black flex items-center gap-1 mt-0.5 ${isExpirySoon(item.expiryDate) ? 'text-red-500' : 'text-slate-400'}`}>
          <Clock size={10}/> {item.expiryDate}
        </span>
      )}
    </div>
    <div className="flex-1 text-center font-black">
      <span className={`text-[9px] rounded-md px-1 sm:px-2 py-0.5 ${
        item.qty < 5 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-[#1E4D4D]'
      }`}>
        {item.qty}
      </span>
    </div>
    <div className={`flex-1 text-center text-[9px] font-black ${isPriceHigher(item) ? 'text-red-500 font-black' : 'text-slate-600'}`}>
      {item.price.toLocaleString()}
    </div>
    <div className="flex-1 text-center text-[9px] font-black text-[#1E4D4D]">{item.sum.toLocaleString()}</div>
    
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

const PurchasesInvoice: React.FC<{ onNavigate?: (view: any, params?: any) => void }> = ({ onNavigate }) => {
  const { addToast, refreshGlobal } = useUI();
  const [isAddItemModalOpen, setIsAddItemModalOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editingItem, setEditingItem] = React.useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState<boolean>(false);

  const {
    items, setItems,
    searchTerm, setSearchTerm,
    isSaving,
    isAdjustmentsOpen, setIsAdjustmentsOpen,
    isCameraOpen, setIsCameraOpen,
    isViewerOpen, setIsViewerOpen,
    adjData, setAdjData,
    selectedProduct, setSelectedProduct,
    manualItemName, setManualItemName,
    showSearchDropdown, setShowSearchDropdown,
    invNumInputRef,
    itemNameInputRef,
    header, setHeader,
    isLocked,
    vTotalSum,
    filteredProducts,
    filteredSuppliers,
    selectedIndex,
    setSelectedIndex,
    selectedSupplierIndex,
    isSearchingSuppliers,
    handleSupplierKeyDown,
    supplierSearchTerm,
    showSupplierDropdown,
    setShowSupplierDropdown,
    isAddSupplierModalOpen,
    newSupplierName,
    handleSupplierSearch,
    selectSupplier,
    handleSupplierBlur,
    confirmAddSupplier,
    cancelAddSupplier,
    selectProduct,
    handleSearchKeyDown,
    handlePost,
    safeNavigate,
    currency,
    aiParsedData,
    isProcessingAI, setIsProcessingAI,
    hasUnsavedAI,
    showAIConfirmModal,
    setShowAIConfirmModal,
    handleAIImport,
    applyAIParsedData,
    resetInvoiceState,
    suppliers,
    saveSuccessData,
    setSaveSuccessData,
    isConfirmSaveOpen,
    setIsConfirmSaveOpen,
    isRecoveryModalOpen,
    recoveryDraftData,
    restoreDraft,
    discardDraft
  } = usePurchases(onNavigate);

  const selectedSupplierObj = suppliers?.find((s: any) => s.id === header.supplier_id || s.Supplier_ID === header.supplier_id);

  // Navigation Guard: Browser Refresh/Close
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProcessingAI || hasUnsavedAI || items.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessingAI, hasUnsavedAI, items.length]);

  // Helper to open modal with product data
  const handleSelectProduct = (p: any) => {
    setEditingItem(null);
    selectProduct(p);
    setIsAddItemModalOpen(true);
  };

  const handleAddItem = (item: any) => {
    const newItem = {
      ...item,
      product_id: item.productId,
      parent_id: header.invoice_number,
      row_order: items.length + 1
    };

    // Check if updating an existing row in the table
    const existingRowIdx = items.findIndex(i => i.id === newItem.id);
    if (existingRowIdx > -1) {
      const updated = [...items];
      const existing = updated[existingRowIdx];
      if (existing) {
        updated[existingRowIdx] = {
          ...existing,
          ...newItem,
          row_order: existing.row_order
        } as any;
      }
      setItems(updated);
      return;
    }

    // Auto-Fix: Merge quantities for duplicate items
    const existingItemIndex = items.findIndex(i => 
      (i.product_id === newItem.product_id && i.product_id && !i.product_id.startsWith('manual-')) || 
      (i.name === newItem.name && (!i.product_id || i.product_id.startsWith('manual-')))
    );

    if (existingItemIndex > -1) {
      const updatedItems = [...items];
      const existingItem = updatedItems[existingItemIndex];
      if (existingItem) {
        updatedItems[existingItemIndex] = {
          ...existingItem,
          qty: existingItem.qty + newItem.qty,
          sum: (existingItem.qty + newItem.qty) * existingItem.price
        } as any;
      }
      setItems(updatedItems);
      addToast("تم دمج الكمية للصنف المكرر", "info");
    } else {
      setItems([...items, newItem as any]);
    }
  };

  const handleRowClick = React.useCallback((item: any) => {
    if (isLocked) return;

    setEditingItem({
      id: item.id,
      name: item.name,
      qty: item.qty,
      price: item.price,
      expiryDate: item.expiryDate || '',
      category: item.category || '',
      notes: item.note || item.notes || ''
    });
    setIsEditModalOpen(true);
  }, [isLocked]);

  const handleSaveModalData = React.useCallback((updatedItem: any) => {
    setItems((prev: any[]) => prev.map(i => {
      if (i.id === updatedItem.id) {
        return {
          ...i,
          name: updatedItem.name,
          qty: updatedItem.qty,
          price: updatedItem.price,
          expiryDate: updatedItem.expiryDate,
          note: updatedItem.notes,
          notes: updatedItem.notes,
          sum: updatedItem.qty * updatedItem.price
        };
      }
      return i;
    }));
    setIsEditModalOpen(false);
    setEditingItem(null);
  }, [setItems]);

  const handleSaveInvoice = () => {
    // Auto-Fix: Generate temporary invoice number if empty
    if (!header.invoice_number) {
      const tempNum = `TEMP-${Date.now().toString().slice(-6)}`;
      setHeader(prev => ({ ...prev, invoice_number: tempNum }));
    }
    setIsConfirmSaveOpen(true);
  };

  const isPriceHigher = React.useCallback((item: any) => {
    const product = filteredProducts.find(p => p.id === item.product_id);
    if (product && product.LastPurchasePrice && item.price > product.LastPurchasePrice) {
      return true;
    }
    return false;
  }, [filteredProducts]);

  const isExpirySoon = React.useCallback((expiryDate: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    return expiry < sixMonthsFromNow;
  }, []);

  const handleDeleteItem = React.useCallback((idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }, [setItems]);

  return (
    <div className="flex flex-col min-h-full h-full bg-white font-cairo w-full relative overflow-x-hidden" dir="rtl">
      {/* HEADER SECTION - FLAT & FULL WIDTH */}
      <div className="shrink-0 z-[100] border-b border-slate-100 bg-white">
        <div className="py-2 px-3 flex items-center justify-between gap-2.5 w-full overflow-hidden bg-white">
          {/* Main Toolbar Row: Back -> Smart Import -> Return */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Back Button */}
            <button 
              onClick={() => safeNavigate('dashboard')} 
              className="w-7 h-7 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all shrink-0 active:scale-95"
              title="الرجوع للرئيسية"
            >
              <ArrowRight size={16} />
            </button>

            {/* Smart Import Button */}
            <div className="relative shrink-0">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAIImport(file);
                }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingAI}
                className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-black hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50 shrink-0"
              >
                {isProcessingAI ? (
                  <div className="w-3 h-3 border-2 border-emerald-700/30 border-t-emerald-700 rounded-full animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                <span>الاستيراد الذكي</span>
              </button>
            </div>

            {/* Return Button */}
            <button 
              onClick={() => setHeader({...header, isReturn: !header.isReturn})}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all text-[10px] font-black select-none shrink-0 active:scale-95 ${
                header.isReturn 
                  ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              <RotateCcw size={12} className={header.isReturn ? 'animate-spin-slow' : ''} />
              <span>المرتجع</span>
            </button>
          </div>

          {/* Right side: Payment Toggle (Cash/Credit) */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 w-[110px] shrink-0">
            <button 
              onClick={() => setHeader({...header, payment_method: 'Cash'})}
              className={`flex-1 py-1 rounded-md text-[9px] font-black transition-all relative z-10 ${header.payment_method === 'Cash' ? 'text-white' : 'text-slate-400'}`}
            >
              {header.payment_method === 'Cash' && (
                <motion.div layoutId="payment-bg-pur" className="absolute inset-0 bg-[#1E4D4D] rounded-md -z-10 shadow-sm" />
              )}
              نقداً
            </button>
            <button 
              onClick={() => setHeader({...header, payment_method: 'Credit'})}
              className={`flex-1 py-1 rounded-md text-[9px] font-black transition-all relative z-10 ${header.payment_method === 'Credit' ? 'text-white' : 'text-slate-400'}`}
            >
              {header.payment_method === 'Credit' && (
                <motion.div layoutId="payment-bg-pur" className="absolute inset-0 bg-[#7f1d1d] rounded-md -z-10 shadow-sm" />
              )}
              آجل
            </button>
          </div>
        </div>

        {/* DATA DIVIDERS SECTION */}
        <form onSubmit={(e) => e.preventDefault()} className="border-t border-slate-50 overflow-x-visible bg-white">
          <div className="flex flex-row gap-2 items-center w-full px-3 py-2">
            {/* Supplier Name Field - Flex expansion */}
            <div className="flex-1 min-w-0 relative bg-white">
              <input 
                value={supplierSearchTerm}
                onChange={(e) => handleSupplierSearch(e.target.value)}
                onKeyDown={handleSupplierKeyDown}
                onFocus={() => setShowSupplierDropdown(true)}
                onBlur={handleSupplierBlur}
                placeholder="اسم المورد..."
                className="w-full h-10 border-b border-gray-400 focus:outline-none focus:border-green-500 rounded-none text-black text-right placeholder-gray-400 bg-transparent pr-1"
              />
              {selectedSupplierObj && (
                <div className="absolute left-1 bottom-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300 font-sans text-[10px] font-bold border border-amber-100/50 dark:border-amber-900/40 shadow-sm pointer-events-none select-none z-10 transition-all">
                  <span>الرصيد:</span>
                  <span className="font-mono">{(selectedSupplierObj.balance || 0).toLocaleString()}</span>
                  <span className="text-[8px] opacity-80">{currency}</span>
                </div>
              )}
              <AnimatePresence>
                {showSupplierDropdown && filteredSuppliers.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full mt-1 right-0 bg-white border border-slate-100 shadow-2xl z-[9999] overflow-hidden rounded-xl w-[200%] max-w-[450px]"
                  >
                    {isSearchingSuppliers ? (
                       <div className="p-4 text-center text-sm font-medium text-slate-400">
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                        جاري البحث...
                      </div>
                    ) : filteredSuppliers.map((s, idx) => (
                      <button 
                        key={s.id}
                        type="button"
                        onMouseDown={() => selectSupplier(s)}
                        className={`w-full p-2.5 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0 text-right ${selectedSupplierIndex === idx ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                      >
                        <span className="text-base font-semibold text-[#1E4D4D]">{s.Supplier_Name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Date Field - fixed and improved width & padding */}
            <div className="w-[95px] shrink-0 relative h-10 bg-white">
              <input 
                type="date"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                value={header.date}
                onChange={(e) => setHeader({...header, date: e.target.value})}
              />
              <div className="absolute inset-0 border-b border-gray-400 text-black text-center bg-transparent px-[2px] flex items-center justify-center text-sm font-semibold pointer-events-none font-sans">
                {formatDateDisplay(header.date || "") || "التاريخ..."}
              </div>
            </div>
          </div>
          
          <div className="flex border-b border-slate-100 flex-row gap-[2%] px-3 py-2 bg-white">
            <div className="basis-[25%] relative">
              <input 
                type="text"
                inputMode="numeric"
                ref={invNumInputRef}
                value={header.invoice_number}
                onChange={(e) => setHeader({...header, invoice_number: e.target.value})}
                placeholder="رقم الفاتورة..."
                className="w-full h-10 border-b border-gray-400 focus:outline-none focus:border-green-500 rounded-none text-black text-right placeholder-gray-400 bg-transparent"
              />
            </div>
            <div className="basis-[73%] relative flex items-center">
              <textarea 
                placeholder="ملاحظات الفاتورة..."
                value={header.notes || ''}
                onChange={(e) => setHeader({...header, notes: e.target.value})}
                className="w-full h-10 border-b border-gray-400 focus:outline-none focus:border-green-500 rounded-none text-black text-right placeholder-gray-400 resize-none pt-2 bg-transparent pr-2"
              />
              <div className="absolute left-3 flex items-center gap-2">
                {header.attachment && (
                  <button 
                    onClick={() => setIsViewerOpen(true)}
                    className="w-6 h-6 rounded-md overflow-hidden border border-[#1E4D4D]/20 shadow-sm active:scale-95 transition-transform"
                    title="عرض المستند"
                  >
                    <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                      <FileText size={12} className="text-[#1E4D4D]" />
                    </div>
                  </button>
                )}
                <button 
                  onClick={() => setIsCameraOpen(true)}
                  className="text-slate-300 hover:text-[#1E4D4D] transition-colors"
                  title="تصوير كاميرا"
                >
                  <Camera size={16} />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <CameraModule 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(base64) => handleAIImport(base64)}
      />

      {header.attachment && (
        <DocumentViewer 
          isOpen={isViewerOpen} 
          onClose={() => setIsViewerOpen(false)} 
          image={header.attachment} 
          onDelete={() => setHeader({ ...header, attachment: '' })}
        />
      )}

      {/* SEARCH BAR SECTION - CENTRAL */}
      <div className="shrink-0 p-3 bg-white border-b border-slate-100">
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              ref={itemNameInputRef}
              value={searchTerm || manualItemName}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setManualItemName(e.target.value);
                setShowSearchDropdown(true);
                setSelectedIndex(-1);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="إكتب اسم الصنف..."
              className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pr-10 pl-4 text-[11px] font-bold focus:bg-white focus:ring-2 focus:ring-[#1E4D4D]/10 transition-all outline-none"
            />
            
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showSearchDropdown && filteredProducts.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full mt-1 right-0 left-0 bg-white border border-slate-100 rounded-xl shadow-2xl z-[100] overflow-hidden"
                >
                  {filteredProducts.map((p, idx) => (
                    <button 
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className={`w-full p-4 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0 ${selectedIndex === idx ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3 text-right">
                        <Package className="text-slate-400" size={18} />
                        <div>
                          <p className="text-[9px] font-black text-[#1E4D4D]">{p.Name}</p>
                          <p className="text-[9px] font-black text-slate-400">الباركود: {p.barcode || '---'}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] font-black text-emerald-600">{p.CostPrice?.toLocaleString()} {currency}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={() => setIsAddItemModalOpen(true)}
            className="w-12 h-12 bg-[#1E4D4D] text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* ITEMS LIST SECTION - SIMPLE LIST */}
      <PullToRefresh onRefresh={async () => { await refreshGlobal(); }} className="flex-1 overflow-y-auto bg-white pb-6">
        {hasUnsavedAI && (
          <div className="bg-amber-50/80 border-r-4 border-amber-500 p-3 mx-4 my-2 rounded-xl flex items-start gap-2.5 shadow-sm select-none" id="ai-review-banner">
            <span className="text-amber-600 mt-0.5"><Sparkles size={16} className="animate-pulse" /></span>
            <div className="flex-1">
              <h4 className="text-[10px] font-black text-amber-900">شاشة المراجعة الوسيطة (تدقيق يدوي مطلوب)</h4>
              <p className="text-[9px] font-bold text-amber-700 leading-relaxed mt-0.5">
                تظهر هنا الأصناف والبيانات المستخرجة وتعديلاتها. يمنع النظام الترحيل التلقائي لضمان المراجعة؛ يرجى مراجعة وتعديل أي حقول (رقم الفاتورة، المورد، الأصناف)، ثم الضغط على "حفظ الفاتورة" للموافقة اليدوية وحفظها كفاتورة مشتريات محاسبية مسودة.
              </p>
            </div>
          </div>
        )}

        <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-slate-50 flex items-center px-4 py-2">
          <span className="flex-[2] text-[11px] font-black text-slate-400 uppercase tracking-widest">الصنف</span>
          <span className="flex-1 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">الكمية</span>
          <span className="flex-1 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">السعر</span>
          <span className="flex-1 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">الإجمالي</span>
          <span className="w-10"></span>
        </div>
        
        <div className="divide-y divide-slate-50 relative overflow-hidden">
          <AnimatePresence initial={false}>
            {items.map((item, idx) => (
              <InvoiceItemRow 
                key={item.id || idx}
                item={item}
                idx={idx}
                onDelete={handleDeleteItem}
                onClick={() => handleRowClick(item)}
                isExpirySoon={isExpirySoon}
                isPriceHigher={isPriceHigher}
              />
            ))}
          </AnimatePresence>

          {items.length === 0 && (
            <div className="p-20 text-center opacity-20 grayscale">
              <ShoppingBag className="mx-auto mb-4" size={48} />
              <p className="text-[9px] font-black">لا توجد أصناف مضافة</p>
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* PERFECTLY ALIGNED STICKY FOOTER SECTION */}
      <div className="sticky bottom-0 w-full z-50 bg-white border-t border-gray-200 p-3 shadow-lg space-y-2 pb-[calc(14px+env(safe-area-inset-bottom))] px-4 rounded-b-2xl">
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase">الخصم</span>
            <AnimatedNumber value={adjData.discountPercent * vTotalSum / 100} className="text-[9px] font-black text-red-500" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase">رسوم أخرى</span>
            <AnimatedNumber value={adjData.otherFees} className="text-[9px] font-black text-slate-600" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase">الصافي</span>
            <div className="flex items-baseline gap-1">
              <AnimatedNumber value={vTotalSum} className="text-[9px] font-black text-[#1E4D4D]" />
              <span className="text-[9px] font-black text-slate-400">{currency}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => setIsAdjustmentsOpen(true)}
            className="flex-1 h-11 bg-slate-100 text-[#1E4D4D] rounded-xl font-black text-[9px] flex items-center justify-center gap-2"
          >
            <div className="flex items-center -space-x-1 rtl:space-x-reverse text-emerald-600">
              <Percent size={15} />
              <Plus size={11} className="mb-0.5" />
            </div>
            التسويات
          </button>
          <button 
            type="button"
            disabled={isSaving || items.length === 0 || isProcessingAI}
            onClick={handleSaveInvoice}
            className="flex-[2] h-11 bg-[#1E4D4D] text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>حفظ الفاتورة</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI CONFIRMATION MODAL */}
      <Modal
        isOpen={showAIConfirmModal}
        onClose={() => setShowAIConfirmModal(false)}
        title="المدير الذكي للمشتريات"
      >
        <div className="space-y-4 p-2 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-2">
              <Sparkles size={32} />
            </div>
            <h3 className="text-[11px] font-black text-[#1E4D4D]">تم تحليل المستند بنجاح</h3>
            <p className="text-[11px] font-bold text-slate-500 mb-4">
              إليك مخلص البيانات المستخرجة:
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex-1 overflow-y-auto max-h-[300px]">
             <div className="grid grid-cols-2 gap-2 mb-3">
               <div className="p-2 bg-white rounded-lg border border-slate-100 italic">
                 <span className="block text-[11px] text-slate-400">المورد</span>
                 <span className="text-[11px] font-black text-[#1E4D4D]">{aiParsedData?.supplier || 'غير مكتشف'}</span>
               </div>
               <div className="p-2 bg-white rounded-lg border border-slate-100">
                 <span className="block text-[11px] text-slate-400">رقم الفاتورة</span>
                 <span className="text-[11px] font-black text-[#1E4D4D]">{aiParsedData?.invoice_number || '---'}</span>
               </div>
             </div>

             <div className="space-y-1">
               <p className="text-[11px] font-black text-slate-500 mb-2 border-b border-slate-200 pb-1">الأصناف المكتشفة ({aiParsedData?.items?.length || 0}):</p>
               {aiParsedData?.items?.map((item: any, i: number) => (
                 <div key={i} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 text-[11px]">
                   <span className="font-bold text-[#1E4D4D] truncate flex-1">{item.name}</span>
                   <div className="flex items-center gap-2 shrink-0 pr-2">
                     <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-black">x{item.quantity}</span>
                     <span className="text-slate-400">{item.price}</span>
                   </div>
                 </div>
               ))}
             </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0 pt-2 border-t border-slate-100">
            <button 
              onClick={() => applyAIParsedData()}
              className="w-full h-11 bg-[#1E4D4D] text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-2"
            >
              <Edit3 size={18} />
              نعم (تعديل ومراجعة)
            </button>
            <button 
              onClick={() => {
                applyAIParsedData();
                setTimeout(() => handlePost(), 500);
              }}
              className="w-full h-11 bg-emerald-600 text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              حفظ فوراً
            </button>
            <button 
              onClick={() => {
                setShowAIConfirmModal(false);
                resetInvoiceState();
                setIsProcessingAI(false);
              }}
              className="w-full h-10 bg-red-50 text-red-600 rounded-xl font-bold text-[11px] flex items-center justify-center gap-2 mt-1"
            >
              <Trash2 size={16} />
              إلغاء الاستيراد
            </button>
          </div>
        </div>
      </Modal>

      {/* ADD ITEM POP-UP MODAL */}
      <ItemEntryModal 
        isOpen={isAddItemModalOpen}
        onClose={() => {
          setIsAddItemModalOpen(false);
          setEditingItem(null);
          setSelectedProduct(null);
        }}
        onAdd={handleAddItem}
        mode="purchase"
        initialData={editingItem ? {
          id: editingItem.id,
          productId: editingItem.product_id,
          name: editingItem.name,
          qty: editingItem.qty,
          price: editingItem.price,
          expiryDate: editingItem.expiryDate,
          note: editingItem.note || editingItem.notes,
          category: editingItem.category
        } : (selectedProduct ? {
          productId: selectedProduct.id,
          name: selectedProduct.Name || selectedProduct.name,
          price: selectedProduct.CostPrice || selectedProduct.UnitPrice,
          category: selectedProduct.categoryName,
          product: { ...selectedProduct, Name: selectedProduct.Name || selectedProduct.name }
        } : null)}
      />

      {/* ADJUSTMENTS MODAL */}
      <Modal 
        isOpen={isAdjustmentsOpen} 
        onClose={() => setIsAdjustmentsOpen(false)}
        title="التسويات والرسوم الإضافية"
        maxWidth="max-w-[340px] w-[92vw]"
        positionClass="items-center"
        noPadding={true}
      >
        <div dir="rtl" className="space-y-4 p-4 bg-white rounded-b-3xl">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block text-right">نسبة الخصم (%)</label>
            <div className="relative">
              <Percent className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input 
                type="number"
                value={adjData.discountPercent}
                onChange={(e) => setAdjData({...adjData, discountPercent: Number(e.target.value)})}
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 text-[12px] font-bold text-[#1E4D4D] focus:bg-white text-right outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block text-right">رسوم أخرى</label>
              <input 
                type="number"
                value={adjData.otherFees}
                onChange={(e) => setAdjData({...adjData, otherFees: Number(e.target.value)})}
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[12px] font-bold text-[#1E4D4D] focus:bg-white text-center outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block text-right">الضريبة</label>
              <input 
                type="number"
                value={adjData.tax}
                onChange={(e) => setAdjData({...adjData, tax: Number(e.target.value)})}
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-4 text-[12px] font-bold text-[#1E4D4D] focus:bg-white text-center outline-none transition-all"
              />
            </div>
          </div>

          <Button 
            onClick={() => setIsAdjustmentsOpen(false)}
            className="w-full !h-11 bg-[#1E4D4D] text-white !rounded-xl font-black text-[13px] shadow-lg shadow-emerald-900/10 mt-2 flex items-center justify-center"
          >
            تطبيق التعديلات
          </Button>
        </div>
      </Modal>

      {/* ADD NEW SUPPLIER MODAL */}
      <Modal
        isOpen={isAddSupplierModalOpen}
        onClose={cancelAddSupplier}
        title=""
        maxWidth="w-full max-w-[340px]"
        noPadding={true}
        centerOnMobile={true}
        showCloseButton={false}
      >
        <div className="pt-[2px] px-[2px] pb-4 text-center space-y-1 bg-white">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <User size={24} />
          </div>
          <div className="space-y-[2px]">
            <h3 className="text-sm font-black text-[#1E4D4D]">مورد غير مسجل</h3>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed px-2">
              هذا المورد غير مسجل، هل تريد إضافة <span className="text-[#1E4D4D] underline">[{newSupplierName}]</span> كاسم جديد؟
            </p>
          </div>
          <div className="flex gap-[2px] pt-1 px-2">
            <button 
              onClick={confirmAddSupplier}
              className="flex-[2] h-10 bg-[#1E4D4D] text-white rounded-xl font-black text-[11px] shadow-md active:scale-95 transition-all"
            >
              نعم
            </button>
            <button 
              onClick={cancelAddSupplier}
              className="flex-1 h-10 bg-slate-100 text-slate-500 rounded-xl font-black text-[11px] active:scale-95 transition-all"
            >
              لا
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Save Modal - Unified Pattern */}
      <AnimatePresence>
        {isConfirmSaveOpen && (
          <UnifiedModal
            saveFunction={handlePost}
            requiredFields={['supplier_id', 'invoice_number']}
            formData={header}
            setFormData={setHeader}
            onClose={() => setIsConfirmSaveOpen(false)}
            title="تأكيد حفظ فاتورة المشتريات"
            isInvoiceSaveConfirm={true}
            invoiceType="PURCHASE"
            invoiceTotal={vTotalSum}
          >
            <div className="space-y-4">
              <p className="text-[11px] font-bold text-slate-400 text-center">سيتم حفظ الفاتورة وتحديث المخزون وقيد الذمم الدائنة.</p>
            </div>
          </UnifiedModal>
        )}

        {/* Save Success Flow overlay */}
        {saveSuccessData && (
          <SaveSuccessModal
            isOpen={!!saveSuccessData}
            invoiceNumber={saveSuccessData.invoiceNumber}
            totalAmount={saveSuccessData.totalAmount}
            currency={currency || "YER"}
            type="PURCHASE"
            date={saveSuccessData.date}
            partnerName={saveSuccessData.partnerName}
            accountingStatus={saveSuccessData.accountingStatus}
            inventoryStatus={saveSuccessData.inventoryStatus}
            balanceStatus={saveSuccessData.balanceStatus}
            onClose={() => {
              setSaveSuccessData(null);
            }}
            onNewInvoice={() => {
              setSaveSuccessData(null);
              resetInvoiceState();
            }}
          />
        )}

        {/* Live Draft Recovery Dialogue (Task 5) */}
        {isRecoveryModalOpen && recoveryDraftData && (
          <DraftRecoveryDialog
            isOpen={isRecoveryModalOpen}
            moduleName="فاتورة المشتريات والتوريد"
            updatedAt={recoveryDraftData.updatedAt}
            itemCount={(recoveryDraftData.payload?.items || recoveryDraftData.items)?.length || 0}
            totalAmount={recoveryDraftData.payload?.totals?.subtotal || recoveryDraftData.totals?.subtotal}
            onRestore={restoreDraft}
            onDiscard={discardDraft}
          />
        )}
      </AnimatePresence>

      {/* Item edit modal */}
      <InvoiceItemEditModal 
        isOpen={isEditModalOpen}
        item={editingItem}
        mode="purchase"
        currency={currency || "YER"}
        onSave={handleSaveModalData}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
      />
    </div>
  );
};

export default PurchasesInvoice;
