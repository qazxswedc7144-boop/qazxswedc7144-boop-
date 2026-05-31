export const Card = ({ title, value }: { title: string; value: string | number }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1.5 justify-center">
    <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{title}</div>
    <div className="text-xl lg:text-2xl font-bold text-[#1E4D4D]">{value}</div>
  </div>
);
