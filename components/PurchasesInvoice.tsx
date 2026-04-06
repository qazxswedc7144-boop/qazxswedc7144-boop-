
import React from 'react';
import { Card, Button, Badge, Modal, Input } from './SharedUI';
import { ItemEntryModal } from './ItemEntryModal';
import { InvoiceLockedBanner } from './SharedInvoiceUI';
import PrintMenu from './PrintMenu';
import { 
  Search, Trash2, Plus, Minus, ArrowLeft, Tag, Camera, Calendar,
  ChevronDown, RotateCcw, CheckCircle2,
  ShoppingBag, Package, CalendarDays, Wallet, Percent, Scale,
  X, Edit3, AlertCircle, History, ShieldAlert, Lock, Clock,
  User, CreditCard, Save, ChevronRight, FileText, ArrowRight, Home, Printer,
  ChevronLeft, MoreVertical, Trash, Info, FileSpreadsheet, LayoutList,
  Sparkles, FileUp, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePurchases } from '../hooks/usePurchases';
import { useUI } from '../store/AppContext';
import { InvoiceItem } from '../types';
import { CameraModule } from './CameraModule';
import { DocumentViewer } from './DocumentViewer';

const PurchasesInvoice: React.FC<{ onNavigate?: (view: any, params?: any) => void }> = ({ onNavigate }) => {
  const { addToast } = useUI();
  const [isAddItemModalOpen, setIsAddItemModalOpen] = React.useState(false);
  const [showMoreDetails, setShowMoreDetails] = React.useState(false);
  const [tempTotal, setTempTotal] = React.useState<number | string>('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    items, setItems,
    searchTerm, setSearchTerm,
    isSearchOpen, setSearchOpen,
    isAutoSaving,
    isSaving,
    isDuplicate,
    hasDependencies,
    isAdjustmentsOpen, setIsAdjustmentsOpen,
    isCameraOpen, setIsCameraOpen,
    isViewerOpen, setIsViewerOpen,
    adjData, setAdjData,
    selectedProduct, setSelectedProduct,
    manualItemName, setManualItemName,
    tempQty, setTempQty,
    tempPrice, setTempPrice,
    tempExpiry, setTempExpiry,
    tempNote, setTempNote,
    showSearchDropdown, setShowSearchDropdown,
    manualCategoryName, setManualCategoryName,
    selectedCategoryId, setSelectedCategoryId,
    showCategoryDropdown, setShowCategoryDropdown,
    invNumInputRef,
    itemNameInputRef,
    qtyInputRef,
    priceInputRef,
    expiryInputRef,
    noteInputRef,
    categoryInputRef,
    header, setHeader,
    isLocked,
    vTotalSum,
    filteredProducts,
    filteredSuppliers,
    selectedIndex,
    setSelectedIndex,
    supplierSearchTerm,
    setSupplierSearchTerm,
    showSupplierDropdown,
    setShowSupplierDropdown,
    isAddSupplierModalOpen,
    setIsAddSupplierModalOpen,
    newSupplierName,
    handleSupplierSearch,
    selectSupplier,
    handleSupplierBlur,
    confirmAddSupplier,
    cancelAddSupplier,
    selectProduct,
    finalizeItemAdd,
    handleSearchKeyDown,
    handlePost,
    currency,
    isRecovery,
    suppliers,
    categories,
    addCategory,
    handleExport,
    printData,
    editingInvoiceId,
    isAIProcessing,
    showAIConfirmModal,
    setShowAIConfirmModal,
    handleAIImport,
    applyAIParsedData,
    resetInvoiceState
  } = usePurchases(onNavigate);

  // Helper to open modal with product data
  const handleSelectProduct = (p: any) => {
    selectProduct(p);
    setIsAddItemModalOpen(true);
  };

  const handleAddItem = (item: any) => {
    // Auto-Fix: Merge quantities for duplicate items
    const existingItemIndex = items.findIndex(i => 
      (i.product_id === item.productId && i.product_id && !i.product_id.startsWith('manual-')) || 
      (i.name === item.name && (!i.product_id || i.product_id.startsWith('manual-')))
    );

    if (existingItemIndex > -1) {
      const updatedItems = [...items];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        qty: updatedItems[existingItemIndex].qty + item.qty,
        sum: (updatedItems[existingItemIndex].qty + item.qty) * updatedItems[existingItemIndex].price
      };
      setItems(updatedItems);
      addToast("تم دمج الكمية للصنف المكرر", "info");
    } else {
      setItems([...items, {
        ...item,
        product_id: item.productId,
        parent_id: header.invoice_number,
        row_order: items.length + 1
      } as any]);
    }
  };

  const handleSaveInvoice = () => {
    // Auto-Fix: Generate temporary invoice number if empty
    if (!header.invoice_number) {
      const tempNum = `TEMP-${Date.now().toString().slice(-6)}`;
      setHeader(prev => ({ ...prev, invoice_number: tempNum }));
      setTimeout(() => handlePost(), 100);
    } else {
      handlePost();
    }
  };

  const isPriceHigher = (item: any) => {
    const product = filteredProducts.find(p => p.id === item.product_id);
    if (product && product.LastPurchasePrice && item.price > product.LastPurchasePrice) {
      return true;
    }
    return false;
  };

  const isExpirySoon = (expiryDate: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    return expiry < sixMonthsFromNow;
  };

  return (
    <div className="flex flex-col h-screen bg-white font-['Cairo'] w-full relative overflow-hidden" dir="rtl">
      {/* HEADER SECTION - FLAT & FULL WIDTH */}
      <div className="shrink-0 z-[100] border-b border-slate-100">
        <div className="py-3 px-4 flex items-center justify-between gap-4">
          {/* Right Group: Title, AI Import, Return */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => onNavigate?.('dashboard')} 
                className="w-8 h-8 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all ml-2"
                title="الرجوع للرئيسية"
              >
                <ArrowRight size={18} />
              </button>
              <h2 className="text-lg font-black text-[#1E4D4D] whitespace-nowrap">مشتريات</h2>
              <div className="mr-2 flex items-center gap-2">
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
                  disabled={isAIProcessing}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[11px] font-black hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isAIProcessing ? (
                    <div className="w-4 h-4 border-2 border-emerald-700/30 border-t-emerald-700 rounded-full animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  الاستيراد الذكي
                </button>
              </div>
            </div>

            <div 
              className="flex items-center gap-2 cursor-pointer select-none group" 
              onClick={() => setHeader({...header, isReturn: !header.isReturn})}
            >
              <span className="text-xs font-bold text-[#1E4D4D]">مرتجع</span>
              <div className="w-5 h-5 border-2 border-[#1E4D4D] rounded flex items-center justify-center bg-white transition-all group-hover:bg-slate-50">
                {header.isReturn && <span className="text-[#1E4D4D] font-bold text-xs">✓</span>}
              </div>
            </div>
          </div>

          {/* Left Group: Payment Toggle */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 w-full max-w-[240px]">
            <button 
              onClick={() => setHeader({...header, payment_method: 'Cash'})}
              className={`flex-1 py-2 rounded-md text-[11px] font-black transition-all relative z-10 ${header.payment_method === 'Cash' ? 'text-white' : 'text-slate-400'}`}
            >
              {header.payment_method === 'Cash' && (
                <motion.div layoutId="payment-bg-pur" className="absolute inset-0 bg-[#1E4D4D] rounded-md -z-10 shadow-sm" />
              )}
              نقداً
            </button>
            <button 
              onClick={() => setHeader({...header, payment_method: 'Credit'})}
              className={`flex-1 py-2 rounded-md text-[11px] font-black transition-all relative z-10 ${header.payment_method === 'Credit' ? 'text-white' : 'text-slate-400'}`}
            >
              {header.payment_method === 'Credit' && (
                <motion.div layoutId="payment-bg-pur" className="absolute inset-0 bg-[#7f1d1d] rounded-md -z-10 shadow-sm" />
              )}
              آجل
            </button>
          </div>
        </div>

        {/* DATA DIVIDERS SECTION */}
        <div className="border-t border-slate-50">
          <div className="flex border-b border-slate-50">
            <div className="w-[60%] flex items-center h-10 px-3 border-l border-slate-50">
              <User className="text-slate-300 ml-2" size={14} />
              <input 
                value={supplierSearchTerm}
                onChange={(e) => handleSupplierSearch(e.target.value)}
                onBlur={handleSupplierBlur}
                placeholder="اسم المورد..."
                className="flex-1 h-full bg-transparent text-xs font-bold text-[#1E4D4D] outline-none border-b border-[#1E4D4D]/30 focus:border-[#1E4D4D] transition-colors"
              />
              <AnimatePresence>
                {showSupplierDropdown && filteredSuppliers.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full mt-0 right-0 left-0 bg-white border-b border-slate-100 shadow-xl z-[110] overflow-hidden"
                  >
                    {filteredSuppliers.map(s => (
                      <button 
                        key={s.id}
                        onMouseDown={() => selectSupplier(s)}
                        className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 text-right"
                      >
                        <span className="text-xs font-bold text-[#1E4D4D]">{s.Supplier_Name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="w-[40%] flex items-center h-10 px-3">
              <CalendarDays className="text-slate-300 ml-2" size={14} />
              <input 
                type="date"
                value={header.date}
                onChange={(e) => setHeader({...header, date: e.target.value})}
                className="flex-1 h-full bg-transparent text-xs font-bold text-[#1E4D4D] outline-none border-b border-[#1E4D4D]/30 focus:border-[#1E4D4D] transition-colors"
              />
            </div>
          </div>
          
          <div className="flex border-b border-slate-50">
            <div className="w-[30%] flex items-center h-10 px-3 border-l border-slate-50">
              <LayoutList className="text-slate-300 ml-2" size={14} />
              <input 
                type="text"
                inputMode="numeric"
                ref={invNumInputRef}
                value={header.invoice_number}
                onChange={(e) => setHeader({...header, invoice_number: e.target.value})}
                placeholder="رقم الفاتورة..."
                className="flex-1 h-full bg-transparent text-xs font-bold text-[#1E4D4D] outline-none border-b border-[#1E4D4D]/30 focus:border-[#1E4D4D] transition-colors"
              />
            </div>
            <div className="w-[70%] flex items-center h-10 px-3 relative">
              <FileText className="text-slate-300 ml-2" size={14} />
              <input 
                value={header.notes || ''}
                onChange={(e) => setHeader({...header, notes: e.target.value})}
                placeholder="ملاحظات الفاتورة..."
                className="flex-1 h-full bg-transparent text-xs font-bold text-[#1E4D4D] outline-none pr-8 border-b border-[#1E4D4D]/30 focus:border-[#1E4D4D] transition-colors"
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
        </div>
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
              className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pr-10 pl-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#1E4D4D]/10 transition-all outline-none"
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
                          <p className="text-sm font-black text-[#1E4D4D]">{p.Name}</p>
                          <p className="text-[10px] font-bold text-slate-400">الباركود: {p.barcode || '---'}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-emerald-600">{p.CostPrice?.toLocaleString()} {currency}</p>
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
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-slate-50 flex items-center px-4 py-2">
          <span className="flex-[2] text-[10px] font-black text-slate-400 uppercase tracking-widest">الصنف</span>
          <span className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الكمية</span>
          <span className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">السعر</span>
          <span className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الإجمالي</span>
          <span className="w-8"></span>
        </div>
        
        <div className="divide-y divide-slate-50">
          <AnimatePresence initial={false}>
            {items.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center px-4 py-3 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex-[2] flex flex-col">
                  <span className="text-xs font-black text-[#1E4D4D]">{item.name}</span>
                  {item.expiryDate && (
                    <span className={`text-[9px] font-bold flex items-center gap-1 mt-0.5 ${isExpirySoon(item.expiryDate) ? 'text-red-500' : 'text-slate-400'}`}>
                      <Clock size={10}/> {item.expiryDate}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-center text-xs font-black text-[#1E4D4D]">{item.qty}</div>
                <div className={`flex-1 text-center text-xs font-bold ${isPriceHigher(item) ? 'text-red-500 font-black' : 'text-slate-600'}`}>
                  {item.price.toLocaleString()}
                </div>
                <div className="flex-1 text-center text-xs font-black text-[#1E4D4D]">{item.sum.toLocaleString()}</div>
                <button 
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {items.length === 0 && (
            <div className="p-20 text-center opacity-20 grayscale">
              <ShoppingBag className="mx-auto mb-4" size={48} />
              <p className="text-sm font-black">لا توجد أصناف مضافة</p>
            </div>
          )}
        </div>
      </div>

      {/* FIXED FOOTER SECTION */}
      <div className="shrink-0 bg-white border-t border-slate-100 p-4 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase">الخصم</span>
            <span className="text-sm font-bold text-red-500">{(adjData.discountPercent * vTotalSum / 100).toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase">رسوم أخرى</span>
            <span className="text-sm font-bold text-slate-600">{adjData.otherFees.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase">الصافي</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#1E4D4D]">{vTotalSum.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-slate-400">{currency}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setIsAdjustmentsOpen(true)}
            className="flex-1 h-12 bg-slate-100 text-[#1E4D4D] rounded-xl font-black text-sm flex items-center justify-center gap-2"
          >
            <div className="flex items-center -space-x-1 rtl:space-x-reverse text-emerald-600">
              <Percent size={16} />
              <Plus size={12} className="mb-1" />
            </div>
            التسويات
          </button>
          <button 
            disabled={isSaving || items.length === 0}
            onClick={handleSaveInvoice}
            className="flex-[2] h-12 bg-[#1E4D4D] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 disabled:opacity-50"
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
        <div className="space-y-6 text-center p-4">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <Sparkles size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-[#1E4D4D]">تم تحليل المستند بنجاح</h3>
            <p className="text-sm font-bold text-slate-500">
              لقد تم تعبئة البيانات آلياً من المستند، هل تريد مراجعة البيانات وتعديلها أم الحفظ الفوري؟
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => applyAIParsedData(false)}
              className="w-full h-12 bg-[#1E4D4D] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2"
            >
              <Edit3 size={18} />
              نعم - للمراجعة والتعديل
            </button>
            <button 
              onClick={() => applyAIParsedData(true)}
              className="w-full h-12 bg-emerald-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              لا - للحفظ الفوري
            </button>
            <button 
              onClick={() => {
                setShowAIConfirmModal(false);
                resetInvoiceState();
                onNavigate?.('dashboard');
              }}
              className="w-full h-12 bg-red-50 text-red-600 rounded-xl font-black text-sm flex items-center justify-center gap-2"
            >
              <Trash2 size={18} />
              حذف - لإلغاء العملية
            </button>
          </div>
        </div>
      </Modal>

      {/* ADD ITEM POP-UP MODAL */}
      <ItemEntryModal 
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        onAdd={handleAddItem}
        mode="purchase"
        initialData={selectedProduct ? {
          productId: selectedProduct.id,
          name: selectedProduct.Name,
          price: selectedProduct.CostPrice || selectedProduct.UnitPrice,
          category: selectedProduct.categoryName,
          product: selectedProduct
        } : null}
      />

      {/* ADJUSTMENTS MODAL */}
      <Modal 
        isOpen={isAdjustmentsOpen} 
        onClose={() => setIsAdjustmentsOpen(false)}
        title="التسويات والرسوم الإضافية"
      >
        <div className="space-y-6 p-2">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">نسبة الخصم (%)</label>
            <div className="relative">
              <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="number"
                value={adjData.discountPercent}
                onChange={(e) => setAdjData({...adjData, discountPercent: Number(e.target.value)})}
                className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl pr-12 pl-4 text-lg font-black focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">رسوم أخرى</label>
              <input 
                type="number"
                value={adjData.otherFees}
                onChange={(e) => setAdjData({...adjData, otherFees: Number(e.target.value)})}
                className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-lg font-black focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">الضريبة</label>
              <input 
                type="number"
                value={adjData.tax}
                onChange={(e) => setAdjData({...adjData, tax: Number(e.target.value)})}
                className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-lg font-black focus:bg-white transition-all"
              />
            </div>
          </div>

          <Button 
            onClick={() => setIsAdjustmentsOpen(false)}
            className="w-full h-14 bg-[#1E4D4D] text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-900/10 mt-4"
          >
            تطبيق التعديلات
          </Button>
        </div>
      </Modal>

      {/* ADD NEW SUPPLIER MODAL */}
      <Modal
        isOpen={isAddSupplierModalOpen}
        onClose={cancelAddSupplier}
        title="إضافة مورد جديد"
      >
        <div className="space-y-6 text-center p-4">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <User size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-[#1E4D4D]">مورد غير مسجل</h3>
            <p className="text-sm font-bold text-slate-500">
              هذا المورد غير مسجل، هل تريد إضافة <span className="text-[#1E4D4D] underline">[{newSupplierName}]</span> كاسم جديد؟
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={confirmAddSupplier}
              className="flex-1 h-12 bg-[#1E4D4D] text-white rounded-xl font-black text-sm"
            >
              نعم، أضف المورد
            </button>
            <button 
              onClick={cancelAddSupplier}
              className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl font-black text-sm"
            >
              لا، إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PurchasesInvoice;
