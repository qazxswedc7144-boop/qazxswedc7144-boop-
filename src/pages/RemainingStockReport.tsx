
import React, { useMemo } from 'react';
import { useInventory, useUI } from '../store/AppContext';
import BaseReportPage from '../components/BaseReportPage';
import { Badge } from '../components/SharedUI';

const RemainingStockReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const { products } = useInventory();
  const { currency } = useUI();

  const data = useMemo(() => {
    return products.map(p => ({
      ...p,
      stockValue: p.StockQuantity * (p.CostPrice || 0)
    })).sort((a, b) => b.stockValue - a.stockValue);
  }, [products]);

  const columns = [
    { header: 'الصنف', accessor: 'Name' },
    { header: 'الرصيد', accessor: (p: any) => (
      <span className={p.StockQuantity <= p.MinLevel ? 'text-red-500 font-bold' : ''}>
        {p.StockQuantity} {p.DefaultUnit}
      </span>
    )},
    { header: 'التكلفة', accessor: (p: any) => `${(p.CostPrice || 0).toLocaleString()} ${currency}` },
    { header: 'قيمة المخزون', accessor: (p: any) => `${p.stockValue.toLocaleString()} ${currency}` },
    { header: 'الحالة', accessor: (p: any) => (
      <Badge variant={p.StockQuantity <= 0 ? 'danger' : p.StockQuantity <= p.MinLevel ? 'warning' : 'success'}>
        {p.StockQuantity <= 0 ? 'منتهي' : p.StockQuantity <= p.MinLevel ? 'منخفض' : 'متوفر'}
      </Badge>
    )}
  ];

  return (
    <BaseReportPage 
      title="تقرير الجرد المتبقي" 
      subtitle="قائمة بكافة الأصناف المتوفرة وقيمتها المالية الحالية بناءً على سعر التكلفة"
      data={data}
      columns={columns}
      onNavigate={onNavigate}
    />
  );
};

export default RemainingStockReport;
