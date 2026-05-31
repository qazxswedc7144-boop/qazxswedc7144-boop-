import React, { useState, useMemo } from "react";
import { Search, Calendar } from 'lucide-react';

interface ReportLayoutProps {
  data: any[];
  children: (filteredData: any[], predict: (history: any[]) => number) => React.ReactNode;
}

export default function ReportLayout({ data = [], children }: ReportLayoutProps) {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const filtered = useMemo(() => {
    let result = [...data];

    if (search) {
      result = result.filter((i: any) =>
        (i.name || i.Name || "").toLowerCase().includes(search.toLowerCase())
      );
    }

    if (fromDate) {
      result = result.filter((i: any) => (i.date || i.timestamp || "") >= fromDate);
    }

    if (toDate) {
      result = result.filter((i: any) => (i.date || i.timestamp || "") <= toDate);
    }

    return result;
  }, [data, search, fromDate, toDate]);

  const predict = (history: any[]) => {
    if (!history || history.length === 0) return 0;
    const avg = history.reduce((s, i) => s + (i.qty || i.quantity || 0), 0) / history.length;
    return Math.round(avg);
  };

  return (
    <div className="space-y-4 font-cairo" dir="rtl">
      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="date" 
              className="w-full h-10 bg-slate-50 border-none rounded-xl pr-9 pl-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#1E4D4D]/20 transition-all"
              onChange={e => setFromDate(e.target.value)} 
            />
          </div>
          <div className="relative">
            <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="date" 
              className="w-full h-10 bg-slate-50 border-none rounded-xl pr-9 pl-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#1E4D4D]/20 transition-all"
              onChange={e => setToDate(e.target.value)} 
            />
          </div>
        </div>

        <div className="relative">
          <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full h-12 bg-slate-50 border-none rounded-xl pr-12 pl-4 text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-[#1E4D4D]/20 transition-all"
            placeholder="Search within report..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* CONTENT */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children(filtered, predict)}
      </div>
    </div>
  );
}
