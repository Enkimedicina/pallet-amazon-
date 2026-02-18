
import React, { useState, useEffect, useMemo } from 'react';
import { PalletConfig, Sale, Currency } from './types';
import { calculateFinancials, formatCurrency } from './utils/calculations';
import DashboardCard from './components/DashboardCard';
import ExportButton from './components/ExportButton';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Line, PieChart, Pie, Cell, ComposedChart
} from 'recharts';

type Tab = 'dashboard' | 'history' | 'tools';

const App: React.FC = () => {
  // Persistence Layer con valores por defecto realistas
  const [config, setConfig] = useState<PalletConfig>(() => {
    try {
      const saved = localStorage.getItem('pallet_config');
      return saved ? JSON.parse(saved) : {
        investmentUsd: 1250,
        exchangeRate: 19.5,
        totalPieces: 250,
        additionalExpensesUsd: 0,
        targetMultiplier: 2
      };
    } catch (e) {
      return { investmentUsd: 1250, exchangeRate: 19.5, totalPieces: 250, additionalExpensesUsd: 0, targetMultiplier: 2 };
    }
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    try {
      const saved = localStorage.getItem('pallet_sales');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(Currency.MXN);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Estados de formularios
  const [newSale, setNewSale] = useState({ price: 0, client: '', method: 'Efectivo', date: new Date().toISOString().split('T')[0] });
  const [simPrice, setSimPrice] = useState<number>(0);

  useEffect(() => {
    localStorage.setItem('pallet_config', JSON.stringify(config));
    localStorage.setItem('pallet_sales', JSON.stringify(sales));
  }, [config, sales]);

  const stats = useMemo(() => calculateFinancials(config, sales), [config, sales]);

  const currentAvgPriceUsd = useMemo(() => {
    return sales.length > 0 ? (stats.totalRevenueUsd / sales.length) : stats.initialCostPerPieceUsd;
  }, [sales.length, stats.totalRevenueUsd, stats.initialCostPerPieceUsd]);

  const simResults = useMemo(() => {
    if (simPrice <= 0) return null;
    const simPriceUsd = displayCurrency === Currency.MXN ? simPrice / config.exchangeRate : simPrice;
    const totalRevenue = stats.totalRevenueUsd + (stats.remainingPieces * simPriceUsd);
    const totalNetProfit = Math.max(0, totalRevenue - stats.totalInvestmentUsd);
    const isTargetMet = totalRevenue >= stats.targetRevenueUsd;
    
    return {
      totalRevenue,
      totalNetProfit,
      isTargetMet
    };
  }, [simPrice, stats, displayCurrency, config.exchangeRate]);

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
    setIsModalOpen(false);
    setNewSale({ price: 0, client: '', method: 'Efectivo', date: new Date().toISOString().split('T')[0] });
  };

  const displayVal = (amount: number, forceCurr?: Currency) => {
    const curr = forceCurr || displayCurrency;
    const val = curr === Currency.USD ? amount : amount * config.exchangeRate;
    return formatCurrency(val, curr);
  };

  const pieData = [
    { name: 'Reinversión', value: stats.capitalRecoveredUsd, color: '#4f46e5' },
    { name: 'Ganancia', value: stats.netProfitUsd, color: '#10b981' }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Web Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <div>
              <span className="text-xl font-black text-slate-800 tracking-tighter">PALLETPRO</span>
              <span className="block text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none">Business Intelligence</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {(['dashboard', 'history', 'tools'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`text-xs font-black uppercase tracking-widest transition-colors ${activeTab === t ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {t === 'dashboard' ? 'Panel Principal' : t === 'history' ? 'Ventas' : 'Estrategia'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              {['MXN', 'USD'].map(c => (
                <button
                  key={c}
                  onClick={() => setDisplayCurrency(c as Currency)}
                  className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${displayCurrency === c ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 space-y-8">
                <div className={`p-8 rounded-[2.5rem] border-l-[12px] shadow-sm ${stats.isROIReached ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-indigo-600'}`}>
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                      <h2 className="text-3xl font-black text-slate-800 italic tracking-tighter">
                        {stats.isROIReached ? '¡UTILIDAD LIBRE!' : 'PUNTO DE EQUILIBRIO'}
                      </h2>
                      <p className="text-slate-500 font-medium mt-1">
                        {stats.isROIReached 
                          ? 'Inversión recuperada. Cada venta es capital propio.' 
                          : `Faltan ${displayVal(stats.remainingInvestmentUsd)} para recuperar tu inversión.`}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-black text-slate-800 leading-none">{stats.recoveryProgress.toFixed(1)}%</div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Retorno de Inversión</span>
                    </div>
                  </div>
                  <div className="mt-8 bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                    <div className={`h-full transition-all duration-1000 ${stats.isROIReached ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${stats.recoveryProgress}%` }}></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <DashboardCard title="Fondo Reinversión" value={displayVal(stats.capitalRecoveredUsd)} subtitle="Capital recuperado" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>} colorClass="bg-indigo-100 text-indigo-700" />
                  <DashboardCard title="Ganancia Neta" value={displayVal(stats.netProfitUsd)} subtitle="Dinero libre" icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m.599-2.1c.442-.258.81-.595 1.056-1.003C15.12 12.812 16 11.5 16 10s-.88-2.812-2.345-3.897M12 20V4m0 0h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} colorClass="bg-emerald-100 text-emerald-700" />
                  <DashboardCard title="Costo Dinámico" value={displayVal(stats.dynamicCostPerPieceUsd)} subtitle={`En ${stats.remainingPieces} pz`} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>} colorClass="bg-amber-100 text-amber-700" />
                  <DashboardCard title="Meta Proyectada" value={displayVal(stats.totalRevenueUsd + (stats.remainingPieces * currentAvgPriceUsd))} subtitle={`Factor x${((stats.totalRevenueUsd + (stats.remainingPieces * currentAvgPriceUsd))/stats.totalInvestmentUsd).toFixed(1)}`} icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>} colorClass="bg-slate-800 text-white" />
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Estado de Capital</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" stroke="none">
                        {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => displayVal(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-4 mt-8">
                  {pieData.map(item => (
                    <div key={item.name} className="flex justify-between items-center p-4 rounded-2xl bg-slate-50">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></div><span className="text-xs font-bold text-slate-500 italic">{item.name}</span></div>
                      <span className="text-sm font-black">{displayVal(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div>
                <h3 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">Libro de Ventas</h3>
                <p className="text-slate-400 font-medium">Histórico detallado de transacciones</p>
              </div>
              <ExportButton config={config} sales={sales} />
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="pb-6 px-4">Fecha</th>
                    <th className="pb-6 px-4">Referencia</th>
                    <th className="pb-6 px-4">Precio ({displayCurrency})</th>
                    <th className="pb-6 px-4">Utilidad Real</th>
                    <th className="pb-6 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sales.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-medium italic">Sin registros de ventas.</td></tr>
                  ) : (
                    [...sales].reverse().map(sale => (
                      <tr key={sale.id} className="group hover:bg-indigo-50/30 transition-colors">
                        <td className="py-6 px-4 text-sm font-medium text-slate-500">{sale.date}</td>
                        <td className="py-6 px-4 font-bold text-slate-700">{sale.client || 'Venta General'}</td>
                        <td className="py-6 px-4 font-black text-slate-900">{displayVal(sale.price)}</td>
                        <td className="py-6 px-4">
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-black ${sale.price > sale.realCostAtSale ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {sale.price > sale.realCostAtSale ? '+' : ''}{displayVal(sale.price - sale.realCostAtSale)}
                          </span>
                        </td>
                        <td className="py-6 px-4 text-center">
                          <button onClick={() => setSales(sales.filter(s => s.id !== sale.id))} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
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

        {activeTab === 'tools' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in zoom-in-95 duration-500">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10"><svg className="w-24 h-24 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div>
              <h3 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter mb-4">Simulador de Futuro</h3>
              <p className="text-slate-500 font-medium mb-12">Calcula cuánto ganarías si vendieras el resto de tu inventario a un precio específico.</p>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4 italic">¿Precio de venta proyectado?</label>
                  <div className="relative">
                    <span className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300 text-3xl font-black">$</span>
                    <input 
                      type="number" 
                      value={simPrice || ''} 
                      onChange={e => setSimPrice(parseFloat(e.target.value) || 0)} 
                      className="w-full pl-16 pr-8 py-8 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-indigo-600 focus:outline-none text-5xl font-black text-indigo-600 transition-all placeholder:text-slate-200 text-slate-900" 
                      placeholder="0.00" 
                    />
                  </div>
                </div>

                {simResults && (
                  <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-8">
                    <div className="flex justify-between items-end border-b border-white/10 pb-6">
                      <div><p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Ingresos Totales Proyectados</p><p className="text-3xl font-black">{displayVal(simResults.totalRevenue)}</p></div>
                      <div className="text-right">
                        <div className={`text-xs font-black px-3 py-1 rounded-lg ${simResults.isTargetMet ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60'}`}>Meta x{config.targetMultiplier}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Ganancia Libre Final Estimada</p><p className="text-5xl font-black text-emerald-400">{displayVal(simResults.totalNetProfit)}</p></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-200 py-12 text-center text-slate-400">
        <div className="flex justify-center gap-8 mb-6">
          <span className="text-[10px] font-black uppercase tracking-widest">Powered by PalletPro 2025</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Seguro y Privado</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Exportación Profesional</span>
        </div>
        <p className="text-[10px] font-medium italic opacity-50">Los datos se guardan localmente en tu navegador para máxima privacidad.</p>
      </footer>

      {/* Action FAB */}
      <button onClick={() => setIsModalOpen(true)} className="fixed bottom-10 right-10 w-16 h-16 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-400 flex items-center justify-center transform hover:scale-110 active:scale-95 transition-all z-40">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
      </button>

      {/* Modals */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl border border-white/20">
            <h2 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter mb-8">Nueva Venta</h2>
            <form onSubmit={handleAddSale} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Monto de Venta ({displayCurrency})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl">$</span>
                  <input 
                    type="number" step="0.01" required autoFocus 
                    value={newSale.price || ''} 
                    onChange={e => setNewSale({...newSale, price: parseFloat(e.target.value) || 0})} 
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:outline-none text-xl font-black text-slate-900 placeholder:text-slate-400" 
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
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-800"
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
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-800" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Referencia / Cliente</label>
                <input 
                  type="text" placeholder="Ej. Zapato Nike - Juan" 
                  value={newSale.client} 
                  onChange={e => setNewSale({...newSale, client: e.target.value})} 
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black italic text-slate-800 placeholder:text-slate-400" 
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl italic">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg shadow-indigo-100 italic">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter mb-8">Ajustes Base</h2>
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Inversión (USD)</label>
                  <input 
                    type="number" 
                    value={config.investmentUsd} 
                    onChange={e => setConfig({...config, investmentUsd: parseFloat(e.target.value) || 0})} 
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">T. Cambio (MXN)</label>
                  <input 
                    type="number" step="0.01" 
                    value={config.exchangeRate} 
                    onChange={e => setConfig({...config, exchangeRate: parseFloat(e.target.value) || 1})} 
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Piezar Totales</label>
                  <input 
                    type="number" 
                    value={config.totalPieces} 
                    onChange={e => setConfig({...config, totalPieces: parseInt(e.target.value) || 0})} 
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gastos USD</label>
                  <input 
                    type="number" 
                    value={config.additionalExpensesUsd} 
                    onChange={e => setConfig({...config, additionalExpensesUsd: parseFloat(e.target.value) || 0})} 
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-900" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Multiplicador Meta</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map(num => (
                    <button key={num} onClick={() => setConfig({...config, targetMultiplier: num})} className={`flex-1 py-4 rounded-2xl font-black ${config.targetMultiplier === num ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>x{num}</button>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                <button onClick={() => setIsSettingsOpen(false)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest italic shadow-xl">Guardar Ajustes</button>
                <button onClick={() => confirm('¿Resetear todo?') && setSales([])} className="text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 py-3 rounded-xl transition-all">Limpiar Historial de Ventas</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
