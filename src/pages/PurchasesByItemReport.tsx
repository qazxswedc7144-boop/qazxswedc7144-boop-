
import React, { useState, useEffect } from 'react';
import BaseReportPage from '../components/BaseReportPage';
import { db } from '../lib/database';

const PurchasesByItemReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const purchases = await db.getPurchases();
        const supps = await db.getSuppliers();
        setSuppliers(supps.map(s => ({ id: s.Supplier_ID, name: s.Supplier_Name })));

        // Aggregate by item
        const itemMap: Record<string, any> = {};
        purchases.forEach(purchase => {
          if (purchase.invoiceStatus === 'CANCELLED' || purchase.invoiceStatus === 'DRAFT') return;
          
          purchase.items.forEach(item => {
            if (!itemMap[item.id]) {
              itemMap[item.id] = {
                id: item.id,
                name: item.name,
                qty: 0,
                total: 0,
                date: purchase.date,
                partnerId: purchase.partnerId
              };
            }
            itemMap[item.id].qty += item.qty;
            itemMap[item.id].total += item.sum;
          });
        });

        setData(Object.values(itemMap));
      } catch (error) {
        console.error("Failed to fetch purchases report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const columns = [
    { header: 'الصنف', accessor: 'name', sortKey: 'name' },
    { header: 'الكمية المشتراة', accessor: (item: any) => item.qty.toLocaleString(), sortKey: 'qty' },
    { header: 'إجمالي المشتريات', accessor: (item: any) => item.total.toLocaleString() + ' AED', sortKey: 'total' },
  ];

  return (
    <BaseReportPage 
      title="المشتريات حسب الصنف" 
      subtitle="تحليل كميات وقيم المشتريات لكل صنف"
      data={data}
      columns={columns}
      onNavigate={onNavigate}
      showPartnerFilter={true}
      partners={suppliers}
    />
  );
};

export default PurchasesByItemReport;
