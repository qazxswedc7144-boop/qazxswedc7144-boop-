import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  BarChart3, Calendar, Download, Printer, ArrowRight,
  TrendingUp, Wallet, Package, ArrowDownRight, 
  Users, UserCheck, ShieldAlert, Receipt, Search, RefreshCw
} from "lucide-react";
import { useUI } from "@/contexts/AppContext";
import { ReportEngine } from "@/services/reports/reportEngine";
import { Button } from "@/components/shared/SharedUI";

interface FinancialEngineReportProps {
  onNavigate: (view: string) => void;
}

type TabType = 
  | 'trial-balance'
  | 'profit-loss'
  | 'balance-sheet'
  | 'inventory-valuation'
  | 'cash-flow'
  | 'customer-balances'
  | 'supplier-balances'
  | 'aging-reports-customer'
  | 'aging-reports-supplier'
  | 'tax-reports';

export default function FinancialEngineReport({ onNavigate }: FinancialEngineReportProps) {
  const { currency, addToast } = useUI();
  const formatNum = (val: any) => {
    if (val === undefined || val === null || isNaN(Number(val))) return "0";
    return Number(val).toLocaleString();
  };
  const [activeTab, setActiveTab] = useState<TabType>('trial-balance');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().substring(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reportData, setReportData] = useState<any>(null);

  // Load report data from ReportEngine
  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      let data: any = null;
      switch (activeTab) {
        case 'trial-balance':
          data = await ReportEngine.getTrialBalance(startDate, endDate);
          break;
        case 'profit-loss':
          data = await ReportEngine.getProfitLoss(startDate, endDate);
          break;
        case 'balance-sheet':
          data = await ReportEngine.getBalanceSheet(endDate);
          break;
        case 'inventory-valuation':
          data = await ReportEngine.getInventoryValue();
          break;
        case 'cash-flow':
          data = await ReportEngine.getCashFlow(startDate, endDate);
          break;
        case 'customer-balances':
          data = await ReportEngine.getCustomerBalances();
          break;
        case 'supplier-balances':
          data = await ReportEngine.getSupplierBalances();
          break;
        case 'aging-reports-customer':
          data = await ReportEngine.getAgingReport('CUSTOMER');
          break;
        case 'aging-reports-supplier':
          data = await ReportEngine.getAgingReport('SUPPLIER');
          break;
        case 'tax-reports':
          data = await ReportEngine.getTaxReport(startDate, endDate);
          break;
      }
      setReportData(data);
    } catch (error) {
      console.error("Error executing financial reporting calculations:", error);
      addToast("خطأ أثناء تجميع البيانات المالية الحقيقية.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab, startDate, endDate]);

  // Handle excel (CSV UTF-8 BOM) export
  const handleExportExcel = () => {
    if (!reportData) return;
    try {
      let csvContent = "\uFEFF"; // UTF-8 BOM
      
      if (activeTab === 'trial-balance') {
        csvContent += "رمز الحساب,اسم الحساب,النوع,الحركات الدائنة,الحركات المدينة,الرصيد المدين النهائي,الرصيد الدائن النهائي\n";
        reportData.forEach((item: any) => {
          csvContent += `"${item.code}","${item.name}","${item.type}",${item.credit},${item.debit},${item.endingDebit},${item.endingCredit}\n`;
        });
      } else if (activeTab === 'profit-loss') {
        csvContent += "البند,القيمة\n";
        csvContent += `"إجمالي الإيرادات",${reportData.revenue}\n`;
        csvContent += `"تكلفة المبيعات (COGS)",${reportData.cogs}\n`;
        csvContent += `"إجمالي الربح (Gross Profit)",${reportData.grossProfit}\n`;
        csvContent += `"المصاريف التشغيلية (Expenses)",${reportData.expenses}\n`;
        csvContent += `"صافي الربح الفعلي",${reportData.netProfit}\n`;
        csvContent += `"هامش الربح التشغيلي",${reportData.margin.toFixed(2)}%\n`;
      } else if (activeTab === 'balance-sheet') {
        csvContent += "البند,النوع,القيمة\n";
        csvContent += "--- الأصول ---\n";
        reportData.assets.forEach((a: any) => {
          csvContent += `"${a.name}","أصول",${a.amount}\n`;
        });
        csvContent += `"إجمالي الأصول",,${reportData.totalAssets}\n\n`;
        csvContent += "--- الالتزامات ---\n";
        reportData.liabilities.forEach((l: any) => {
          csvContent += `"${l.name}","التزامات",${l.amount}\n`;
        });
        csvContent += `"إجمالي الالتزامات",,${reportData.totalLiabilities}\n\n`;
        csvContent += "--- حقوق الملكية ---\n";
        reportData.equity.forEach((e: any) => {
          csvContent += `"${e.name}","حقوق ملكية",${e.amount}\n`;
        });
        csvContent += `"إجمالي حقوق الملكية",,${reportData.totalEquity}\n`;
      } else if (activeTab === 'inventory-valuation') {
        csvContent += "اسم المادة,الباركود,الفئة,الكمية المتوفرة,تكلفة الوحدة,سعر البيع,قيمة التكلفة الإجمالية,القيمة السوقية المتوقعة\n";
        reportData.items.forEach((item: any) => {
          csvContent += `"${item.name}","${item.code}","${item.category}",${item.quantity},${item.unitCost},${item.unitSell},${item.costValue},${item.salesValue}\n`;
        });
      } else if (activeTab === 'cash-flow') {
        csvContent += "تاريخ الحركة,الوصف,النوع,المبلغ,المصدر\n";
        reportData.flows.forEach((f: any) => {
          csvContent += `"${f.date}","${f.description}","${f.type}",${f.amount},"${f.source}"\n`;
        });
        csvContent += `\n"رصيد النقد البداية",,${reportData.startingBalance}\n`;
        csvContent += `"رصيد كشف النقد النهائي",,${reportData.endingBalance}\n`;
      } else if (activeTab === 'customer-balances' || activeTab === 'supplier-balances') {
        csvContent += "الاسم المستعار,رقم الهاتف,إجمالي تعاملات الفولدر,المبالغ المسددة,رصيد الذمة المفتوحة\n";
        reportData.forEach((item: any) => {
          csvContent += `"${item.name}","${item.phone}",${item.totalSales || item.totalPurchases || 0},${item.totalPaid},${item.balance}\n`;
        });
      } else if (activeTab === 'aging-reports-customer' || activeTab === 'aging-reports-supplier') {
        csvContent += "الشريك,الفاتورة المرتبطة,تاريخها,الأيام المتأخرة,المبلغ المستحق,0-30 يوم,31-60 يوم,61-90 يوم,أعلى من 90 يوم\n";
        reportData.forEach((item: any) => {
          csvContent += `"${item.partnerName}","${item.docId}","${item.date}",${item.days},${item.amount},${item.bucket1},${item.bucket2},${item.bucket3},${item.bucket4}\n`;
        });
      } else if (activeTab === 'tax-reports') {
        csvContent += "البند المالي,المبلغ الخاضع للضريبة,مجموع ضريبة القيمة المضافة\n";
        csvContent += `"المبيعات المصدرة",${reportData.totalSalesTaxable},${reportData.outputVat}\n`;
        csvContent += `"المشتريات المدخلة",${reportData.totalPurchasesTaxable},${reportData.inputVat}\n`;
        csvContent += `"فرق الضريبة المتبقي للدفع",,${reportData.netTaxPayable}\n`;
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Financial_${activeTab}_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast("تم تصدير ملفات البيانات إلى Excel بنجاح.", "success");
    } catch {
      addToast("فشل في تحويل وتصدير البيانات.", "error");
    }
  };

  // Printing Layout
  const handlePrint = () => {
    window.print();
  };

  const tabsConfig = [
    { id: 'trial-balance', label: 'ميزان المراجعة', icon: <BarChart3 size={16} />, desc: 'رصد توازن الحركات المدينة والدائنة لكافة حسابات الأستاذ العام.' },
    { id: 'profit-loss', label: 'الأرباح والخسائر', icon: <TrendingUp size={16} />, desc: 'قائمة الدخل - الإيرادات، كلفة المبيعات، وهوامش الربح.' },
    { id: 'balance-sheet', label: 'الميزانية العمومية', icon: <Wallet size={16} />, desc: 'تحليل الأصول، الالتزامات وحقوق الملكية للحسابات القائمة.' },
    { id: 'inventory-valuation', label: 'تقييم المخزون', icon: <Package size={16} />, desc: 'رصد تكلفة مخزون المنتجات متضمنة الهوامش والأرباح غير المحققة.' },
    { id: 'cash-flow', label: 'التفوقات النقدية', icon: <ArrowDownRight size={16} />, desc: 'بيان حركة دخول وخروج النقد (صندوق / بنك) مباشرة.' },
    { id: 'customer-balances', label: 'أرصدة العملاء', icon: <Users size={16} />, desc: 'رصد المديونيات، ومبيعات كل عميل والمبالغ المسددة.' },
    { id: 'supplier-balances', label: 'أرصدة الموردين', icon: <UserCheck size={16} />, desc: 'تتبع مشتريات ودفعات الموردين والأرصدة الدائنة المستحقة.' },
    { id: 'aging-reports-customer', label: 'تعمير ذمم العملاء', icon: <ShieldAlert size={16} />, desc: 'تقسيم ديون العملاء غير المسددة حسب الفترة.' },
    { id: 'aging-reports-supplier', label: 'تعمير ذمم الموردين', icon: <ShieldAlert size={16} />, desc: 'توزيع التزامات الموردين المستحقة زمنياً.' },
    { id: 'tax-reports', label: 'التقرير الضريبي VAT', icon: <Receipt size={16} />, desc: 'احتساب الضريبة المخرجة للعملاء والمدخلة للموردين وفارق التسوية.' }
  ];

  const currentTabName = tabsConfig.find(tc => tc.id === activeTab)?.label || '';

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFA] text-slate-900" dir="rtl">
      
      {/* Header Panel */}
      <header className="sticky top-0 z-[40] bg-white border-b border-slate-100 px-6 h-20 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('reports')}
            className="w-10 h-10 bg-slate-50 border border-slate-100 flex items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-[#1E4D4D] transition-all"
          >
            <ArrowRight size={20} />
          </motion.button>
          <div>
            <h1 className="text-lg font-black text-[#1E4D4D] tracking-tight">محرك التقارير المالية المتكامل</h1>
            <p className="text-[10px] text-slate-400 font-bold">بدون stubs - حسابات حقيقية دقيقة من الدفاتر مباشرة</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="px-4 h-11 bg-white border border-slate-200 text-slate-600 hover:border-[#1E4D4D] hover:text-[#1E4D4D] rounded-xl flex items-center gap-2 text-xs font-black transition-all"
          >
            <Printer size={16} />
            <span>طباعة التقرير</span>
          </button>
          <button 
            onClick={handleExportExcel}
            className="px-4 h-11 bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl flex items-center gap-2 text-xs font-black transition-all"
          >
            <Download size={16} />
            <span>تصدير Excel (CSV)</span>
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* RIGHT COLUMN: Nav Tabs list */}
        <div className="lg:col-span-1 flex flex-col gap-3 print:hidden">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-3">
            <h3 className="text-xs font-black text-[#1E4D4D] mb-1">حدد حقول التقرير</h3>
            
            {/* Start Date */}
            {activeTab !== 'balance-sheet' && activeTab !== 'inventory-valuation' && activeTab !== 'customer-balances' && activeTab !== 'supplier-balances' && (
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">من تاريخ</label>
                <div className="relative">
                  <Calendar size={14} className="absolute right-3 top-3.5 text-slate-400" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl pr-9 pl-3 h-10 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1E4D4D]"
                  />
                </div>
              </div>
            )}

            {/* End Date */}
            {activeTab !== 'inventory-valuation' && activeTab !== 'customer-balances' && activeTab !== 'supplier-balances' && (
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">حتى تاريخ</label>
                <div className="relative">
                  <Calendar size={14} className="absolute right-3 top-3.5 text-slate-400" />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl pr-9 pl-3 h-10 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1E4D4D]"
                  />
                </div>
              </div>
            )}

            {/* Search filter input */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">بحث في النتائج</label>
              <div className="relative">
                <Search size={14} className="absolute right-3 top-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="ابحث هنا..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl pr-9 pl-3 h-10 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1E4D4D]"
                />
              </div>
            </div>

            <Button 
              variant="secondary" 
              onClick={fetchReportData} 
              className="h-10 text-xs font-black shadow-none border border-slate-100 hover:bg-slate-50 mt-2"
              icon={<RefreshCw size={14} />}
            >
              تحديث البيانات
            </Button>
          </div>

          {/* List of tabs */}
          <div className="bg-white p-2 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 px-3 py-2">قائمة التقارير المالية</span>
            {tabsConfig.map((item) => {
              const active = item.id === activeTab;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setReportData(null);
                    setIsLoading(true);
                    setActiveTab(item.id as TabType);
                    setSearchTerm("");
                  }}
                  className={`w-full flex items-center justify-between text-right px-3 py-3 rounded-2xl transition-all ${active ? 'bg-[#1E4D4D] text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 hover:text-[#1E4D4D]'}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`${active ? 'text-white' : 'text-slate-400'}`}>{item.icon}</span>
                    <span className="text-xs font-black">{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* LEFT COLUMN: Main results display area */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Print only banner */}
          <div className="hidden print:block mb-8 text-center">
            <h2 className="text-2xl font-black text-[#1E4D4D]">{currentTabName}</h2>
            <p className="text-xs text-slate-500 font-bold mt-1">المستخرج من محرك التقارير المالية المتكامل</p>
            <p className="text-[10px] text-slate-400 font-medium">الفترة الزمنية المصدرة: من {startDate} إلى {endDate}</p>
          </div>

          {isLoading ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-slate-100 border-t-[#1E4D4D] animate-spin mb-2" />
              <h3 className="text-sm font-black text-[#1E4D4D]">جارٍ طحن الحسابات ومزامنة حركة الفواتير والذمم...</h3>
              <p className="text-xs text-slate-400 font-bold">يتم جلب الحسابات مباشرة من قاعدة بيانات الـ Ledger ونفي Stubs</p>
            </div>
          ) : !reportData ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center">
              <span className="text-slate-300 block text-5xl mb-3">⚲</span>
              <h3 className="text-sm font-black text-slate-700">لم يتم العثور على أية سجلات مالية</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">تأكد من تعديل فلاتر التاريخ والتحقق من ترحيل قيود اليومية.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              
              {/* RENDER ACTIVE TAB */}
              {activeTab === 'trial-balance' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-6">
                  <div>
                    <h2 className="text-base font-black text-[#1E4D4D]">ميزان المراجعة بالأرصدة والحركات</h2>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">يقوم بفحص ومطابقة القيود المزدوجة ومجموع الحسابات لضمان عدم حدوث تخلخل مالي.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-100">
                          <th className="p-3">رمز الحساب</th>
                          <th className="p-3">اسم حساب الأستاذ</th>
                          <th className="p-3">الحركات المدنية (Debit)</th>
                          <th className="p-3">الحركات الدائنة (Credit)</th>
                          <th className="p-3 text-[#1E4D4D]">الرصيد المدين النهائي</th>
                          <th className="p-3 text-red-600">الرصيد الدائن النهائي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                        {reportData
                          .filter((item: any) => 
                            item.name.includes(searchTerm) || 
                            item.code.includes(searchTerm) || 
                            item.type.includes(searchTerm)
                          )
                          .map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-mono text-[11px] text-slate-500">{item?.code}</td>
                              <td className="p-3 font-black text-slate-700">{item?.name}</td>
                              <td className="p-3 text-slate-600">{formatNum(item?.debit)}</td>
                              <td className="p-3 text-slate-600">{formatNum(item?.credit)}</td>
                              <td className="p-3 text-emerald-700 font-bold">{item?.endingDebit > 0 ? `${formatNum(item?.endingDebit)} ${currency}` : '-'}</td>
                              <td className="p-3 text-red-700 font-bold">{item?.endingCredit > 0 ? `${formatNum(item?.endingCredit)} ${currency}` : '-'}</td>
                            </tr>
                          ))}
                        
                        {/* Summary totals row */}
                        <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-[#1E4D4D]">
                          <td className="p-3" colSpan={2}>المجموع المتطابق للقيود</td>
                          <td className="p-3">
                            {formatNum(reportData?.reduce?.((sum: number, item: any) => sum + (item?.debit || 0), 0))} {currency}
                          </td>
                          <td className="p-3">
                            {formatNum(reportData?.reduce?.((sum: number, item: any) => sum + (item?.credit || 0), 0))} {currency}
                          </td>
                          <td className="p-3 text-emerald-800">
                            {formatNum(reportData?.reduce?.((sum: number, item: any) => sum + (item?.endingDebit || 0), 0))} {currency}
                          </td>
                          <td className="p-3 text-red-800">
                            {formatNum(reportData?.reduce?.((sum: number, item: any) => sum + (item?.endingCredit || 0), 0))} {currency}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'profit-loss' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Summary Metric Cards */}
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm md:col-span-1">
                    <span className="text-[10px] text-slate-400 font-black">إجمالي الإيرادات (Sales)</span>
                    <h3 className="text-2xl font-black text-emerald-600 mt-1">{formatNum(reportData?.revenue)} <span className="text-xs font-normal text-slate-400">{currency}</span></h3>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm md:col-span-1">
                    <span className="text-[10px] text-slate-400 font-black">تكلفة البضاعة المباعة (COGS)</span>
                    <h3 className="text-2xl font-black text-red-500 mt-1">{formatNum(reportData?.cogs)} <span className="text-xs font-normal text-slate-400">{currency}</span></h3>
                  </div>
                  <div className="bg-[#1E4D4D] text-white p-5 rounded-3xl shadow-sm md:col-span-1">
                    <span className="text-[10px] text-emerald-100 font-black">صافي الأرباح التشغيلية</span>
                    <h3 className="text-2xl font-black text-white mt-1">{formatNum(reportData?.netProfit)} <span className="text-xs font-normal text-emerald-200">{currency}</span></h3>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm md:col-span-3 flex flex-col gap-6">
                    <h2 className="text-base font-black text-[#1E4D4D]">قائمة الأرباح والخسائر للنشاط</h2>
                    
                    <div className="flex flex-col divide-y divide-slate-100 font-semibold text-xs">
                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-700 font-black">إجمالي المبيعات النشطة (Revenue)</span>
                        <span className="text-emerald-700 font-black">+{formatNum(reportData?.revenue)} {currency}</span>
                      </div>
                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-700 font-black">تكلفة المبيعات (COGS)</span>
                        <span className="text-red-600">-{formatNum(reportData?.cogs)} {currency}</span>
                      </div>
                      <div className="flex justify-between p-3.5 bg-slate-50 font-black text-sm text-[#1E4D4D]">
                        <span>إجمالي هامش الربح (Gross Profit)</span>
                        <span>{formatNum(reportData?.grossProfit)} {currency}</span>
                      </div>
                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-700 font-black">المصاريف التشغيلية والإدارية (Expenses)</span>
                        <span className="text-red-600">-{formatNum(reportData?.expenses)} {currency}</span>
                      </div>
                      
                      {/* Expense details list if any */}
                      {(reportData?.expenseDetails || []).map((exp: any) => (
                        <div key={exp.id} className="flex justify-between pr-8 pl-3.5 py-2 text-slate-500 text-[11px]">
                          <span>{exp.name} ({exp.code})</span>
                          <span>{formatNum(exp.amount)} {currency}</span>
                        </div>
                      ))}

                      <div className="flex justify-between p-3.5 bg-emerald-50 font-black text-base text-emerald-800">
                        <span>صافي الربح الفعلي (Net Profit)</span>
                        <span>{formatNum(reportData?.netProfit)} {currency}</span>
                      </div>
                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-700 font-black">النسبة المئوية لهامش التشغيل (%)</span>
                        <span className="font-serif text-[#1E4D4D] font-black">{Number(reportData?.margin || 0).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'balance-sheet' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-black text-[#1E4D4D]">قائمة الميزانية العمومية المتوازنة</h2>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">تتبع الوضع المالي الشامل للشركة حتى تاريخ {reportData?.asOfDate}.</p>
                    </div>
                    {reportData?.isBalanced ? (
                      <span className="px-3 py-1 text-[10px] font-black bg-emerald-100 text-emerald-700 rounded-lg">الميزانية متطابقة ومتوازنة ✓</span>
                    ) : (
                      <span className="px-3 py-1 text-[10px] font-black bg-red-100 text-red-600 rounded-lg">فارق تسوية غير متوازن ⚠</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Assets Col */}
                    <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                      <h3 className="text-xs font-black text-[#1E4D4D] border-b border-slate-200 pb-2 mb-3">الأصول (Assets)</h3>
                      <div className="flex flex-col gap-2.5 text-xs font-semibold">
                        {(reportData?.assets || []).map((a: any) => (
                          <div key={a.id} className="flex justify-between">
                            <span className="text-slate-600">{a.name} <span className="font-mono text-[10px] text-slate-400">({a.code})</span></span>
                            <span className="font-bold text-slate-800">{formatNum(a.amount)} {currency}</span>
                          </div>
                        ))}
                        {(reportData?.assets || []).length === 0 && (
                          <span className="text-[11px] text-slate-400 italic">لا توجد أصول مسجلة بعد.</span>
                        )}
                        <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-black text-rose-800 text-sm">
                          <span>إجمالي الأصول</span>
                          <span>{formatNum(reportData?.totalAssets)} {currency}</span>
                        </div>
                      </div>
                    </div>

                    {/* Liabilities + Equity Col */}
                    <div className="flex flex-col gap-4">
                      {/* Liabilities */}
                      <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                        <h3 className="text-xs font-black text-[#1E4D4D] border-b border-slate-200 pb-2 mb-3">الالتزامات المطلوبة (Liabilities)</h3>
                        <div className="flex flex-col gap-2.5 text-xs font-semibold">
                          {(reportData?.liabilities || []).map((l: any) => (
                            <div key={l.id} className="flex justify-between">
                              <span className="text-slate-600">{l.name} <span className="font-mono text-[10px] text-slate-400">({l.code})</span></span>
                              <span className="font-bold text-slate-800">{formatNum(l.amount)} {currency}</span>
                            </div>
                          ))}
                          {(reportData?.liabilities || []).length === 0 && (
                            <span className="text-[11px] text-slate-400 italic">لا توجد مطلوبات التزام مسجلة.</span>
                          )}
                          <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-black text-slate-700">
                            <span>إجمالي المطلوبات للشركاء</span>
                            <span>{formatNum(reportData?.totalLiabilities)} {currency}</span>
                          </div>
                        </div>
                      </div>

                      {/* Equity */}
                      <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                        <h3 className="text-xs font-black text-[#1E4D4D] border-b border-slate-200 pb-2 mb-3">حقوق الملكية ورأس المال (Equity)</h3>
                        <div className="flex flex-col gap-2.5 text-xs font-semibold">
                          {(reportData?.equity || []).map((e: any) => (
                            <div key={e.id} className="flex justify-between">
                              <span className="text-slate-600">{e.name}</span>
                              <span className="font-bold text-slate-800">{formatNum(e.amount)} {currency}</span>
                            </div>
                          ))}
                          <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-black text-[#1E4D4D] text-sm">
                            <span>إجمالي الخصوم وحقوق الملكية</span>
                            <span>{formatNum((reportData?.totalLiabilities || 0) + (reportData?.totalEquity || 0))} {currency}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'inventory-valuation' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 font-bold">مجموع قيمة المخزون الحالي (سعر الكلفة)</span>
                      <h3 className="text-xl font-black text-[#1E4D4D] mt-1">{formatNum(reportData?.totalCostValue)} {currency}</h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 font-bold">إجمالي القيمة البيعية المتوقعة للمستودع</span>
                      <h3 className="text-xl font-black text-blue-700 mt-1">{formatNum(reportData?.totalSalesValue)} {currency}</h3>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <span className="text-[9px] text-emerald-600 font-bold">الأرباح المخزنة (الربح المتوقع Unrealized)</span>
                      <h3 className="text-xl font-black text-emerald-800 mt-1">+{formatNum(reportData?.totalProfitPotential)} {currency}</h3>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-base font-black text-[#1E4D4D]">تفاصيل تقييم المواد المخزنة</h2>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">قائمة دقيقة بالمواد المصنفة في المستودع والمقيمة وفقاً لطرق متوسط التكلفة المرجح.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-100">
                          <th className="p-3">اسم المادة</th>
                          <th className="p-3">باركود/كود</th>
                          <th className="p-3">الفئة</th>
                          <th className="p-3 text-center">الكمية المتوفرة</th>
                          <th className="p-3 text-left">سعر التكلفة</th>
                          <th className="p-3 text-left">القيمة الإجمالية (تكلفة)</th>
                          <th className="p-3 text-left">سعر البيع الافتراضي</th>
                          <th className="p-3 text-left text-[#1E4D4D]">القيمة البيعية المتوقعة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                        {(reportData?.items || [])
                          .filter((item: any) => 
                            item?.name?.includes(searchTerm) || 
                            item?.code?.includes(searchTerm) || 
                            item?.category?.includes(searchTerm)
                          )
                          .map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-black text-slate-700">{item?.name}</td>
                              <td className="p-3 font-mono text-[11px] text-slate-500">{item?.code}</td>
                              <td className="p-3 text-slate-500">{item?.category}</td>
                              <td className="p-3 text-center font-bold text-slate-800">{item?.quantity}</td>
                              <td className="p-3 text-left">{formatNum(item?.unitCost)}</td>
                              <td className="p-3 text-left text-red-700 font-bold">{formatNum(item?.costValue)} {currency}</td>
                              <td className="p-3 text-left">{formatNum(item?.unitSell)}</td>
                              <td className="p-3 text-left text-emerald-700 font-bold">{formatNum(item?.salesValue)} {currency}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'cash-flow' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Summary Card */}
                    <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                      <h3 className="text-xs font-black text-[#1E4D4D] mb-3 border-b border-slate-200 pb-2">ملخص النقد والسيولة</h3>
                      <div className="flex flex-col gap-2.5 text-xs font-semibold">
                        <div className="flex justify-between">
                          <span className="text-slate-500">رصيد البداية المفتوح</span>
                          <span className="font-bold text-slate-800">{formatNum(reportData?.startingBalance)} {currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">مقبوضات نقدية من العملاء</span>
                          <span className="font-bold text-emerald-700">+{formatNum(reportData?.collectionsFromCustomers)} {currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">دفعات نقدية للموردين</span>
                          <span className="font-bold text-red-500">-{formatNum(reportData?.paymentsToSuppliers)} {currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">مصروفات تشغيلية مسددة</span>
                          <span className="font-bold text-red-500">-{formatNum(reportData?.operatingExpensesPaid)} {currency}</span>
                        </div>
                        {reportData?.otherInflows > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">إيرادات نقدية أخرى</span>
                            <span className="font-bold text-emerald-600">+{formatNum(reportData?.otherInflows)} {currency}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-rose-800 text-sm">
                          <span>رصيد النقد المتوفر الفعلي</span>
                          <span>{formatNum(reportData?.endingBalance)} {currency}</span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-2 justify-center">
                      <h3 className="text-sm font-black text-[#1E4D4D]">بيان التدفقات النقدية (الأسلوب المباشر)</h3>
                      <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                        يقوم محرك التقرير بمسح حسابات الصندوق النقدية (ACC-101) وحسابات البنك الدفترية (ACC-104) لرصد السيولة والآثار المباشرة لكافة الدفعات والقيود دون قيود غير نقدية كالاستهلاكات أو المخصصات المضافة.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black text-slate-700 mb-2">سجل حركات التدفق النقدي</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-100">
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">الوصف والبيان</th>
                            <th className="p-3">التصنيف والمرجع</th>
                            <th className="p-3 text-left">التأثير المالي على النقود</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {(reportData?.flows || [])
                            .filter((item: any) => 
                              item?.description?.includes(searchTerm) || 
                              item?.source?.includes(searchTerm)
                            )
                            .map((item: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-3 text-slate-500 font-mono text-[11px]">{item?.date}</td>
                                <td className="p-3 font-bold text-slate-700">{item?.description}</td>
                                <td className="p-3"><span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-slate-100 text-slate-600">{item?.source}</span></td>
                                <td className={`p-3 text-left font-black ${item?.type === 'INFLOW' ? 'text-emerald-700' : 'text-red-500'}`}>
                                  {item?.type === 'INFLOW' ? `+${formatNum(item?.amount)}` : `-${formatNum(item?.amount)}`} {currency}
                                </td>
                              </tr>
                            ))}
                          {(reportData?.flows || []).length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400 font-semibold italic">لا توجد حركات نقدية في الفترة الخاضعة للتقرير.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {(activeTab === 'customer-balances' || activeTab === 'supplier-balances') && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-6">
                  <div>
                    <h2 className="text-base font-black text-[#1E4D4D]">
                      {activeTab === 'customer-balances' ? 'أرصدة الشركاء والعملاء' : 'أرصدة حسابات الموردين والدائنين'}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">مطابقة حسابات المبيعات والمشتريات والفواتير مع الدفعات المدخلة وسندات القبض/الصرف والذمم العالقة.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-100">
                          <th className="p-3">رقم التعريف المعرف</th>
                          <th className="p-3">اسم الشريك التجاري</th>
                          <th className="p-3">رقم الهاتف للاتصال</th>
                          <th className="p-3 text-left">{activeTab === 'customer-balances' ? 'إجمالي فواتير المبيعات' : 'إجمالي المشتريات من المورد'}</th>
                          <th className="p-3 text-left">إجمالي المبالغ المسددة</th>
                          <th className="p-3 text-left text-rose-800">الرصيد النهائي المستحق</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium">
                        {(Array.isArray(reportData) ? reportData : [])
                          .filter((item: any) => 
                            item?.name?.includes(searchTerm) || 
                            item?.id?.includes(searchTerm)
                          )
                          .map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-mono text-[11px] text-slate-500">{item?.id}</td>
                              <td className="p-3 font-black text-slate-700">{item?.name}</td>
                              <td className="p-3 text-slate-500 font-mono text-[11px]">{item?.phone}</td>
                              <td className="p-3 text-left">{formatNum(item?.totalSales || item?.totalPurchases || 0)} {currency}</td>
                              <td className="p-3 text-left text-emerald-700">{formatNum(item?.totalPaid || 0)} {currency}</td>
                              <td className="p-3 text-left text-red-600 font-black">
                                {formatNum(item?.balance || 0)} {currency}
                              </td>
                            </tr>
                          ))}
                        
                        {/* Summary Totals */}
                        <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-[#1E4D4D]">
                          <td colSpan={3} className="p-3">إجمالي توازن الحسابين</td>
                          <td className="p-3 text-left">
                            {formatNum((Array.isArray(reportData) ? reportData : []).reduce((sum: number, x: any) => sum + (x?.totalSales || x?.totalPurchases || 0), 0))} {currency}
                          </td>
                          <td className="p-3 text-left text-emerald-800">
                            {formatNum((Array.isArray(reportData) ? reportData : []).reduce((sum: number, x: any) => sum + (x?.totalPaid || 0), 0))} {currency}
                          </td>
                          <td className="p-3 text-left text-rose-900">
                            {formatNum((Array.isArray(reportData) ? reportData : []).reduce((sum: number, x: any) => sum + (x?.balance || 0), 0))} {currency}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(activeTab === 'aging-reports-customer' || activeTab === 'aging-reports-supplier') && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-6">
                  <div>
                    <h2 className="text-base font-black text-[#1E4D4D]">
                      {activeTab === 'aging-reports-customer' ? 'تقرير تعمير ذمم ومديونيات العملاء' : 'تقرير تعمير ذمم ومستحقات الموردين'}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">تقسيم المبالغ المطلوبة لآجال مختلفة (0-30، 31-60، 61-90، وما فوق) لتسهيل جدولة استحقاقات الدفع.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-100">
                          <th className="p-3">الشريك</th>
                          <th className="p-3">الفاتورة</th>
                          <th className="p-3">تاريخ الاستحقاق</th>
                          <th className="p-3 text-center">أيام التأخر</th>
                          <th className="p-3 text-center">المبلغ المستحق</th>
                          <th className="p-3 text-left">0-30 يوم</th>
                          <th className="p-3 text-left">31-60 يوم</th>
                          <th className="p-3 text-left">61-90 يوم</th>
                          <th className="p-3 text-left text-rose-800">أكثر من 90 يوم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {(Array.isArray(reportData) ? reportData : [])
                          .filter((item: any) => 
                            item?.partnerName?.includes(searchTerm) || 
                            item?.docId?.includes(searchTerm)
                          )
                          .map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-black text-slate-700">{item?.partnerName}</td>
                              <td className="p-3 text-slate-500 font-mono text-[11px]">{item?.docId}</td>
                              <td className="p-3 text-slate-500 font-mono text-[11px]">{item?.date}</td>
                              <td className="p-3 text-center font-bold text-slate-600">{item?.days} أيام</td>
                              <td className="p-3 text-center font-bold text-slate-800">{formatNum(item?.amount)} {currency}</td>
                              <td className="p-3 text-left text-slate-600">{item?.bucket1 > 0 ? `${formatNum(item?.bucket1)}` : '-'}</td>
                              <td className="p-3 text-left text-amber-600">{item?.bucket2 > 0 ? `${formatNum(item?.bucket2)}` : '-'}</td>
                              <td className="p-3 text-left text-orange-600">{item?.bucket3 > 0 ? `${formatNum(item?.bucket3)}` : '-'}</td>
                              <td className="p-3 text-left text-red-600 font-bold">{item?.bucket4 > 0 ? `${formatNum(item?.bucket4)}` : '-'}</td>
                            </tr>
                          ))}
                        {(Array.isArray(reportData) ? reportData : []).length === 0 && (
                          <tr>
                            <td colSpan={9} className="p-4 text-center text-slate-400 font-bold italic">لا توجد ديون معلقة متأخرة الدفع حالياً. تم سداد كافة الأدفار ✓</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'tax-reports' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-6">
                  <div>
                    <h2 className="text-base font-black text-[#1E4D4D]">التقرير الضريبي المجمع - ضريبة القيمة المضافة (VAT)</h2>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">حساب ضريبة الـ VAT للمخرجات (المبيعات) والمدخلات (المشتريات) واحتساب التسوية والفرق الواجب للدفع لهيئة الزكاة والجمارك.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Outputs tax */}
                    <div className="border border-slate-100 rounded-2xl p-4 bg-emerald-50/20">
                      <h3 className="text-xs font-black text-emerald-800 mb-2 border-b border-emerald-100 pb-2">الضريبة المخرجة (VAT Output) - مبيعات</h3>
                      <div className="flex flex-col gap-2.5 text-xs font-semibold">
                        <div className="flex justify-between">
                          <span className="text-slate-500">إجمالي المبيعات الخاضعة للضريبة</span>
                          <span className="font-bold">{formatNum(reportData?.totalSalesTaxable)} {currency}</span>
                        </div>
                        <div className="flex justify-between font-black text-emerald-700">
                          <span>مجموع ضريبة المبيعات المحصلة</span>
                          <span>+{formatNum(reportData?.outputVat)} {currency}</span>
                        </div>
                      </div>
                    </div>

                    {/* Inputs tax */}
                    <div className="border border-slate-100 rounded-2xl p-4 bg-red-50/20">
                      <h3 className="text-xs font-black text-red-800 mb-2 border-b border-red-100 pb-2">الضريبة المدخلة (VAT Input) - مشتريات</h3>
                      <div className="flex flex-col gap-2.5 text-xs font-semibold">
                        <div className="flex justify-between">
                          <span className="text-slate-500">إجمالي المشتريات الخاضعة للضريبة</span>
                          <span className="font-bold">{formatNum(reportData?.totalPurchasesTaxable)} {currency}</span>
                        </div>
                        <div className="flex justify-between font-black text-red-700">
                          <span>مجموع ضريبة المشتريات المدفوعة</span>
                          <span>-{formatNum(reportData?.inputVat)} {currency}</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Payable status */}
                    <div className="md:col-span-2 bg-[#1E4D4D] text-white p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-emerald-200">صافي الضريبة المستحقة للتسوية (VAT Payable)</h4>
                        <p className="text-[10px] text-emerald-100 opacity-80 mt-1">فارق المطالبة المتبقي واجب دفعه للجهة الضريبية.</p>
                      </div>
                      <h3 className="text-xl font-black">{formatNum(reportData?.netTaxPayable)} {currency}</h3>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
