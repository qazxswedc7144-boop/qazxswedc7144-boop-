
import React, { useState, useMemo, useEffect } from 'react';
import { AdjustmentRepository } from '../repositories/AdjustmentRepository';
import { useUI } from '../store/AppContext';
import { useAppStore } from '../store/useAppStore';
import { Card, Badge, Button } from '../components/SharedUI';
import { Search, Tag, Wallet, Scale, ArrowRight, Filter, ChevronRight, FileText, Trash2 } from 'lucide-react';
import { InvoiceAdjustment } from '../types';

interface AdjustmentsArchiveModuleProps {
  onNavigate?: (view: any) => void;
}

/**
 * View Name: Adjustments Registry
 * Source Table: Invoice_Adjustments
 */
const AdjustmentsArchiveModule: React.FC<AdjustmentsArchiveModuleProps> = ({ onNavigate }) => {
  const { currency, version, refreshGlobal, addToast } = useUI();
  const setEditingInvoiceId = useAppStore(state => state.setEditingInvoiceId);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustments, setAdjustments] = useState<InvoiceAdjustment[]>([]);
  const [summary, setSummary] = useState({ totalDiscounts: 0, totalFees: 0, totalTaxes: 0, netImpact: 0, count: 0 });
  const [filterType, setFilterType] = useState<'ALL' | 'Discount' | 'Additional Fee' | 'Tax Adjustment'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [data, sum] = await Promise.all([
          AdjustmentRepository.getAll(),
          AdjustmentRepository.getSummary()
        ]);
        setAdjustments(data);
        setSummary(sum);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [version]);

  const filteredAdjustments = useMemo(() => {
    let list = [...adjustments];
    if (filterType !== 'ALL') {
      list = list.filter(a => a.Type === filterType);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(a => 
        a.InvoiceID.toLowerCase().includes(term) || 
        (a.Note && a.Note.toLowerCase().includes(term))
      );
    }
    return list.sort((a, b) => new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime());
  }, [adjustments, searchTerm, filterType]);

  const handleGoToInvoice = (invoiceId: string) => {
    setEditingInvoiceId(invoiceId);
    const view = invoiceId.startsWith('SALE') || invoiceId.startsWith('INV') ? 'sales' : 'purchases';
    onNavigate?.(view);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("هل أنت متأكد من حذف هذا التعديل المالي؟")) {
      await AdjustmentRepository.delete(id);
      addToast("تم حذف التعديل بنجاح", "success");
      refreshGlobal();
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'Discount': return 'danger';
      case 'Tax Adjustment': return 'info';
      default: return 'success';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'Discount': return 'خصم مالي';
      case 'Tax Adjustment': return 'تسوية ضريبية';
      default: return 'رسوم إضافية';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Discount': return <Tag size={18}/>;
      case 'Tax Adjustment': return <Scale size={18}/>;
      default: return <Wallet size={18}/>;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Discount': return 'bg-red-50 text-red-600';
      case 'Tax Adjustment': return 'bg-blue-50 text-blue-600';
      default: return 'bg-emerald-50 text-emerald-600';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-20">
        <div className="w-10 h-10 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 bg-[#F8FAFA] min-h-full pb-32 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#1E4D4D] text-white rounded-[24px] flex items-center justify-center text-3xl shadow-xl">🏷️</div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-[#1E4D4D] tracking-tight">سجل الرسوم والخصومات</h2>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">إدارة الضرائب، الرسوم، والخصومات المالية</p>
          </div>
        </div>
        <button onClick={() => onNavigate?.('dashboard')} className="bg-white border border-slate-200 text-[#1E4D4D] px-8 py-4 rounded-[22px] text-xs font-black flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95">🏠 الرئيسية</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <Card className="border-r-8 border-red-500 !p-5 flex flex-col justify-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">الخصومات</p>
            <h3 className="text-xl font-black text-red-600">{(summary.totalDiscounts || 0).toLocaleString()} <span className="text-[10px] opacity-40 font-bold">{currency}</span></h3>
         </Card>
         <Card className="border-r-8 border-emerald-500 !p-5 flex flex-col justify-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">الرسوم</p>
            <h3 className="text-xl font-black text-emerald-600">{(summary.totalFees || 0).toLocaleString()} <span className="text-[10px] opacity-40 font-bold">{currency}</span></h3>
         </Card>
         <Card className="border-r-8 border-blue-600 !p-5 flex flex-col justify-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">الضرائب</p>
            <h3 className="text-xl font-black text-blue-600">{(summary.totalTaxes || 0).toLocaleString()} <span className="text-[10px] opacity-40 font-bold">{currency}</span></h3>
         </Card>
         <Card className="border-r-8 border-slate-800 !p-5 flex flex-col justify-center bg-slate-50">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">صافي الأثر</p>
            <h3 className={`text-xl font-black ${(summary.netImpact || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {(summary.netImpact || 0).toLocaleString()} <span className="text-[10px] opacity-40 font-bold">{currency}</span>
            </h3>
         </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-3 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 shadow-inner overflow-x-auto no-scrollbar">
           <button onClick={() => setFilterType('ALL')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${filterType === 'ALL' ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-400'}`}>الكل</button>
           <button onClick={() => setFilterType('Discount')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${filterType === 'Discount' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400'}`}>الخصومات</button>
           <button onClick={() => setFilterType('Additional Fee')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${filterType === 'Additional Fee' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}>الرسوم</button>
           <button onClick={() => setFilterType('Tax Adjustment')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${filterType === 'Tax Adjustment' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>الضرائب</button>
        </div>

        <div className="relative w-full md:w-80 group px-2">
          <input 
            type="text" 
            placeholder="بحث برقم الفاتورة أو البيان..." 
            className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-12 py-3.5 text-[11px] font-black focus:bg-white focus:border-[#1E4D4D] outline-none shadow-inner transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1E4D4D] transition-colors" />
        </div>
      </div>

      <Card noPadding className="shadow-2xl border-slate-100 overflow-hidden !rounded-[40px] animate-in slide-in-from-bottom-4 duration-700 bg-white">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-[11px]">
            <thead className="bg-[#F8FAFA] text-slate-400 font-black uppercase border-b-2 border-slate-100">
              <tr>
                <th className="px-8 py-6">المرجع (Invoice)</th>
                <th className="px-8 py-6">نوع التعديل</th>
                <th className="px-8 py-6">البيان / الملاحظة</th>
                <th className="px-8 py-6 text-center">القيمة</th>
                <th className="px-8 py-6 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-32 text-center text-slate-300 italic font-black text-sm uppercase tracking-[4px] opacity-40">No Adjustments Found</td>
                </tr>
              ) : filteredAdjustments.map((adj, idx) => {
                const isDiscount = adj.Type === 'Discount';

                return (
                  <tr 
                    key={adj.AdjustmentID || idx} 
                    className="hover:bg-slate-50 cursor-pointer group transition-all relative active:bg-slate-100"
                    onClick={() => handleGoToInvoice(adj.InvoiceID)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${getTypeColor(adj.Type)}`}>
                           {getTypeIcon(adj.Type)}
                        </div>
                        <div>
                          <span className="font-black text-[#1E4D4D] text-sm block">#{adj.InvoiceID}</span>
                          <span className="text-[9px] font-black text-slate-300 uppercase">Document Ref</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <Badge variant={getBadgeVariant(adj.Type)}>
                        {getTypeLabel(adj.Type)}
                      </Badge>
                    </td>
                    <td className="px-8 py-6 font-black text-slate-500 truncate max-w-[250px]">
                      {adj.Note || '---'}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex flex-col items-center">
                         <span className={`font-black text-sm ${isDiscount ? 'text-red-500' : 'text-[#1E4D4D]'}`}>
                            {isDiscount ? '-' : '+'}{(adj.Value || 0).toLocaleString()}
                            {adj.IsPercentage ? '%' : ` ${currency}`}
                         </span>
                         {adj.IsPercentage && <span className="text-[8px] font-bold text-slate-300 uppercase">حساب نسبي</span>}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleGoToInvoice(adj.InvoiceID); }}
                          className="w-9 h-9 bg-white border border-slate-100 rounded-xl text-blue-500 hover:bg-blue-500 hover:text-white hover:shadow-lg transition-all active:scale-90 flex items-center justify-center"
                          title="فتح الفاتورة"
                        >
                          <FileText size={16}/>
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, adj.AdjustmentID)}
                          className="w-9 h-9 bg-white border border-slate-100 rounded-xl text-red-400 hover:bg-red-500 hover:text-white hover:shadow-lg transition-all active:scale-90 flex items-center justify-center"
                          title="حذف"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdjustmentsArchiveModule;
