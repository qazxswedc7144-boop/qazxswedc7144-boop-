
import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import ReportPageLayout from './ReportPageLayout';

interface Column {
  header: string;
  accessor: string | ((item: any) => React.ReactNode);
  sortKey?: string;
  className?: string;
}

interface BaseReportPageProps {
  title: string;
  data?: any[];
  columns?: Column[];
  onNavigate: (view: string) => void;
  children?: React.ReactNode;
  onFilterChange?: (filters: { startDate: string, endDate: string, partnerId: string }) => void;
}

const BaseReportPage: React.FC<BaseReportPageProps> = ({ 
  title, 
  data = [], 
  columns = [], 
  onNavigate, 
  children,
  onFilterChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });

  const processedData = useMemo(() => {
    let result = [...data];

    // Date Filter
    if (dateFilter.from || dateFilter.to) {
      result = result.filter(item => {
        const itemDate = item.date || item.Date || item.createdAt || item.Transaction_Date || item.timestamp;
        if (!itemDate) return true;
        
        const d = new Date(itemDate).toISOString().split('T')[0] || '';
        if (dateFilter.from && d < dateFilter.from) return false;
        if (dateFilter.to && d > dateFilter.to) return false;
        return true;
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
  }, [data, searchTerm, sortConfig, dateFilter]);

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
    <ReportPageLayout
      title={title}
      onBack={() => onNavigate('reports')}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFilterChange={(from, to) => {
        setDateFilter({ from, to });
        onFilterChange?.({ startDate: from, endDate: to, partnerId: '' });
      }}
      onPrint={() => window.print()}
    >
      <div className="flex flex-col h-full">
        {columns.length > 0 && (
          <div className="overflow-x-auto relative custom-scrollbar">
            <table className="w-full text-right zebra-table border-collapse">
              <thead className="sticky top-0 bg-[#F8FAFA] z-20 shadow-sm">
                <tr>
                  {columns.map((col, idx) => {
                    const key = col.sortKey || (typeof col.accessor === 'string' ? col.accessor : null);
                    const isSorted = sortConfig?.key === key;
                    
                    return (
                      <th 
                        key={idx} 
                        className={`px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 ${key ? 'cursor-pointer hover:text-[#1E4D4D] transition-colors' : ''} ${col.className || ''}`}
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
                  <tr key={rowIdx} className="hover:bg-slate-50 transition-colors group">
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className={`px-6 py-5 text-[11px] font-bold text-slate-600 ${col.className || ''}`}>
                        {renderCell(item, col)}
                      </td>
                    ))}
                  </tr>
                ))}
                {processedData.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="py-24 text-center text-slate-300 italic font-black">
                      لا توجد بيانات لعرضها في هذا التقرير
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {children && (
          <div className="p-6">
            {children}
          </div>
        )}
      </div>
    </ReportPageLayout>
  );
};

export default BaseReportPage;
