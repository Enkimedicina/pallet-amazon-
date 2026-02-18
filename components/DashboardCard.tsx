
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
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default group">
      <div className="flex items-center justify-between mb-6">
        <span className={`p-3 rounded-2xl transition-transform group-hover:scale-110 ${colorClass}`}>
          {icon}
        </span>
        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</span>
      </div>
      <div>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
        {subtitle && <p className="text-slate-400 text-xs mt-1.5 font-bold">{subtitle}</p>}
      </div>
    </div>
  );
};

export default DashboardCard;
