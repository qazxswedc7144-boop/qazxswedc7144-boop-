import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/core/db';
import { useUI, useInventory } from '@/contexts/AppContext';
import { useReportContext } from '@/contexts/ReportContext';
import ReportPageLayout from '../components/ReportPageLayout';
import { ShoppingBag, DollarSign, Package, TrendingUp } from 'lucide-react';
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

const PurchasesByItemReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { fromDate, toDate } = useReportContext('purchases');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [productIdFilter, setProductIdFilter] = useState("");
  const { currency } = useUI();
  const { products } = useInventory();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const purchases = (await db.getPurchases()).map(mapInvoiceToPurchase);
        
        // Aggregate by item
        const itemMap: Record<string, any> = {};
        purchases.forEach(purchase => {
          if (purchase.invoiceStatus === 'CANCELLED' || purchase.invoiceStatus === 'DRAFT') return;
          
          const matchesFrom = !fromDate || purchase.date >= fromDate;
          const matchesTo = !toDate || purchase.date <= toDate;

          if (matchesFrom && matchesTo) {
            purchase.items.forEach(item => {
              const pId = item.product_id || item.id;
              if (productIdFilter && pId !== productIdFilter) return;

              if (!itemMap[pId]) {
                itemMap[pId] = {
                  id: pId,
                  name: item.name,
                  qty: 0,
                  total: 0
                };
              }
              itemMap[pId].qty += (Number(item.qty) || 0);
              itemMap[pId].total += (Number(item.sum) || 0);
            });
          }
        });

        setData(Object.values(itemMap));
      } catch (error) {
        console.error("Failed to fetch purchases report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [fromDate, toDate, productIdFilter]);

  const filteredData = useMemo(() => {
    return data.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      qty: acc.qty + curr.qty,
      total: acc.total + curr.total
    }), { qty: 0, total: 0 });
  }, [filteredData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <ReportPageLayout
      title="المشتريات حسب الصنف"
      onBack={() => onNavigate?.('reports')}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFilterChange={(_, __, productId) => setProductIdFilter(productId || "")}
      filterOptions={products.map(p => ({ label: p.Name || p.name || "", value: p.id || "" }))}
      filterLabel="تصفية حسب الصنف"
      summaryCards={[
        { label: "إجمالي المشتريات", value: `${totals.total.toLocaleString()} ${currency}`, icon: <DollarSign size={16} />, color: "bg-emerald-50 text-emerald-600" },
        { label: "إجمالي الوحدات", value: totals.qty.toLocaleString(), icon: <Package size={16} />, color: "bg-blue-50 text-blue-600" },
        { label: "عدد الأصناف", value: filteredData.length, icon: <ShoppingBag size={16} />, color: "bg-purple-50 text-purple-600" },
        { label: "متوسط قيمة الصنف", value: `${(filteredData.length > 0 ? totals.total / filteredData.length : 0).toLocaleString()} ${currency}`, icon: <TrendingUp size={16} />, color: "bg-orange-50 text-orange-600" }
      ]}
      onExportExcel={() => ExportService.exportToCSV(filteredData, "PurchasesByItemReport")}
      onExportPDF={() => ExportService.exportToPDFFile(
        "تقرير المبيعات حسب الصنف",
        ["اسم الصنف", "الكمية المشتراة", "إجمالي التكلفة"],
        filteredData.map(d => [d.name, d.qty, d.total.toLocaleString()]),
        "PurchasesByItemReport"
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
          <table className="w-full text-right zebra-table min-w-[600px]">
            <thead className="bg-[#F8FAFA] text-slate-400 font-bold text-[10px] uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-right font-bold">اسم الصنف</th>
                <th className="px-6 py-5 text-center font-bold">الكمية المشتراة</th>
                <th className="px-6 py-5 text-center font-bold">إجمالي التكلفة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filteredData.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5 font-bold">{item.name}</td>
                  <td className="px-6 py-5 text-center font-bold text-[#1E4D4D]">
                    {item.qty.toLocaleString()}
                  </td>
                  <td className="px-6 py-5 text-center font-bold text-emerald-600">
                    {item.total.toLocaleString()} {currency}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center text-slate-300 font-black italic">
                    لا توجد حركات مشتريات مسجلة في هذه الفترة
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

export default PurchasesByItemReport;
