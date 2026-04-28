
import React, { useState, useMemo, useEffect } from 'react';
import { InvoiceRepository } from '../services/repositories/invoice.repository';
import { AdjustmentRepository } from '../services/repositories/AdjustmentRepository';
import { Sale } from '../types';
import { useUI } from '../store/AppContext';
import { useAppStore } from '../store/useAppStore';
import { Card, Badge, Button } from '../components/SharedUI';
import { UI_CONFIG } from '../constants';
import AdjustmentForm from './AdjustmentForm';
import { Search, Edit3, Tag, ArrowRight, Plus, Home } from 'lucide-react';

const SalesArchiveModule: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { currency, version, refreshGlobal, addToast } = useUI();
  const setEditingInvoiceId = useAppStore(state => state.setEditingInvoiceId);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [targetInvoiceId, setTargetInvoiceId] = useState<string | null>(null);

  // Fix: Fetch sales in useEffect as getSalesArchive is now async
  useEffect(() => {
    const fetchSales = async () => {
      const data = await InvoiceRepository.getSalesArchive();
      setSales(data);
    };
    fetchSales();
  }, [version]);

  const filteredSales = useMemo(() => {
    const list = [...sales].sort((a, b) => new Date(b.Date || b.date || "").getTime() - new Date(a.Date || a.date || "").getTime());
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(s => s.SaleID.toLowerCase().includes(term) || (s.customerId && s.customerId.toLowerCase().includes(term)));
  }, [sales, searchTerm]);

  const handleEditAction = (sale: Sale) => {
    setEditingInvoiceId(sale.SaleID);
    onNavigate?.('sales');
  };

  const handleAddNew = () => {
    setEditingInvoiceId(null); 
    onNavigate?.('sales');
  };

  return (
    <div className="p-4 md:p-8 space-y-8 bg-[#F8FAFA] min-h-full pb-32 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[48px] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <div className={`w-20 h-20 bg-emerald-50 text-[#10B981] flex items-center justify-center text-4xl shadow-inner ${UI_CONFIG.imageShape}`}>📊</div>
          <div>
            <h2 className={`text-4xl ${UI_CONFIG.headerWeight} text-[#1E4D4D] tracking-tight`}>أرشيف المبيعات</h2>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-[4px] mt-2 opacity-60">Operations Registry</p>
          </div>
        </div>
        <div className="flex gap-4">
          <Button 
            variant="approve" 
            size="md" 
            className="!rounded-[28px] px-10 shadow-xl shadow-emerald-200" 
            icon={<Plus size={22}/>}
            onClick={handleAddNew}
          >
            فاتورة بيع جديدة
          </Button>
          <button onClick={() => onNavigate?.('dashboard')} className="bg-white border border-slate-200 text-[#1E4D4D] px-6 py-5 rounded-[28px] text-xs font-black flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm active:scale-95">
            <Home size={22} />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-3 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="relative w-full md:w-96 group px-2">
          <input type="text" placeholder="بحث برقم الفاتورة..." className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-12 py-4 text-[11px] font-black focus:bg-white focus:border-[#10B981] outline-none shadow-inner transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Search size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" />
        </div>
        <Badge variant="info">{filteredSales.length} مستند مسجل</Badge>
      </div>

      <Card noPadding className="shadow-2xl border-slate-100 overflow-hidden !rounded-[48px] bg-white">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right text-[11px]">
            <thead className={`bg-[#F8FAFA] text-slate-400 ${UI_CONFIG.headerWeight} uppercase border-b-2 border-slate-100`}>
              <tr>
                <th className="px-10 py-6">رقم القيد</th>
                <th className="px-10 py-6">التاريخ</th>
                <th className="px-10 py-6">العميل</th>
                <th className="px-10 py-6 text-center">المبلغ الصافي</th>
                <th className="px-10 py-6 text-center">الحالة</th>
                <th className="px-10 py-6 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSales.map(sale => (
                <tr key={sale.id} onClick={() => handleEditAction(sale)} className={`hover:bg-slate-50 cursor-pointer group transition-all ${UI_CONFIG.rowHeightMedium}`}>
                  <td className="px-10 py-6 font-black text-[#1E4D4D] text-sm">#{sale.SaleID}</td>
                  <td className="px-10 py-6 font-bold text-slate-500">{new Date(sale.date || sale.Date || "").toLocaleDateString('ar-SA')}</td>
                  <td className="px-10 py-6 font-black text-[#1E4D4D]">{sale.customerId || 'عميل نقدي'}</td>
                  <td className="px-10 py-6 text-center font-black text-sm">{ (sale.finalTotal || sale.FinalTotal || 0).toLocaleString() }</td>
                  <td className="px-10 py-6 text-center">
                    <Badge variant={sale.InvoiceStatus === 'POSTED' ? 'success' : 'warning'}>
                       {sale.InvoiceStatus === 'POSTED' ? 'مرحلة ✅' : 'محفوظة 📁'}
                    </Badge>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                       <button className="w-10 h-10 bg-white border border-slate-100 rounded-xl text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white shadow-sm"><Edit3 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default SalesArchiveModule;
