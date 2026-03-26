
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ArrowRight, Search, Download, Printer, Filter, ArrowUpDown, ArrowUp, ArrowDown, Calendar, User } from 'lucide-react';
import { Input, Button } from '../SharedUI';

interface Column {
  header: string;
  accessor: string | ((item: any) => React.ReactNode);
  sortKey?: string;
  className?: string;
}

interface BaseReportPageProps {
  title: string;
  subtitle?: string;
  data?: any[];
  columns?: Column[];
  onNavigate: (view: string) => void;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  showDateFilter?: boolean;
  showPartnerFilter?: boolean;
  partners?: { id: string, name: string }[];
  onFilterChange?: (filters: { startDate: string, endDate: string, partnerId: string }) => void;
}

const BaseReportPage: React.FC<BaseReportPageProps> = ({ 
  title, 
  subtitle, 
  data = [], 
  columns = [], 
  onNavigate, 
  children,
  actions,
  showDateFilter = true,
  showPartnerFilter = false,
  partners = [],
  onFilterChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPartner, setSelectedPartner] = useState('');

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setSelectedPartner('');
    setSearchTerm('');
    onFilterChange?.({ startDate: '', endDate: '', partnerId: '' });
  };

  const processedData = useMemo(() => {
    let result = [...data];

    // Date Filter
    if (startDate || endDate) {
      result = result.filter(item => {
        const itemDate = item.date || item.Date || item.createdAt || item.Transaction_Date;
        if (!itemDate) return true;
        
        const d = new Date(itemDate).toISOString().split('T')[0];
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }

    // Partner Filter
    if (selectedPartner) {
      result = result.filter(item => {
        const pId = item.customerId || item.partnerId || item.supplierId || item.partner_id;
        return pId === selectedPartner;
      });
    }

    // Search Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item => {
        return Object.values(item).some(val => 
          String(val).toLowerCase().includes(term)
        );
      });
    }

    // Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortConfig]);

  const handleSort = (col: Column) => {
    const key = col.sortKey || (typeof col.accessor === 'string' ? col.accessor : null);
    if (!key) return;

    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderCell = (item: any, col: Column) => {
    if (typeof col.accessor === 'function') {
      return col.accessor(item);
    }
    return item[col.accessor];
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500 font-['Cairo']" dir="rtl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
        <button 
          onClick={() => onNavigate('reports')}
          className="flex items-center gap-1 hover:text-[#1E4D4D] transition-colors"
          title="العودة للتقارير"
        >
          <ArrowRight size={14} />
        </button>
        <ChevronLeft size={12} />
        <span className="text-[#1E4D4D]">{title}</span>
      </nav>

      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 min-h-[600px] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-2xl font-black text-[#1E4D4D] tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{subtitle}</p>}
          </div>
          
          <div className="flex items-center gap-3">
            {actions}
            <Button variant="secondary" size="sm" icon={<Printer size={16} />} onClick={() => window.print()}>طباعة</Button>
            <Button variant="secondary" size="sm" icon={<Download size={16} />}>تصدير Excel</Button>
          </div>
        </div>

        {/* Filters Section */}
        {(showDateFilter || showPartnerFilter) && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 p-6 bg-slate-50 rounded-[24px] border border-slate-100">
            {showDateFilter && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">من تاريخ</label>
                  <div className="relative">
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-white border-2 border-transparent rounded-[18px] pr-12 pl-5 py-3 text-[13px] font-black text-[#1E4D4D] focus:border-[#1E4D4D] outline-none shadow-sm transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">إلى تاريخ</label>
                  <div className="relative">
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-white border-2 border-transparent rounded-[18px] pr-12 pl-5 py-3 text-[13px] font-black text-[#1E4D4D] focus:border-[#1E4D4D] outline-none shadow-sm transition-all"
                    />
                  </div>
                </div>
              </>
            )}
            
            {showPartnerFilter && partners.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الشريك (عميل/مورد)</label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <select 
                    value={selectedPartner} 
                    onChange={e => setSelectedPartner(e.target.value)}
                    className="w-full bg-white border-2 border-transparent rounded-[18px] pr-12 pl-5 py-3 text-[13px] font-black text-[#1E4D4D] focus:border-[#1E4D4D] outline-none shadow-sm transition-all appearance-none"
                  >
                    <option value="">الكل</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              <Button 
                variant="primary" 
                className="flex-1 h-[52px]" 
                icon={<Filter size={18} />}
                onClick={() => onFilterChange?.({ startDate, endDate, partnerId: selectedPartner })}
              >
                تطبيق الفلتر
              </Button>
              <Button 
                variant="neutral" 
                className="w-12 h-[52px] !p-0" 
                icon={<ArrowUpDown size={18} className="rotate-45" />}
                onClick={handleReset}
                title="إعادة تعيين"
              />
            </div>
          </div>
        )}

        {columns.length > 0 && (
          <div className="space-y-6 flex-1 flex flex-col">
            <div className="relative max-w-md">
              <Input 
                placeholder="بحث في نتائج التقرير..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="!pr-12"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            </div>

            <div className="flex-1 overflow-x-auto custom-scrollbar">
              <table className="w-full text-right">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b-2 border-slate-50">
                    {columns.map((col, idx) => {
                      const key = col.sortKey || (typeof col.accessor === 'string' ? col.accessor : null);
                      const isSorted = sortConfig?.key === key;
                      
                      return (
                        <th 
                          key={idx} 
                          className={`px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest ${key ? 'cursor-pointer hover:text-[#1E4D4D] transition-colors' : ''} ${col.className || ''}`}
                          onClick={() => key && handleSort(col)}
                        >
                          <div className="flex items-center gap-2">
                            {col.header}
                            {key && (
                              <span className="text-slate-300">
                                {isSorted ? (
                                  sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                ) : (
                                  <ArrowUpDown size={12} className="opacity-30" />
                                )}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {processedData.map((item, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors group">
                      {columns.map((col, colIdx) => (
                        <td key={colIdx} className={`px-6 py-5 text-xs font-bold text-slate-600 ${col.className || ''}`}>
                          {renderCell(item, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {processedData.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="py-20 text-center text-slate-300 italic font-bold">
                        لا توجد بيانات لعرضها في هذا التقرير
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
};

export default BaseReportPage;
