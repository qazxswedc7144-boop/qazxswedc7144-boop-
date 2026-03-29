
import React from 'react';
import { Badge, Modal, Button } from './SharedUI';
import { InvoiceLockedBanner } from './SharedInvoiceUI';
import PrintMenu from './PrintMenu';
import { ExportService } from '../services/exportService';
import { 
  Plus, Minus, ArrowLeft, CheckCircle2, AlertCircle, Package, Clock, Calendar,
  ShoppingCart, User, CreditCard, Wallet, Tag, Trash2, ChevronRight, Save, Search,
  RotateCcw, Camera, Edit3, Home, History, Printer, FileSpreadsheet, ArrowRight
} from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'motion/react';

const SalesModule: React.FC<{ onNavigate?: (view: any, params?: any) => void }> = ({ onNavigate }) => {
  const {
    items,
    manualItemName, setManualItemName,
    tempQty, setTempQty,
    tempPrice, setTempPrice,
    selectedIndex, setSelectedIndex,
    tempExpiry, setTempExpiry,
    tempNote, setTempNote,
    showSearchDropdown, setShowSearchDropdown,
    isDetailModalOpen, setIsDetailModalOpen,
    isConfirmSaveOpen, setIsConfirmSaveOpen,
    itemNameInputRef,
    qtyInputRef,
    header, setHeader,
    isPeriodLockedStatus,
    isLocked,
    isSaving,
    isAdding,
    vTotalSum,
    persistToDB,
    filteredProducts,
    selectProduct,
    finalizeItemAdd,
    handleSearchKeyDown,
    updateItem,
    removeItem,
    handlePost,
    currency,
    isAdmin,
    isDuplicate,
    adjData,
    categoryName,
    setCategoryName
  } = useSales(onNavigate);

  const priceInputRef = React.useRef<HTMLInputElement>(null);
  const expiryInputRef = React.useRef<HTMLInputElement>(null);
  const noteInputRef = React.useRef<HTMLInputElement>(null);
  const categoryInputRef = React.useRef<HTMLSelectElement>(null);

  const systemStatus = useAppStore(state => state.systemStatus);
  const isRecovery = systemStatus === 'RECOVERY_MODE';

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'Draft': return 'مسودة 📝';
      case 'Saved': return 'مرحلة (مفتوحة) ✅';
      case 'PartiallyPaid': return 'سداد جزئي 💸';
      case 'Paid': return 'تم السداد 💰';
      case 'Cancelled': return 'ملغاة 🚫';
      case 'Returned': return 'مرتجع 🔄';
      default: return status;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f7f8fa] font-['Cairo'] w-full max-w-7xl mx-auto relative overflow-x-hidden" dir="rtl">
      {/* HEADER SECTION */}
      <div className="p-4 space-y-4 shrink-0 z-50">
        <div className="bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 space-y-4">
          {/* Top Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => onNavigate?.('dashboard')} 
                className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all"
                title="الرجوع للرئيسية"
              >
                <ArrowRight size={20} />
              </button>
              <div className="w-10 h-10 bg-[#1E4D4D]/5 rounded-xl flex items-center justify-center text-[#1E4D4D]">
                <ShoppingCart size={20} />
              </div>
              <div className="text-right">
                <h2 className="text-lg font-black text-[#1E4D4D]">مبيعات</h2>
                <p className="text-[10px] font-bold text-slate-400"># ---</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setHeader({...header, isReturn: !header.isReturn})}
                className={`h-10 px-4 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${header.isReturn ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
              >
                <RotateCcw size={14} />
                <span>مرتجع؟</span>
              </button>

              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                <button 
                  onClick={() => setHeader({...header, payment_method: 'Cash'})}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${header.payment_method === 'Cash' ? 'bg-[#064e3b] text-white shadow-sm' : 'text-slate-400'}`}
                >
                  نقداً
                </button>
                <button 
                  onClick={() => setHeader({...header, payment_method: 'Credit'})}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${header.payment_method === 'Credit' ? 'bg-[#7f1d1d] text-white shadow-sm' : 'text-slate-400'}`}
                >
                  آجل
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => ExportService.exportToExcel(items, `SALE_${Date.now()}`, ['name', 'qty', 'price', 'sum'])}
                disabled={items.length === 0}
                className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all disabled:opacity-50"
                title="تصدير CSV"
              >
                <FileSpreadsheet size={20} />
              </button>

              <PrintMenu data={{ items, finalTotal: vTotalSum }} type="SALE" items={items} />
              
              <button 
                onClick={() => onNavigate?.('invoices-archive', { filter: 'SALE' })} 
                className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] hover:bg-slate-100 transition-all"
                title="سجل المبيعات"
              >
                <History size={20} />
              </button>
            </div>
          </div>

          {/* Middle Row */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input 
                  disabled={isLocked || isRecovery} 
                  className="w-full h-[48px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-black text-[#1E4D4D] outline-none focus:border-[#1E4D4D] transition-all text-right" 
                  placeholder="اسم العميل..." 
                  value={header.customer_id} 
                  onChange={e => setHeader({...header, customer_id: e.target.value})} 
                />
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>
            <div className="w-[120px] relative">
              <input 
                type="date" 
                disabled={isLocked || isRecovery}
                className="w-full h-[48px] bg-slate-50 border border-slate-100 rounded-xl px-2 text-[11px] font-black text-center outline-none focus:border-[#1E4D4D]"
                value={header.date}
                onChange={e => setHeader({...header, date: e.target.value})}
              />
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex gap-3">
            <div className="w-[120px] relative">
              <input 
                disabled 
                className="w-full h-[48px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-black text-center outline-none" 
                value={header.invoice_number} 
                placeholder="رقم الفاتورة..."
              />
              <Edit3 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>
            <div className="flex-1">
              <input 
                className="w-full h-[48px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-black text-right outline-none focus:border-[#1E4D4D]"
                placeholder="ملاحظات الفاتورة..."
                value={header.notes}
                onChange={e => setHeader({...header, notes: e.target.value})}
              />
            </div>
            <div className="w-12 h-[48px] bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-300">
              <Camera size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[100px] custom-scrollbar space-y-4">
        {/* ITEM ENTRY AREA */}
        <div className="px-4 mt-2">
          <div className="bg-white rounded-[24px] p-3 shadow-sm border border-slate-100 flex justify-between items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                ref={itemNameInputRef}
                disabled={isLocked || isRecovery}
                className="w-full h-[48px] bg-slate-50 border border-slate-100 rounded-xl pr-10 pl-4 text-sm font-black text-[#1E4D4D] focus:border-[#1E4D4D] transition-all outline-none text-right" 
                placeholder="تصفية البنود المضافة..." 
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
                        key={p.ProductID} 
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
              className="h-[48px] px-6 border-2 border-[#10B981] text-[#10B981] rounded-xl flex items-center gap-2 text-sm font-black hover:bg-emerald-50 transition-all shrink-0"
            >
              <Plus size={18} />
              <span>إضافة</span>
            </button>
          </div>
        </div>

        {/* ITEM TABLE */}
        <div className="px-4">
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
              <tr className="h-[44px]">
                <th className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[45%]">الصنف</th>
                <th className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[15%]">الكمية</th>
                <th className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[20%]">السعر</th>
                <th className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left w-[20%]">المجموع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <Package size={48} className="mb-2" />
                      <p className="text-xs font-black">قائمة الأصناف فارغة</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr 
                    key={item.id} 
                    className="h-[44px] hover:bg-slate-50/50 transition-colors cursor-pointer"
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
                    <td className="px-3">
                      <p className="text-[11px] font-black text-[#1E4D4D] truncate max-w-[120px]">{item.name}</p>
                    </td>
                    <td className="px-2 text-center">
                      <span className="text-[11px] font-black text-[#1E4D4D]">{item.qty}</span>
                    </td>
                    <td className="px-2 text-center">
                      <span className="text-[11px] font-black text-slate-500">{item.price}</span>
                    </td>
                    <td className="px-3 text-left">
                      <p className="text-[11px] font-black text-[#1E4D4D]">{item.sum.toLocaleString()}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* BOTTOM SUMMARY BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 z-[100] max-w-7xl mx-auto shadow-[0_-4px_10px_rgba(0,0,0,0.03)] flex items-center gap-3">
        <div className="w-20 bg-slate-50 h-[56px] rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">البنود</p>
          <p className="text-sm font-black text-[#1E4D4D]">{items.length}</p>
        </div>

        <div className="flex-1 bg-emerald-50 h-[56px] rounded-2xl border border-emerald-100 flex flex-col items-center justify-center">
          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">صافي المبيعات</p>
          <p className="text-sm font-black text-emerald-700">{vTotalSum.toLocaleString()} <span className="text-[10px]">AED</span></p>
        </div>

        <button 
          onClick={() => setIsConfirmSaveOpen(true)} 
          disabled={items.length === 0 || isLocked || isDuplicate || isSaving || isRecovery} 
          className={`h-[56px] px-8 rounded-2xl font-black text-sm text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 ${isLocked || isDuplicate || isRecovery ? 'bg-red-500' : 'bg-[#1E4D4D]'}`}
        >
          ترحيل السجل
        </button>
      </div>

      {/* POPUP ITEM ENTRY */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)} 
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
                        key={p.ProductID} 
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
                <label className="text-[10px] font-bold text-slate-500">الكمية</label>
                <input 
                  ref={qtyInputRef} 
                  type="number" 
                  className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-center text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]" 
                  placeholder="0" 
                  value={tempQty} 
                  onChange={e => setTempQty(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      expiryInputRef.current?.focus();
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">تاريخ الصلاحية</label>
                <input 
                  ref={expiryInputRef}
                  type="date"
                  className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]"
                  value={tempExpiry} 
                  onChange={e => setTempExpiry(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      priceInputRef.current?.focus();
                    }
                  }}
                />
              </div>
            </div>

            {/* Row 3: السعر (Right) | التصنيف (Left) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">السعر</label>
                <input 
                  ref={priceInputRef}
                  type="number" 
                  className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-center text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D]" 
                  placeholder="0.00" 
                  value={tempPrice} 
                  onChange={e => setTempPrice(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      categoryInputRef.current?.focus();
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">التصنيف</label>
                <select 
                  ref={categoryInputRef}
                  className="w-full h-[40px] bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold text-[#1E4D4D] outline-none focus:border-[#1E4D4D] appearance-none"
                  value={categoryName} 
                  onChange={e => setCategoryName(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      noteInputRef.current?.focus();
                    }
                  }}
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
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    finalizeItemAdd();
                  }
                }}
              />
            </div>
          </div>

          {/* Bottom Actions: إضافة (Right) | إلغاء (Left) */}
          <div className="flex gap-3 p-3 border-t border-slate-100">
            <Button 
              className="flex-1 !h-[44px] !rounded-xl"
              variant="primary"
              onClick={() => finalizeItemAdd()}
              isLoading={isAdding}
            >
              إضافة الصنف
            </Button>
            <Button 
              className="flex-1 !h-[44px] !rounded-xl"
              variant="neutral"
              onClick={() => setIsDetailModalOpen(false)}
            >
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Save Modal */}
      <Modal
        isOpen={isConfirmSaveOpen}
        onClose={() => setIsConfirmSaveOpen(false)}
        title="تأكيد الحفظ"
      >
        <div className="p-6 text-center space-y-6" dir="rtl">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-black text-[#1E4D4D]">هل أنت متأكد؟</p>
            <p className="text-[11px] font-bold text-slate-400">سيتم ترحيل الفاتورة وتحديث المخزون والحسابات.</p>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المبلغ المستحق</span>
            <span className="text-xl font-black text-[#1E4D4D]">{vTotalSum.toLocaleString()} {currency}</span>
          </div>

          <div className="flex gap-3">
            <button 
              className="flex-[2] h-[52px] bg-[#1E4D4D] text-white rounded-xl text-sm font-black shadow-lg active:scale-95 transition-all"
              onClick={() => {
                setIsConfirmSaveOpen(false);
                handlePost();
              }}
            >
              تأكيد وحفظ
            </button>
            <button 
              className="flex-1 h-[52px] bg-slate-100 text-slate-500 rounded-xl text-sm font-black active:scale-95 transition-all"
              onClick={() => setIsConfirmSaveOpen(false)}
            >
              مراجعة
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default SalesModule;
