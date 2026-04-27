
import React from 'react';
import { Badge, Modal, Button } from '../components/SharedUI';
import { ItemEntryModal } from '../components/ItemEntryModal';
import { InvoiceLockedBanner } from '../components/SharedInvoiceUI';
import PrintMenu from '../components/PrintMenu';
import { ExportService } from '../services/exportService';
import { 
  Plus, Minus, ArrowLeft, CheckCircle2, AlertCircle, Package, Clock, Calendar,
  ShoppingCart, User, CreditCard, Wallet, Tag, Trash2, ChevronRight, Save, Search,
  RotateCcw, Camera, Edit3, Home, History, Printer, FileSpreadsheet, ArrowRight,
  Percent, ChevronDown, LayoutList, Sparkles
} from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'motion/react';
import { CameraModule } from './CameraModule';
import { DocumentViewer } from '../components/DocumentViewer';
import { AnimatedNumber } from '../components/AnimatedNumber';

const SalesModule: React.FC<{ onNavigate?: (view: any, params?: any) => void }> = ({ onNavigate }) => {
  const {
    items, setItems,
    manualItemName, setManualItemName,
    tempQty, setTempQty,
    tempPrice, setTempPrice,
    selectedIndex, setSelectedIndex,
    tempExpiry, setTempExpiry,
    tempNote, setTempNote,
    showSearchDropdown, setShowSearchDropdown,
    isDetailModalOpen, setIsDetailModalOpen,
    isConfirmSaveOpen, setIsConfirmSaveOpen,
    isAdjustmentsOpen, setIsAdjustmentsOpen,
    isCameraOpen, setIsCameraOpen,
    isViewerOpen, setIsViewerOpen,
    adjData, setAdjData,
    itemNameInputRef,
    qtyInputRef,
    priceInputRef,
    expiryInputRef,
    noteInputRef,
    categoryInputRef,
    header, setHeader,
    isLocked,
    isSaving,
    isAdding,
    vTotalSum,
    filteredProducts,
    selectProduct,
    finalizeItemAdd,
    handleSearchKeyDown,
    setIsConfirmSaveOpen: setConfirmSaveOpen,
    handlePost,
    currency,
    isDuplicate,
    selectedProduct,
    categoryName,
    setCategoryName,
    isRecovery,
    getStatusLabel,
    handleExport,
    printData,
    customerSearchTerm, setCustomerSearchTerm,
    showCustomerDropdown, setShowCustomerDropdown,
    isAddCustomerModalOpen, setIsAddCustomerModalOpen,
    newCustomerName, setNewCustomerName,
    filteredCustomers,
    handleCustomerSearch,
    selectCustomer,
    handleCustomerBlur,
    confirmAddCustomer,
    cancelAddCustomer,
    isProcessingAI, setIsProcessingAI,
    hasUnsavedAI,
    showAIConfirmModal,
    setShowAIConfirmModal,
    handleAIImport,
    applyAIParsedData,
    resetInvoiceState
  } = useSales(onNavigate);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddItem = (item: any) => {
    // Logic to add item to sales list
    const newItem = {
      ...item,
      product_id: item.productId,
      parent_id: header.invoice_number,
      row_order: items.length + 1
    };
    
    // Check for duplicates
    const existingIdx = items.findIndex(i => 
      (i.product_id === newItem.product_id && i.product_id && !i.product_id.startsWith('manual-')) || 
      (i.name === newItem.name && (!i.product_id || i.product_id.startsWith('manual-')))
    );

    if (existingIdx > -1) {
      const updated = [...items];
      updated[existingIdx].qty += newItem.qty;
      updated[existingIdx].sum = updated[existingIdx].qty * updated[existingIdx].price;
      setItems(updated);
    } else {
      setItems([...items, newItem as any]);
    }
  };

  return (
    <div className="flex flex-col min-h-full h-full bg-white font-cairo w-full relative overflow-x-hidden" dir="rtl">
      {/* HEADER SECTION - FLAT & FULL WIDTH */}
      <div className="shrink-0 z-[100] border-b border-slate-100">
        <div className="py-3 px-4 flex items-center justify-between gap-4 w-full flex-wrap gap-y-2">
          {/* Right Group: Title, Print, Return */}
          <div className="flex items-center gap-6 flex-1">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onNavigate?.('dashboard')} 
                className="w-8 h-8 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all ml-2"
                title="الرجوع للرئيسية"
              >
                <ArrowRight size={18} />
              </button>
              <h2 className="text-lg font-black text-[#1E4D4D] whitespace-nowrap">مبيعات</h2>
              <div className="mr-2">
                <PrintMenu data={printData} type="SALE" items={items} />
              </div>
            </div>

            <div 
              className="flex items-center gap-2 cursor-pointer select-none group mr-auto ml-4 bg-slate-50 px-4 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors shadow-sm" 
              onClick={() => setHeader({...header, isReturn: !header.isReturn})}
            >
              <span className="text-xs font-bold text-[#1E4D4D]">مرتجع</span>
              <div className="w-5 h-5 border-2 border-[#1E4D4D] rounded flex items-center justify-center bg-white transition-all group-hover:bg-slate-50">
                {header.isReturn && <span className="text-[#1E4D4D] font-bold text-xs">✓</span>}
              </div>
            </div>
          </div>

          {/* Left Group: Payment Toggle */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 w-full max-w-[240px] shrink-0">
            <button 
              onClick={() => setHeader({...header, payment_method: 'Cash'})}
              className={`flex-1 py-2 rounded-md text-[11px] font-black transition-all relative z-10 ${header.payment_method === 'Cash' ? 'text-white' : 'text-slate-400'}`}
            >
              {header.payment_method === 'Cash' && (
                <motion.div layoutId="payment-bg-sale" className="absolute inset-0 bg-[#1E4D4D] rounded-md -z-10 shadow-sm" />
              )}
              نقداً
            </button>
            <button 
              onClick={() => setHeader({...header, payment_method: 'Credit'})}
              className={`flex-1 py-2 rounded-md text-[11px] font-black transition-all relative z-10 ${header.payment_method === 'Credit' ? 'text-white' : 'text-slate-400'}`}
            >
              {header.payment_method === 'Credit' && (
                <motion.div layoutId="payment-bg-sale" className="absolute inset-0 bg-[#7f1d1d] rounded-md -z-10 shadow-sm" />
              )}
              آجل
            </button>
          </div>
        </div>

        {/* DATA DIVIDERS SECTION */}
        <div className="border-t border-slate-50 overflow-x-visible">
          <div className="flex border-b border-slate-50 flex-wrap gap-y-2">
            <div className="w-full sm:w-[60%] min-w-[200px] flex items-center h-10 px-3 border-l border-slate-50">
              <User className="text-slate-300 ml-2" size={14} />
              <input 
                disabled={isLocked || isRecovery}
                value={customerSearchTerm}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                onBlur={handleCustomerBlur}
                placeholder="اسم العميل..."
                className="flex-1 h-full bg-transparent text-xs font-bold text-[#1E4D4D] outline-none border-b border-[#1E4D4D]/30 focus:border-[#1E4D4D] transition-colors"
              />
              <AnimatePresence>
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full mt-0 right-0 left-0 bg-white border-b border-slate-100 shadow-xl z-[110] overflow-hidden"
                  >
                    {filteredCustomers.map(c => (
                      <button 
                        key={c.id}
                        onMouseDown={() => selectCustomer(c)}
                        className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 text-right"
                      >
                        <span className="text-xs font-bold text-[#1E4D4D]">{c.Supplier_Name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex-1 flex items-center h-10 px-3">
              <Calendar className="text-slate-300 ml-2" size={14} />
              <input 
                type="date"
                disabled={isLocked || isRecovery}
                value={header.date}
                onChange={(e) => setHeader({...header, date: e.target.value})}
                className="flex-1 h-full bg-transparent text-xs font-bold text-[#1E4D4D] outline-none border-b border-[#1E4D4D]/30 focus:border-[#1E4D4D] transition-colors"
              />
            </div>
          </div>
          
          <div className="flex border-b border-slate-50 flex-wrap gap-y-2">
            <div className="w-full sm:w-[30%] flex items-center h-10 px-3 border-l border-slate-50">
              <LayoutList className="text-slate-300 ml-2" size={14} />
              <input 
                type="text"
                value={header.invoice_number}
                onChange={(e) => setHeader({...header, invoice_number: e.target.value})}
                placeholder="رقم الفاتورة..."
                className="flex-1 h-full bg-transparent text-xs font-bold text-[#1E4D4D] outline-none border-b border-[#1E4D4D]/30 focus:border-[#1E4D4D] transition-colors"
              />
            </div>
            <div className="flex-1 flex items-center h-10 px-3 relative">
              <Edit3 className="text-slate-300 ml-2" size={14} />
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
                  >
                    <img src={header.attachment} className="w-full h-full object-cover" alt="Thumbnail" />
                  </button>
                )}
                <button 
                  onClick={() => setIsCameraOpen(true)}
                  className="text-slate-300 hover:text-[#1E4D4D] transition-colors"
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

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ITEM ENTRY AREA - FLATTENED */}
        <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input 
              ref={itemNameInputRef}
              disabled={isLocked || isRecovery}
              className="w-full h-10 bg-slate-50 border border-slate-100 rounded-lg pr-9 pl-3 text-xs font-bold text-[#1E4D4D] focus:bg-white focus:ring-1 focus:ring-[#1E4D4D]/20 transition-all outline-none text-right" 
              placeholder="ابحث عن صنف أو كود..." 
              value={manualItemName} 
              onChange={e => { setManualItemName(e.target.value); setShowSearchDropdown(true); setSelectedIndex(-1); }} 
              onFocus={() => setShowSearchDropdown(true)}
              onKeyDown={handleSearchKeyDown}
            />
            
            <AnimatePresence>
              {showSearchDropdown && filteredProducts.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-xl z-[100] mt-1 overflow-hidden"
                >
                  {filteredProducts.map((p, idx) => (
                    <button 
                      key={p.id} 
                      onClick={() => selectProduct(p)}
                      className={`w-full px-4 py-3 text-right flex justify-between items-center border-b border-slate-50 last:border-0 transition-colors ${selectedIndex === idx ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                    >
                      <div>
                        <p className="text-xs font-black text-[#1E4D4D]">{p.Name}</p>
                        <p className="text-[9px] font-bold text-slate-400">{p.categoryName || 'عام'}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-emerald-600">{p.UnitPrice} {currency}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            disabled={isLocked || isRecovery} 
            onClick={() => setIsDetailModalOpen(true)}
            className="h-10 px-4 bg-[#10B981] text-white rounded-lg flex items-center gap-2 text-xs font-black hover:bg-emerald-600 transition-all shrink-0 shadow-sm"
          >
            <Plus size={16} />
            <span>إضافة</span>
          </button>
        </div>

        {/* ITEMS LIST SECTION - SIMPLE LIST MATCHING PURCHASES */}
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-slate-50 flex items-center px-2 py-2 w-full">
            <span className="flex-[2] text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">الصنف</span>
            <span className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الكمية</span>
            <span className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">السعر</span>
            <span className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">المجموع</span>
          </div>
          
          <AnimatePresence initial={false}>
            {items.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center opacity-20">
                <Package size={40} className="mb-2" />
                <p className="text-xs font-black">قائمة الأصناف فارغة</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <motion.div 
                  key={item.id + '-' + idx} 
                  initial={{ backgroundColor: 'rgb(209 250 229 / 0.8)' }}
                  animate={{ backgroundColor: 'transparent' }}
                  transition={{ duration: 1 }}
                  className="flex items-center px-2 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer w-full group relative"
                  onClick={() => {
                    if (!isLocked && !isRecovery) {
                      setManualItemName(item.name);
                      setTempQty(item.qty);
                      setTempPrice(item.price);
                      setTempExpiry(item.expiryDate || '');
                      setIsDetailModalOpen(true);
                    }
                  }}
                >
                  <div className="flex-[2] flex flex-col items-start overflow-hidden pr-1">
                    <span className="text-[10px] sm:text-xs font-black text-[#1E4D4D] truncate w-full text-right">{item.name}</span>
                  </div>
                  <div className="flex-1 text-center">
                    <span className={`text-[10px] sm:text-[11px] font-black rounded-md px-1 sm:px-2 py-0.5 ${
                      item.qty < 5 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-[#1E4D4D]'
                    }`}>
                      {item.qty}
                    </span>
                  </div>
                  <div className="flex-1 text-center text-[10px] sm:text-[11px] font-black text-slate-500">
                    {item.price.toLocaleString()}
                  </div>
                  <div className="flex-1 text-center text-[10px] sm:text-[11px] font-black text-[#1E4D4D]">
                    {item.sum.toLocaleString()}
                  </div>

                  {/* Smart Delete Button (Hover to Delete) */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setItems(items.filter((_, i) => i !== idx));
                    }}
                    className="absolute left-2 opacity-0 group-hover:opacity-100 p-1.5 text-red-300 hover:text-white hover:bg-red-500 rounded-lg transition-all"
                    title="حذف الصنف"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* FIXED FOOTER SECTION - MATCHING PURCHASES DESIGN */}
      <div className="shrink-0 bg-white border-t border-slate-100 p-4 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase">الخصم</span>
            <AnimatedNumber value={adjData.discountPercent * vTotalSum / 100} className="text-sm font-bold text-red-500" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase">رسوم أخرى</span>
            <AnimatedNumber value={adjData.otherFees} className="text-sm font-bold text-slate-600" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase">الصافي</span>
            <div className="flex items-baseline gap-1">
              <AnimatedNumber value={vTotalSum} className="text-2xl font-black text-[#1E4D4D]" />
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
            onClick={() => setIsConfirmSaveOpen(true)} 
            disabled={items.length === 0 || isLocked || isDuplicate || isSaving || isRecovery} 
            className={`flex-[2] h-12 rounded-xl font-black text-sm text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${isLocked || isDuplicate || isRecovery ? 'bg-red-500 shadow-red-900/20' : 'bg-[#1E4D4D] shadow-emerald-900/20'} disabled:opacity-50`}
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
        title="المدير الذكي للمبيعات"
      >
        <div className="space-y-6 text-center p-4">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <Sparkles size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-[#1E4D4D]">تم تحليل المستند بنجاح</h3>
            <p className="text-sm font-bold text-slate-500">
              تم تعبئة البيانات، هل تريد التعديل؟
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => applyAIParsedData()}
              className="w-full h-12 bg-[#1E4D4D] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2"
            >
              <Edit3 size={18} />
              نعم (تعديل يدوي)
            </button>
            <button 
              onClick={() => {
                applyAIParsedData();
                setTimeout(() => handlePost(), 500);
              }}
              className="w-full h-12 bg-emerald-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              لا (حفظ فوراً)
            </button>
            <button 
              onClick={() => {
                setShowAIConfirmModal(false);
                resetInvoiceState();
                setIsProcessingAI(false);
                onNavigate?.('dashboard');
              }}
              className="w-full h-12 bg-red-50 text-red-600 rounded-xl font-black text-sm flex items-center justify-center gap-2"
            >
              <Trash2 size={18} />
              حذف وإلغاء العملية
            </button>
          </div>
        </div>
      </Modal>

      {/* POPUP ITEM ENTRY */}
      <ItemEntryModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onAdd={handleAddItem}
        mode="sale"
        initialData={selectedProduct ? {
          productId: selectedProduct.id,
          name: selectedProduct.Name,
          price: tempPrice || selectedProduct.UnitPrice,
          category: selectedProduct.categoryName,
          product: selectedProduct
        } : null}
      />

      {/* MODALS - FLATTENED DESIGN */}
      <Modal 
        isOpen={isAddCustomerModalOpen} 
        onClose={cancelAddCustomer}
        title=""
        maxWidth="w-full sm:w-[340px]"
        noPadding={true}
      >
        <div className="p-6 text-center space-y-5 bg-white">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <User size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-[#1E4D4D]">عميل جديد؟</h3>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              هل تريد إضافة <span className="text-[#1E4D4D] underline">{newCustomerName}</span> كعميل جديد في النظام؟
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <button 
              onClick={confirmAddCustomer}
              className="flex-[2] h-11 bg-[#1E4D4D] text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
            >
              نعم، إضافة
            </button>
            <button 
              onClick={cancelAddCustomer}
              className="flex-1 h-11 bg-slate-100 text-slate-500 rounded-xl text-xs font-black active:scale-95 transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Save Modal - FLATTENED */}
      <Modal
        isOpen={isConfirmSaveOpen}
        onClose={() => setIsConfirmSaveOpen(false)}
        title=""
        maxWidth="w-full sm:w-[340px]"
        noPadding={true}
      >
        <div className="p-6 text-center space-y-5 bg-white" dir="rtl">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-black text-[#1E4D4D]">تأكيد الحفظ</p>
            <p className="text-[10px] font-bold text-slate-400">سيتم ترحيل الفاتورة وتحديث المخزون والحسابات.</p>
          </div>
          
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">المبلغ المستحق</span>
            <span className="text-lg font-black text-[#1E4D4D]">{vTotalSum.toLocaleString()} {currency}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button 
              className="flex-[2] h-11 bg-[#1E4D4D] text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
              onClick={() => {
                setIsConfirmSaveOpen(false);
                handlePost();
              }}
            >
              تأكيد وحفظ
            </button>
            <button 
              className="flex-1 h-11 bg-slate-100 text-slate-500 rounded-xl text-xs font-black active:scale-95 transition-all"
              onClick={() => setIsConfirmSaveOpen(false)}
            >
              مراجعة
            </button>
          </div>
        </div>
      </Modal>

      {/* ADJUSTMENTS MODAL - MATCHING PURCHASES DESIGN */}
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
    </div>
  );
};
export default SalesModule;
