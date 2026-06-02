
import React from 'react';
import { Modal, Button } from '@/components/shared/SharedUI';
import { ItemEntryModal } from '@/modules/sales/components/ItemEntryModal';
import PrintMenu from '@/components/shared/PrintMenu';
import { 
  Plus, CheckCircle2, Package, RotateCcw, ArrowRight,
  Percent, User
} from 'lucide-react';
import { useSales } from '@/modules/sales/hooks/useSales';
import { motion, AnimatePresence } from 'motion/react';
import { DocumentViewer } from '@/components/shared/DocumentViewer';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';

import { SaleItemRow } from '@/modules/sales/components/SalesInvoiceUI';
import { UnifiedModal } from '@/components/shared/UnifiedModal';
import { useUI } from '@/contexts/AppContext';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { InvoiceItemEditModal } from '@/components/shared/InvoiceItemEditModal';

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
  const p0 = parts[0];
  const p1 = parts[1];
  const p2 = parts[2];
  if (p0 !== undefined && p1 !== undefined && p2 !== undefined) {
    const year = p0;
    const month = parseInt(p1, 10);
    const day = parseInt(p2, 10);
    return `${year}/${month}/${day}`;
  }
  return dateStr;
};

const SalesModule: React.FC<{ onNavigate?: (view: any, params?: any) => void }> = ({ onNavigate }) => {
  const { refreshGlobal } = useUI();
  const {
    items, setItems,
    manualItemName, setManualItemName,
    tempQty,
    tempPrice,
    selectedIndex, setSelectedIndex,
    tempExpiry,
    tempNote,
    showSearchDropdown, setShowSearchDropdown,
    isDetailModalOpen, setIsDetailModalOpen,
    isConfirmSaveOpen, setIsConfirmSaveOpen,
    isAdjustmentsOpen, setIsAdjustmentsOpen,
    isViewerOpen, setIsViewerOpen,
    adjData, setAdjData,
    itemNameInputRef,
    header, setHeader,
    isLocked,
    isSaving,
    vTotalSum,
    filteredProducts,
    selectProduct,
    handleSearchKeyDown,
    handlePost,
    currency,
    isDuplicate,
    selectedProduct,
    setSelectedProduct,
    categoryName,
    isRecovery,
    printData,
    customerSearchTerm,
    showCustomerDropdown, setShowCustomerDropdown,
    isAddCustomerModalOpen,
    newCustomerName,
    filteredCustomers,
    handleCustomerSearch,
    handleCustomerKeyDown,
    selectedCustomerIndex,
    isSearchingCustomers,
    selectCustomer,
    handleCustomerBlur,
    confirmAddCustomer,
    cancelAddCustomer
  } = useSales(onNavigate);

  const [editingItem, setEditingItem] = React.useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState<boolean>(false);

  const handleAddItem = React.useCallback((item: any) => {
    const newItem = {
      ...item,
      product_id: item.productId,
      parent_id: header.invoice_number,
      row_order: items.length + 1
    };
    
    setItems(prev => {
      // Check if we are updating an existing row in the table
      const existingRowIdx = prev.findIndex(i => i.id === newItem.id);
      const existingRow = prev[existingRowIdx];
      if (existingRowIdx > -1 && existingRow) {
        const updated = [...prev];
        updated[existingRowIdx] = {
          ...existingRow,
          ...newItem,
          row_order: existingRow.row_order
        } as any;
        return updated;
      }

      // Check if item is already present under another index to merge quantities
      const existingIdx = prev.findIndex(i => 
        (i.product_id === newItem.product_id && i.product_id && !i.product_id.startsWith('manual-')) || 
        (i.name === newItem.name && (!i.product_id || i.product_id.startsWith('manual-')))
      );

      const existingItem = prev[existingIdx];
      if (existingIdx > -1 && existingItem) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...existingItem,
          qty: (existingItem.qty || 0) + newItem.qty,
          sum: ((existingItem.qty || 0) + newItem.qty) * (existingItem.price || 0)
        } as any;
        return updated;
      } else {
        return [...prev, newItem as any];
      }
    });
  }, [header.invoice_number, items.length, setItems]);

  const handleDeleteItem = React.useCallback((idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }, [setItems]);

  const handleRowClick = React.useCallback((item: any) => {
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
  }, []);

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

  return (
    <div className="flex flex-col min-h-full h-full bg-white font-cairo w-full relative overflow-x-hidden" dir="rtl">
      {/* HEADER SECTION - FLAT & FULL WIDTH */}
      <div className="shrink-0 z-[100] border-b border-slate-100 bg-white">
        <div className="py-2 px-2 flex items-center justify-between gap-[4px] w-full overflow-hidden">
          {/* Main Toolbar Row */}
          <div className="flex items-center gap-[4px] flex-1">
            <button 
              onClick={() => onNavigate?.('dashboard')} 
              className="w-7 h-7 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all shrink-0"
              title="الرجوع للرئيسية"
            >
              <ArrowRight size={16} />
            </button>

            {/* Print and Return buttons container */}
            <div className="flex items-center justify-center gap-[5%] flex-1">
              {/* Print Menu (compact) */}
              <div className="shrink-0 scale-90 origin-right">
                <PrintMenu data={printData} type="SALE" items={items} />
              </div>

              {/* Return Button */}
              <button 
                onClick={() => setHeader({...header, isReturn: !header.isReturn})}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all text-[10px] font-black select-none shrink-0 ${
                  header.isReturn 
                    ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                }`}
              >
                <RotateCcw size={12} className={header.isReturn ? 'animate-spin-slow' : ''} />
                <span>المرتجع</span>
              </button>
            </div>
          </div>

          {/* Right side: Payment Toggle (smaller) */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 w-[110px] shrink-0">
            <button 
              onClick={() => setHeader({...header, payment_method: 'Cash'})}
              className={`flex-1 py-1 rounded-md text-[9px] font-black transition-all relative z-10 ${header.payment_method === 'Cash' ? 'text-white' : 'text-slate-400'}`}
            >
              {header.payment_method === 'Cash' && (
                <motion.div layoutId="payment-bg-sale" className="absolute inset-0 bg-[#1E4D4D] rounded-md -z-10 shadow-sm" />
              )}
              نقداً
            </button>
            <button 
              onClick={() => setHeader({...header, payment_method: 'Credit'})}
              className={`flex-1 py-1 rounded-md text-[9px] font-black transition-all relative z-10 ${header.payment_method === 'Credit' ? 'text-white' : 'text-slate-400'}`}
            >
              {header.payment_method === 'Credit' && (
                <motion.div layoutId="payment-bg-sale" className="absolute inset-0 bg-[#7f1d1d] rounded-md -z-10 shadow-sm" />
              )}
              آجل
            </button>
          </div>
        </div>

        {/* DATA DIVIDERS SECTION */}
        <div className="border-t border-slate-50 overflow-x-visible bg-white">
          <div className="flex flex-row gap-2 items-center w-full px-3 py-2">
            {/* Customer Name Field - Flex expansion */}
            <div className="flex-1 min-w-0 relative bg-white">
              <input 
                disabled={isLocked || isRecovery}
                value={customerSearchTerm}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                onKeyDown={handleCustomerKeyDown}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={handleCustomerBlur}
                placeholder="اسم العميل..."
                className="w-full h-10 border-b border-gray-400 focus:outline-none focus:border-green-500 rounded-none text-black text-right placeholder-gray-400 bg-transparent"
              />
              <AnimatePresence>
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full mt-1 right-0 bg-white border border-slate-100 shadow-2xl z-[9999] overflow-hidden rounded-xl w-[200%] max-w-[450px]"
                  >
                    {isSearchingCustomers ? (
                      <div className="p-4 text-center text-sm font-medium text-slate-400">
                        <div className="w-4 h-4 border-2 border-[#1E4D4D] border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                        جاري البحث...
                      </div>
                    ) : filteredCustomers.map((c, idx) => (
                      <button 
                        key={c.id} 
                        onMouseDown={() => selectCustomer(c)}
                        className={`w-full p-2.5 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0 text-right ${selectedCustomerIndex === idx ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                      >
                        <span className="text-base font-semibold text-[#1E4D4D]">{c.Supplier_Name}</span>
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
                disabled={isLocked || isRecovery}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                value={header.date}
                onChange={(e) => setHeader({...header, date: e.target.value})}
              />
              <div className="absolute inset-0 border-b border-gray-400 text-black text-center bg-transparent px-[2px] flex items-center justify-center text-sm font-semibold pointer-events-none">
                {formatDateDisplay(header.date || "") || "التاريخ..."}
              </div>
            </div>
          </div>
          
          <div className="flex border-b border-slate-100 flex-row gap-[2%] px-3 py-2 bg-white">
            <div className="basis-[25%] relative">
               <input 
                type="text"
                value={header.invoice_number}
                onChange={(e) => setHeader({...header, invoice_number: e.target.value})}
                placeholder="رقم الفاتورة..."
                className="w-full h-10 border-b border-gray-400 focus:outline-none focus:border-green-500 rounded-none text-black text-right placeholder-gray-400 bg-transparent"
              />
            </div>
            <div className="basis-[73%] relative flex items-center">
              <textarea 
                placeholder="ملاحظات الفاتورة..."
                rows={1}
                value={header.notes || ''}
                onChange={(e) => setHeader({...header, notes: e.target.value})}
                className="w-full h-10 border-b border-gray-400 focus:outline-none focus:border-green-500 rounded-none text-black text-right placeholder-gray-400 resize-none pt-2 bg-transparent pr-2"
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
              </div>
            </div>
          </div>
        </div>
      </div>

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
        <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0 flex-nowrap">
          <div className="relative flex-1">
            <input 
              ref={itemNameInputRef}
              disabled={isLocked || isRecovery}
              className="w-full h-10 bg-slate-50 border border-slate-100 rounded-lg px-3 text-[6px] font-black text-[#1E4D4D] focus:bg-white focus:ring-1 focus:ring-[#1E4D4D]/20 transition-all outline-none text-right" 
              placeholder="ابحث عن صنف..." 
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
                        <p className="text-[11px] font-black text-[#1E4D4D]">{p.Name}</p>
                        <p className="text-[11px] font-bold text-slate-400">{p.categoryName || 'عام'}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-black text-emerald-600">{p.UnitPrice} {currency}</p>
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
            className="h-10 px-4 bg-[#10B981] text-white rounded-lg flex items-center gap-1 text-[11px] font-black hover:bg-emerald-600 transition-all shrink-0 shadow-sm"
          >
            <Plus size={16} />
            <span>إضافة</span>
          </button>
        </div>

        {/* ITEMS LIST SECTION - SIMPLE LIST MATCHING PURCHASES */}
        <PullToRefresh onRefresh={async () => { await refreshGlobal(); }} className="flex-1 overflow-y-auto bg-white custom-scrollbar pb-32">
          <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 border-b border-slate-50 flex items-center px-2 py-2 w-full flex-nowrap">
            <span className="flex-[2] text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">الصنف</span>
            <span className="flex-1 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">الكمية</span>
            <span className="flex-1 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">السعر</span>
            <span className="flex-1 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">المجموع</span>
            <span className="w-10"></span>
          </div>
          
          <AnimatePresence initial={false}>
            {items.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center opacity-20">
                <Package size={40} className="mb-2" />
                <p className="text-[11px] font-black">قائمة الأصناف فارغة</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <SaleItemRow 
                  key={item.id || idx}
                  item={item}
                  idx={idx}
                  isLocked={isLocked}
                  isRecovery={isRecovery}
                  onDelete={handleDeleteItem}
                  onClick={() => handleRowClick(item)}
                />
              ))
            )}
          </AnimatePresence>
        </PullToRefresh>
      </div>

      {/* FIXED FOOTER SECTION - MATCHING PURCHASES DESIGN */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 p-2 shadow-lg space-y-2">
        <div className="flex items-center justify-between flex-nowrap px-2">
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-black text-slate-400 uppercase">الخصم</span>
            <AnimatedNumber value={adjData.discountPercent * vTotalSum / 100} className="text-[11px] font-black text-red-500" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-black text-slate-400 uppercase">رسوم أخرى</span>
            <AnimatedNumber value={adjData.otherFees} className="text-[11px] font-black text-slate-600" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-black text-slate-400 uppercase">الصافي</span>
            <div className="flex items-baseline gap-1">
              <AnimatedNumber value={vTotalSum} className="text-[11px] font-black text-[#1E4D4D]" />
              <span className="text-[11px] font-black text-slate-400">{currency}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-nowrap">
          <button 
            type="button"
            onClick={() => setIsAdjustmentsOpen(true)}
            className="flex-1 h-11 bg-slate-100 text-[#1E4D4D] rounded-xl font-black text-[11px] flex items-center justify-center gap-2"
          >
            <div className="flex items-center -space-x-1 rtl:space-x-reverse text-emerald-600">
              <Percent size={15} />
              <Plus size={11} className="mb-0.5" />
            </div>
            التسويات
          </button>
          <button 
            type="button"
            onClick={() => setIsConfirmSaveOpen(true)} 
            disabled={items.length === 0 || isLocked || isDuplicate || isSaving || isRecovery} 
            className={`flex-[2] h-11 rounded-xl font-black text-[11px] text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${isLocked || isDuplicate || isRecovery ? 'bg-red-500 shadow-red-900/20' : 'bg-[#1E4D4D] shadow-emerald-900/20'} disabled:opacity-50`}
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

      {/* POPUP ITEM ENTRY */}
      <ItemEntryModal 
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setEditingItem(null);
          setSelectedProduct(null);
        }}
        onAdd={handleAddItem}
        mode="sale"
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
          name: manualItemName || selectedProduct.Name || selectedProduct.name,
          qty: tempQty,
          price: tempPrice || selectedProduct.UnitPrice,
          expiryDate: tempExpiry || selectedProduct.ExpiryDate,
          category: categoryName || selectedProduct.categoryName,
          note: tempNote,
          product: { ...selectedProduct, Name: selectedProduct.Name || selectedProduct.name }
        } : null)}
      />

      {/* MODALS - FLATTENED DESIGN */}
      <Modal 
        isOpen={isAddCustomerModalOpen} 
        onClose={cancelAddCustomer}
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
            <h3 className="text-sm font-black text-[#1E4D4D]">عميل جديد؟</h3>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed px-2">
              هل تريد إضافة <span className="text-[#1E4D4D] underline">{newCustomerName}</span> كعميل جديد في النظام؟
            </p>
          </div>
          <div className="flex gap-[2px] pt-1 px-2">
            <button 
              onClick={confirmAddCustomer}
              className="flex-[2] h-10 bg-[#1E4D4D] text-white rounded-xl text-[11px] font-black shadow-md active:scale-95 transition-all"
            >
              نعم
            </button>
            <button 
              onClick={cancelAddCustomer}
              className="flex-1 h-10 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black active:scale-95 transition-all"
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
            requiredFields={['customer_id', 'invoice_number']}
            formData={header}
            setFormData={setHeader}
            onClose={() => setIsConfirmSaveOpen(false)}
            title="تأكيد حفظ الفاتورة"
          >
            <div className="space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-[11px] font-bold text-slate-400 text-center">سيتم ترحيل الفاتورة وتحديث المخزون والحسابات.</p>
              
              <div className="bg-slate-50 dark:bg-gray-700/50 p-4 rounded-xl border border-slate-100 dark:border-gray-600 flex justify-between items-center">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">المبلغ المستحق</span>
                <span className="text-[11px] font-black text-[#1E4D4D] dark:text-emerald-400">{vTotalSum.toLocaleString()} {currency}</span>
              </div>
            </div>
          </UnifiedModal>
        )}
      </AnimatePresence>

      {/* ADJUSTMENTS MODAL - MATCHING PURCHASES DESIGN */}
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

      {/* Item edit modal */}
      <InvoiceItemEditModal 
        isOpen={isEditModalOpen}
        item={editingItem}
        mode="sale"
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
export default SalesModule;
