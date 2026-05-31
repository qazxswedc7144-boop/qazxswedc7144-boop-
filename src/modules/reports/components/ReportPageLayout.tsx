import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MoreVertical, Printer, FileDown, FileSpreadsheet, 
  Search, Filter, ArrowRight, X, Calendar
} from "lucide-react";
import { useReportContext } from "@/contexts/ReportContext";

interface SummaryCard {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
}

interface FilterOption {
  label: string;
  value: string;
}

interface ReportPageLayoutProps {
  title: string;
  onBack: () => void;
  onPrint?: () => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onFilterChange?: (fromDate: string, toDate: string, extraId?: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  children: React.ReactNode;
  summaryCards?: SummaryCard[];
  filterOptions?: FilterOption[];
  filterLabel?: string;
  hideDateFilters?: boolean;
  customDropdownItems?: React.ReactNode;
  sectionName?: string;
}

export default function ReportPageLayout({
  title,
  onBack,
  onPrint,
  onExportExcel,
  onExportPDF,
  onFilterChange,
  searchTerm,
  onSearchChange,
  children,
  summaryCards = [],
  filterOptions = [],
  filterLabel = "اختر صنف/مورد/عميل",
  customDropdownItems = null,
  sectionName
}: ReportPageLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const resolvedSectionName = React.useMemo(() => {
    if (sectionName) return sectionName;
    const t = title.toLowerCase();
    if (t.includes('مبيعات') || t.includes('المبيعات') || t.includes('sales')) return 'sales';
    if (t.includes('مشتريات') || t.includes('المشتريات') || t.includes('purchase')) return 'purchases';
    if (t.includes('حساب') || t.includes('الحساب') || t.includes('account')) return 'accounts';
    return 'general';
  }, [sectionName, title]);

  const { fromDate, toDate, setDateRange } = useReportContext(resolvedSectionName);
  const [localFrom, setLocalFrom] = useState(fromDate);
  const [localTo, setLocalTo] = useState(toDate);
  const [extraId, setExtraId] = useState("");
  const [isFilterBarVisible, setIsFilterBarVisible] = useState(true);
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync local inputs with global context updates (e.g., reset)
  useEffect(() => {
    setLocalFrom(fromDate);
    setLocalTo(toDate);
  }, [fromDate, toDate]);

  const handleApplyModalFilter = () => {
    setDateRange(localFrom, localTo);
    setIsModalOpen(false);
    onFilterChange?.(localFrom, localTo, extraId);
  };

  const handleExtraIdChange = (val: string) => {
    setExtraId(val);
    onFilterChange?.(fromDate, toDate, val);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFA] font-cairo text-slate-900 overflow-x-hidden" dir="rtl">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 h-20 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="w-10 h-10 bg-slate-50 border border-slate-100 flex items-center justify-center rounded-xl text-slate-500 hover:bg-white hover:text-[#1E4D4D] transition-all"
          >
            <ArrowRight size={20} />
          </motion.button>
          <h1 className="text-lg font-black text-[#1E4D4D] truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {filterOptions.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsFilterBarVisible(!isFilterBarVisible)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${isFilterBarVisible ? 'bg-[#1E4D4D] text-white border-[#1E4D4D]' : 'bg-white text-slate-500 border-slate-100'}`}
            >
              <Filter size={18} />
            </motion.button>
          )}

