
import React, { useState, useEffect, useMemo } from 'react';
import { PalletConfig, Sale, Currency } from './types';
import { calculateFinancials, formatCurrency } from './utils/calculations';
import DashboardCard from './components/DashboardCard';
import ExportButton from './components/ExportButton';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Line, PieChart, Pie, Cell, ComposedChart, Bar
} from 'recharts';

type Tab = 'overview' | 'sales' | 'simulator';

const App: React.FC = () => {
  // Persistence Layer
  const [config, setConfig] = useState<PalletConfig>(() => {
    const saved = localStorage.getItem('pallet_config');
    return saved ? JSON.parse(saved) : {
      investmentUsd: 1250,
      exchangeRate: 19.5,
      totalPieces: 250,
      additionalExpensesUsd: 0,
      targetMultiplier: 2
    };
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('pallet_sales');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(Currency.MXN);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Form States
  const [newSale, setNewSale] = useState({
    price: 0, 
    client: '',
    method: 'Efectivo',
    date: new Date().toISOString().split('T')[0]
  });
  const [simPrice, setSimPrice] = useState<number>(0);

  useEffect(() => {
    localStorage.setItem('pallet_config', JSON.stringify(config));
    localStorage.setItem('pallet_sales', JSON.stringify(sales));
  }, [config, sales]);

  const stats = useMemo(() => calculateFinancials(config, sales), [config, sales]);

  const currentAvgPriceUsd = useMemo(() => {
    return sales.length > 0 ? (stats.totalRevenueUsd / sales.length) : stats.initialCostPerPieceUsd;
  }, [sales.length, stats.totalRevenueUsd, stats.initialCostPerPieceUsd]);

  const handleAddSale = (e: React.FormEvent) => {
    e.preventDefault();
    const priceInUsd = displayCurrency === Currency.MXN ? newSale.price / config.exchangeRate : newSale.price;
    const sale: Sale = {
      id: crypto.randomUUID(),
      ...newSale,
      price: priceInUsd,
      realCostAtSale: stats.dynamicCostPerPieceUsd
    };
    setSales([...sales, sale]);
    setIsSaleModalOpen(false);
    setNewSale({ price: 0, client: '', method: 'Efectivo', date: new Date().toISOString().split('T')[0] });
  };

  const deleteSale = (id: string) => {
    if (confirm('¿Eliminar este registro permanentemente?')) {
      setSales(sales.filter(s => s.id !== id));
    }
  };

  const displayVal = (usdAmount: number, overrideCurrency?: Currency) => {
    const curr = overrideCurrency || displayCurrency;
    const val = curr === Currency.USD ? usdAmount : usdAmount * config.exchangeRate;
    return formatCurrency(val, curr);
  };

  // Chart Data preparation
  const chartData = useMemo(() => {
    let cumulativeRevenue = 0;
    const factor = displayCurrency === Currency.USD ? 1 : config.exchangeRate;
    return sales.map((s, i) => {
      cumulativeRevenue += s.price;
      return {
        name: `Venta ${i + 1}`,
        ingreso: cumulativeRevenue * factor,
        meta: stats.totalInvestmentUsd * factor,
        ganancia: Math.max(0, (cumulativeRevenue - stats.totalInvestmentUsd) * factor)
      };
    });
  }, [sales, stats.totalInvestmentUsd, displayCurrency, config.exchangeRate]);

  const projectionData = useMemo(() => {
    const data = [];
    const factor = displayCurrency === Currency.USD ? 1 : config.exchangeRate;
    let cumulative = 0;
    
    sales.forEach((s, i) => {
      cumulative += s.price;
      data.push({ label: `${i + 1}`, actual: cumulative * factor, projected: null });
    });

    if (data.length > 0) data[data.length - 1].projected = data[data.length - 1].actual;
    else data.push({ label: '0', actual: 0, projected: 0 });

    if (stats.remainingPieces > 0) {
      const steps = 4;
      const stepSize = Math.ceil(stats.remainingPieces / steps);
      for (let i = 1; i <= steps; i++) {
        const count = i === steps ? stats.remainingPieces : i * stepSize;
        data.push({
          label: `+${count}`,
          actual: null,
          projected: (stats.totalRevenueUsd + (count * currentAvgPriceUsd)) * factor
        });
      }
    }
    return data;
  }, [sales, stats.remainingPieces, stats.totalRevenueUsd, currentAvgPriceUsd, displayCurrency, config.exchangeRate]);

  const pieData = [
    { name: 'Capital Reinversión', value: stats.capitalRecoveredUsd, color: '#6366f1' },
    { name: 'Ganancia Libre', value: stats.netProfitUsd, color: '#10b981' }
  ];

  const simResults = useMemo(() => {
    if (simPrice <= 0) return null;
    const priceInUsd = displayCurrency === Currency.MXN ? simPrice / config.exchangeRate : simPrice;
    const projectedTotalRev = stats.totalRevenueUsd + (stats.remainingPieces * priceInUsd);
    return {
      profitPerPiece: Math.max(0, priceInUsd - stats.dynamicCostPerPieceUsd),
      totalRevenue: projectedTotalRev,
      totalNetProfit: projectedTotalRev - stats.totalInvestmentUsd,
      isTargetMet: projectedTotalRev >= stats.targetRevenueUsd
    };
  }, [simPrice, stats, displayCurrency, config.exchangeRate]);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-4 sm:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 ring-4 ring-indigo-50">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">Pallet Pro</h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 block">Financial Intelligence v4.0</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              {(['MXN', 'USD'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setDisplayCurrency(c as Currency)}
                  className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${displayCurrency === c ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-slate-200"
              title="Configuración"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </button>

            <button 
              onClick={() => setIsSaleModalOpen(true)}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
              Nueva Venta
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-8 mt-8">
        <div className="flex items-center gap-1 border-b border-slate-200 w-full overflow-x-auto custom-scrollbar whitespace-nowrap">
          {[
            { id: 'overview', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
            { id: 'sales', label: 'Historial de Ventas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
            { id: 'simulator', label: 'Simulador IA', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 font-bold text-sm transition-all ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon}></path></svg>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8">
        {activeTab === 'overview' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Investment Status Banner */}
            <div className={`mb-8 p-6 rounded-3xl border-l-[10px] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-colors ${stats.isROIReached ? 'bg-emerald-50 border-emerald-500' : 'bg-indigo-50 border-indigo-600'}`}>
              <div className="flex items-center gap-6 text-center md:text-left">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md ${stats.isROIReached ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {stats.isROIReached ? (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                  ) : (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 italic uppercase tracking-tight">
                    {stats.isROIReached ? 'Ganancia Libre Alcanzada' : 'Fase de Recuperación de Capital'}
                  </h2>
                  <p className="text-slate-500 text-sm font-medium">
                    {stats.isROIReached 
                      ? 'Has cubierto el costo total del pallet. Cada nueva venta es utilidad neta para tu bolsillo.'
                      : `Faltan ${displayVal(stats.remainingInvestmentUsd)} para completar la recuperación de la inversión inicial.`
                    }
                  </p>
                </div>
              </div>
              <div className="min-w-[200px] text-center md:text-right">
                <div className="text-3xl font-black text-slate-800 leading-none">{stats.recoveryProgress.toFixed(1)}%</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Progreso ROI</div>
                <div className="w-full bg-slate-200 h-2 rounded-full mt-3 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 rounded-full ${stats.isROIReached ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                    style={{ width: `${stats.recoveryProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <DashboardCard 
                title="Capital para Reinvertir"
                value={displayVal(stats.capitalRecoveredUsd)}
                subtitle="Fondo de Recuperación"
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>}
                colorClass="bg-indigo-100 text-indigo-700"
              />
              <DashboardCard 
                title="Ganancia Libre"
                value={displayVal(stats.netProfitUsd)}
                subtitle="Dinero a tu favor"
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m.599-2.1c.442-.258.81-.595 1.056-1.003C15.12 12.812 16 11.5 16 10s-.88-2.812-2.345-3.897M12 20V4m0 0h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                colorClass="bg-emerald-100 text-emerald-700"
              />
              <DashboardCard 
                title="Costo Dinámico Pz"
                value={displayVal(stats.dynamicCostPerPieceUsd)}
                subtitle={`${stats.remainingPieces} piezas restantes`}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>}
                colorClass="bg-amber-100 text-amber-700"
              />
              <DashboardCard 
                title="Meta x${config.targetMultiplier}"
                value={displayVal(stats.targetRevenueUsd)}
                subtitle={`${stats.progressToTarget.toFixed(0)}% lograda`}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>}
                colorClass="bg-slate-800 text-white"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
              {/* Financial Performance Chart */}
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 italic uppercase tracking-tighter">Performance Financiero</h3>
                    <p className="text-slate-400 text-xs font-medium">Histórico de acumulación vs punto de equilibrio</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div> Ingresos</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Ganancia</div>
                  </div>
                </div>
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorIngreso" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                        formatter={(val: number) => displayVal(val)}
                      />
                      <Area type="monotone" dataKey="ingreso" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorIngreso)" />
                      <Area type="monotone" dataKey="ganancia" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorProfit)" />
                      <Line type="monotone" dataKey="meta" stroke="#f87171" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Capital Distribution */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-lg font-black text-slate-800 italic uppercase tracking-tighter mb-2">Estado del Capital</h3>
                <p className="text-slate-400 text-xs font-medium mb-8 italic">¿A favor o para reinversión?</p>
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => displayVal(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full space-y-4 mt-6">
                    {pieData.map(item => (
                      <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-xs font-bold text-slate-500">{item.name}</span>
                        </div>
                        <span className="text-sm font-black text-slate-800">{displayVal(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Projections and Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="text-lg font-black text-slate-800 italic uppercase tracking-tighter mb-1">Trayectoria de Crecimiento</h3>
                 <p className="text-slate-400 text-xs font-medium mb-8">Basado en promedio actual: <span className="text-indigo-600 font-bold">{displayVal(currentAvgPriceUsd)}/pz</span></p>
                 <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={projectionData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                        <Tooltip formatter={(v: number) => displayVal(v)} />
                        <Area type="monotone" dataKey="actual" fill="#6366f1" fillOpacity={0.1} stroke="#6366f1" strokeWidth={3} />
                        <Line type="monotone" dataKey="projected" stroke="#818cf8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-slate-900 rounded-3xl p-10 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500 rounded-full blur-[100px] opacity-20"></div>
                
                <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-8 relative z-10">Resumen Proyectado</h3>
                <div className="space-y-8 relative z-10">
                  <div className="flex items-end justify-between border-b border-white/10 pb-4">
                    <div>
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Valor de Inventario Remanente</p>
                      <p className="text-2xl font-black">{displayVal(stats.remainingPieces * currentAvgPriceUsd)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Margen Promedio</p>
                      <p className={`font-bold ${stats.averageMarginUsd > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {stats.averageMarginUsd > 0 ? '+' : ''}{displayVal(stats.averageMarginUsd)}/pz
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10">
                    <div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Utilidad Neta Final Estimada</p>
                      <p className="text-4xl font-black text-emerald-400">
                        {displayVal(stats.netProfitUsd + (stats.remainingPieces * (currentAvgPriceUsd - stats.initialCostPerPieceUsd)))}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 flex items-center justify-center font-black text-xs">
                        x{((stats.totalRevenueUsd + (stats.remainingPieces * currentAvgPriceUsd)) / stats.totalInvestmentUsd).toFixed(1)}
                      </div>
                    </div>
                  </div>

                  <p className="text-white/40 text-[10px] leading-relaxed italic">
                    * El cálculo dinámico ajusta el costo por pieza automáticamente a medida que vendes, permitiéndote saber exactamente cuándo empiezas a generar dinero "limpio".
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-800 italic uppercase tracking-tighter">Historial de Transacciones</h3>
                <p className="text-slate-400 text-sm font-medium">Gestión detallada de cada pieza vendida</p>
              </div>
              <ExportButton config={config} sales={sales} />
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="pb-4 px-4">Fecha</th>
                    <th className="pb-4 px-4">Cliente / Referencia</th>
                    <th className="pb-4 px-4">Método</th>
                    <th className="pb-4 px-4">Precio ({displayCurrency})</th>
                    <th className="pb-4 px-4">Ganancia Real</th>
                    <th className="pb-4 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-400 font-medium italic">No hay ventas registradas aún.</td>
                    </tr>
                  ) : (
                    [...sales].reverse().map(sale => (
                      <tr key={sale.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="py-5 px-4 text-sm font-medium text-slate-500">{sale.date}</td>
                        <td className="py-5 px-4 font-bold text-slate-700">{sale.client || 'Venta Directa'}</td>
                        <td className="py-5 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase text-slate-500 border border-slate-200">
                            {sale.method}
                          </span>
                        </td>
                        <td className="py-5 px-4 font-black text-slate-800">{displayVal(sale.price)}</td>
                        <td className="py-5 px-4">
                          <div className={`flex items-center gap-1.5 font-black text-sm ${sale.price > sale.realCostAtSale ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {sale.price > sale.realCostAtSale ? '+' : ''}{displayVal(sale.price - sale.realCostAtSale)}
                            <span className="text-[10px] opacity-50 font-bold uppercase">Neto</span>
                          </div>
                        </td>
                        <td className="py-5 px-4 text-center">
                          <button 
                            onClick={() => deleteSale(sale.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'simulator' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8">
                <div className="bg-indigo-50 p-4 rounded-3xl animate-pulse">
                  <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
              </div>
              
              <h3 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter mb-2">Simulador de Estrategia</h3>
              <p className="text-slate-400 text-sm font-medium mb-10 leading-relaxed italic">Ingresa un precio de venta para proyectar el impacto en la rentabilidad de todo el pallet.</p>

              <div className="space-y-8">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">¿Venta promedio por pieza?</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-2xl font-black">$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      autoFocus
                      value={simPrice || ''}
                      onChange={e => setSimPrice(parseFloat(e.target.value) || 0)}
                      className="w-full pl-12 pr-6 py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-600 focus:outline-none text-4xl font-black text-indigo-600 transition-all placeholder:text-slate-200"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {simResults && (
                  <div className="grid grid-cols-1 gap-6 animate-in zoom-in-95 duration-300">
                    <div className="bg-slate-900 rounded-3xl p-8 text-white">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-6">Proyección de Final de Ciclo</h4>
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <span className="text-white/40 text-sm font-bold italic">Ingresos Totales</span>
                          <span className="text-2xl font-black">{displayVal(simResults.totalRevenue)}</span>
                        </div>
                        <div className="h-px bg-white/10"></div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/40 text-sm font-bold italic">Ganancia Libre Final</span>
                          <span className={`text-4xl font-black ${simResults.totalNetProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {displayVal(simResults.totalNetProfit)}
                          </span>
                        </div>
                        {simResults.isTargetMet && (
                          <div className="bg-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-center font-black text-xs uppercase tracking-widest border border-emerald-500/30">
                            ✓ Supera la meta x{config.targetMultiplier}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 italic">Utilidad p/ Pieza</p>
                        <p className="text-xl font-black text-indigo-800">{displayVal(simResults.profitPerPiece)}</p>
                      </div>
                      <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100">
                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1 italic">Margen de Error</p>
                        <p className="text-xl font-black text-amber-800">
                          {((simResults.totalNetProfit / simResults.totalRevenue) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl border border-white/20 animate-in zoom-in-95">
            <h2 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter mb-8">Nueva Transacción</h2>
            <form onSubmit={handleAddSale} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Monto de Venta ({displayCurrency})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl">$</span>
                  <input 
                    type="number" step="0.01" required autoFocus
                    value={newSale.price || ''}
                    onChange={e => setNewSale({...newSale, price: parseFloat(e.target.value) || 0})}
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:outline-none text-xl font-black"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Método</label>
                  <select 
                    value={newSale.method}
                    onChange={e => setNewSale({...newSale, method: e.target.value})}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:outline-none font-bold text-sm"
                  >
                    <option>Efectivo</option>
                    <option>Transferencia</option>
                    <option>Tarjeta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fecha</label>
                  <input 
                    type="date" required
                    value={newSale.date}
                    onChange={e => setNewSale({...newSale, date: e.target.value})}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:outline-none font-bold text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cliente / Nota</label>
                <input 
                  type="text" placeholder="Ej. Juan Pérez - Zapato Nike"
                  value={newSale.client}
                  onChange={e => setNewSale({...newSale, client: e.target.value})}
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:outline-none font-bold text-sm"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsSaleModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-2xl transition-all italic">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all italic">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl border border-white/20 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter mb-8">Ajustes Base</h2>
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Costo Pallet (USD)</label>
                  <input type="number" value={config.investmentUsd} onChange={e => setConfig({...config, investmentUsd: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:outline-none font-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Dólar Hoy (MXN)</label>
                  <input type="number" step="0.01" value={config.exchangeRate} onChange={e => setConfig({...config, exchangeRate: parseFloat(e.target.value) || 1})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:outline-none font-black" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Piezas</label>
                  <input type="number" value={config.totalPieces} onChange={e => setConfig({...config, totalPieces: parseInt(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:outline-none font-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gastos Extra (USD)</label>
                  <input type="number" value={config.additionalExpensesUsd} onChange={e => setConfig({...config, additionalExpensesUsd: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:outline-none font-black" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Multiplicador Meta Objetivo</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map(num => (
                    <button key={num} onClick={() => setConfig({...config, targetMultiplier: num})} className={`flex-1 py-4 rounded-2xl font-black transition-all ${config.targetMultiplier === num ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>x{num}</button>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                <button onClick={() => setIsSettingsOpen(false)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl italic">Guardar Cambios</button>
                <button 
                  onClick={() => confirm('¿Borrar TODO el historial? Esta acción no se puede deshacer.') && setSales([])} 
                  className="w-full py-4 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-all"
                >
                  Resetear Historial de Ventas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
