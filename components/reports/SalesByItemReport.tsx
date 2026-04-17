
import React, { useState, useEffect } from 'react';
import BaseReportPage from './BaseReportPage';
import { db } from '../../services/database';

const SalesByItemReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sales = await db.getSales();
        const custs = await db.getCustomers();
        setCustomers(custs.map((c: any) => ({ 
          id: c.Supplier_ID || c.id, 
          name: c.Supplier_Name || c.name 
        })));

        // Aggregate by item
        const itemMap: Record<string, any> = {};
        sales.forEach(sale => {
          if (sale.InvoiceStatus === 'CANCELLED' || sale.InvoiceStatus === 'DRAFT') return;
          
          sale.items.forEach(item => {
            if (!itemMap[item.id]) {
              itemMap[item.id] = {
                id: item.id,
                name: item.name,
                qty: 0,
                total: 0,
                date: sale.date, // For date filtering in BaseReportPage
                customerId: sale.customerId // For partner filtering in BaseReportPage
              };
            }
            itemMap[item.id].qty += item.qty;
            itemMap[item.id].total += item.sum;
          });
        });

        setData(Object.values(itemMap));
      } catch (error) {
        console.error("Failed to fetch sales report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const columns = [
    { header: 'الصنف', accessor: 'name', sortKey: 'name' },
    { header: 'الكمية المباعة', accessor: (item: any) => item.qty.toLocaleString(), sortKey: 'qty' },
    { header: 'إجمالي المبيعات', accessor: (item: any) => item.total.toLocaleString() + ' AED', sortKey: 'total' },
  ];

  return (
    <BaseReportPage 
      title="المبيعات حسب الصنف" 
      subtitle="تحليل كميات وقيم المبيعات لكل صنف"
      data={data}
      columns={columns}
      onNavigate={onNavigate}
      showPartnerFilter={true}
      partners={customers}
    />
  );
};

export default SalesByItemReport;
