
import React from 'react';
import { Card, Button, Badge, Modal, Input } from './SharedUI';
import { InvoiceLockedBanner } from './SharedInvoiceUI';
import PrintMenu from './PrintMenu';
import { 
  Search, Trash2, Plus, Minus, ArrowLeft, Tag, Camera, Calendar,
  ChevronDown, RotateCcw, CheckCircle2,
  ShoppingBag, Package, CalendarDays, Wallet, Percent, Scale,
  X, Edit3, AlertCircle, History, ShieldAlert, Lock, Clock,
  User, CreditCard, Save, ChevronRight, FileText, ArrowRight, Home, Printer,
  ChevronLeft, MoreVertical, Trash, Info, FileSpreadsheet, LayoutList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePurchases } from '../hooks/usePurchases';

const PurchasesInvoice: React.FC<{ onNavigate?: (view: any, params?: any) => void }> = ({ onNavigate }) => {
  const {
    items, setItems,
    searchTerm, setSearchTerm,
    isSearchOpen, setSearchOpen,
    isAutoSaving,
    isSaving,
    isDuplicate,
    hasDependencies,
    isAdjustmentsOpen, setIsAdjustmentsOpen,
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
    selectProduct,
    finalizeItemAdd,
    handlePost,
    currency,
    isRecovery,
    suppliers,
    categories,
    addCategory,
    handleExport,
    printData,
    editingInvoiceId
  } = usePurchases(onNavigate);

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
                <ShoppingBag size={20} />
              </div>
              <div className="text-right">
                <h2 className="text-lg font-black text-[#1E4D4D]">توريد مشتريات</h2>
                <p className="text-[10px] font-bold text-slate-400"># {header.invoice_number || '---'}</p>
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
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${header.payment_method === 'Cash' ? 'bg-[#1E4D4D] text-white shadow-sm' : 'text-slate-400'}`}
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
          </div>

          {/* Form Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">رقم الفاتورة</label>
              <div className="relative">
                <FileText className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                  ref={invNumInputRef}
                  value={header.invoice_number}
                  onChange={(e) => setHeader({...header, invoice_number: e.target.value})}
                  placeholder="رقم فاتورة المورد"
                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pr-10 pl-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#1E4D4D]/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">المورد</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <select 
                  value={header.supplier_id}
                  onChange={(e) => setHeader({...header, supplier_id: e.target.value})}
                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pr-10 pl-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#1E4D4D]/10 transition-all appearance-none"
                >
                  <option value="">اختر المورد...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.Supplier_Name}</option>)}
                </select>
                <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">تاريخ الفاتورة</label>
              <div className="relative">
                <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                  type="date"
                  value={header.date}
                  onChange={(e) => setHeader({...header, date: e.target.value})}
                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pr-10 pl-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#1E4D4D]/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">ملاحظات</label>
              <div className="relative">
                <Edit3 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                  value={header.notes}
                  onChange={(e) => setHeader({...header, notes: e.target.value})}
                  placeholder="أي ملاحظات إضافية..."
                  className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pr-10 pl-4 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-[#1E4D4D]/10 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-0 px-4 pb-4 gap-4 overflow-hidden">
        {isLocked && (
          <InvoiceLockedBanner 
            isPeriodLocked={false} 
            isAdmin={true} 
            financialStatus={header.payment_status} 
          />
        )}
        
        {/* Items Table Card */}
        <Card className="flex-1 flex flex-col !p-0 overflow-hidden !rounded-[32px] border border-slate-100 shadow-sm bg-white">
          <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1E4D4D] rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-900/20">
                <LayoutList size={16} />
              </div>
              <h3 className="text-sm font-black text-[#1E4D4D]">أصناف الفاتورة</h3>
              <Badge variant="neutral" className="mr-2 bg-white">{items.length} صنف</Badge>
            </div>
            
            <div className="flex items-center gap-2">
               <button 
                 onClick={() => setIsAdjustmentsOpen(true)}
                 className="h-9 px-4 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
               >
                 <Tag size={14} />
                 التسويات والخصم
               </button>
               <button 
                 onClick={() => setItems([])}
                 className="h-9 w-9 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 hover:border-red-100 transition-all flex items-center justify-center"
                 title="مسح الكل"
               >
                 <Trash2 size={16} />
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-right border-collapse">
              <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10">
                <tr className="border-b border-slate-50">
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">الصنف</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الكمية</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">السعر</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الإجمالي</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence initial={false}>
                  {items.map((item, idx) => (
                    <motion.tr 
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="group hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#1E4D4D]">{item.name}</span>
                          {item.expiryDate && <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 mt-1"><Clock size={10}/> تنتهي في: {item.expiryDate}</span>}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-3 bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
                          <button 
                            disabled={isLocked}
                            onClick={() => {
                              const newItems = [...items];
                              if (newItems[idx].qty > 1) {
                                newItems[idx].qty--;
                                newItems[idx].sum = newItems[idx].qty * newItems[idx].price;
                                setItems(newItems);
                              }
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-[#1E4D4D] shadow-sm disabled:opacity-50"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-black text-[#1E4D4D] min-w-[20px]">{item.qty}</span>
                          <button 
                            disabled={isLocked}
                            onClick={() => {
                              const newItems = [...items];
                              newItems[idx].qty++;
                              newItems[idx].sum = newItems[idx].qty * newItems[idx].price;
                              setItems(newItems);
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-[#1E4D4D] shadow-sm disabled:opacity-50"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-bold text-slate-600">{item.price.toLocaleString()}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-black text-[#1E4D4D]">{item.sum.toLocaleString()}</span>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          disabled={isLocked}
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20 grayscale">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                          <ShoppingBag size={40} />
                        </div>
                        <p className="text-sm font-black">لا توجد أصناف في الفاتورة حالياً</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ADD ITEM BAR */}
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 shrink-0">
             <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                   <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                   <input 
                     ref={itemNameInputRef}
                     disabled={isLocked}
                     value={searchTerm || manualItemName}
                     onChange={(e) => {
                       setSearchTerm(e.target.value);
                       setManualItemName(e.target.value);
                       setShowSearchDropdown(true);
                     }}
                     placeholder="ابحث عن صنف أو أدخل اسم جديد..."
                     className="w-full h-12 bg-white border border-slate-200 rounded-2xl pr-10 pl-4 text-sm font-bold focus:ring-4 focus:ring-[#1E4D4D]/5 transition-all disabled:opacity-50"
                   />
                   
                   {/* Search Results Dropdown */}
                   <AnimatePresence>
                     {showSearchDropdown && filteredProducts.length > 0 && (
                       <motion.div 
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, y: 10 }}
                         className="absolute bottom-full mb-2 right-0 left-0 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                       >
                         {filteredProducts.map(p => (
                           <button 
                             key={p.id}
                             onClick={() => selectProduct(p)}
                             className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                           >
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                 <Package size={20} />
                               </div>
                               <div className="text-right">
                                 <p className="text-sm font-black text-[#1E4D4D]">{p.Name}</p>
                                 <p className="text-[10px] font-bold text-slate-400">الباركود: {p.barcode || '---'}</p>
                               </div>
                             </div>
                             <div className="text-left">
                               <p className="text-xs font-black text-emerald-600">{p.CostPrice?.toLocaleString()} {currency}</p>
                               <p className="text-[9px] font-bold text-slate-400">المخزون: {p.StockQuantity}</p>
                             </div>
                           </button>
                         ))}
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>

                <div className="flex gap-2">
                  <div className="w-24 relative">
                    <input 
                      ref={qtyInputRef}
                      disabled={isLocked}
                      type="number"
                      value={tempQty}
                      onChange={(e) => setTempQty(e.target.value)}
                      placeholder="الكمية"
                      className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 text-center text-sm font-black focus:ring-4 focus:ring-[#1E4D4D]/5 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="w-32 relative">
                    <input 
                      ref={priceInputRef}
                      disabled={isLocked}
                      type="number"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      placeholder="السعر"
                      className="w-full h-12 bg-white border border-slate-200 rounded-2xl px-4 text-center text-sm font-black focus:ring-4 focus:ring-[#1E4D4D]/5 transition-all disabled:opacity-50"
                    />
                  </div>
                  <button 
                    disabled={isLocked || !manualItemName || !tempQty || !tempPrice}
                    onClick={finalizeItemAdd}
                    className="h-12 px-6 bg-[#1E4D4D] text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    إضافة
                  </button>
                </div>
             </div>
          </div>
        </Card>
      </div>

      {/* FOOTER ACTION BAR */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0 z-50">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي الفاتورة</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#1E4D4D]">{vTotalSum.toLocaleString()}</span>
                <span className="text-xs font-bold text-slate-400">{currency}</span>
              </div>
            </div>
            
            <div className="h-10 w-px bg-slate-100 hidden md:block" />
            
            <div className="flex items-center gap-4">
               <div className="text-right">
                 <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">الخصم</p>
                 <p className="text-xs font-bold text-[#1E4D4D]">{adjData.discountPercent}%</p>
               </div>
               <div className="text-right">
                 <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">الرسوم</p>
                 <p className="text-xs font-bold text-[#1E4D4D]">{adjData.otherFees.toLocaleString()}</p>
               </div>
               <div className="text-right">
                 <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">الضريبة</p>
                 <p className="text-xs font-bold text-[#1E4D4D]">{adjData.tax.toLocaleString()}</p>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 ml-4">
               <button 
                 onClick={handleExport}
                 className="w-11 h-11 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-100"
                 title="تصدير Excel"
               >
                 <FileSpreadsheet size={20} />
               </button>
               <PrintMenu type="PURCHASE" data={printData} />
            </div>

            <button 
              disabled={isLocked || isSaving || items.length === 0}
              onClick={handlePost}
              className="flex-1 md:flex-none h-14 px-10 bg-gradient-to-br from-[#1E4D4D] to-[#0f2a2a] text-white rounded-[20px] font-black text-lg shadow-xl shadow-emerald-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100"
            >
              {isSaving ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={24} />
                  <span>حفظ وترحيل الفاتورة</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
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

export default PurchasesInvoice;
