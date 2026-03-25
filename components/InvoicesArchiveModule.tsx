
import React, { useState, useMemo, useEffect } from 'react';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { AdjustmentRepository } from '../repositories/AdjustmentRepository';
import { SupplierRepository } from '../repositories/SupplierRepository';
import { useUI } from '../store/AppContext';
import { useAppStore } from '../store/useAppStore';
import { Card, Badge, Button, Modal } from './SharedUI';
import AdjustmentForm from './AdjustmentForm';
import { authService } from '../services/auth.service';
import { db } from '../services/database';
import { transactionOrchestrator } from '../services/transactionOrchestrator';
import { 
  Search, Printer, Edit3, ShoppingCart, ShoppingBag, 
  ArrowRight, Tag, History, Filter, Fingerprint,
  Plus, CheckSquare, Square, Banknote, Clock, User, Lock, Ban, Home
} from 'lucide-react';

interface InvoicesArchiveModuleProps {
  onNavigate?: (view: any, params?: any) => void;
  initialFilter?: 'ALL' | 'SALE' | 'PURCHASE';
}

const InvoicesArchiveModule: React.FC<InvoicesArchiveModuleProps> = ({ onNavigate, initialFilter = 'ALL' }) => {
  const { currency, version, refreshGlobal, addToast } = useUI();
  const setEditingInvoiceId = useAppStore(state => state.setEditingInvoiceId);
  const user = authService.getCurrentUser();
  const isAdmin = user?.Role === 'Admin';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [finalTotals, setFinalTotals] = useState<Record<string, number>>({});
  const [lockedInvoices, setLockedInvoices] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);

  const [filterType, setFilterType] = useState<'ALL' | 'SALE' | 'PURCHASE'>(initialFilter);
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'Cash' | 'Credit'>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'total' | 'id'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementHistory, setSettlementHistory] = useState<any[]>([]);
  const [targetInvoice, setTargetInvoice] = useState<any>(null);

  useEffect(() => {
    if (initialFilter) setFilterType(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    const loadArchive = async () => {
      const data = await InvoiceRepository.getInvoicesArchive();
      setInvoices(data);
      
      const totals: Record<string, number> = {};
      const locks: Record<string, boolean> = {};
      for (const inv of data) {
        const id = inv.entityType === 'SALE' ? (inv.SaleID || inv.id) : (inv.invoiceId || inv.purchase_id || inv.id);
        const subtotal = inv.entityType === 'SALE' ? (inv.finalTotal || inv.FinalTotal || 0) : (inv.totalAmount || inv.finalAmount || 0);
        const tax = inv.tax || 0;
        totals[id] = await AdjustmentRepository.calculateFinalTotal(id, subtotal, tax);
        
        const invDate = inv.entityType === 'SALE' ? (inv.date || inv.Date) : inv.date;
        locks[id] = await db.isDateLocked(invDate);
      }
      setFinalTotals(totals);
      setLockedInvoices(locks);
    };
    loadArchive();
  }, [version]);

  const filteredInvoices = useMemo(() => {
    let list = [...invoices];
    if (filterType !== 'ALL') list = list.filter(inv => inv.entityType === filterType);
    if (paymentFilter !== 'ALL') {
      list = list.filter(inv => {
        const method = inv.paymentStatus || (inv.status === 'PAID' ? 'Cash' : 'Credit');
        return method === paymentFilter;
      });
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(inv => {
        const invId = inv.entityType === 'SALE' ? (inv.SaleID || inv.id) : (inv.invoiceId || inv.purchase_id || inv.id);
        const partner = inv.entityType === 'SALE' ? (inv.customerId || 'عميل نقدي') : (inv.partnerName || inv.partnerId);
        return invId.toLowerCase().includes(term) || partner.toLowerCase().includes(term);
      });
    }

    // Sorting
    list.sort((a, b) => {
      let valA: any, valB: any;
      if (sortBy === 'date') {
        valA = new Date(a.entityType === 'SALE' ? (a.date || a.Date) : a.date).getTime();
        valB = new Date(b.entityType === 'SALE' ? (b.date || b.Date) : b.date).getTime();
      } else if (sortBy === 'total') {
        const idA = a.entityType === 'SALE' ? (a.SaleID || a.id) : (a.invoiceId || a.purchase_id || a.id);
        const idB = b.entityType === 'SALE' ? (b.SaleID || b.id) : (b.invoiceId || b.purchase_id || b.id);
        valA = finalTotals[idA] || 0;
        valB = finalTotals[idB] || 0;
      } else {
        valA = a.entityType === 'SALE' ? (a.SaleID || a.id) : (a.invoiceId || a.purchase_id || a.id);
        valB = b.entityType === 'SALE' ? (b.SaleID || b.id) : (b.invoiceId || b.purchase_id || b.id);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [invoices, searchTerm, filterType, paymentFilter, sortBy, sortOrder, finalTotals]);

  const handleOpenSettlements = async (e: React.MouseEvent, inv: any) => {
    e.stopPropagation();
    const id = inv.entityType === 'SALE' ? (inv.SaleID || inv.id) : (inv.invoiceId || inv.purchase_id || inv.id);
    const history = await SupplierRepository.getInvoicePaymentHistory(id);
    setSettlementHistory(history);
    setTargetInvoice(inv);
    setIsSettlementModalOpen(true);
  };

  const handleViewAudit = (e: React.MouseEvent, inv: any) => {
    e.stopPropagation();
    const id = inv.entityType === 'SALE' ? (inv.SaleID || inv.id) : (inv.invoiceId || inv.purchase_id || inv.id);
    // التنقل لواجهة التدقيق مع تمرير المعرف (Contextual Filter)
    onNavigate?.('audit-history', { id });
  };

  const handleOpenInvoice = (inv: any) => {
    const id = inv.entityType === 'SALE' ? (inv.SaleID || inv.id) : (inv.invoiceId || inv.purchase_id || inv.id);
    const view = inv.entityType === 'SALE' ? 'sales' : 'purchases';
    onNavigate?.(view as any, { id });
  };

  const handleCancelInvoice = async (e: React.MouseEvent, inv: any) => {
    e.stopPropagation();
    const invDate = inv.date || inv.Date;
    const recordId = inv.entityType === 'SALE' ? (inv.SaleID || inv.id) : (inv.invoiceId || inv.purchase_id || inv.id);
    
    if (await db.isDateLocked(invDate) && !isAdmin) {
      addToast("خطأ حماية: لا يمكن إلغاء مستند يقع ضمن فترة محاسبية مغلقة 🔒", "error");
      return;
    }

    const status = inv.InvoiceStatus || inv.invoiceStatus;
    if (status === 'CANCELLED' || status === 'VOID') {
      addToast("المستند ملغى بالفعل", "info");
      return;
    }

    // Phase 5: Double Confirm Delete
    const confirmText = `هل أنت متأكد من إلغاء هذا المستند؟ سيتم قفله ومنع التعديل عليه.\nيرجى كتابة رقم الفاتورة [${recordId}] للتأكيد:`;
    const userInput = prompt(confirmText);
    
    if (userInput !== recordId) {
      if (userInput !== null) addToast("رقم الفاتورة غير متطابق، تم إلغاء العملية", "warning");
      return;
    }
    
    try {
      // Phase 4: Delete Protection (Soft Delete)
      await transactionOrchestrator.deleteInvoice(inv.id, inv.entityType);
      addToast("تم إلغاء المستند بنجاح بنظام الأرشفة الآمنة ✅", "success");
      refreshGlobal();
    } catch (err: any) { 
      addToast(err.message || "Error cancelling", "error"); 
    }
  };

  const handleUnpostAndEdit = async (e: React.MouseEvent, inv: any) => {
    e.stopPropagation();
    const recordId = inv.entityType === 'SALE' ? (inv.SaleID || inv.id) : (inv.invoiceId || inv.purchase_id || inv.id);
    
    if (!isAdmin) {
      addToast("عذراً، هذه الصلاحية متوفرة للمدراء فقط 🔒", "error");
      return;
    }

    // Confirmation Dialog (User Request)
    const confirmText = `⚠️ تحذير: أنت على وشك إلغاء ترحيل الفاتورة رقم [${recordId}].
سيتم عكس كافة القيود المحاسبية وحركات المخزون المرتبطة بها.
هل تريد الاستمرار؟`;
    
    if (!window.confirm(confirmText)) return;

    try {
      const res = await transactionOrchestrator.unpostInvoice(inv.id, inv.entityType);
      if (res.success) {
        addToast("تم إلغاء الترحيل بنجاح. يمكنك الآن تعديل الفاتورة ✅", "success");
        
        // Phase 3: Smart Navigation
        const paymentType = inv.paymentStatus || (inv.status === 'PAID' ? 'Cash' : 'Credit');
        const isReturn = inv.entityType === 'SALE' ? !!inv.isReturn : inv.invoiceType === 'مرتجع';
        
        let targetView = '';
        if (inv.entityType === 'PURCHASE') {
          if (isReturn) {
            targetView = paymentType === 'Cash' ? 'PurchaseReturnCashScreen' : 'PurchaseReturnCreditScreen';
          } else {
            targetView = paymentType === 'Cash' ? 'PurchaseCashScreen' : 'PurchaseCreditScreen';
          }
        } else {
          if (isReturn) {
            targetView = paymentType === 'Cash' ? 'SalesReturnCashScreen' : 'SalesReturnCreditScreen';
          } else {
            targetView = paymentType === 'Cash' ? 'SalesCashScreen' : 'SalesCreditScreen';
          }
        }
        
        // Since we don't have these specific screens, we'll use the standard ones with parameters
        // But the user asked for specific NavigateTo calls.
        // I'll assume onNavigate handles these or I'll map them to existing views.
        const viewMapping: Record<string, any> = {
          'PurchaseCashScreen': 'purchases',
          'PurchaseCreditScreen': 'purchases',
          'PurchaseReturnCashScreen': 'purchases',
          'PurchaseReturnCreditScreen': 'purchases',
          'SalesCashScreen': 'sales',
          'SalesCreditScreen': 'sales',
          'SalesReturnCashScreen': 'sales',
          'SalesReturnCreditScreen': 'sales'
        };

        setEditingInvoiceId(inv.id);
        onNavigate?.(viewMapping[targetView] || (inv.entityType === 'SALE' ? 'sales' : 'purchases'), { id: inv.id });
      }
    } catch (err: any) {
      addToast(err.message || "فشل إلغاء الترحيل", "error");
    }
  };

  const getPaymentStatusBadge = (inv: any, total: number) => {
    const paid = inv.paidAmount || 0;
    const status = inv.payment_status || (paid === 0 ? 'Unpaid' : paid < total ? 'Partially Paid' : 'Paid');
    
    switch(status) {
      case 'Unpaid': return <Badge variant="danger">غير مسددة</Badge>;
      case 'Partially Paid': return <Badge variant="warning">مسددة جزئياً</Badge>;
      case 'Paid': return <Badge variant="success">مسددة بالكامل</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 bg-[#F8FAFA] min-h-full pb-32 animate-in fade-in" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#1E4D4D] text-white rounded-[20px] flex items-center justify-center text-2xl shadow-xl">📦</div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[#1E4D4D]">أرشيف المستندات</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">إدارة سجلات العمليات والربط المالي</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate?.('sales')} className="bg-[#10B981] text-white px-5 py-2.5 rounded-xl font-black text-[10px] shadow-lg active:scale-95 transition-all flex items-center gap-2"><Plus size={14} /> مبيعات جديدة</button>
          <button onClick={() => onNavigate?.('purchases')} className="bg-[#1E4D4D] text-white px-5 py-2.5 rounded-xl font-black text-[10px] shadow-lg active:scale-95 transition-all flex items-center gap-2"><Plus size={14} /> مشتريات جديدة</button>
          <button onClick={() => onNavigate?.('dashboard')} className="w-10 h-10 bg-white border border-slate-200 text-[#1E4D4D] rounded-xl flex items-center justify-center shadow-sm">
             <Home size={20} />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 bg-white p-2 rounded-[24px] border border-slate-100 shadow-sm relative">
        <div className="relative flex-1 group">
          <input type="text" placeholder="البحث برقم الفاتورة، الطرف الثاني..." className="w-full bg-slate-50 border-2 border-transparent rounded-[18px] px-12 py-3.5 text-[11px] font-black focus:bg-white focus:border-[#1E4D4D] outline-none shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-5 py-3 rounded-[18px] text-[10px] font-black transition-all border ${showFilters ? 'bg-[#1E4D4D] text-white' : 'bg-slate-50 text-slate-500'}`}>
          <Filter size={14} /> فلترة
        </button>
      </div>

      {showFilters && (
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-300 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">نوع المستند</label>
              <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                {['ALL', 'SALE', 'PURCHASE'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setFilterType(t as any)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${filterType === t ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-400 hover:text-[#1E4D4D]'}`}
                  >
                    {t === 'ALL' ? 'الكل' : t === 'SALE' ? 'مبيعات' : 'مشتريات'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">ترتيب حسب</label>
              <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                {['date', 'total', 'id'].map(s => (
                  <button 
                    key={s}
                    onClick={() => {
                      if (sortBy === s) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy(s as any); setSortOrder('desc'); }
                    }}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${sortBy === s ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-400 hover:text-[#1E4D4D]'}`}
                  >
                    {s === 'date' ? 'التاريخ' : s === 'total' ? 'الإجمالي' : 'المرجع'}
                    {sortBy === s && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
        {filteredInvoices.map(inv => {
          const id = inv.entityType === 'SALE' ? (inv.SaleID || inv.id) : (inv.invoiceId || inv.purchase_id || inv.id);
          const total = finalTotals[id] || 0;
          const paid = inv.paidAmount || 0;
          const isFinancialLocked = inv.payment_status && inv.payment_status !== 'Unpaid';
          const invDate = inv.entityType === 'SALE' ? (inv.date || inv.Date) : inv.date;
          const isPeriodLocked = lockedInvoices[id] || false;
          const partner = inv.entityType === 'SALE' ? (inv.customerId || 'عميل نقدي') : (inv.partnerName || inv.partnerId);

          return (
            <Card key={id} onClick={() => handleOpenInvoice(inv)} className="hover:shadow-md transition-all cursor-pointer border-slate-100 !p-5 relative group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-xs">
                    {inv.entityType === 'SALE' ? '🛒' : '📦'}
                  </span>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-black text-[#1E4D4D] text-sm">{id}</span>
                      {(isFinancialLocked || isPeriodLocked) && (
                        <Lock size={10} className={isPeriodLocked ? "text-amber-500" : "text-red-400"} />
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-slate-400">{new Date(invDate).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
                {getPaymentStatusBadge(inv, total)}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">الطرف الثاني</p>
                    <p className="text-xs font-black text-slate-700 truncate max-w-[150px]">{partner}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5 text-left">الإجمالي</p>
                    <p className="text-sm font-black text-[#1E4D4D]">{total.toLocaleString()} <span className="text-[10px] opacity-40">{currency}</span></p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] font-black text-slate-400">المسدد: <span className="text-emerald-600">{paid.toLocaleString()}</span></span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleViewAudit(e, inv); }} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-[#1E4D4D] hover:text-white transition-colors"><Fingerprint size={14}/></button>
                    <button onClick={(e) => { e.stopPropagation(); handleOpenSettlements(e, inv); }} className="p-2 bg-slate-50 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"><History size={14}/></button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card noPadding className="hidden lg:block shadow-xl overflow-hidden !rounded-[40px] bg-white border-slate-100">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-[11px]">
            <thead className="bg-[#F8FAFA] text-slate-400 font-black border-b border-slate-50">
              <tr>
                <th className="px-8 py-5">المرجع</th>
                <th className="px-8 py-5">التاريخ</th>
                <th className="px-8 py-5">الطرف</th>
                <th className="px-8 py-5 text-center">الحالة</th>
                <th className="px-8 py-5 text-center">المسدد</th>
                <th className="px-8 py-5 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInvoices.map(inv => {
                const id = inv.entityType === 'SALE' ? (inv.SaleID || inv.id) : (inv.invoiceId || inv.purchase_id || inv.id);
                const total = finalTotals[id] || 0;
                const paid = inv.paidAmount || 0;
                const isFinancialLocked = inv.payment_status && inv.payment_status !== 'Unpaid';
                const invDate = inv.entityType === 'SALE' ? (inv.date || inv.Date) : inv.date;
                const isPeriodLocked = lockedInvoices[id] || false;
                const partner = inv.entityType === 'SALE' ? (inv.customerId || 'عميل نقدي') : (inv.partnerName || inv.partnerId);

                return (
                  <tr key={id} onClick={() => handleOpenInvoice(inv)} className="hover:bg-slate-50 cursor-pointer group">
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-2">
                          <span className="font-black text-[#1E4D4D]">{id}</span>
                          {(isFinancialLocked || isPeriodLocked) && (
                            <Lock size={12} className={isPeriodLocked ? "text-amber-500" : "text-red-400"} />
                          )}
                       </div>
                    </td>
                    <td className="px-8 py-5 font-bold text-slate-400">{new Date(invDate).toLocaleDateString('ar-SA')}</td>
                    <td className="px-8 py-5 font-black text-slate-600">{partner}</td>
                    <td className="px-8 py-5 text-center">
                       {getPaymentStatusBadge(inv, total)}
                    </td>
                    <td className="px-8 py-5 text-center">
                       <div className="flex flex-col items-center">
                          <span className={`font-black ${paid >= total ? 'text-emerald-500' : 'text-blue-500'}`}>{paid.toLocaleString()}</span>
                          <span className="text-[7px] font-bold opacity-30 uppercase">من {total.toLocaleString()}</span>
                       </div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          {inv.InvoiceStatus === 'POSTED' || inv.invoiceStatus === 'POSTED' ? (
                            <button onClick={(e) => handleUnpostAndEdit(e, inv)} className="w-9 h-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-indigo-500 hover:text-indigo-600 shadow-sm" title="إلغاء الترحيل والتعديل"><Edit3 size={16} /></button>
                          ) : (
                            <button onClick={(e) => handleOpenInvoice(inv)} className="w-9 h-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-emerald-500 hover:text-emerald-600 shadow-sm" title="تعديل"><Edit3 size={16} /></button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setTargetInvoice(inv); setIsAdjModalOpen(true); }} className={`w-9 h-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center transition-all ${isPeriodLocked && !isAdmin ? 'text-slate-200 cursor-not-allowed' : 'text-amber-500 hover:text-amber-600 shadow-sm'}`} title="تعديل مالي"><Tag size={16} /></button>
                          <button onClick={(e) => handleCancelInvoice(e, inv)} className={`w-9 h-9 bg-white border border-slate-100 rounded-xl flex items-center justify-center transition-all ${isPeriodLocked && !isAdmin ? 'text-slate-200 cursor-not-allowed' : 'text-red-300 hover:text-red-500 shadow-sm'}`} title="إلغاء المستند"><Ban size={16} /></button>
                          <button onClick={(e) => handleViewAudit(e, inv)} className="w-9 h-9 bg-white border border-slate-100 rounded-xl text-slate-900 flex items-center justify-center hover:bg-slate-900 hover:text-white" title="تاريخ التدقيق"><Fingerprint size={16}/></button>
                          <button onClick={(e) => handleOpenSettlements(e, inv)} className="w-9 h-9 bg-white border border-slate-100 rounded-xl text-blue-500 flex items-center justify-center hover:shadow-md" title="سجل الدفعات"><History size={16}/></button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isSettlementModalOpen} onClose={() => setIsSettlementModalOpen(false)} title="سجل سدادات الفاتورة">
         {targetInvoice && (
           <div className="space-y-6 py-2" dir="rtl">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي المستند</p>
                    <h3 className="text-lg font-black text-[#1E4D4D]">{finalTotals[targetInvoice.entityType === 'SALE' ? (targetInvoice.SaleID || targetInvoice.id) : (targetInvoice.invoiceId || targetInvoice.purchase_id || targetInvoice.id)]?.toLocaleString()} {currency}</h3>
                 </div>
                 {getPaymentStatusBadge(targetInvoice, finalTotals[targetInvoice.entityType === 'SALE' ? (targetInvoice.SaleID || targetInvoice.id) : (targetInvoice.invoiceId || targetInvoice.purchase_id || targetInvoice.id)] || 0)}
              </div>

              <div className="space-y-3">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">سجل الدفعات (Vouchers)</h4>
                 {settlementHistory.length === 0 ? (
                    <div className="py-10 text-center opacity-30 italic font-bold text-xs">لا توجد دفعات مرتبطة بهذا المستند حالياً</div>
                 ) : (
                    <div className="space-y-2">
                       {settlementHistory.map(s => (
                         <div key={s.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center"><Banknote size={14}/></div>
                               <div>
                                  <p className="font-black text-[#1E4D4D] text-xs">سند مالي رقم #{s.voucherId}</p>
                                  <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Clock size={8}/> {new Date(s.date).toLocaleDateString('ar-SA')}</p>
                               </div>
                            </div>
                            <span className="font-black text-emerald-600 text-sm">{s.amount.toLocaleString()}</span>
                         </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>
         )}
      </Modal>

      {targetInvoice && (
        <AdjustmentForm 
          isOpen={isAdjModalOpen}
          onClose={() => setIsAdjModalOpen(false)}
          invoiceId={targetInvoice.entityType === 'SALE' ? (targetInvoice.SaleID || targetInvoice.id) : (targetInvoice.invoiceId || targetInvoice.purchase_id || targetInvoice.id)}
          currency={currency}
          onSave={async (adj) => {
            const id = targetInvoice.entityType === 'SALE' ? (targetInvoice.SaleID || targetInvoice.id) : (targetInvoice.invoiceId || targetInvoice.purchase_id || targetInvoice.id);
            await AdjustmentRepository.save({ ...adj, AdjustmentID: db.generateId('ADJ'), InvoiceID: id });
            addToast("تمت إضافة التعديل المالي بنجاح ✅", "success");
            refreshGlobal();
          }}
        />
      )}
    </div>
  );
};

export default InvoicesArchiveModule;
