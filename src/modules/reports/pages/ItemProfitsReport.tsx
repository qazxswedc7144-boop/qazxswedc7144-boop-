
import React, { useMemo, useState, useEffect } from 'react';
import { useInventory, useUI } from '@/contexts/AppContext';
import ReportPageLayout from '../components/ReportPageLayout';
import { SalesRepository } from '@/database/repositories/SalesRepository';
import { Sale } from '@/types';
import { TrendingUp, Package, DollarSign, BarChart3 } from 'lucide-react';
import { ExportService } from '@/services/data/exportService';

const ItemProfitsReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { products } = useInventory();
  const { currency } = useUI();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({ from: "", to: "", productId: "" });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allSales = await SalesRepository.getAll();
        // Filter only posted/finalized sales
        setSales(allSales.filter(s => s.InvoiceStatus !== 'CANCELLED' && s.InvoiceStatus !== 'DRAFT'));
      } catch (error) {
        console.error("Error fetching sales for report:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const data = useMemo(() => {
    if (loading) return [];

    const itemStats: Record<string, { 
      id: string,
      name: string, 
      qty: number, 
      revenue: number, 
      cost: number, 
      profit: number,
      margin: number
    }> = {};

    sales.forEach(sale => {
      const matchesFrom = !dateFilter.from || sale.date >= dateFilter.from;
      const matchesTo = !dateFilter.to || sale.date <= dateFilter.to;
      if (!matchesFrom || !matchesTo) return;

      sale.items.forEach(item => {
        const productId = item.product_id;
        if (dateFilter.productId && productId !== dateFilter.productId) return;

        const product = products.find(p => p.id === productId);
        
        if (!itemStats[productId]) {
          itemStats[productId] = {
            id: productId,
            name: item.name || product?.Name || 'صنف غير معروف',
            qty: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            margin: 0
          };
        }

        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const cost = Number(product?.CostPrice || product?.avgCost) || 0;

        itemStats[productId].qty += qty;
        itemStats[productId].revenue += qty * price;
        itemStats[productId].cost += qty * cost;
      });
    });

    return Object.values(itemStats).map(stat => {
      const profit = stat.revenue - stat.cost;
      const margin = stat.revenue > 0 ? (profit / stat.revenue) * 100 : 0;
      return {
        ...stat,
        profit,
        margin
      };
    }).sort((a, b) => b.profit - a.profit);
  }, [sales, products, loading, dateFilter]);

  const filteredData = useMemo(() => {
    return data.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      revenue: acc.revenue + curr.revenue,
      cost: acc.cost + curr.cost,
      profit: acc.profit + curr.profit,
      qty: acc.qty + curr.qty
    }), { revenue: 0, cost: 0, profit: 0, qty: 0 });
  }, [filteredData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <ReportPageLayout
      title="تقرير أرباح الأصناف"
      onBack={() => onNavigate?.('reports')}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFilterChange={(from, to, productId) => setDateFilter({ from, to, productId: productId || "" })}
      filterOptions={products.map(p => ({ label: p.Name || p.name || "", value: p.id || "" }))}
      filterLabel="تصفية حسب الصنف"
      summaryCards={[
        { label: "صافي الأرباح", value: `${totals.profit.toLocaleString()} ${currency}`, icon: <TrendingUp size={16} />, color: "bg-emerald-50 text-emerald-600" },
        { label: "إجمالي المبيعات", value: `${totals.revenue.toLocaleString()} ${currency}`, icon: <DollarSign size={16} />, color: "bg-blue-50 text-blue-600" },
        { label: "إجمالي الكميات", value: totals.qty.toLocaleString(), icon: <Package size={16} />, color: "bg-orange-50 text-orange-600" },
        { label: "متوسط هامش الربح", value: `${(totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0).toFixed(1)}%`, icon: <BarChart3 size={16} />, color: "bg-purple-50 text-purple-600" }
      ]}
      onExportExcel={() => ExportService.exportToCSV(filteredData, "ItemProfitsReport")}
      onExportPDF={() => ExportService.exportToPDFFile(
        "تقرير أرباح الأصناف",
        ["اسم الصنف", "الكمية", "المبيعات", "التكلفة", "الربح"],
        filteredData.map(d => [d.name, d.qty, d.revenue.toLocaleString(), d.cost.toLocaleString(), d.profit.toLocaleString()]),
        "ItemProfitsReport"
      )}
      onPrint={() => window.print()}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse zebra-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">الصنف</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">الكمية</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">المبيعات ({currency})</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">التكلفة ({currency})</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">الربح الصافي</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">الهامش</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-5 font-bold text-slate-700">{item.name}</td>
                <td className="px-6 py-5 font-black text-[#1E4D4D]">{item.qty.toLocaleString()}</td>
                <td className="px-6 py-5 text-slate-500">{item.revenue.toLocaleString()}</td>
                <td className="px-6 py-5 text-slate-500">{item.cost.toLocaleString()}</td>
                <td className="px-6 py-5">
                   <div className={`font-black ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {item.profit.toLocaleString()}
                   </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-black ${item.margin >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                      {item.margin.toFixed(1)}%
                    </span>
                    <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${item.margin >= 0 ? 'bg-blue-400' : 'bg-red-400'}`} 
                        style={{ width: `${Math.min(Math.abs(item.margin), 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-slate-300 italic font-black">
                  لا توجد بيانات متاحة حالياً بناءً على فلاتر البحث المطبقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportPageLayout>
  );
};

export default ItemProfitsReport;
