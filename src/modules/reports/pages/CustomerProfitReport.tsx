
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/core/db';
import { useAccounting, useUI, useInventory } from '@/contexts/AppContext';
import ReportPageLayout from '../components/ReportPageLayout';
import { User, TrendingUp, DollarSign, Wallet, Users } from 'lucide-react';
import { ExportService } from '@/services/data/exportService';
import { Sale, UnifiedInvoice } from '@/types';

function mapInvoiceToSale(inv: UnifiedInvoice): Sale {
  return {
    ...inv,
    SaleID: inv.id,
    customerId: inv.partnerId,
    branchId: 'main',
    totalCost: inv.subtotal * 0.7, // COGS estimate
    InvoiceStatus: inv.documentStatus,
    paidAmount: inv.paidAmount,
    items: inv.items,
    finalTotal: inv.finalTotal,
    paymentStatus: inv.paymentStatus,
    Date: inv.date
  } as unknown as Sale;
}

const CustomerProfitReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({ from: "", to: "", customerId: "" });
  const { customers } = useAccounting();
  const { products } = useInventory();
  const { currency } = useUI();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sales = (await db.getSales()).map(mapInvoiceToSale);
        const stats: Record<string, any> = {};
        let totalSystemProfit = 0;

        sales.filter(s => s.InvoiceStatus === 'POSTED').forEach(sale => {
          const saleDate = sale.date;
          const matchesFrom = !dateFilter.from || saleDate >= dateFilter.from;
          const matchesTo = !dateFilter.to || saleDate <= dateFilter.to;

          if (matchesFrom && matchesTo) {
            const cId = sale.customerId;
            
            // Filter by customer if selected
            if (dateFilter.customerId && cId !== dateFilter.customerId) return;

            if (!stats[cId]) {
              const customer = customers.find(c => c.id === cId || c.Supplier_ID === cId);
              stats[cId] = {
                id: cId,
                name: customer?.Supplier_Name || 'عميل غير معروف',
                totalSales: 0,
                totalCost: 0,
                netProfit: 0,
              };
            }

            stats[cId].totalSales += (sale.finalTotal || 0);
            
            let saleCost = 0;
            sale.items.forEach((item: any) => {
              const prod = products.find(p => p.id === (item.product_id || item.id));
              saleCost += (item.qty || 0) * (prod?.CostPrice || 0);
            });
            stats[cId].totalCost += saleCost;
          }
        });

        const processed = Object.values(stats).map((s: any) => {
          const netProfit = s.totalSales - s.totalCost;
          totalSystemProfit += netProfit;
          return { ...s, netProfit };
        });

        const final = processed.map(s => ({
          ...s,
          contribution: totalSystemProfit > 0 ? (s.netProfit / totalSystemProfit) * 100 : 0
        })).sort((a, b) => b.netProfit - a.netProfit);

        setData(final);
      } catch (error) {
        console.error("Failed to fetch customer profit report:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customers, products, dateFilter]);

  const filteredData = useMemo(() => {
    return data.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      sales: acc.sales + curr.totalSales,
      profit: acc.profit + curr.netProfit
    }), { sales: 0, profit: 0 });
  }, [filteredData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <ReportPageLayout
      title="تقرير أرباح العملاء"
      onBack={() => onNavigate?.('reports')}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFilterChange={(from, to, customerId) => setDateFilter({ from, to, customerId: customerId || "" })}
      filterOptions={customers.map(c => ({ label: c.Supplier_Name || "", value: c.id || c.Supplier_ID || "" }))}
      filterLabel="تصفية حسب العميل"
      summaryCards={[
        { label: "إجمالي المبيعات", value: `${totals.sales.toLocaleString()} ${currency}`, icon: <DollarSign size={16} />, color: "bg-emerald-50 text-emerald-600" },
        { label: "صافي الأرباح", value: `${totals.profit.toLocaleString()} ${currency}`, icon: <TrendingUp size={16} />, color: "bg-blue-50 text-blue-600" },
        { label: "عدد العملاء", value: filteredData.length, icon: <Users size={16} />, color: "bg-purple-50 text-purple-600" },
        { label: "متوسط ربح العميل", value: `${(filteredData.length > 0 ? totals.profit / filteredData.length : 0).toLocaleString()} ${currency}`, icon: <Wallet size={16} />, color: "bg-orange-50 text-orange-600" }
      ]}
      onExportExcel={() => ExportService.exportToCSV(filteredData, "CustomerProfitReport")}
      onExportPDF={() => ExportService.exportToPDFFile(
        "تقرير أرباح العملاء",
        ["العميل", "المبيعات", "التكلفة", "الربح", "المساهمة"],
        filteredData.map(d => [d.name, d.totalSales, d.totalCost, d.netProfit, d.contribution.toFixed(2) + "%"]),
        "CustomerProfitReport"
      )}
      onPrint={() => window.print()}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-right zebra-table min-w-[900px]">
          <thead className="bg-[#F8FAFA] text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-5 text-right font-black">اسم العميل</th>
              <th className="px-6 py-5 text-center font-black">إجمالي المبيعات</th>
              <th className="px-6 py-5 text-center font-black">إجمالي التكلفة</th>
              <th className="px-6 py-5 text-center font-black">صافي الربح</th>
              <th className="px-6 py-5 text-center font-black">المساهمة (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.map((c, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-5 font-bold text-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-[#1E4D4D]">
                      <User size={14} />
                    </div>
                    <span>{c.name}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-center font-black text-slate-700">
                  {c.totalSales.toLocaleString()} {currency}
                </td>
                <td className="px-6 py-5 text-center font-bold text-slate-400 text-xs">
                  {c.totalCost.toLocaleString()} {currency}
                </td>
                <td className={`px-6 py-5 text-center font-black ${c.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {c.netProfit.toLocaleString()} {currency}
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                      <div 
                        className="h-full bg-[#1E4D4D] rounded-full" 
                        style={{ width: `${Math.max(0, Math.min(c.contribution, 100))}%` }} 
                      />
                    </div>
                    <span className="text-xs font-black text-slate-700 w-10">{c.contribution.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-slate-300 font-black italic">
                  لا توجد نتائج تطابق البحث أو الفلترة المختارة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportPageLayout>
  );
};

export default CustomerProfitReport;
