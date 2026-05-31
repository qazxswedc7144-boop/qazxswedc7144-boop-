import { LayoutGrid, Package, TrendingUp, AlertCircle } from 'lucide-react';

export const QuickReports = ({ onNavigate }: { onNavigate: (view: string) => void }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button 
        onClick={() => onNavigate('remaining-stock')}
        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all group"
      >
        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
          <Package size={20} />
        </div>
        <span className="text-xs font-black text-slate-700">المخزون</span>
      </button>

      <button 
        onClick={() => onNavigate('sales-by-item')}
        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all group"
      >
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
          <TrendingUp size={20} />
        </div>
        <span className="text-xs font-black text-slate-700">المبيعات</span>
      </button>

      <button 
        onClick={() => onNavigate('expiry-items')}
        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all group"
      >
        <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
          <AlertCircle size={20} />
        </div>
        <span className="text-xs font-black text-slate-700">النواقص</span>
      </button>

      <button 
        onClick={() => onNavigate('reports')}
        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all group"
      >
        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
          <LayoutGrid size={20} />
        </div>
        <span className="text-xs font-black text-slate-700">كل التقارير</span>
      </button>
    </div>
  );
};
