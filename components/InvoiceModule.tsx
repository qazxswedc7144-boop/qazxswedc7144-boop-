
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/database';
import { Sale, InvoiceHistory, Purchase } from '../types';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { useUI } from '../store/AppContext';
import { useAppStore } from '../store/useAppStore';
import { Button, Card, Badge, Modal } from './SharedUI';
import { Clock, User, ChevronRight, History, Archive, Edit3, Printer, Search, FileText, ArrowLeftRight, Ban } from 'lucide-react';

interface InvoiceModuleProps {
  lang: 'en' | 'ar';
  onNavigate?: (view: any) => void;
}

const InvoiceModule: React.FC<InvoiceModuleProps> = ({ lang, onNavigate }) => {
  const isAr = lang === 'ar';
  const { currency, version, addToast, refreshGlobal } = useUI();
  const setEditingInvoiceId = useAppStore(s => s.setEditingInvoiceId);
  const [activeTab, setActiveTab] = useState<'recent' | 'saved' | 'archive'>('recent');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [purchaseList, setPurchaseList] = useState<Purchase[]>([]);
  const [combinedRecent, setCombinedRecent] = useState<any[]>([]);
  
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [currentHistory, setCurrentHistory] = useState<InvoiceHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fix: Data loading now awaits async repository calls
  const loadData = useCallback(async () => {
    if (activeTab === 'archive') {
      const sales = await InvoiceRepository.getArchiveSales();
      const purchases = await InvoiceRepository.getArchivePurchases();
      setSalesList(sales);
      setPurchaseList(purchases);
      setCombinedRecent([]);
    } else if (activeTab === 'saved') {
      const saved = await InvoiceRepository.getSavedInvoices();
      setSalesList(saved);
      setPurchaseList([]);
      setCombinedRecent([]);
    } else {
      const recent = await InvoiceRepository.getRecentInvoices();
      setCombinedRecent(recent);
      setSalesList([]);
      setPurchaseList([]);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData, version]);

  const combinedList = useMemo(() => {
    let list: any[] = [];
    
    if (activeTab === 'recent') {
      list = combinedRecent.map(item => ({
        ...item,
        displayId: item.SaleID || item.invoiceId || item.purchase_id,
        displayTotal: item.FinalTotal || item.totalAmount || 0,
        displayPartner: item.customerId || item.partnerName || 'عميل نقدي'
      }));
    } else {
      list = [
        ...salesList.map(s => ({ ...s, entityType: 'SALE', displayId: s.SaleID, displayTotal: s.FinalTotal, displayPartner: s.customerId || 'عميل نقدي' })),
        ...purchaseList.map(p => ({ ...p, entityType: 'PURCHASE', displayId: p.invoiceId, displayTotal: p.totalAmount, displayPartner: p.partnerName }))
      ];
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(item => 
        item.displayId?.toLowerCase().includes(term) || 
        item.displayPartner?.toLowerCase().includes(term)
      );
    }

    return list.sort((a,b) => {
      const dateA = new Date(a.date || a.Date).getTime();
      const dateB = new Date(b.date || b.Date).getTime();
      return dateB - dateA;
    });
  }, [salesList, purchaseList, combinedRecent, searchTerm, activeTab]);

  const handleOpenForEdit = (item: any) => {
    const recordId = item.id || item.SaleID || item.invoiceId || item.purchase_id;
    setEditingInvoiceId(recordId);
    onNavigate?.(item.entityType === 'SALE' ? 'sales' : 'purchases');
  };

  const handleCancelInvoice = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (item.InvoiceStatus === 'CANCELLED' || item.invoiceStatus === 'CANCELLED') return;
    if (!confirm(isAr ? "هل أنت متأكد من إلغاء هذا المستند؟ سيتم قفله ومنع التعديل عليه." : "Are you sure? This will lock the document.")) return;
    
    try {
      const recordId = item.id || item.SaleID || item.invoiceId || item.purchase_id;
      if (item.entityType === 'SALE') {
        const sales = await db.getSales();
        const sale = sales.find(s => s.id === recordId || s.SaleID === recordId);
        // Fix: Corrected arguments for db.persist (Error line 102)
        if (sale) { sale.InvoiceStatus = 'CANCELLED'; await db.persist('sales', sales); }
      } else {
        const purchases = await db.getPurchases();
        const purchase = purchases.find(p => p.id === recordId || p.purchase_id === recordId);
        // Fix: Corrected arguments for db.persist (Error line 106)
        if (purchase) { purchase.invoiceStatus = 'CANCELLED'; await db.persist('purchases', purchases); }
      }
      addToast(isAr ? "تم إلغاء المستند بنجاح" : "Invoice Cancelled", "success");
      refreshGlobal();
    } catch (err) { addToast("Error cancelling", "error"); }
  };

  const handlePrint = (e: React.MouseEvent, item: any) => {
    e.stopPropagation(); 
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html lang="ar" dir="rtl">
          <head>
            <title>طباعة مستند - PharmaFlow</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
            <style>body { font-family: 'Cairo', sans-serif; padding: 1.5cm; }</style>
          </head>
          <body>
            <div class="border-b-4 border-[#1E4D4D] pb-6 mb-8 flex justify-between items-center">
               <h1 class="text-3xl font-black text-[#1E4D4D]">PharmaFlow</h1>
               <div class="text-left text-xs font-bold text-slate-400">تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</div>
            </div>
            ${item.InvoiceStatus === 'CANCELLED' || item.invoiceStatus === 'CANCELLED' ? '<div class="text-center mb-8"><span class="text-4xl font-black text-red-500 border-8 border-red-500 px-10 py-2 rounded-full uppercase opacity-30">Cancelled - ملغاة</span></div>' : ''}
            <div class="grid grid-cols-2 gap-8 mb-10">
               <div class="space-y-1">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">نوع المستند</p>
                  <p class="text-xl font-black text-[#1E4D4D]">فاتورة ${item.entityType === 'SALE' ? 'مبيعات' : 'مشتريات'}</p>
               </div>
               <div class="space-y-1 text-left">
                  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">المرجع</p>
                  <p class="text-xl font-black text-[#1E4D4D]">#${item.displayId}</p>
               </div>
            </div>
            <table class="w-full text-right border-collapse">
               <thead>
                  <tr class="bg-slate-50 border-y-2 border-slate-200">
                     <th class="py-4 px-2 text-xs font-black">الصنف</th>
                     <th class="py-4 px-2 text-center text-xs font-black">الكمية</th>
                     <th class="py-4 px-2 text-left text-xs font-black">المجموع</th>
                  </tr>
               </thead>
               <tbody>
                  ${(item.items || [])?.map((it: any) => `
                    <tr class="border-b border-slate-100">
                       <td class="py-4 px-2 text-sm font-bold text-slate-700">${it.name}</td>
                       <td class="py-4 px-2 text-center text-sm font-bold text-slate-50">${it.qty}</td>
                       <td class="py-4 px-2 text-left text-sm font-black text-[#1E4D4D]">${it.sum.toLocaleString()} ${currency}</td>
                    </tr>
                  `).join('')}
               </tbody>
            </table>
            <div class="mt-8 flex justify-end">
               <div class="bg-[#F8FAFA] p-6 rounded-3xl border-2 border-slate-100 min-w-[250px]">
                  <div class="flex justify-between items-center">
                     <span class="text-xs font-black text-slate-400 uppercase">الإجمالي النهائي</span>
                     <span class="text-2xl font-black text-[#1E4D4D]">${item.displayTotal.toLocaleString()} ${currency}</span>
                  </div>
               </div>
            </div>
            <script>window.onload = () => { window.print(); window.close(); };</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const viewHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    setHistoryLoading(true);
    db.getInvoiceHistory(id).then(history => {
      setCurrentHistory(history.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setHistoryModalOpen(true);
      setHistoryLoading(false);
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 bg-[#F8FAFA] min-h-full pb-32 animate-in fade-in duration-500" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white text-[#1E4D4D] border-2 border-slate-100 rounded-[24px] flex items-center justify-center text-3xl shadow-sm">📑</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-[#1E4D4D] tracking-tight">{isAr ? 'أرشيف السجلات' : 'Invoices Archive'}</h2>
            <p className="text-slate-400 text-sm font-bold">{isAr ? 'إدارة ومراجعة السجلات المالية والمحفوظات' : 'Manage and review financial records'}</p>
          </div>
        </div>
        <button onClick={() => onNavigate?.('dashboard')} className="bg-white border border-slate-200 text-[#1E4D4D] px-8 py-4 rounded-[22px] text-xs font-black flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95">🏠 {isAr ? 'الرئيسية' : 'Home'}</button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-2 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex p-1 bg-slate-50 rounded-[26px] w-fit overflow-x-auto no-scrollbar gap-1">
          <button onClick={() => setActiveTab('recent')} className={`px-8 py-3 rounded-2xl text-[11px] font-black transition-all whitespace-nowrap ${activeTab === 'recent' ? 'bg-white text-[#1E4D4D] shadow-md' : 'text-slate-400 hover:text-[#1E4D4D]'}`}>{isAr ? 'آخر 90 يوماً' : 'Recent (90 Days)'}</button>
          <button onClick={() => setActiveTab('archive')} className={`px-8 py-3 rounded-2xl text-[11px] font-black transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'archive' ? 'bg-white text-[#1E4D4D] shadow-md' : 'text-slate-400 hover:text-[#1E4D4D]'}`}><Archive size={14}/> {isAr ? 'الأرشيف العام' : 'General Archive'}</button>
          <button onClick={() => setActiveTab('saved')} className={`px-8 py-3 rounded-2xl text-[11px] font-black transition-all whitespace-nowrap ${activeTab === 'saved' ? 'bg-white text-[#1E4D4D] shadow-md' : 'text-slate-400 hover:text-[#1E4D4D]'}`}>{isAr ? 'المحفوظة' : 'Saved'}</button>
        </div>

        <div className="relative w-full md:w-80 group px-2">
          <input type="text" placeholder={isAr ? "بحث بالرقم أو اسم الطرف..." : "Search by number or partner..."} className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-12 py-3 text-[11px] font-black focus:bg-white focus:border-[#1E4D4D] shadow-inner transition-all outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Search size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1E4D4D] transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
           {combinedList.map(item => (
              <div 
                key={item.id} 
                onClick={() => handleOpenForEdit(item)}
                className={`p-8 rounded-[44px] border-4 transition-all relative group cursor-pointer ${
                  (item.InvoiceStatus === 'CANCELLED' || item.invoiceStatus === 'CANCELLED') ? 'border-red-100 bg-red-50/20 grayscale-[0.5]' :
                  item.InvoiceStatus === 'PENDING' ? 'border-amber-100 bg-amber-50/30 hover:border-amber-300' : 'border-slate-50 bg-white hover:border-[#1E4D4D]/20 hover:shadow-2xl'
                }`}
              >
                 <div className="flex justify-between items-start mb-6">
                   <div>
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">REF: #{item.displayId}</p>
                     <Badge variant={item.entityType === 'SALE' ? 'success' : 'info'}>{item.entityType === 'SALE' ? 'مبيعات' : 'مشتريات'}</Badge>
                   </div>
                   <div className="flex gap-2">
                     {item.InvoiceStatus !== 'CANCELLED' && item.invoiceStatus !== 'CANCELLED' && (
                       <button onClick={(e) => handleCancelInvoice(e, item)} className="w-10 h-10 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-red-300 hover:text-red-500 transition-all shadow-sm" title={isAr ? "إلغاء المستند" : "Cancel Invoice"}><Ban size={16} /></button>
                     )}
                     <button onClick={(e) => { e.stopPropagation(); viewHistory(e, item.displayId); }} className="w-10 h-10 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-[#1E4D4D] transition-all shadow-sm"><History size={16} /></button>
                   </div>
                 </div>
                 
                 <h4 className="text-2xl font-black text-[#1E4D4D] mb-1">{item.displayTotal.toLocaleString()} <span className="text-xs font-bold opacity-30 tracking-tight uppercase">{currency}</span></h4>
                 <p className="text-sm font-black text-slate-500 truncate mb-6">{item.displayPartner}</p>
                 
                 <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-2">
                    <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5"><Clock size={12} /> {new Date(item.date || item.Date).toLocaleDateString('ar-SA')}</span>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                      (item.InvoiceStatus === 'CANCELLED' || item.invoiceStatus === 'CANCELLED') ? 'bg-red-100 text-red-700' :
                      item.InvoiceStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                       {(item.InvoiceStatus === 'CANCELLED' || item.invoiceStatus === 'CANCELLED') ? (isAr ? "🚫 ملغية" : "Cancelled") :
                        item.InvoiceStatus === 'PENDING' ? (isAr ? "📁 محفوظة" : "Saved") : (isAr ? "✅ مرحلة" : "Posted")}
                    </span>
                 </div>
              </div>
           ))}
           {combinedList.length === 0 && (
             <div className="col-span-full py-32 text-center text-slate-300 italic font-black text-sm uppercase tracking-[4px] opacity-40">No Records Found</div>
           )}
        </div>

      <Modal isOpen={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title={isAr ? "سجل تدقيق المستند" : "Document Audit Log"}>
         <div className="space-y-6 py-2" dir="rtl">
            {historyLoading ? (<div className="p-16 text-center animate-pulse"><div className="w-12 h-12 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Scanning...</p></div>) : currentHistory.length === 0 ? (<div className="p-16 text-center space-y-4"><div className="text-5xl opacity-10">📂</div><p className="text-xs font-black text-slate-300 italic">No audit records found.</p></div>) : (
               <div className="relative border-r-4 border-slate-50 pr-8 space-y-10">
                  {currentHistory.map((entry, idx) => (
                     <div key={entry.id || idx} className="relative">
                        <div className="absolute -right-[42px] top-1 w-5 h-5 rounded-full bg-white border-4 border-[#1E4D4D] shadow-md z-10"></div>
                        <div className="bg-[#F8FAFA] p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                           <div className="flex justify-between items-start mb-3">
                              <Badge variant={entry.action === 'POSTED' ? 'success' : 'info'}>{entry.action === 'POSTED' ? (isAr ? 'ترحيل نهائي' : 'Posted') : (isAr ? 'تعديل' : 'Updated')}</Badge>
                              <span className="text-[10px] font-black text-slate-300">{new Date(entry.timestamp).toLocaleString('ar-SA')}</span>
                           </div>
                           <p className="text-xs font-bold text-[#1E4D4D] leading-relaxed mb-4">{entry.details}</p>
                           <div className="flex items-center gap-3 pt-4 border-t border-white"><div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-inner"><User size={14} className="text-slate-400" /></div><div><p className="text-[10px] font-black text-slate-500">{entry.userName}</p><p className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Authorized User</p></div></div>
                        </div>
                     </div>
                  ))}
               </div>
            )}
            <div className="pt-6"><Button onClick={() => setHistoryModalOpen(false)} variant="secondary" className="w-full !rounded-[24px] h-14 font-black">إغلاق النافذة</Button></div>
         </div>
      </Modal>
    </div>
  );
};

export default InvoiceModule;
