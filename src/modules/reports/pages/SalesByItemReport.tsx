import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/core/db';
import ReportPageLayout from '../components/ReportPageLayout';
import { useUI, useInventory } from '@/contexts/AppContext';
import { useReportContext } from '@/contexts/ReportContext';
import { Package, DollarSign, BarChart3 } from 'lucide-react';
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

const SalesByItemReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { fromDate, toDate } = useReportContext('sales');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [productIdFilter, setProductIdFilter] = useState("");
  const { currency } = useUI();
  const { products } = useInventory();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sales = (await db.getSales()).map(mapInvoiceToSale);
        
        const itemMap: Record<string, any> = {};
        let grandTotalSales = 0;

        sales.forEach(sale => {
          if (sale.InvoiceStatus === 'CANCELLED' || sale.InvoiceStatus === 'DRAFT') return;
          
          const saleDate = sale.date || (sale as any).timestamp;
          const matchesFrom = !fromDate || saleDate >= fromDate;
          const matchesTo = !toDate || saleDate <= toDate;

          if (matchesFrom && matchesTo) {
            sale.items.forEach(item => {
              const itemId = item.product_id || item.id || item.name;
              
              // Filter by product if selected
              if (productIdFilter && itemId !== productIdFilter) return;

              if (!itemMap[itemId]) {
                const prod = products.find(p => p.id === itemId);
                itemMap[itemId] = {
                  id: itemId,
                  name: item.name || prod?.Name || 'صنف غير معروف',
                  qty: 0,
                  total: 0,
                  unit: item.unit || prod?.DefaultUnit || 'قطعة'
                };
              }
              itemMap[itemId].qty += (item.qty || 0);
              itemMap[itemId].total += (item.sum || (item.qty * item.price) || 0);
              grandTotalSales += (item.sum || (item.qty * item.price) || 0);
            });
          }
        });

        const processed = Object.values(itemMap).map((item: any) => ({
          ...item,
          avgPrice: item.qty > 0 ? item.total / item.qty : 0,
          contribution: grandTotalSales > 0 ? (item.total / grandTotalSales) * 100 : 0
        })).sort((a: any, b: any) => b.total - a.total);

        setData(processed);
      } catch (error) {
        console.error("Failed to fetch sales report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [fromDate, toDate, productIdFilter, products]);

  const filteredData = useMemo(() => {
    return data.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const totals = useMemo(() => {
     return filteredData.reduce((acc, curr) => ({
        sales: acc.sales + curr.total,
        qty: acc.qty + curr.qty
     }), { sales: 0, qty: 0 });
  }, [filteredData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <ReportPageLayout
      title="المبيعات حسب الصنف"
      onBack={() => onNavigate?.('reports')}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFilterChange={(_, __, productId) => setProductIdFilter(productId || "")}
      filterOptions={products.map(p => ({ label: p.Name || p.name || "", value: p.id || "" }))}
      filterLabel="تصفية حسب الصنف"
      summaryCards={[
        { label: "إجمالي المبيعات", value: `${totals.sales.toLocaleString()} ${currency}`, icon: <DollarSign size={16} />, color: "bg-emerald-50 text-emerald-600" },
        { label: "إجمالي الوحدات", value: totals.qty.toLocaleString(), icon: <Package size={16} />, color: "bg-blue-50 text-blue-600" },
        { label: "عدد الأصناف المباعة", value: filteredData.length, icon: <BarChart3 size={16} />, color: "bg-purple-50 text-purple-600" }
      ]}
      onExportExcel={() => ExportService.exportToCSV(filteredData, "SalesByItemReport")}
      onExportPDF={() => ExportService.exportToPDFFile(
        "تقرير المبيعات حسب الصنف",
        ["اسم الصنف", "الكمية المباعة", "إجمالي المبيعات", "متوسط السعر", "المساهمة"],
        filteredData.map(d => [d.name, d.qty, d.total, d.avgPrice.toFixed(2), d.contribution.toFixed(2) + "%"]),
        "SalesByItemReport"
      )}
      onPrint={() => window.print()}
    >
      <div className="flex flex-col w-full">
        {/* Active Time Filter Indicator */}
        {(fromDate || toDate) && (
          <div className="mx-6 mt-6 mb-2 p-4 bg-teal-50/50 border border-teal-100/40 rounded-2xl flex items-center justify-between text-xs text-[#1E4D4D]">
            <div className="flex items-center gap-2 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span>نطاق الفلترة المطبق:</span>
              <span className="font-mono text-[11px] bg-white border border-teal-100/50 px-2 py-0.5 rounded-lg text-[#163a3a]">
                {fromDate ? fromDate : "البداية"} &larr; {toDate ? toDate : "الآن"}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right zebra-table min-w-[800px]">
            <thead className="bg-[#F8FAFA] text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-right font-black">الصنف</th>
                <th className="px-6 py-5 text-center font-black">الكمية المباعة</th>
                <th className="px-6 py-5 text-center font-black">إجمالي المبيعات</th>
                <th className="px-6 py-5 text-center font-black">متوسط السعر</th>
                <th className="px-6 py-5 text-center font-black">نسبة المساهمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5 font-bold text-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-[#1E4D4D]">
                        <Package size={14} />
                      </div>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center font-black text-[#1E4D4D]">
                    {item.qty.toLocaleString()} {item.unit}
                  </td>
                  <td className="px-6 py-5 text-center font-black text-emerald-600">
                    {item.total.toLocaleString()} {currency}
                  </td>
                  <td className="px-6 py-5 text-center font-bold text-slate-500 text-xs">
                    {item.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                        <div 
                          className="h-full bg-[#10B981] rounded-full" 
                          style={{ width: `${Math.min(item.contribution, 100)}%` }} 
                        />
                      </div>
                      <span className="text-xs font-black text-slate-700 w-10">{item.contribution.toFixed(1)}%</span>
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
      </div>
    </ReportPageLayout>
  );
};

export default SalesByItemReport;
