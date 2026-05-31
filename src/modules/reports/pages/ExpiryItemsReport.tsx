
import React, { useState, useMemo } from 'react';
import { useInventory } from '@/contexts/AppContext';
import { Badge } from '@/components/shared/SharedUI';
import ReportPageLayout from '../components/ReportPageLayout';
import { AlertCircle, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { ExportService } from '@/services/data/exportService';

const ExpiryItemsReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { products } = useInventory();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({ from: "", to: "", productId: "" });

  const rawData = useMemo(() => {
    return products.map(p => {
      const expiryDate = p.ExpiryDate || (p as any).expiryDate;
      const daysUntil = expiryDate ? (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) : 9999;
      
      let status: 'valid' | 'expiring_soon' | 'expired' = 'valid';
      if (daysUntil <= 0) status = 'expired';
      else if (daysUntil <= 90) status = 'expiring_soon';

      return {
        id: p.id,
        name: p.Name || p.name || 'بدون اسم',
        qty: p.StockQuantity || p.stock || 0,
        expiryDate: expiryDate || 'غير محدد',
        daysUntil,
        status,
        unit: p.DefaultUnit || 'قطعة'
      };
    });
  }, [products]);

  const filteredData = useMemo(() => {
    return rawData.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFrom = !dateFilter.from || item.expiryDate >= dateFilter.from;
      const matchesTo = !dateFilter.to || item.expiryDate <= dateFilter.to;
      const matchesProduct = !dateFilter.productId || item.id === dateFilter.productId;
      return matchesSearch && matchesFrom && matchesTo && matchesProduct;
    });
  }, [rawData, searchTerm, dateFilter]);

  const stats = useMemo(() => {
    return filteredData.reduce((acc, curr) => {
      if (curr.status === 'expired') acc.expired++;
      else if (curr.status === 'expiring_soon') acc.expiringSoon++;
      else acc.valid++;
      return acc;
    }, { expired: 0, expiringSoon: 0, valid: 0 });
  }, [filteredData]);

  return (
    <ReportPageLayout
      title="تقرير صلاحية الأصناف"
      onBack={() => onNavigate?.('reports')}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFilterChange={(from, to, productId) => setDateFilter({ from, to, productId: productId || "" })}
      filterOptions={products.map(p => ({ label: p.Name || p.name || "", value: p.id || "" }))}
      filterLabel="تصفية حسب الصنف"
      summaryCards={[
        { label: "أصناف منتهية", value: stats.expired, icon: <AlertCircle size={16} />, color: "bg-red-50 text-red-600" },
        { label: "قريب الانتهاء", value: stats.expiringSoon, icon: <Clock size={16} />, color: "bg-orange-50 text-orange-600" },
        { label: "أصناف صالحة", value: stats.valid, icon: <CheckCircle2 size={16} />, color: "bg-emerald-50 text-emerald-600" },
        { label: "إجمالي المنتجات", value: filteredData.length, icon: <Calendar size={16} />, color: "bg-blue-50 text-blue-600" }
      ]}
      onExportExcel={() => ExportService.exportToCSV(filteredData, "ExpiryReport")}
      onExportPDF={() => ExportService.exportToPDFFile(
        "تقرير صلاحية الأصناف",
        ["الصنف", "الكمية المتبقية", "تاريخ الانتهاء", "الحالة"],
        filteredData.map(d => [d.name, d.qty, d.expiryDate, d.status === 'expired' ? 'منتهي' : d.status === 'expiring_soon' ? 'قريب' : 'ساري']),
        "ExpiryReport"
      )}
      onPrint={() => window.print()}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-right zebra-table min-w-[700px]">
          <thead className="bg-[#F8FAFA] text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-5 text-right">الصنف</th>
              <th className="px-6 py-5 text-right">الكمية المتبقية</th>
              <th className="px-6 py-5 text-right">تاريخ الانتهاء</th>
              <th className="px-6 py-5 text-right">حالة الصنف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-5 font-bold text-slate-700">{item.name}</td>
                <td className="px-6 py-5 font-black text-[#1E4D4D]">
                  {item.qty} {item.unit}
                </td>
                <td className={`px-6 py-5 font-black ${
                  item.status === 'expired' ? 'text-red-500' : 
                  item.status === 'expiring_soon' ? 'text-orange-500' : 'text-slate-500'
                }`}>
                  {item.expiryDate}
                </td>
                <td className="px-6 py-5">
                  <Badge variant={
                    item.status === 'expired' ? 'danger' : 
                    item.status === 'expiring_soon' ? 'warning' : 'success'
                  }>
                    {item.status === 'expired' ? 'منتهي' : 
                     item.status === 'expiring_soon' ? 'قريب الانتهاء' : 'ساري'}
                  </Badge>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center text-slate-300 font-black italic">
                  لا توجد نتائج تطابق البحث أو الفلترة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportPageLayout>
  );
};

export default ExpiryItemsReport;
