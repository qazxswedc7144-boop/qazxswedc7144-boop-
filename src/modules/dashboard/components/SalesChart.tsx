import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const SalesChart = () => {
  const data = [
    { day: "السبت", value: 200 },
    { day: "الأحد", value: 400 },
    { day: "الإثنين", value: 300 },
    { day: "الثلاثاء", value: 500 },
    { day: "الأربعاء", value: 450 },
    { day: "الخميس", value: 600 },
    { day: "الجمعة", value: 350 },
  ];

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <h3 className="text-sm font-black text-slate-700 mb-4 px-2">نشاط المبيعات الأسبوعي</h3>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }}
              dy={10}
            />
            <YAxis 
              hide 
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 900 }}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#1E4D4D" 
              strokeWidth={4} 
              dot={{ r: 4, fill: '#1E4D4D', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#10B981' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
