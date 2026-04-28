
import React, { useMemo, useState, useEffect } from 'react';
import { useInventory, useUI } from '../store/AppContext';
import BaseReportPage from '../components/BaseReportPage';
import { SalesRepository } from '../services/repositories/SalesRepository';
import { Sale } from '../types';

const ItemProfitsReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { products } = useInventory();
  const { currency } = useUI();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

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
      name: string, 
      qty: number, 
      revenue: number, 
      cost: number, 
      profit: number,
      margin: number
    }> = {};

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const productId = item.product_id;
        const product = products.find(p => p.id === productId);
        
        if (!itemStats[productId]) {
          itemStats[productId] = {
            name: item.name || product?.Name || 'صنف غير معروف',
            qty: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            margin: 0
          };
        }

        const qty = item.qty || 0;
        const price = item.price || 0;
        const cost = product?.CostPrice || 0;

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
  }, [sales, products, loading]);

  const columns = [
    { header: 'الصنف', accessor: 'name', sortKey: 'name' },
    { header: 'الكمية المباعة', accessor: (d: any) => `${d.qty.toLocaleString()}`, sortKey: 'qty' },
    { header: 'إجمالي المبيعات', accessor: (d: any) => `${d.revenue.toLocaleString()} ${currency}`, sortKey: 'revenue' },
    { header: 'إجمالي التكلفة', accessor: (d: any) => `${d.cost.toLocaleString()} ${currency}`, sortKey: 'cost' },
    { header: 'صافي الربح', accessor: (d: any) => (
      <span className={d.profit >= 0 ? 'text-emerald-600 font-black' : 'text-red-500 font-black'}>
        {d.profit.toLocaleString()} {currency}
      </span>
    ), sortKey: 'profit' },
    { header: 'هامش الربح', accessor: (d: any) => (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-16">
          <div 
            className={`h-full ${d.margin > 20 ? 'bg-emerald-500' : d.margin > 10 ? 'bg-blue-500' : 'bg-amber-500'}`} 
            style={{ width: `${Math.min(Math.max(d.margin, 0), 100)}%` }}
          ></div>
        </div>
        <span className="text-[10px] font-black text-slate-400">{d.margin.toFixed(1)}%</span>
      </div>
    ), sortKey: 'margin' }
  ];

  return (
    <BaseReportPage 
      title="تقرير أرباح الأصناف" 
      subtitle="تحليل الربحية لكل صنف بناءً على المبيعات الفعلية وتكلفة الشراء"
      data={data}
      columns={columns}
      onNavigate={onNavigate}
    >
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </BaseReportPage>
  );
};

export default ItemProfitsReport;
