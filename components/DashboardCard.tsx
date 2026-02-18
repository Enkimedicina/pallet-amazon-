
import React from 'react';

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass: string;
}

const DashboardCard: React.FC<Props> = ({ title, value, subtitle, icon, colorClass }) => {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 group cursor-default">
      <div className="flex items-center justify-between mb-6">
        <div className={`p-3.5 rounded-2xl transition-all group-hover:scale-110 group-hover:rotate-3 ${colorClass} shadow-inner`}>
          {icon}
        </div>
        <span className="text-slate-300 text-[10px] font-black uppercase tracking-[0.2em]">{title}</span>
      </div>
      <div>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1.5">{value}</h3>
        {subtitle && <p className="text-slate-400 text-[10px] font-bold italic uppercase tracking-wider">{subtitle}</p>}
      </div>
    </div>
  );
};

export default DashboardCard;