          <div className="relative" ref={menuRef}>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 bg-white shadow-sm border border-slate-100 flex items-center justify-center rounded-xl text-slate-500 hover:text-[#1E4D4D] transition-all"
            >
              <MoreVertical size={20} />
            </motion.button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="absolute left-0 mt-2 w-52 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-[100]"
                >
                  <button 
                    onClick={() => { onPrint?.(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 hover:text-[#1E4D4D] transition-all"
                  >
                    <Printer size={16} />
                    <span>طباعة التقرير</span>
                  </button>
                  <button 
                    onClick={() => { onExportExcel?.(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-all"
                  >
                    <FileSpreadsheet size={16} />
                    <span>تصدير Excel (CSV)</span>
                  </button>
                  <button 
                    onClick={() => { onExportPDF?.(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-all"
                  >
                    <FileDown size={16} />
                    <span>تصدير PDF</span>
                  </button>
                  <button 
                    onClick={() => { setIsModalOpen(true); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 hover:text-[#1E4D4D] transition-all"
                  >
                    <Calendar size={16} className="text-[#1E4D4D]" />
                    <span>بحث متقدم</span>
                  </button>
                  {customDropdownItems}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* FILTER BAR & SEARCH */}
      <div className="sticky top-20 z-40 bg-[#F8FAFA] px-6 py-4 space-y-4 print:hidden">
        <AnimatePresence>
          {isFilterBarVisible && filterOptions.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4">
                <div className="space-y-2 w-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase mr-1">{filterLabel}</label>
                  <select 
                    value={extraId}
                    onChange={(e) => handleExtraIdChange(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-50 rounded-2xl px-4 text-xs font-bold text-[#1E4D4D] focus:bg-white focus:border-[#1E4D4D] outline-none transition-all appearance-none"
                  >
                    <option value="">الكل</option>
                    {filterOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative group">
          <Search 
            size={18} 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1E4D4D] transition-colors" 
          />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث في محتوى التقرير..."
            className="w-full h-12 bg-white border border-slate-100 rounded-full pr-12 pl-6 text-[11px] font-bold text-[#1E4D4D] shadow-sm outline-none focus:ring-2 focus:ring-[#1E4D4D]/10 transition-all"
          />
        </div>
      </div>

      {/* SUMMARY CARDS */}
      {summaryCards.length > 0 && (
        <div className="px-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
          {summaryCards.map((card, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-white p-5 rounded-[28px] border border-slate-50 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                 <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color || 'bg-slate-50 text-slate-500'}`}>
                   {card.icon}
                 </div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{card.label}</span>
              </div>
              <div className="text-lg font-black text-[#1E4D4D]">{card.value}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 px-6 pb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden print:shadow-none print:border-none"
        >
          {children}
        </motion.div>
      </main>

      {/* Advanced Search Popover Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] border border-slate-100 shadow-2xl p-6 overflow-hidden z-[210] flex flex-col gap-5 text-right font-cairo"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <span className="text-xs font-black text-[#1E4D4D] flex items-center gap-2">
                  <Calendar size={16} className="text-[#1E4D4D]" />
                  البحث والفلترة المتقدمة
                </span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5 flex flex-col">
                  <label htmlFor="modalFromDate" className="text-[10px] font-black text-slate-400 mr-1">من تاريخ</label>
                  <input
                    id="modalFromDate"
                    type="date"
                    value={localFrom}
                    onChange={(e) => setLocalFrom(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-xs font-bold text-[#1E4D4D] focus:bg-white focus:ring-2 focus:ring-[#1E4D4D]/5 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5 flex flex-col">
                  <label htmlFor="modalToDate" className="text-[10px] font-black text-slate-400 mr-1">إلى تاريخ</label>
                  <input
                    id="modalToDate"
                    type="date"
                    value={localTo}
                    onChange={(e) => setLocalTo(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-xs font-bold text-[#1E4D4D] focus:bg-white focus:ring-2 focus:ring-[#1E4D4D]/5 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleApplyModalFilter}
                  className="flex-1 h-11 bg-[#1E4D4D] hover:bg-[#163a3a] text-white rounded-2xl font-black text-xs transition-all shadow-sm"
                >
                  تطبيق الفلترة
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-bold text-xs transition-all border border-slate-100"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          header, .filter-bar, .summary-cards { display: none !important; }
          main { padding: 0 !important; width: 100% !important; margin: 0 !important; }
          .zebra-table { width: 100% !important; border: 1px solid #eee !important; }
          .zebra-table th { background-color: #f8fafa !important; border-bottom: 1px solid #ddd !important; }
        }
        .zebra-table tr:nth-child(even) {
          background-color: #F8FAFA;
        }
        .zebra-table th {
          position: sticky;
          top: 0;
          z-index: 10;
          background-color: #F8FAFA;
        }
      `}} />
    </div>
  );
}
