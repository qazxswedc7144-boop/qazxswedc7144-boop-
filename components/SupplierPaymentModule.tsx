
import React, { useState, useMemo, useEffect } from 'react';
import { useAccounting, useUI } from '../store/AppContext';
import { Purchase, Supplier } from '../types';
import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { accountingService } from '../services/accounting.service';
import { db } from '../services/database';
import { Card, Button, Badge, Modal } from './SharedUI';
import { 
  ArrowRight, History, CheckCircle2, ChevronDown, ListChecks,
  Banknote, User, CheckSquare, Square, Calendar
} from 'lucide-react';

const SupplierPaymentModule: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { suppliers } = useAccounting();
  const { currency, addToast, refreshGlobal } = useUI();
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierSearchTerm, setSupplierSearchTerm] = useState<string>('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Purchase[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [totalPaidAmount, setTotalPaidAmount] = useState<number>(0); // تم تغيير المسمى لـ Paid_Amount
  const [allocations, setAllocations] = useState<Record<string, { amount: number, note: string }>>({});
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchTerm) return suppliers.filter(s => s.Balance > 0);
    return suppliers.filter(s => 
      s.Balance > 0 && 
      (s.Supplier_Name.toLowerCase().includes(supplierSearchTerm.toLowerCase()) || 
       s.Supplier_ID.toLowerCase().includes(supplierSearchTerm.toLowerCase()))
    );
  }, [suppliers, supplierSearchTerm]);

  const selectedSupplier = useMemo(() => 
    suppliers.find(s => s.Supplier_ID === selectedSupplierId),
    [suppliers, selectedSupplierId]
  );

  useEffect(() => {
    if (selectedSupplierId) {
      PurchaseRepository.getUnpaidBySupplier(selectedSupplierId).then(invoices => {
        setUnpaidInvoices(invoices);
        setSelectedInvoiceIds(new Set(invoices.map(i => i.id)));
      });
      setAllocations({});
    } else {
      setUnpaidInvoices([]);
      setSelectedInvoiceIds(new Set());
    }
  }, [selectedSupplierId]);

  const toggleInvoiceSelection = (id: string) => {
    const next = new Set(selectedInvoiceIds);
    if (next.has(id)) {
      next.delete(id);
      const nextAlloc = { ...allocations };
      delete nextAlloc[id];
      setAllocations(nextAlloc);
    } else {
      next.add(id);
    }
    setSelectedInvoiceIds(next);
  };

  const handleAutoAllocate = () => {
    if (totalPaidAmount <= 0) {
      addToast("يرجى إدخال المبلغ المسدد أولاً", "warning");
      return;
    }

    let remaining = totalPaidAmount;
    const newAllocations: Record<string, { amount: number, note: string }> = {};
    const newSelectedIds = new Set<string>();

    // FIFO: unpaidInvoices is already sorted by date (oldest first) from PurchaseRepository
    unpaidInvoices.forEach(inv => {
      if (remaining <= 0) return;
      
      const unpaidAmount = inv.totalAmount - (inv.paidAmount || 0);
      const toPay = Math.min(remaining, unpaidAmount);
      
      if (toPay > 0) {
        newAllocations[inv.id] = { 
          amount: parseFloat(toPay.toFixed(2)),
          note: allocations[inv.id]?.note || ''
        };
        newSelectedIds.add(inv.id);
        remaining -= toPay;
      }
    });

    setAllocations(newAllocations);
    setSelectedInvoiceIds(newSelectedIds);
    
    if (remaining > 0) {
      addToast(`تم التوزيع بنجاح (FIFO). يوجد فائض قدره ${parseFloat(remaining.toFixed(2))} ${currency} سيتم احتسابه كدفعة مقدمة.`, 'info');
    } else {
      addToast("تم توزيع المبلغ بالكامل على أقدم الفواتير (FIFO) ✅", "success");
    }
  };

  const handleAllocationChange = (id: string, val: number) => {
    if (!selectedInvoiceIds.has(id)) return;
    const inv = unpaidInvoices.find(i => i.id === id);
    if (!inv) return;
    const max = inv.totalAmount - (inv.paidAmount || 0);
    
    if (val > max) {
      addToast(`المبلغ يتجاوز رصيد الفاتورة (${max.toLocaleString()})`, "warning");
    }
    
    const toPay = Math.min(val, max);
    setAllocations({ 
      ...allocations, 
      [id]: { 
        amount: parseFloat(toPay.toFixed(2)), 
        note: allocations[id]?.note || '' 
      } 
    });
  };

  const handleAllocationNoteChange = (id: string, note: string) => {
    setAllocations({
      ...allocations,
      [id]: {
        amount: allocations[id]?.amount || 0,
        note
      }
    });
  };

  const totalAllocated = useMemo(() => 
    Object.values(allocations).reduce((a: number, b: any) => a + b.amount, 0),
    [allocations]
  );

  const handleConfirmPayment = async () => {
    if (!selectedSupplierId || totalPaidAmount <= 0) {
      addToast("يرجى إكمال بيانات السداد", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      await db.runTransaction(async () => {
        const voucherId = await accountingService.recordVoucher(
          'خرج',
          selectedSupplier?.Supplier_Name || 'مورد غير معروف',
          totalPaidAmount,
          'مدفوعات موردين',
          `سداد مورد: ${selectedSupplier?.Supplier_Name} | ${notes}`,
          selectedSupplierId,
          allocations
        );

        for (const invoiceId in allocations) {
          const { amount, note } = allocations[invoiceId];
          if (amount > 0) {
             await PurchaseRepository.updatePaidAmount(invoiceId, amount);
          }
        }

        await SupplierRepository.postToLedger({
          id: db.generateId('PL'),
          partnerId: selectedSupplierId,
          date: new Date().toISOString(),
          description: `سند صرف رقم #${voucherId}`,
          debit: totalPaidAmount, 
          credit: 0,
          referenceId: voucherId
        });
      });

      addToast("تمت معالجة السداد بنجاح ✅", "success");
      refreshGlobal();
      onNavigate?.('dashboard');
    } catch (e: any) {
      addToast(`خطأ: ${e.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFA] font-['Cairo'] overflow-hidden" dir="rtl">
      <div className="bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#1E4D4D] transition-colors"><ArrowRight size={20} /></button>
          <div>
            <h2 className="text-lg font-black text-[#1E4D4D]">سداد مديونية مورد</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Paid Amount Verification Active</p>
          </div>
        </div>
        <Badge variant="neutral">سند صرف نقدية</Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           <div className="lg:col-span-4 space-y-6">
              <Card className="!p-8 space-y-6 shadow-xl">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User size={14}/> اختر المورد</label>
                     <div className="relative">
                        <input 
                          className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 font-black text-[#1E4D4D] outline-none focus:border-blue-500 transition-all"
                          placeholder="اكتب اسم المورد أو الكود..."
                          value={supplierSearchTerm}
                          onChange={e => {
                            setSupplierSearchTerm(e.target.value);
                            setShowSupplierDropdown(true);
                          }}
                          onFocus={() => setShowSupplierDropdown(true)}
                        />
                        {showSupplierDropdown && (
                          <div className="absolute top-full left-0 right-0 bg-white border-2 border-slate-100 rounded-2xl shadow-2xl z-[200] mt-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {filteredSuppliers.length > 0 ? (
                              filteredSuppliers.map(s => (
                                <button 
                                  key={s.Supplier_ID} 
                                  onClick={() => {
                                    setSelectedSupplierId(s.Supplier_ID);
                                    setSupplierSearchTerm(s.Supplier_Name);
                                    setShowSupplierDropdown(false);
                                  }}
                                  className="w-full p-4 text-right hover:bg-blue-50 border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors"
                                >
                                  <div className="font-black text-[#1E4D4D] group-hover:text-blue-600">{s.Supplier_Name}</div>
                                  <Badge variant="danger">{s.Balance.toLocaleString()} {currency}</Badge>
                                </button>
                              ))
                            ) : (
                              <div className="p-4 text-center text-slate-400 text-xs font-bold">لا يوجد نتائج...</div>
                            )}
                          </div>
                        )}
                        {showSupplierDropdown && <div className="fixed inset-0 z-[190]" onClick={() => setShowSupplierDropdown(false)} />}
                     </div>
                    {selectedSupplier && (
                      <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                         <p className="text-[10px] font-black text-red-600 uppercase mb-1">إجمالي المستحقات له</p>
                         <h3 className="text-xl font-black text-[#1E4D4D] text-center">{selectedSupplier.Balance.toLocaleString()} <span className="text-xs opacity-40">{currency}</span></h3>
                      </div>
                    )}
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Banknote size={14}/> المبلغ المسدد (Paid Amount)</label>
                    <input type="number" className="w-full h-16 bg-[#F8FAFA] border-2 border-slate-100 rounded-[24px] px-6 text-2xl font-black text-center text-[#1E4D4D] outline-none focus:bg-white transition-all shadow-inner" placeholder="0.00" value={totalPaidAmount || ''} onChange={e => setTotalPaidAmount(parseFloat(e.target.value) || 0)} />
                    {totalPaidAmount > 0 && (
                      <button onClick={handleAutoAllocate} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 active:scale-95">
                         <ListChecks size={18} /> توزيع آلي (FIFO) للمبلغ المسدد
                      </button>
                    )}
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ملاحظات</label>
                    <textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold h-24" placeholder="ملاحظات السند..." value={notes} onChange={e => setNotes(e.target.value)} />
                 </div>
              </Card>
           </div>

           <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-sm font-black text-[#1E4D4D] flex items-center gap-2 uppercase tracking-widest"><History size={16}/> الفواتير المعلقة ({unpaidInvoices.length})</h3>
                 <button onClick={() => setSelectedInvoiceIds(selectedInvoiceIds.size === unpaidInvoices.length ? new Set() : new Set(unpaidInvoices.map(i => i.id)))} className="text-[10px] font-black text-blue-600 underline">
                    {selectedInvoiceIds.size === unpaidInvoices.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                 </button>
              </div>

              {!selectedSupplierId ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-20 flex flex-col items-center justify-center text-center opacity-40">
                   <User size={48} className="mb-4 text-slate-300" />
                   <p className="font-bold text-sm">يرجى اختيار مورد لعرض فواتيره وتوزيع المبلغ</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {unpaidInvoices.map(inv => {
                     const isSelected = selectedInvoiceIds.has(inv.id);
                     const remaining = inv.totalAmount - (inv.paidAmount || 0);
                     const allocation = (allocations[inv.id] as any) || { amount: 0, note: '' };
                     const status = inv.paidAmount && inv.paidAmount > 0 ? 'PartiallyPaid' : 'Unpaid';

                     return (
                       <Card key={inv.id} className={`transition-all border-r-8 ${isSelected ? (allocation.amount > 0 ? 'border-r-emerald-500 shadow-lg' : 'border-r-blue-500 bg-blue-50/10') : 'border-r-slate-100 opacity-60'}`}>
                          <div className="space-y-4">
                             <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-4 flex-1">
                                   <button onClick={() => toggleInvoiceSelection(inv.id)} className="text-blue-600">
                                      {isSelected ? <CheckSquare size={24} /> : <Square size={24} className="text-slate-300" />}
                                   </button>
                                   <div>
                                      <div className="flex items-center gap-2">
                                         <h4 className="font-black text-[#1E4D4D] text-sm">فاتورة رقم #{inv.invoiceId}</h4>
                                         <Badge variant={status === 'PartiallyPaid' ? 'warning' : 'danger'} className="text-[8px] px-2 py-0.5">
                                            {status === 'PartiallyPaid' ? 'مدفوعة جزئياً' : 'غير مدفوعة'}
                                         </Badge>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                         <Calendar size={10} className="text-slate-300" />
                                         <span className="text-[10px] text-slate-400 font-bold">{new Date(inv.date).toLocaleDateString('ar-SA')}</span>
                                      </div>
                                   </div>
                                </div>

                                <div className="flex items-center gap-8">
                                   <div className="text-center">
                                      <p className="text-[9px] font-black text-slate-300 uppercase">المتبقي</p>
                                      <p className="text-sm font-black text-red-500">{remaining.toLocaleString()}</p>
                                   </div>
                                   <div className="w-32">
                                      <input 
                                        type="number" 
                                        disabled={!isSelected}
                                        className={`w-full h-10 border-2 rounded-xl text-center font-black text-sm outline-none transition-all ${isSelected ? 'bg-white border-blue-200' : 'bg-slate-50 border-transparent cursor-not-allowed'}`}
                                        value={allocation.amount || ''} 
                                        onChange={e => handleAllocationChange(inv.id, parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                      />
                                   </div>
                                </div>
                             </div>
                             
                             {isSelected && (
                               <div className="flex items-center gap-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-right-2">
                                  <input 
                                    type="text"
                                    placeholder="أضف ملاحظة لهذه الفاتورة..."
                                    className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-[#1E4D4D] placeholder:text-slate-300"
                                    value={allocation.note}
                                    onChange={e => handleAllocationNoteChange(inv.id, e.target.value)}
                                  />
                               </div>
                             )}
                          </div>
                       </Card>
                     );
                   })}
                </div>
              )}
           </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 z-[100] shadow-2xl">
         <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex gap-10">
               <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">إجمالي المسدد</p>
                  <p className="text-xl font-black text-red-500">{totalPaidAmount.toLocaleString()}</p>
               </div>
               <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">الموزع على الفواتير</p>
                  <p className={`text-xl font-black ${totalAllocated > totalPaidAmount ? 'text-red-500' : 'text-emerald-600'}`}>{totalAllocated.toLocaleString()}</p>
               </div>
            </div>
            <Button variant="primary" className="h-14 px-12 shadow-xl text-base" onClick={handleConfirmPayment} isLoading={isProcessing} disabled={totalPaidAmount <= 0 || !selectedSupplierId || totalAllocated > totalPaidAmount} icon={<CheckCircle2 size={20}/>}>حفظ وإغلاق السند</Button>
         </div>
      </div>


    </div>
  );
};

export default SupplierPaymentModule;
