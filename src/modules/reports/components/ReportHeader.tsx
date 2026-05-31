import { useState, useEffect, useRef } from "react";
import { Search, SlidersHorizontal, Calendar, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { create } from "zustand";
import { format, subDays, parseISO, isValid } from "date-fns";

// Zustand Store for global reports filter state
interface ReportFilterState {
  searchTerm: string;
  startDate: string; // Style: "YYYY-MM-DD"
  endDate: string;   // Style: "YYYY-MM-DD"
  setSearchTerm: (term: string) => void;
  setDates: (start: string, end: string) => void;
}

export const useReportFilterStore = create<ReportFilterState>((set) => ({
  searchTerm: "",
  startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
  endDate: format(new Date(), "yyyy-MM-dd"),
  setSearchTerm: (term: string) => set({ searchTerm: term }),
  setDates: (start: string, end: string) => set({ startDate: start, endDate: end }),
}));

interface ReportHeaderProps {
  title: string;
  onApply?: (startDate: string, endDate: string) => void;
}

export default function ReportHeader({ title, onApply }: ReportHeaderProps) {
  const { searchTerm, startDate, endDate, setSearchTerm, setDates } = useReportFilterStore();

  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync outside changes of searchTerm to internal localSearch
  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  // Debounced search term update
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handler = setTimeout(() => {
      setSearchTerm(localSearch);
    }, 450); // Debounce duration to optimize recalculations
    return () => clearTimeout(handler);
  }, [localSearch, setSearchTerm]);

  // Sync dates when modal opens
  useEffect(() => {
    if (isPopoverOpen) {
      setLocalStartDate(startDate);
      setLocalEndDate(endDate);
    }
  }, [isPopoverOpen, startDate, endDate]);

  // Click outside to close standard Popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current && 
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApply = () => {
    const startParsed = parseISO(localStartDate);
    const endParsed = parseISO(localEndDate);

    if (isValid(startParsed) && isValid(endParsed)) {
      setDates(localStartDate, localEndDate);
      if (onApply) {
        onApply(localStartDate, localEndDate);
      }
      setIsPopoverOpen(false);
    }
  };

  return (
    <div className="w-full mb-6 select-none font-cairo" dir="rtl">
      {/* Title section with styling */}
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-xl font-black text-[#1E4D4D] dark:text-teal-400 leading-tight">
          {title}
        </h2>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
          تقرير شامل للفترة من {startDate} إلى {endDate}
        </span>
      </div>

      {/* Main Row layout with 70% Search Input and Menu button in standard RTL */}
      <div className="flex items-center gap-3 w-full">
        {/* Search Input - taking exactly 70% space per tailwind styling specifications */}
        <div className="relative w-[70%] group">
          <Search 
            size={18} 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1E4D4D] dark:group-focus-within:text-teal-400 transition-colors" 
          />
          <input 
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="البحث السريع في محتويات التقارير..."
            aria-label="البحث السريع في التقرير"
            className="w-full h-11 pr-11 pl-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl text-xs font-black text-[#1E4D4D] dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-[#1E4D4D]/10 dark:focus:ring-teal-500/15 focus:border-[#1E4D4D] dark:focus:border-teal-500 transition-all placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>

        {/* 30% or Remaining space holds the button at the left (RTL layout) */}
        <div className="relative flex-1 flex justify-end">
          <motion.button
            ref={triggerRef}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            aria-haspopup="dialog"
            aria-expanded={isPopoverOpen}
            aria-label="إعدادات النطاق الزمني والتصفية"
            className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all shadow-sm ${
              isPopoverOpen 
              ? "bg-[#1E4D4D] text-white border-[#1E4D4D] dark:bg-teal-500 dark:text-slate-900 dark:border-teal-500" 
              : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-100 dark:border-slate-700/60 hover:text-[#1E4D4D] dark:hover:text-teal-400"
            }`}
          >
            <SlidersHorizontal size={18} />
          </motion.button>

          {/* Settings Popover wrapper with standard clean Animation */}
          <AnimatePresence>
            {isPopoverOpen && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                role="dialog"
                aria-modal="true"
                aria-label="تصفية النطاق الزمني"
                className="absolute left-0 top-13 z-50 w-72 p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-100 dark:border-slate-800/80 flex flex-col gap-4 font- Cairo"
              >
                {/* Popover Header with label */}
                <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                  <span className="text-xs font-black text-[#1E4D4D] dark:text-teal-400 flex items-center gap-1.5">
                    <Calendar size={14} />
                    تحديد النطاق الزمني
                  </span>
                  <button 
                    onClick={() => setIsPopoverOpen(false)}
                    aria-label="إغلاق التصفية"
                    className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Input Fields */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="startDateInput" className="text-[10px] font-black text-slate-400 dark:text-slate-500 mr-1">
                      من تاريخ
                    </label>
                    <input
                      id="startDateInput"
                      type="date"
                      value={localStartDate}
                      onChange={(e) => setLocalStartDate(e.target.value)}
                      aria-label="تاريخ بداية النطاق الزمني"
                      className="w-full h-10 bg-slate-50 dark:bg-slate-800/55 border border-slate-100 dark:border-slate-800 rounded-xl px-3 text-xs font-bold text-[#1E4D4D] dark:text-slate-250 outline-none focus:ring-2 focus:ring-[#1E4D4D]/10 dark:focus:ring-teal-500/10 focus:border-[#1E4D4D] dark:focus:border-teal-500 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="endDateInput" className="text-[10px] font-black text-slate-400 dark:text-slate-500 mr-1">
                      إلى تاريخ
                    </label>
                    <input
                      id="endDateInput"
                      type="date"
                      value={localEndDate}
                      onChange={(e) => setLocalEndDate(e.target.value)}
                      aria-label="تاريخ نهاية النطاق الزمني"
                      className="w-full h-10 bg-slate-50 dark:bg-slate-800/55 border border-slate-100 dark:border-slate-800 rounded-xl px-3 text-xs font-bold text-[#1E4D4D] dark:text-slate-250 outline-none focus:ring-2 focus:ring-[#1E4D4D]/10 dark:focus:ring-teal-500/10 focus:border-[#1E4D4D] dark:focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>

                {/* Confirm Apply action button */}
                <button
                  type="button"
                  onClick={handleApply}
                  className="w-full h-10 bg-[#1E4D4D] dark:bg-teal-500 text-white dark:text-slate-900 rounded-xl font-black text-xs hover:bg-[#163a3a] dark:hover:bg-teal-400 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Check size={14} />
                  تطبيق الفلترة
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
