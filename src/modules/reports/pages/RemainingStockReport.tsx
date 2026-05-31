import React, { useState, useMemo } from 'react';
import { useInventory, useUI } from '@/contexts/AppContext';
import { Badge } from '@/components/shared/SharedUI';
import ReportPageLayout from '../components/ReportPageLayout';
import { Package, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ExportService } from '@/services/data/exportService';

const RemainingStockReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { products } = useInventory();
  const { currency } = useUI();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({ from: "", to: "", productId: "" });

  const rawData = useMemo(() => {
    return products.map(p => ({
      id: p.id,
      name: p.Name || p.name || 'بدون اسم',
      date: (p as any).LastPurchaseDate || p.Created_At || new Date().toISOString().split('T')[0],
      qty: p.StockQuantity || p.stock || 0,
      cost: p.CostPrice || p.price || 0,
      stockValue: (Number(p.StockQuantity) || 0) * (Number(p.CostPrice) || 0),
      minLevel: p.MinLevel || 5,
      unit: p.DefaultUnit || 'قطعة'
    }));
  }, [products]);

  const filteredData = useMemo(() => {
    return rawData.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFrom = !dateFilter.from || item.date >= dateFilter.from;
      const matchesTo = !dateFilter.to || item.date <= dateFilter.to;
      const matchesProduct = !dateFilter.productId || item.id === dateFilter.productId;
      return matchesSearch && matchesFrom && matchesTo && matchesProduct;
    });
  }, [rawData, searchTerm, dateFilter]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      qty: acc.qty + curr.qty,
      value: acc.value + curr.stockValue,
      lowItems: acc.lowItems + (curr.qty <= curr.minLevel ? 1 : 0)
    }), { qty: 0, value: 0, lowItems: 0 });
  }, [filteredData]);

  const predict = (history: any[]) => {
    if (!history || history.length === 0) return 0;
    const avg = history.reduce((s, i) => s + (i.qty || i.quantity || 0), 0) / history.length;
    return Math.round(avg);
  };

  return (
    <ReportPageLayout
      title="تقرير جرد المخزون"
      onBack={() => onNavigate?.('reports')}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFilterChange={(from, to, productId) => setDateFilter({ from, to, productId: productId || "" })}
      filterOptions={products.map(p => ({ label: p.Name || p.name || "", value: p.id || "" }))}
      filterLabel="تصفية حسب الصنف"
      summaryCards={[
        { label: "إجمالي الكميات", value: totals.qty.toLocaleString(), icon: <Package size={16} />, color: "bg-blue-50 text-blue-600" },
        { label: "قيمة المخزون", value: `${totals.value.toLocaleString()} ${currency}`, icon: <DollarSign size={16} />, color: "bg-emerald-50 text-emerald-600" },
        { label: "أصناف منخفضة", value: totals.lowItems, icon: <AlertTriangle size={16} />, color: "bg-orange-50 text-orange-600" },
        { label: "كفاءة المخزون", value: `${(filteredData.length > 0 ? ((filteredData.length - totals.lowItems) / filteredData.length) * 100 : 0).toFixed(1)}%`, icon: <CheckCircle2 size={16} />, color: "bg-purple-50 text-purple-600" }
      ]}
      onExportExcel={() => ExportService.exportToCSV(filteredData, "InventoryStatusReport")}
      onExportPDF={() => ExportService.exportToPDFFile(
        "تقرير جرد المخزون",
        ["الصنف", "الرصيد", "التكلفة", "القيمة", "الحالة"],
        filteredData.map(d => [d.name, d.qty + " " + d.unit, d.cost.toLocaleString(), d.stockValue.toLocaleString(), d.qty <= 0 ? 'منتهي' : d.qty <= d.minLevel ? 'منخفض' : 'سليم']),
        "InventoryStatusReport"
      )}
      onPrint={() => window.print()}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-right zebra-table border-collapse">
          <thead className="bg-[#F8FAFA] text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-5 text-right">الصنف</th>
              <th className="px-6 py-5 text-right">الرصيد</th>
              <th className="px-6 py-5 text-right">التكلفة</th>
              <th className="px-6 py-5 text-right">القيمة</th>
              <th className="px-6 py-5 text-right">تنبؤ الطلب</th>
              <th className="px-6 py-5 text-right">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-5 font-bold text-slate-700">{item.name}</td>
                <td className="px-6 py-5 font-black text-[#1E4D4D]">
                  <span className={item.qty <= item.minLevel ? 'text-red-500' : ''}>
                    {item.qty} {item.unit}
                  </span>
                </td>
                <td className="px-6 py-5 text-slate-500 text-xs">{item.cost.toLocaleString()} {currency}</td>
                <td className="px-6 py-5 font-black text-[#1E4D4D]">{item.stockValue.toLocaleString()} {currency}</td>
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span className="text-emerald-600 font-black text-sm">
                      {predict([item, item])}
                    </span>
                    <span className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">متوقع</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <Badge variant={item.qty <= 0 ? 'danger' : item.qty <= item.minLevel ? 'warning' : 'success'}>
                    {item.qty <= 0 ? 'منتهي' : item.qty <= item.minLevel ? 'منخفض' : 'متوفر'}
                  </Badge>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-black italic">
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

export default RemainingStockReport;
