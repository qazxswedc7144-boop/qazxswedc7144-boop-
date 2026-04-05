
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/database';
import { voucherService } from '../services/voucherService';
import { useUI } from '../store/AppContext';
import { Receipt, Payment, Supplier } from '../types';
import PrintMenu from './PrintMenu';
import { 
  Search, X, ArrowDownCircle, ArrowUpRight, Printer, Trash2, Calendar, CreditCard, User, FileText, Wallet, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VouchersModuleProps {
  onNavigate?: (view: any) => void;
  initialType?: 'RECEIPT' | 'PAYMENT';
}

const VouchersModule: React.FC<VouchersModuleProps> = ({ onNavigate, initialType = 'RECEIPT' }) => {
  const { version, refreshGlobal, addToast } = useUI();
  const [vType, setVType] = useState<'RECEIPT' | 'PAYMENT'>(initialType);
  const [searchTerm, setSearchTerm] = useState('');
  const [history, setHistory] = useState<(Receipt | Payment)[]>([]);
  const [customers, setCustomers] = useState<Supplier[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setShowPartnerDropdown(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const [form, setForm] = useState({
    partnerId: '',
    amount: '',
    notes: '',
    paymentMethod: 'CASH' as 'CASH' | 'TRANSFER',
    date: new Date().toISOString().split('T')[0]
  });

  const filteredPartners = useMemo(() => {
    const list = vType === 'RECEIPT' ? customers : suppliers;
    if (!partnerSearch.trim()) return [];
    return list.filter(p => p.Supplier_Name.toLowerCase().includes(partnerSearch.toLowerCase()));
  }, [vType, customers, suppliers, partnerSearch]);

  useEffect(() => {
    const fetchData = async () => {
      const custs = await db.customers.toArray();
      const supps = await db.suppliers.toArray();
      const rcpts = await db.receipts.toArray();
      const pymnts = await db.payments.toArray();
      
      setCustomers(custs);
      setSuppliers(supps);
      
      const combined = [
        ...rcpts.map(r => ({ ...r, type: 'RECEIPT' as const })),
        ...pymnts.map(p => ({ ...p, type: 'PAYMENT' as const }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setHistory(combined);
    };
    fetchData();
  }, [version]);

  const handleSave = async () => {
    let finalPartnerId = form.partnerId;

    // Validation: Amount
    if (!form.amount || parseFloat(form.amount) <= 0) {
      addToast("يرجى إدخال مبلغ أكبر من صفر", "error");
      return;
    }

    // Validation: Partner
    if (!finalPartnerId) {
      if (!partnerSearch.trim()) {
        addToast("يرجى اختيار أو كتابة اسم المستلم/المسلم", "error");
        return;
      }

      // Check if name matches exactly an existing one
      const exactMatch = (vType === 'RECEIPT' ? customers : suppliers).find(p => p.Supplier_Name === partnerSearch.trim());
      if (exactMatch) {
        finalPartnerId = exactMatch.id;
      } else {
        // Create new partner
        if (window.confirm(`الاسم "${partnerSearch}" غير موجود. هل تريد إضافته كـ ${vType === 'RECEIPT' ? 'عميل جديد' : 'مورد جديد'}؟`)) {
          try {
            const newPartner: Supplier = {
              id: `P-${Date.now()}`,
              Supplier_ID: `SID-${Date.now()}`,
              Supplier_Name: partnerSearch.trim(),
              Balance: 0,
              openingBalance: 0,
              Is_Active: true,
              updated_at: new Date().toISOString(),
              version: 1
            };
            if (vType === 'RECEIPT') {
              await db.customers.add(newPartner);
            } else {
              await db.suppliers.add(newPartner);
            }
            finalPartnerId = newPartner.id;
            addToast("تم إضافة الاسم الجديد بنجاح", "success");
          } catch (e) {
            addToast("فشل إضافة الاسم الجديد", "error");
            return;
          }
        } else {
          return;
        }
      }
    }
    
    setLoading(true);
    try {
      if (vType === 'RECEIPT') {
        await voucherService.createReceipt({
          customer_id: finalPartnerId,
          amount: parseFloat(form.amount),
          notes: form.notes,
          date: new Date(form.date).toISOString(),
          paymentMethod: form.paymentMethod
        });
      } else {
        await voucherService.createPayment({
          supplier_id: finalPartnerId,
          amount: parseFloat(form.amount),
          notes: form.notes,
          date: new Date(form.date).toISOString(),
          paymentMethod: form.paymentMethod
        });
      }

      addToast("تم حفظ السند وتحديث الأرصدة بنجاح", "success");
      setForm({ partnerId: '', amount: '', notes: '', paymentMethod: 'CASH', date: new Date().toISOString().split('T')[0] });
      setPartnerSearch('');
      refreshGlobal();
    } catch (err: any) {
      addToast(err.message || "فشل الحفظ", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: any) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السند؟')) {
      try {
        if (item.type === 'RECEIPT') {
          await db.db.receipts.delete(item.id);
          await db.updateCustomerBalance(item.customer_id, item.amount); // Reverse: add back to receivable
        } else {
          await db.db.payments.delete(item.id);
          await db.updateSupplierBalance(item.supplier_id, item.amount); // Reverse: add back to payable
        }
        
        // Also delete journal entry
        const entries = await db.journalEntries.where('reference_id').equals(item.id).toArray();
        for (const entry of entries) {
           // Reverse account balances
           for (const line of entry.lines) {
             await db.updateAccountBalance(line.account_id, line.credit - line.debit);
           }
           await db.journalEntries.delete(entry.id);
        }

        addToast('تم الحذف بنجاح ✅', 'success');
        refreshGlobal();
      } catch (e: any) {
        addToast(`فشل الحذف: ${e.message}`, 'error');
      }
    }
  };

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(h => {
       const partnerName = (h as any).type === 'RECEIPT' 
         ? customers.find(c => c.id === (h as Receipt).customer_id)?.Supplier_Name 
         : suppliers.find(s => s.id === (h as Payment).supplier_id)?.Supplier_Name;
       
       return partnerName?.toLowerCase().includes(term) || 
              h.notes?.toLowerCase().includes(term) || 
              h.amount.toString().includes(term);
    });
  }, [history, searchTerm, customers, suppliers]);

  return (
    <div className="p-4 md:p-8 space-y-8 pb-24" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-100">
               <CreditCard size={24} />
            </div>
            <div>
               <h2 className="text-xl md:text-2xl font-black text-[#1E4D4D]">سندات القبض والصرف</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إدارة التحويلات النقدية والعهدة</p>
            </div>
         </div>
         <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-[#1E4D4D] text-xl font-black hover:bg-slate-100 transition-colors">➦</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-1 bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 space-y-8 h-fit lg:sticky lg:top-8">
          {/* Tabs */}
          <div className="flex p-1.5 bg-[#F8FAFA] rounded-3xl border border-slate-100">
             <button 
               onClick={() => { setVType('RECEIPT'); setForm(f => ({...f, partnerId: ''})); setPartnerSearch(''); }} 
               className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${vType === 'RECEIPT' ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-400 hover:text-emerald-600'}`}
             >
               <ArrowDownCircle size={18} />
               سند قبض
             </button>
             <button 
               onClick={() => { setVType('PAYMENT'); setForm(f => ({...f, partnerId: ''})); setPartnerSearch(''); }} 
               className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${vType === 'PAYMENT' ? 'bg-red-500 text-white shadow-xl' : 'text-slate-400 hover:text-red-500'}`}
             >
               <ArrowUpRight size={18} />
               سند صرف
             </button>
          </div>

          <div className="space-y-5">
             {/* Partner Selection */}
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1">
                  {vType === 'RECEIPT' ? 'يستلم من (العميل)' : 'يصرف لـ (المورد)'}
                </label>
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <input 
                    type="text"
                    className="w-full bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl px-5 py-4 font-black text-[#1E4D4D] focus:outline-none focus:border-[#1E4D4D] transition-all"
                    placeholder="ابدأ الكتابة للبحث أو إضافة اسم جديد..."
                    value={partnerSearch}
                    onChange={e => {
                      setPartnerSearch(e.target.value);
                      setForm({...form, partnerId: ''});
                      setShowPartnerDropdown(true);
                    }}
                    onFocus={(e) => {
                      e.stopPropagation();
                      setShowPartnerDropdown(true);
                    }}
                  />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                    <User size={18} />
                  </div>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {showPartnerDropdown && filteredPartners.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[110] max-h-60 overflow-y-auto custom-scrollbar"
                        onClick={e => e.stopPropagation()}
                      >
                        {filteredPartners.map(p => (
                          <button
                            key={p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm({...form, partnerId: p.id});
                              setPartnerSearch(p.Supplier_Name);
                              setShowPartnerDropdown(false);
                            }}
                            className="w-full text-right px-5 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between group"
                          >
                            <span className="font-black text-[#1E4D4D]">{p.Supplier_Name}</span>
                            <span className="text-[9px] font-bold text-slate-300 group-hover:text-[#1E4D4D]">اختيار</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
             </div>

             {/* Amount and Date */}
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1">المبلغ</label>
                   <div className="relative">
                     <input 
                       type="number"
                       className="w-full bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl px-5 py-4 font-black text-[#1E4D4D] text-center text-xl"
                       placeholder="0.00"
                       value={form.amount}
                       onChange={e => setForm({...form, amount: e.target.value})}
                     />
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20 font-black text-xs">AED</div>
                   </div>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1">التاريخ</label>
                   <input 
                     type="date"
                     className="w-full bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl px-3 py-4 font-black text-slate-600 text-xs"
                     value={form.date}
                     onChange={e => setForm({...form, date: e.target.value})}
                   />
                </div>
             </div>

             {/* Payment Method */}
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1">طريقة الدفع</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setForm({...form, paymentMethod: 'CASH'})}
                    className={`py-3 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-2 ${form.paymentMethod === 'CASH' ? 'border-[#1E4D4D] bg-[#1E4D4D]/5 text-[#1E4D4D]' : 'border-slate-50 text-slate-400'}`}
                  >
                    <Wallet size={14} />
                    نقداً
                  </button>
                  <button 
                    onClick={() => setForm({...form, paymentMethod: 'TRANSFER'})}
                    className={`py-3 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-2 ${form.paymentMethod === 'TRANSFER' ? 'border-[#1E4D4D] bg-[#1E4D4D]/5 text-[#1E4D4D]' : 'border-slate-50 text-slate-400'}`}
                  >
                    <ArrowUpRight size={14} />
                    تحويل بنكي
                  </button>
                </div>
             </div>

             {/* Notes */}
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-1">البيان / السبب</label>
                <textarea 
                  className="w-full bg-[#F8FAFA] border-2 border-slate-50 rounded-2xl px-5 py-4 font-bold text-slate-700 h-28 focus:outline-none focus:border-[#1E4D4D] transition-all"
                  placeholder="اكتب تفاصيل العملية هنا..."
                  value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})}
                />
             </div>
          </div>

          <button 
            disabled={loading}
            onClick={handleSave}
            className={`w-full py-5 rounded-[24px] font-black text-lg text-white shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${vType === 'RECEIPT' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-red-500 hover:bg-red-600 shadow-red-100'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'جاري الحفظ...' : 'حفظ السند وإصدار القيد ✨'}
          </button>
        </div>

        {/* Archive Section */}
        <div className="lg:col-span-2 bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full min-h-[600px]">
           <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-xl font-black text-[#1E4D4D]">أرشيف السندات</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">مراجعة العمليات المالية السابقة</p>
              </div>
              
              <div className="relative w-full md:w-80 group">
                <input 
                   type="text" 
                   placeholder="ابحث بالاسم، المبلغ، أو البيان..." 
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-12 py-3.5 text-xs font-black focus:outline-none focus:border-[#1E4D4D] focus:bg-white shadow-inner transition-all group-hover:border-slate-200"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1E4D4D] transition-colors" size={18} />
              </div>
           </div>
           
           <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1 pb-4">
              {filteredHistory.map(h => {
                const isReceipt = (h as any).type === 'RECEIPT';
                const partner = isReceipt 
                  ? customers.find(c => c.id === (h as Receipt).customer_id)
                  : suppliers.find(s => s.id === (h as Payment).supplier_id);
                
                return (
                  <div key={h.id} className="flex flex-col sm:flex-row items-center justify-between p-6 bg-[#F8FAFA] border border-slate-50 rounded-[32px] hover:bg-white hover:shadow-xl transition-all group relative overflow-hidden">
                    <div className="flex items-center gap-6 w-full sm:w-auto">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0 transition-transform group-hover:scale-110 ${isReceipt ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                          {isReceipt ? <ArrowDownCircle size={24} /> : <ArrowUpRight size={24} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-[#1E4D4D] truncate group-hover:text-black transition-colors">
                            {partner?.Supplier_Name || 'جهة غير معروفة'}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100 flex items-center gap-1">
                               <Calendar size={10} /> {new Date(h.date).toLocaleDateString('ar-SA')}
                            </span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${isReceipt ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                               {isReceipt ? 'سند قبض' : 'سند صرف'}
                            </span>
                            <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">
                               {h.paymentMethod === 'TRANSFER' ? 'تحويل' : 'نقدي'}
                            </span>
                          </div>
                          {h.notes && <p className="text-[10px] text-slate-400 mt-2 truncate max-w-xs">{h.notes}</p>}
                        </div>
                    </div>
                    
                    <div className="text-center sm:text-left mt-4 sm:mt-0 w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
                        <p className={`text-2xl font-black ${isReceipt ? 'text-emerald-600' : 'text-red-500'} mb-2`}>
                          {isReceipt ? '+' : '-'}{h.amount.toLocaleString()} <span className="text-xs font-normal opacity-40">AED</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <PrintMenu data={h} type="VOUCHER" />
                          <button 
                            onClick={() => handleDelete(h)}
                            className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                            title="حذف السند"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                    </div>
                  </div>
                );
              })}
              
              {filteredHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                   <div className="text-5xl opacity-20">📂</div>
                   <p className="text-slate-400 font-black italic">الأرشيف فارغ حالياً</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default VouchersModule;
