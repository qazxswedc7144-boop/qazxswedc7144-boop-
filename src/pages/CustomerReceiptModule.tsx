
import React, { useState, useMemo, useEffect } from 'react';
import { useAccounting, useUI } from '../store/AppContext';
import { Sale } from '../types';
import { SalesRepository } from '../repositories/SalesRepository';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { accountingService } from '../services/accounting.service';
import { db } from '../lib/database';
import { Card, Button, Badge, Modal } from '../components/SharedUI';
import { 
  ArrowRight, History, CheckCircle2, ChevronDown, ListChecks,
  Banknote, User, CheckSquare, Square, ArrowDownCircle, Calendar
} from 'lucide-react';

const CustomerReceiptModule: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { customers } = useAccounting();
  const { currency, addToast, refreshGlobal } = useUI();
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [unpaidSales, setUnpaidSales] = useState<Sale[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [totalPaidAmount, setTotalPaidAmount] = useState<number>(0); // تم تغيير المسمى لـ Paid_Amount
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) return customers.filter(c => c.Balance > 0);
    return customers.filter(c => 
      c.Balance > 0 && 
      (c.Supplier_Name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
       c.Supplier_ID.toLowerCase().includes(customerSearchTerm.toLowerCase()))
    );
  }, [customers, customerSearchTerm]);

  const selectedCustomer = useMemo(() => 
    customers.find(c => c.Supplier_ID === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  useEffect(() => {
    if (selectedCustomerId) {
      SalesRepository.getUnpaidByCustomer(selectedCustomerId).then(invoices => {
        setUnpaidSales(invoices);
        setSelectedInvoiceIds(new Set(invoices.map(i => i.id)));
      });
      setAllocations({});
    } else {
      setUnpaidSales([]);
      setSelectedInvoiceIds(new Set());
    }
  }, [selectedCustomerId]);

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
    let remaining = totalPaidAmount;
    const newAllocations: Record<string, number> = {};

    unpaidSales.filter(i => selectedInvoiceIds.has(i.id)).forEach(sale => {
      if (remaining <= 0) return;
      const unpaidAmount = sale.finalTotal - (sale.paidAmount || 0);
      const toCollect = Math.min(remaining, unpaidAmount);
      if (toCollect > 0) {
        newAllocations[sale.id] = parseFloat(toCollect.toFixed(2));
        remaining -= toCollect;
      }
    });

    setAllocations(newAllocations);
    if (remaining > 0) {
      addToast(`ملاحظة: يوجد فائض ${parseFloat(remaining.toFixed(2))} سيتم إيداعه في حساب العميل.`, 'info');
    }
  };

  const handleAllocationChange = (id: string, val: number) => {
    if (!selectedInvoiceIds.has(id)) return;
    const sale = unpaidSales.find(s => s.id === id);
    if (!sale) return;
    const max = sale.finalTotal - (sale.paidAmount || 0);
    
    if (val > max) {
      addToast(`المبلغ يتجاوز رصيد الفاتورة المتبقي`, "warning");
    }

    const toCollect = Math.min(val, max);
    setAllocations({ ...allocations, [id]: parseFloat(toCollect.toFixed(2)) });
  };

  const totalAllocated = useMemo(() => 
    Object.values(allocations).reduce((a: number, b: number) => a + b, 0),
    [allocations]
  );

  const handleConfirmReceipt = async () => {
    if (!selectedCustomerId || totalPaidAmount <= 0) {
      addToast("بيانات السند ناقصة", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      await db.runTransaction(async () => {
        const voucherId = await accountingService.recordVoucher(
          'دخل',
          selectedCustomer?.Supplier_Name || 'عميل غير معروف',
          totalPaidAmount,
          'تحصيلات مبيعات',
          `قبض من عميل: ${selectedCustomer?.Supplier_Name} | ${notes}`,
          selectedCustomerId,
          allocations
        );

        for (const saleId in allocations) {
          const amount = allocations[saleId];
          if (amount > 0) {
            await SalesRepository.updatePaidAmount(saleId, amount);
          }
        }

        await SupplierRepository.postToLedger({
          id: db.generateId('PL'),
          partnerId: selectedCustomerId,
          date: new Date().toISOString(),
          description: `سند قبض رقم #${voucherId}`,
          debit: 0, 
          credit: totalPaidAmount, 
          referenceId: voucherId
        });
      });

      addToast("تمت التسوية بنجاح ✅", "success");
      refreshGlobal();
      onNavigate?.('dashboard');
    } catch (e: any) {
      addToast(`خطأ مالي: ${e.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full h-full bg-[#F8FAFA] font-['Cairo'] w-full relative overflow-x-hidden" dir="rtl">
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shadow-sm shrink-0 h-20">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#1E4D4D] transition-colors"><ArrowRight size={20} /></button>
          <div>
            <h2 className="text-lg font-black text-[#1E4D4D]">سند قبض من عميل</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Paid Amount Control Center</p>
          </div>
        </div>
        <Badge variant="success">سند قبض نقدية</Badge>
      </div>

      <div className="flex-1 p-4 md:p-8 space-y-6 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           <div className="lg:col-span-4 space-y-6">
              <Card className="!p-8 space-y-6 shadow-xl">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User size={14}/> اختر العميل</label>
                     <div className="relative">
                        <input 
                          className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 font-black text-[#1E4D4D] outline-none focus:border-emerald-500 transition-all"
                          placeholder="اكتب اسم العميل أو الكود..."
                          value={customerSearchTerm}
                          onChange={e => {
                            setCustomerSearchTerm(e.target.value);
                            setShowCustomerDropdown(true);
                          }}
                          onFocus={() => setShowCustomerDropdown(true)}
                        />
                        {showCustomerDropdown && (
                          <div className="absolute top-full left-0 right-0 bg-white border-2 border-slate-100 rounded-2xl shadow-2xl z-[200] mt-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {filteredCustomers.length > 0 ? (
                              filteredCustomers.map(c => (
                                <button 
                                  key={c.Supplier_ID} 
                                  onClick={() => {
                                    setSelectedCustomerId(c.Supplier_ID);
                                    setCustomerSearchTerm(c.Supplier_Name);
                                    setShowCustomerDropdown(false);
                                  }}
                                  className="w-full p-4 text-right hover:bg-emerald-50 border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors"
                                >
                                  <div className="font-black text-[#1E4D4D] group-hover:text-emerald-600">{c.Supplier_Name}</div>
                                  <Badge variant="info">{c.Balance.toLocaleString()} {currency}</Badge>
                                </button>
                              ))
                            ) : (
                              <div className="p-4 text-center text-slate-400 text-xs font-bold">لا يوجد نتائج...</div>
                            )}
                          </div>
                        )}
                        {showCustomerDropdown && <div className="fixed inset-0 z-[190]" onClick={() => setShowCustomerDropdown(false)} />}
                     </div>
                    {selectedCustomer && (
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                         <p className="text-[10px] font-black text-blue-600 uppercase mb-1">المديونية الكلية</p>
                         <h3 className="text-xl font-black text-[#1E4D4D] text-center">{selectedCustomer.Balance.toLocaleString()} <span className="text-xs opacity-40">{currency}</span></h3>
                      </div>
                    )}
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Banknote size={14}/> المبلغ المسدد (Paid Amount)</label>
                    <input type="number" className="w-full h-16 bg-[#F8FAFA] border-2 border-slate-100 rounded-[24px] px-6 text-2xl font-black text-center text-emerald-600 outline-none focus:bg-white focus:border-emerald-500 transition-all shadow-inner" placeholder="0.00" value={totalPaidAmount || ''} onChange={e => setTotalPaidAmount(parseFloat(e.target.value) || 0)} />
                    {totalPaidAmount > 0 && selectedInvoiceIds.size > 0 && (
                      <button onClick={handleAutoAllocate} className="w-full py-3 bg-emerald-50 text-emerald-600 border-2 border-dashed border-emerald-200 rounded-xl text-[10px] font-black hover:bg-emerald-100 transition-all flex items-center justify-center gap-2">
                         <ListChecks size={14} /> توزيع تلقائي للمبلغ المسدد
                      </button>
                    )}
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ملاحظات</label>
                    <textarea className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold outline-none focus:bg-white transition-all h-24" placeholder="ملاحظات التحصيل..." value={notes} onChange={e => setNotes(e.target.value)} />
                 </div>
              </Card>
           </div>

           <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between px-2">
                 <h3 className="text-sm font-black text-[#1E4D4D] flex items-center gap-2 uppercase tracking-widest"><History size={16}/> فواتير العميل المستحقة ({unpaidSales.length})</h3>
                 <button onClick={() => setSelectedInvoiceIds(selectedInvoiceIds.size === unpaidSales.length ? new Set() : new Set(unpaidSales.map(i => i.id)))} className="text-[10px] font-black text-blue-600 underline">
                    {selectedInvoiceIds.size === unpaidSales.length ? 'إلغاء التحديد' : 'تحديد الكل'}
                 </button>
              </div>

              {!selectedCustomerId ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-20 flex flex-col items-center justify-center text-center opacity-40">
                   <User size={48} className="mb-4 text-slate-300" />
                   <p className="font-bold text-sm">اختر عميلاً لعرض مديونياته وتوزيع المبلغ</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {unpaidSales.map(sale => {
                     const isSelected = selectedInvoiceIds.has(sale.id);
                     const remaining = sale.finalTotal - (sale.paidAmount || 0);
                     const allocation = allocations[sale.id] || 0;

                     return (
                       <Card key={sale.id} className={`transition-all border-r-8 ${isSelected ? (allocation > 0 ? 'border-r-emerald-500 shadow-lg' : 'border-r-blue-500') : 'border-r-slate-100 opacity-60'}`}>
                          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                             <div className="flex items-center gap-4 flex-1">
                                <button onClick={() => toggleInvoiceSelection(sale.id)} className="text-blue-600">
                                   {isSelected ? <CheckSquare size={24} /> : <Square size={24} className="text-slate-300" />}
                                </button>
                                <div>
                                   <h4 className="font-black text-[#1E4D4D] text-sm">فاتورة رقم #{sale.SaleID}</h4>
                                   <div className="flex items-center gap-2 mt-1">
                                      <Calendar size={10} className="text-slate-300" />
                                      <span className="text-[10px] text-slate-400 font-bold">{new Date(sale.date).toLocaleDateString('ar-SA')}</span>
                                   </div>
                                </div>
                             </div>

                             <div className="flex items-center gap-8">
                                <div className="text-center">
                                   <p className="text-[9px] font-black text-slate-300 uppercase">الرصيد المتبقي</p>
                                   <p className="text-sm font-black text-red-500">{remaining.toLocaleString()}</p>
                                </div>
                                <div className="w-32">
                                   <input 
                                     type="number" 
                                     disabled={!isSelected}
                                     className={`w-full h-10 border-2 rounded-xl text-center font-black text-sm outline-none ${isSelected ? 'bg-white border-blue-200' : 'bg-slate-50 cursor-not-allowed'}`}
                                     value={allocation || ''} 
                                     onChange={e => handleAllocationChange(sale.id, parseFloat(e.target.value) || 0)}
                                     placeholder="0.00"
                                   />
                                </div>
                             </div>
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
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">إجمالي المقبوض</p>
                  <p className="text-xl font-black text-emerald-600">{totalPaidAmount.toLocaleString()}</p>
               </div>
               <div className="text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">توزيع المبلغ المسدد</p>
                  <p className={`text-xl font-black ${totalAllocated > totalPaidAmount ? 'text-red-500' : 'text-[#1E4D4D]'}`}>{totalAllocated.toLocaleString()}</p>
               </div>
            </div>
            <Button variant="approve" className="h-14 px-12 shadow-xl text-base" onClick={handleConfirmReceipt} isLoading={isProcessing} disabled={totalPaidAmount <= 0 || !selectedCustomerId || totalAllocated > totalPaidAmount} icon={<ArrowDownCircle size={20}/>}>تأكيد وحفظ السند</Button>
         </div>
      </div>


    </div>
  );
};

export default CustomerReceiptModule;