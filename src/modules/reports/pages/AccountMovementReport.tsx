
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/core/db';
import { useUI, useAccounting } from '@/contexts/AppContext';
import ReportPageLayout from '../components/ReportPageLayout';
import { Badge } from '@/components/shared/SharedUI';
import { Hash, ArrowUpRight, ArrowDownLeft, Wallet, CreditCard } from 'lucide-react';
import { ExportService } from '@/services/data/exportService';

const AccountMovementReport: React.FC<{ onNavigate?: (view: any) => void }> = ({ onNavigate }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({ from: "", to: "", accountId: "" });
  const { currency } = useUI();
  const { accounts } = useAccounting();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const entries = await db.getJournalEntries();
        const movements: any[] = [];
        
        // Sort entries by date first
        entries.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const accountBalances: Record<string, number> = {};

        entries.forEach((entry: any) => {
          if (!entry.lines) return;
          entry.lines.forEach((line: any) => {
            const accId = line.accountId || line.account_id;
            if (accountBalances[accId] === undefined) accountBalances[accId] = 0;
            
            accountBalances[accId] += (line.debit - line.credit);
            
            movements.push({
              id: line.id || line.lineId || Math.random().toString(),
              accountId: accId,
              date: entry.date,
              ref: entry.reference_id || entry.id,
              type: entry.sourceType || 'قيد يدوي',
              description: entry.description || 'لا يوجد وصف',
              accountName: line.accountName,
              amount: line.debit > 0 ? line.debit : -line.credit,
              balanceAfter: accountBalances[accId]
            });
          });
        });

        setData(movements.reverse());
      } catch (error) {
        console.error("Failed to fetch account movements:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(m => {
      const matchesSearch = (m.accountName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
                            (m.description?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                            (m.ref?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      const matchesFrom = !dateFilter.from || m.date >= dateFilter.from;
      const matchesTo = !dateFilter.to || m.date <= dateFilter.to;
      const matchesAccount = !dateFilter.accountId || m.accountId === dateFilter.accountId;
      return matchesSearch && matchesFrom && matchesTo && matchesAccount;
    });
  }, [data, searchTerm, dateFilter]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => {
      if (curr.amount > 0) acc.debit += curr.amount;
      else acc.credit += Math.abs(curr.amount);
      return acc;
    }, { debit: 0, credit: 0 });
  }, [filteredData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#1E4D4D] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <ReportPageLayout
      title="حركة الحسابات"
      onBack={() => onNavigate?.('reports')}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onFilterChange={(from, to, accountId) => setDateFilter({ from, to, accountId: accountId || "" })}
      filterOptions={accounts.map(acc => ({ label: acc.name || acc.account_name || "", value: acc.id || acc.account_id || "" }))}
      filterLabel="تصفية حسب الحساب"
      summaryCards={[
        { label: "إجمالي المدين", value: `${totals.debit.toLocaleString()} ${currency}`, icon: <ArrowDownLeft size={16} />, color: "bg-emerald-50 text-emerald-600" },
        { label: "إجمالي الدائن", value: `${totals.credit.toLocaleString()} ${currency}`, icon: <ArrowUpRight size={16} />, color: "bg-red-50 text-red-600" },
        { label: "صافي التغير", value: `${(totals.debit - totals.credit).toLocaleString()} ${currency}`, icon: <Wallet size={16} />, color: "bg-blue-50 text-blue-600" },
        { label: "عدد العمليات", value: filteredData.length, icon: <CreditCard size={16} />, color: "bg-purple-50 text-purple-600" }
      ]}
      onExportExcel={() => ExportService.exportToCSV(filteredData, "AccountMovementReport")}
      onExportPDF={() => ExportService.exportToPDFFile(
        "تقرير حركة الحسابات",
        ["التاريخ", "المرجع", "النوع", "الحساب", "المبلغ", "الرصيد"],
        filteredData.map(d => [d.date, d.ref, d.type, d.accountName, d.amount, d.balanceAfter]),
        "AccountMovementReport"
      )}
      onPrint={() => window.print()}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-right zebra-table min-w-[900px]">
          <thead className="bg-[#F8FAFA] text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-5 text-right font-black">التاريخ</th>
              <th className="px-6 py-5 text-right font-black">رقم العملية</th>
              <th className="px-6 py-5 text-right font-black">نوع العملية</th>
              <th className="px-6 py-5 text-right font-black">الحساب</th>
              <th className="px-6 py-5 text-center font-black">المبلغ</th>
              <th className="px-6 py-5 text-center font-black">الرصيد بعد العملية</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredData.map((m, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-5 text-xs font-bold text-slate-500">
                  {new Date(m.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td className="px-6 py-5 text-slate-700 font-bold">
                  <div className="flex items-center gap-2">
                    <Hash size={12} className="text-slate-300" />
                    <span>{m.ref}</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                   <Badge variant="info">{m.type}</Badge>
                </td>
                <td className="px-6 py-5 font-bold text-slate-700">{m.accountName}</td>
                <td className={`px-6 py-5 text-center font-black ${m.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {m.amount.toLocaleString()} {currency}
                </td>
                <td className="px-6 py-5 text-center font-black text-[#1E4D4D]">
                  {m.balanceAfter.toLocaleString()} {currency}
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-slate-300 font-black italic">
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

export default AccountMovementReport;
