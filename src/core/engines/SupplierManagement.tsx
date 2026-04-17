
import React, { useState, useMemo, useEffect } from 'react';
import { Supplier, SupplierLedgerEntry } from '@/types';
import { db } from '@/services/database';
import { SupplierRepository } from '@/repositories/SupplierRepository';
import { useAccounting, useUI } from '@/store/AppContext';
import { 
  ChevronDown, ChevronUp, Phone, ArrowLeftRight, Search, Plus, ExternalLink, 
  ArrowRight, MapPin, Filter, Calendar, Link as LinkIcon, TrendingUp,
  Users, Truck, ShoppingBag, ArrowLeft, MoreHorizontal, Save, X, Home,
  FileText, Wallet, CreditCard
} from 'lucide-react';
import { Badge, Card, Button, Modal } from '@/components/SharedUI';
import { motion, AnimatePresence } from 'motion/react';

interface SupplierManagementProps {
  lang: 'en' | 'ar';
  onNavigate?: (view: any) => void;
}

type PartnerType = 'supplier' | 'customer';

const SupplierManagement: React.FC<SupplierManagementProps> = ({ lang, onNavigate }) => {
  const isAr = lang === 'ar';
  const { suppliers, customers } = useAccounting();
  const { refreshGlobal, addToast, currency, version } = useUI();
  const [partnerType, setPartnerType] = useState<PartnerType>('supplier');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [newPartner, setNewPartner] = useState({ name: '', phone: '', address: '', openingBalance: 0 });
  const [partnerBalances, setPartnerBalances] = useState<Record<string, number>>({});
  
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const fetchBalances = async () => {
      const list = partnerType === 'supplier' ? suppliers : customers;
      const balances: Record<string, number> = {};
      for (const p of list) {
        balances[p.Supplier_ID] = await SupplierRepository.getPartnerBalance(p.Supplier_ID, partnerType === 'supplier' ? 'S' : 'C');
      }
      setPartnerBalances(balances);
    };
    fetchBalances();
  }, [suppliers, customers, partnerType, version]);

  const t = {
    en: {
      title: 'Financial Directory',
      suppliers: 'Suppliers',
      customers: 'Customers',
      addSupplier: 'New Supplier',
      addCustomer: 'New Customer',
      viewDetails: 'Account Ledger',
      hideDetails: 'Close Ledger',
      total: partnerType === 'supplier' ? 'Total Payable' : 'Total Receivable',
      date: 'Date',
      description: 'Transaction Detail',
      debit: 'Debit (-)',
      credit: 'Credit (+)',
      balance: 'Running Balance',
      search: 'Search by name or phone...'
    },
    ar: {
      title: 'دليل الشركاء المالي',
      suppliers: 'الموردون',
      customers: 'العملاء',
      addSupplier: 'إضافة مورد',
      addCustomer: 'إضافة عميل',
      viewDetails: 'كشف الحساب',
      hideDetails: 'إغلاق الكشف',
      total: partnerType === 'supplier' ? 'المستحقات (له)' : 'المديونية (عليه)',
      date: 'التاريخ',
      description: 'تفاصيل العملية',
      debit: 'مدين',
      credit: 'دائن',
      balance: 'الرصيد التراكمي',
      search: 'بحث بالاسم أو الهاتف...'
    }
  }[lang];

  const partners = useMemo(() => {
    const list = partnerType === 'supplier' ? suppliers : customers;
    if (!debouncedSearch.trim()) return list;
    const term = debouncedSearch.toLowerCase();
    return list.filter(p => 
      p.Supplier_Name.toLowerCase().includes(term) || 
      (p.Phone && p.Phone.includes(debouncedSearch))
    );
  }, [suppliers, customers, partnerType, debouncedSearch]);

  const handleSave = async () => {
    if (!newPartner.name.trim()) {
      addToast(isAr ? 'يرجى إدخل اسم الشريك ⚠️' : 'Enter name ⚠️', 'warning');
      return;
    }

    try {
      const id = `${partnerType === 'supplier' ? 'S' : 'C'}-${Date.now()}`;
      const p: Supplier = {
        id,
        Supplier_ID: id,
        Supplier_Name: newPartner.name.trim(),
        Phone: newPartner.phone.trim(),
        Address: newPartner.address.trim(),
        Balance: newPartner.openingBalance,
        openingBalance: newPartner.openingBalance,
        purchaseHistory: []
      };
      if (partnerType === 'supplier') await db.saveSupplier(p);
      else await db.saveCustomer(p);
      addToast(isAr ? 'تم الحفظ بنجاح ✅' : 'Saved ✅', 'success');
      refreshGlobal();
      setIsModalOpen(false);
      setNewPartner({ name: '', phone: '', address: '', openingBalance: 0 });
    } catch (error) {
      addToast(isAr ? 'خطأ في الحفظ ❌' : 'Save Error ❌', 'error');
    }
  };

  const loadLedger = async (partnerId: string) => {
    const data = await SupplierRepository.getLedger(partnerId, dateRange.start, dateRange.end);
    setLedgerData(data);
  };

  const toggleExpand = async (partnerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedId === partnerId) {
      setExpandedId(null);
    } else {
      setExpandedId(partnerId);
      await loadLedger(partnerId);
    }
  };

  useEffect(() => {
    if (expandedId) {
      loadLedger(expandedId);
    }
  }, [dateRange, expandedId]);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFA] font-['Cairo'] overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Modern Header */}
      <header className="p-10 pb-6 shrink-0 bg-white border-b border-slate-100 z-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
          <div className="flex items-center gap-8">
            <div className={`w-20 h-20 rounded-[32px] flex items-center justify-center shadow-2xl shadow-emerald-900/40 ${partnerType === 'supplier' ? 'bg-[#1E4D4D] text-white' : 'bg-blue-600 text-white'}`}>
              {partnerType === 'supplier' ? <Truck size={36} /> : <Users size={36} />}
            </div>
            <div>
              <h2 className="text-4xl font-black text-[#1E4D4D] tracking-tighter leading-none">{t.title}</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-[4px] mt-3 opacity-60">Financial Partners Directory</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsModalOpen(true)}
              className={`h-14 px-8 text-white rounded-[20px] flex items-center gap-3 text-sm font-black shadow-xl transition-all hover:scale-105 ${partnerType === 'supplier' ? 'bg-[#1E4D4D] shadow-emerald-900/20' : 'bg-blue-600 shadow-blue-900/20'}`}
            >
              <Plus size={20} />
              <span>{partnerType === 'supplier' ? t.addSupplier : t.addCustomer}</span>
            </button>
            <button 
              onClick={() => onNavigate?.('dashboard')}
              className="w-14 h-14 bg-slate-50 text-slate-400 rounded-[20px] flex items-center justify-center hover:bg-slate-100 transition-all"
            >
              <Home size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative flex-1">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
            <input 
              className="w-full h-16 bg-slate-50 border border-slate-100 rounded-[24px] pr-16 pl-6 text-sm font-black focus:bg-white focus:border-[#1E4D4D] outline-none shadow-inner transition-all" 
              placeholder={t.search} 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[24px] border border-slate-100">
            <button 
              onClick={() => setPartnerType('supplier')}
              className={`px-8 h-12 rounded-[18px] text-[11px] font-black transition-all flex items-center gap-2 ${partnerType === 'supplier' ? 'bg-[#1E4D4D] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Truck size={14} /> {t.suppliers}
            </button>
            <button 
              onClick={() => setPartnerType('customer')}
              className={`px-8 h-12 rounded-[18px] text-[11px] font-black transition-all flex items-center gap-2 ${partnerType === 'customer' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Users size={14} /> {t.customers}
            </button>
          </div>
        </div>
      </header>

      {/* Partners List */}
      <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {partners.map(p => {
            const isExpanded = expandedId === p.Supplier_ID;
            const balance = partnerBalances[p.Supplier_ID] || 0;
            
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={p.Supplier_ID} 
                className={`bg-white border transition-all duration-500 overflow-hidden ${isExpanded ? 'rounded-[48px] border-[#1E4D4D]/20 shadow-2xl' : 'rounded-[40px] border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200'}`}
              >
                <div className="p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="flex items-center gap-8 flex-1">
                     <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-4xl shadow-inner ${partnerType === 'supplier' ? 'bg-emerald-50 text-[#1E4D4D]' : 'bg-blue-50 text-[#2563EB]'}`}> 
                       {partnerType === 'supplier' ? '🚛' : '🛍️'} 
                     </div>
                     <div className="min-w-0">
                        <h3 className={`text-2xl font-black truncate leading-none mb-3 ${partnerType === 'supplier' ? 'text-[#1E4D4D]' : 'text-[#2563EB]'}`}>{p.Supplier_Name}</h3>
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="flex items-center gap-2 text-[11px] font-bold text-slate-400 bg-slate-50 px-4 py-1.5 rounded-full"><Phone size={14} /> {p.Phone || '---'}</span>
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ID: {p.Supplier_ID.split('-')[0]}</span>
                          {p.Address && <span className="flex items-center gap-2 text-[11px] font-bold text-slate-400"><MapPin size={14} /> {p.Address}</span>}
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center gap-10 lg:border-r border-slate-100 lg:pr-10">
                     <div className="text-center lg:text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">{t.total}</p>
                        <p className={`text-3xl font-black leading-none ${balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {Math.abs(balance).toLocaleString()} <span className="text-sm opacity-40 font-bold">{currency}</span>
                        </p>
                     </div>
                     
                     <button 
                      onClick={(e) => toggleExpand(p.Supplier_ID, e)} 
                      className={`h-14 px-8 rounded-2xl text-xs font-black transition-all flex items-center gap-3 ${isExpanded ? 'bg-slate-100 text-slate-600' : `${partnerType === 'supplier' ? 'bg-[#1E4D4D]' : 'bg-blue-600'} text-white shadow-xl hover:-translate-y-1`}`}
                     >
                       {isExpanded ? <ChevronUp size={20} /> : <FileText size={20} />}
                       {isExpanded ? t.hideDetails : t.viewDetails}
                     </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-50 bg-[#FBFDFD] overflow-hidden"
                    >
                       <div className="p-10 space-y-10">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                             <div className="flex items-center gap-4">
                                <TrendingUp size={24} className="text-[#1E4D4D] opacity-30" />
                                <h4 className="text-base font-black text-[#1E4D4D] uppercase tracking-[3px]">{isAr ? 'كشف الحساب التفصيلي' : 'Detailed Account Statement'}</h4>
                             </div>
                             <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 px-4">
                                   <Calendar size={16} className="text-slate-400" />
                                   <input type="date" className="text-xs font-black outline-none bg-transparent" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                                </div>
                                <span className="text-slate-200">|</span>
                                <div className="flex items-center gap-3 px-4">
                                   <input type="date" className="text-xs font-black outline-none bg-transparent" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                                </div>
                             </div>
                          </div>

                          <div className="bg-white border border-slate-100 shadow-xl overflow-hidden rounded-[40px]">
                            <div className="overflow-x-auto custom-scrollbar">
                              <table className="w-full text-right">
                                <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                  <tr>
                                    <th className="py-6 px-10">{t.date}</th>
                                    <th className="py-6 px-10">{t.description}</th>
                                    <th className="py-6 px-10 text-center">{t.debit}</th>
                                    <th className="py-6 px-10 text-center">{t.credit}</th>
                                    <th className="py-6 px-10 text-left bg-emerald-50/30">{t.balance}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {ledgerData.length > 0 ? ledgerData.map((entry, idx) => (
                                    <tr key={entry.id || idx} className="hover:bg-slate-50/50 transition-all group">
                                      <td className="py-6 px-10 text-xs font-bold text-slate-400 whitespace-nowrap">{new Date(entry.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB')}</td>
                                      <td className="py-6 px-10 min-w-[300px]">
                                         <p className="text-sm font-black text-[#1E4D4D]">{entry.description}</p>
                                         <div className="flex items-center gap-3 mt-2">
                                            <Badge variant="neutral" className="!rounded-full px-3 py-0.5 text-[9px] font-black">#{entry.referenceId}</Badge>
                                            {entry.linkedInvoices && (
                                              <div className="flex items-center gap-2">
                                                 <LinkIcon size={12} className="text-blue-500" />
                                                 <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-0.5 rounded-full">
                                                   {isAr ? `يغطي: ${entry.linkedInvoices}` : `Covers: ${entry.linkedInvoices}`}
                                                 </span>
                                              </div>
                                            )}
                                         </div>
                                      </td>
                                      <td className="py-6 px-10 text-center text-sm text-red-500 font-black">{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</td>
                                      <td className="py-6 px-10 text-center text-sm text-emerald-600 font-black">{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</td>
                                      <td className={`py-6 px-10 text-left font-black text-lg bg-emerald-50/10 ${entry.runningBalance >= 0 ? 'text-[#1E4D4D]' : 'text-red-600'}`}>
                                        {Math.abs(entry.runningBalance || 0).toLocaleString()} <span className="text-xs font-normal opacity-30">{currency}</span>
                                      </td>
                                    </tr>
                                  )) : (
                                    <tr>
                                      <td colSpan={5} className="py-32 text-center">
                                        <div className="flex flex-col items-center opacity-20">
                                          <FileText size={64} className="mb-4" />
                                          <p className="text-sm font-black uppercase tracking-[4px]">لا توجد عمليات مسجلة</p>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add Partner Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={partnerType === 'supplier' ? t.addSupplier : t.addCustomer}>
         <div className="p-8 space-y-8" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{isAr ? 'اسم الشريك' : 'Partner Name'}</label>
               <input 
                 className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-black focus:bg-white focus:border-emerald-500 outline-none transition-all" 
                 placeholder={isAr ? 'مثال: شركة الأدوية المتحدة' : 'e.g. United Pharma Co.'} 
                 value={newPartner.name} 
                 onChange={e => setNewPartner({...newPartner, name: e.target.value})} 
               />
            </div>
            <div className="grid grid-cols-2 gap-8">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{isAr ? 'رقم الهاتف' : 'Phone Number'}</label>
                  <input 
                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-black focus:bg-white focus:border-emerald-500 outline-none transition-all" 
                    placeholder="05..." 
                    value={newPartner.phone} 
                    onChange={e => setNewPartner({...newPartner, phone: e.target.value})} 
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{isAr ? 'الرصيد الافتتاحي' : 'Opening Balance'}</label>
                  <input 
                    type="number"
                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-black focus:bg-white focus:border-emerald-500 outline-none transition-all" 
                    placeholder="0.00" 
                    value={newPartner.openingBalance || ''} 
                    onChange={e => setNewPartner({...newPartner, openingBalance: parseFloat(e.target.value) || 0})} 
                  />
               </div>
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{isAr ? 'العنوان' : 'Address'}</label>
               <textarea 
                 className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 text-xs font-bold h-32 outline-none focus:bg-white focus:border-emerald-500 transition-all" 
                 placeholder={isAr ? 'العنوان التفصيلي...' : 'Detailed address...'} 
                 value={newPartner.address} 
                 onChange={e => setNewPartner({...newPartner, address: e.target.value})} 
               />
            </div>
            <div className="flex gap-4 pt-4">
              <Button 
                variant="neutral" 
                className="flex-1 !rounded-2xl" 
                onClick={() => setIsModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button 
                variant="approve" 
                className="flex-[2] !rounded-2xl shadow-xl shadow-emerald-900/20" 
                onClick={handleSave}
              >
                <Save size={20} className="ml-2" />
                {isAr ? 'حفظ بيانات الشريك' : 'Save Partner Data'}
              </Button>
            </div>
         </div>
      </Modal>
    </div>
  );
};

export default SupplierManagement;
