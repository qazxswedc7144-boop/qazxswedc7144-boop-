
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/core/db';
import { useAccounting, useUI, useInventory } from '@/contexts/AppContext';
import ReportPageLayout from '../components/ReportPageLayout';
import { Truck, Package, TrendingUp, ShoppingBag } from 'lucide-react';
import { ExportService } from '@/services/data/exportService';
import { Purchase, UnifiedInvoice } from '@/types';

function mapInvoiceToPurchase(inv: UnifiedInvoice): Purchase {
  return {
    ...inv,
    purchase_id: inv.id,
    supplierId: inv.partnerId,
    supplierName: inv.partnerName,
    invoiceStatus: inv.documentStatus,
    paidAmount: inv.paidAmount,
    totalAmount: inv.finalTotal,
    status: inv.financialStatus === 'Paid' ? 'PAID' : 'UNPAID',
    items: inv.items,
    finalTotal: inv.finalTotal
  } as unknown as Purchase;
}

const SupplierProfitReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({ from: "", to: "", supplierId: "" });
  const { suppliers } = useAccounting();
  const { products } = useInventory();
  const { currency } = useUI();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rawPurchases, sales] = await Promise.all([
          db.getPurchases(),
          db.getSales()
        ]);
        const purchases = rawPurchases.map(mapInvoiceToPurchase);

        const stats: Record<string, any> = {};
        let totalSystemProfit = 0;

        // Initialize from suppliers list
        suppliers.forEach(s => {
          const sId = s.id || s.Supplier_ID;
          
          // Filter by supplier if selected
          if (dateFilter.supplierId && sId !== dateFilter.supplierId) return;

          stats[sId] = {
            id: sId,
            name: s.Supplier_Name || 'مورد غير معروف',
            totalPurchases: 0,
            totalQty: 0,
            netProfit: 0,
          };
        });

        purchases.filter(p => p.invoiceStatus === 'POSTED').forEach(purchase => {
          const pDate = purchase.date || (purchase as any).timestamp;
          const matchesFrom = !dateFilter.from || pDate >= dateFilter.from;
          const matchesTo = !dateFilter.to || pDate <= dateFilter.to;

          if (matchesFrom && matchesTo) {
            const sId = purchase.partnerId;
            if (stats[sId]) {
              stats[sId].totalPurchases += (purchase.totalAmount || 0);
              purchase.items.forEach((item: any) => {
                stats[sId].totalQty += (item.qty || 0);
              });
            }
          }
        });

        // Calculate profit from sales of items from this supplier
        sales.filter(s => s.InvoiceStatus === 'POSTED').forEach(sale => {
          const sDate = sale.date || (sale as any).timestamp;
          const matchesFrom = !dateFilter.from || sDate >= dateFilter.from;
          const matchesTo = !dateFilter.to || sDate <= dateFilter.to;

          if (matchesFrom && matchesTo) {
            sale.items.forEach(item => {
              const prod = products.find(p => p.id === (item.product_id || item.id));
              if (prod && prod.supplierId && stats[prod.supplierId]) {
                const profit = ((item.price || 0) - (prod.CostPrice || 0)) * (item.qty || 0);
                stats[prod.supplierId].netProfit += profit;
                totalSystemProfit += profit;
              }
            });
          }
        });

        const final = Object.values(stats).map((s: any) => ({
          ...s,
          contribution: totalSystemProfit > 0 ? (s.netProfit / totalSystemProfit) * 100 : 0
        })).sort((a, b) => b.netProfit - a.netProfit);

        setData(final);
      } catch (error) {
        console.error("Failed to fetch supplier profit report:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [suppliers, products, dateFilter]);

  const filteredData = useMemo(() => {
    return data.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      purchases: acc.purchases + curr.totalPurchases,
      profit: acc.profit + curr.netProfit,
      qty: acc.qty + curr.totalQty
    }), { purchases: 0, profit: 0, qty: 0 });
  }, [filteredData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <ReportPageLayout
      title="تقرير أرباح الموردين"
      onBack={() => onNavigate?.('reports')}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFilterChange={(from, to, supplierId) => setDateFilter({ from, to, supplierId: supplierId || "" })}
      filterOptions={suppliers.map(s => ({ label: s.Supplier_Name || "", value: s.id || s.Supplier_ID || "" }))}
      filterLabel="تصفية حسب المورد"
      summaryCards={[
        { label: "إجمالي المشتريات", value: `${totals.purchases.toLocaleString()} ${currency}`, icon: <ShoppingBag size={16} />, color: "bg-emerald-50 text-emerald-600" },
        { label: "صافي الأرباح الربحية", value: `${totals.profit.toLocaleString()} ${currency}`, icon: <TrendingUp size={16} />, color: "bg-blue-50 text-blue-600" },
        { label: "إجمالي الكميات", value: totals.qty.toLocaleString(), icon: <Package size={16} />, color: "bg-orange-50 text-orange-600" },
        { label: "عدد الموردين", value: filteredData.length, icon: <Truck size={16} />, color: "bg-purple-50 text-purple-600" }
      ]}
      onExportExcel={() => ExportService.exportToCSV(filteredData, "SupplierProfitReport")}
      onExportPDF={() => ExportService.exportToPDFFile(
        "تقرير أرباح الموردين",
        ["المورد", "الكميات", "المشتريات", "الأرباح", "المساهمة"],
        filteredData.map(d => [d.name, d.totalQty, d.totalPurchases, d.netProfit, d.contribution.toFixed(2) + "%"]),
        "SupplierProfitReport"
      )}
      onPrint={() => window.print()}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-right zebra-table min-w-[900px]">
          <thead className="bg-[#F8FAFA] text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-5 text-right font-black">اسم المورد</th>
              <th className="px-6 py-5 text-center font-black">إجمالي الكميات</th>
              <th className="px-6 py-5 text-center font-black">إجمالي المشتريات</th>
              <th className="px-6 py-5 text-center font-black">صافي الربح</th>
              <th className="px-6 py-5 text-center font-black">المساهمة (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.map((s, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-5 font-bold text-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-[#1E4D4D]">
                      <Truck size={14} />
                    </div>
                    <span>{s.name}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-center font-black text-slate-700">
                  {s.totalQty.toLocaleString()} وحدة
                </td>
                <td className="px-6 py-5 text-center font-bold text-slate-400 text-xs">
                  {s.totalPurchases.toLocaleString()} {currency}
                </td>
                <td className={`px-6 py-5 text-center font-black ${s.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {s.netProfit.toLocaleString()} {currency}
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                      <div 
                        className="h-full bg-[#1E4D4D] rounded-full" 
                        style={{ width: `${Math.max(0, Math.min(s.contribution, 100))}%` }} 
                      />
                    </div>
                    <span className="text-xs font-black text-slate-700 w-10">{s.contribution.toFixed(1)}%</span>
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

export default SupplierProfitReport;
