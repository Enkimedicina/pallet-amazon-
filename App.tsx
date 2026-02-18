
import React, { useState, useEffect, useMemo } from 'react';
import { PalletConfig, Sale, Currency } from './types';
import { calculateFinancials, formatCurrency } from './utils/calculations';
import DashboardCard from './components/DashboardCard';
import ExportButton from './components/ExportButton';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Line, PieChart, Pie, Cell, ComposedChart
} from 'recharts';

const App: React.FC = () => {
  // Persistence Layer
  const [config, setConfig] = useState<PalletConfig>(() => {
    const saved = localStorage.getItem('pallet_config');
    return saved ? JSON.parse(saved) : {
      investmentUsd: 1250,
      exchangeRate: 17,
      totalPieces: 250,
      additionalExpensesUsd: 0,
      targetMultiplier: 2
    };
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('pallet_sales');
    return saved ? JSON.parse(saved) : [];
  });

  // Default to MXN
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(Currency.MXN);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // New Sale Form
  const [newSale, setNewSale] = useState({
    price: 0, 
    client: '',
    method: 'Efectivo',
    date: new Date().toISOString().split('T')[0]
  });

  // Simulation Form
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
    
    const priceInUsd = displayCurrency === Currency.MXN 
      ? newSale.price / config.exchangeRate 
      : newSale.price;

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

  const handleDeleteSale = (id: string) => {
    setSales(sales.filter(s => s.id !== id));
  };

  const chartData = useMemo(() => {
    let cumulativeRevenue = 0;
    return sales.map((s, i) => {
      cumulativeRevenue += s.price;
      const factor = displayCurrency === Currency.USD ? 1 : config.exchangeRate;
      return {
        name: `Venta ${i + 1}`,
        revenue: cumulativeRevenue * factor,
        investment: stats.totalInvestmentUsd * factor,
        profit: Math.max(0, (cumulativeRevenue - stats.totalInvestmentUsd) * factor)
      };
    });
  }, [sales, stats.totalInvestmentUsd, displayCurrency, config.exchangeRate]);

  // Combined Actual + Projected Data for the new chart
  const projectionChartData = useMemo(() => {
    const data = [];
    const factor = displayCurrency === Currency.USD ? 1 : config.exchangeRate;
    
    // Part 1: Actual cumulative sales
    let cumulative = 0;
    sales.forEach((s, i) => {
      cumulative += s.price;
      data.push({
        label: `Venta ${i + 1}`,
        actual: cumulative * factor,
        projected: null
      });
    });

    // Connector point
    if (data.length > 0) {
      data[data.length - 1].projected = data[data.length - 1].actual;
    } else {
      // Starting from 0 if no sales
      data.push({ label: 'Inicio', actual: 0, projected: 0 });
    }

    // Part 2: Projected growth in 5 steps for visualization
    if (stats.remainingPieces > 0) {
      const steps = 5;
      const pzPerStep = Math.max(1, Math.floor(stats.remainingPieces / steps));
      
      for (let i = 1; i <= steps; i++) {
        const pzCount = i === steps ? stats.remainingPieces : i * pzPerStep;
        const projectedGain = pzCount * currentAvgPriceUsd;
        data.push({
          label: `+${pzCount} Pz`,
          actual: null,
          projected: (stats.totalRevenueUsd + projectedGain) * factor
        });
      }
    }

    return data;
  }, [sales, stats.remainingPieces, stats.totalRevenueUsd, currentAvgPriceUsd, displayCurrency, config.exchangeRate]);

  const pieData = useMemo(() => [
    { name: 'Capital Reinversión', value: stats.capitalRecoveredUsd, color: '#6366f1' },
    { name: 'Ganancia Libre', value: stats.netProfitUsd, color: '#10b981' }
  ], [stats]);

  const displayVal = (usdAmount: number, overrideCurrency?: Currency) => {
    const curr = overrideCurrency || displayCurrency;
    const val = curr === Currency.USD ? usdAmount : usdAmount * config.exchangeRate;
    return formatCurrency(val, curr);
  };

  const dualDisplay = (usdAmount: number) => {
    return `${displayVal(usdAmount, Currency.MXN)} (${displayVal(usdAmount, Currency.USD)})`;
  };

  // Simulation Logic
  const simResults = useMemo(() => {
    if (simPrice <= 0) return null;
    const priceInUsd = displayCurrency === Currency.MXN ? simPrice / config.exchangeRate : simPrice;
    
    const profitForThisPiece = Math.max(0, priceInUsd - stats.dynamicCostPerPieceUsd);
    const newRemainingInvUsd = Math.max(0, stats.remainingInvestmentUsd - priceInUsd);
    const newPiecesRemaining = Math.max(0, stats.remainingPieces - 1);
    const newDynamicCostUsd = newPiecesRemaining > 0 ? newRemainingInvUsd / newPiecesRemaining : 0;
    
    const projectedTotalRevenueUsd = stats.totalRevenueUsd + (stats.remainingPieces * priceInUsd);
    const projectedNetProfitUsd = projectedTotalRevenueUsd - stats.totalInvestmentUsd;
    const meetsTarget = projectedTotalRevenueUsd >= stats.targetRevenueUsd;

    return {
      profit: profitForThisPiece,
      remainingInv: newRemainingInvUsd,
      dynamicCost: newDynamicCostUsd,
      diffCost: newDynamicCostUsd - stats.dynamicCostPerPieceUsd,
      projectedTotalRevenue: projectedTotalRevenueUsd,
      projectedNetProfit: projectedNetProfitUsd,
      meetsTarget
    };
  }, [simPrice, stats, displayCurrency, config.exchangeRate]);

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-4 sm:px-8 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m.599-2.1c.442-.258.81-.595 1.056-1.003C15.12 12.812 16 11.5 16 10s-.88-2.812-2.345-3.897M12 20V4m0 0h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Pallet Profit Master</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-tighter">Control Financiero Inteligente</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
              onClick={() => setDisplayCurrency(Currency.MXN)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${displayCurrency === Currency.MXN ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              MXN
            </button>
            <button 
              onClick={() => setDisplayCurrency(Currency.USD)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${displayCurrency === Currency.USD ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              USD
            </button>
          </div>
          
          <ExportButton config={config} sales={sales} />
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        <div className="mb-8 p-4 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-slate-400 block font-medium">Inversión Total</span>
              <span className="text-lg font-bold text-slate-800">{dualDisplay(stats.totalInvestmentUsd)}</span>
            </div>
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div className="text-sm">
              <span className="text-slate-400 block font-medium">Tipo de Cambio</span>
              <span className="text-lg font-bold text-slate-800">$1 USD = ${config.exchangeRate} MXN</span>
            </div>
          </div>
          <div className="text-sm text-right">
            <span className="text-slate-400 block font-medium">Costo Inicial / Pieza</span>
            <span className="text-lg font-bold text-slate-800">{dualDisplay(stats.initialCostPerPieceUsd)}</span>
          </div>
        </div>

        <div className="mb-8">
          {!stats.isROIReached ? (
            <div className="bg-indigo-50 border-l-4 border-indigo-400 p-5 rounded-r-2xl flex items-center justify-between shadow-sm">
              <div className="flex items-center">
                <div className="p-3 bg-indigo-100 rounded-xl mr-4 text-indigo-700">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </div>
                <div>
                  <h4 className="font-bold text-indigo-900 text-lg italic">Fase de Recuperación de Capital</h4>
                  <p className="text-indigo-800">Todo el ingreso actual se destina a <span className="font-black underline">Reinversión</span> para cubrir los {displayVal(stats.remainingInvestmentUsd)} faltantes.</p>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="text-right mb-1">
                  <span className="text-indigo-800 font-bold">{stats.recoveryProgress.toFixed(1)}%</span>
                </div>
                <div className="w-64 bg-indigo-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000" style={{ width: `${stats.recoveryProgress}%` }}></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-5 rounded-r-2xl flex items-center shadow-sm">
              <div className="p-3 bg-emerald-100 rounded-xl mr-4 text-emerald-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <div>
                <h4 className="font-bold text-emerald-900 text-lg">¡DINERO A TU FAVOR! 🚀</h4>
                <p className="text-emerald-800">Inversión cubierta al 100%. Las nuevas ventas son <span className="font-black">Ganancia Libre</span> directa para ti.</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <DashboardCard 
            title="Capital Reinversión"
            value={displayVal(stats.capitalRecoveredUsd)}
            subtitle="Dinero recuperado/guardado"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>}
            colorClass="bg-indigo-100 text-indigo-600"
          />
          <DashboardCard 
            title="Ganancia Libre"
            value={displayVal(stats.netProfitUsd)}
            subtitle="Dinero ganado a favor"
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m.599-2.1c.442-.258.81-.595 1.056-1.003C15.12 12.812 16 11.5 16 10s-.88-2.812-2.345-3.897M12 20V4m0 0h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            colorClass="bg-emerald-100 text-emerald-600"
          />
          <DashboardCard 
            title="Costo Dinámico"
            value={displayVal(stats.dynamicCostPerPieceUsd)}
            subtitle={`${stats.remainingPieces} piezas restantes`}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>}
            colorClass="bg-purple-100 text-purple-600"
          />
          <DashboardCard 
            title="Meta Total"
            value={displayVal(stats.targetRevenueUsd)}
            subtitle={`${Math.round(stats.progressToTarget)}% del objetivo`}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>}
            colorClass="bg-blue-100 text-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800">Recuperación vs Ganancia ({displayCurrency})</h3>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val.toLocaleString()}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`$${value.toLocaleString()}`, '']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" name="Ventas Acumuladas" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" name="Ganancia Libre" />
                    <Line type="monotone" dataKey="investment" stroke="#f87171" strokeDasharray="5 5" dot={false} strokeWidth={2} name="Línea de Inversión" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* NEW: Projection Chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-800">Proyección de Crecimiento Final</h3>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                    <span className="text-slate-500">Real</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-indigo-300 rounded-full border border-indigo-500 border-dashed"></div>
                    <span className="text-slate-500">Proyectado</span>
                  </div>
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-6 italic">Estimación basada en tu precio promedio de venta actual de <span className="font-bold text-indigo-600">{displayVal(currentAvgPriceUsd)}</span></p>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projectionChartData}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val.toLocaleString()}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`$${value.toLocaleString()}`, '']}
                    />
                    <Area type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" />
                    <Area type="monotone" dataKey="projected" stroke="#818cf8" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorProj)" />
                    <Line type="monotone" dataKey="investment" stroke="#f87171" strokeDasharray="5 5" dot={false} strokeWidth={1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                <h3 className="text-lg font-bold text-slate-800">Historial de Ventas</h3>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsSimulationModalOpen(true)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border border-slate-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    Simular
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Registrar Venta
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-50">
                      <th className="pb-4 px-2">Fecha</th>
                      <th className="pb-4 px-2">Precio ({displayCurrency})</th>
                      <th className="pb-4 px-2">Ganancia Real</th>
                      <th className="pb-4 px-2 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 italic">No hay registros de ventas.</td>
                      </tr>
                    )}
                    {[...sales].reverse().map(sale => (
                      <tr key={sale.id} className="text-sm text-slate-700 hover:bg-indigo-50/30 transition-colors group">
                        <td className="py-4 px-2 whitespace-nowrap text-slate-500">{sale.date}</td>
                        <td className="py-4 px-2 font-bold">{displayVal(sale.price)}</td>
                        <td className="py-4 px-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${sale.price > sale.realCostAtSale ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {sale.price > sale.realCostAtSale ? '+' : ''}{displayVal(sale.price - sale.realCostAtSale)}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-center">
                          <button 
                            onClick={() => handleDeleteSale(sale.id)}
                            className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>
                Distribución de Dinero
              </h3>
              <div className="h-48 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => displayVal(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                    <span className="text-slate-500 font-medium italic">Para Reinvertir:</span>
                  </div>
                  <span className="font-bold text-indigo-700">{displayVal(stats.capitalRecoveredUsd)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-slate-500 font-medium italic">Ganancia Libre:</span>
                  </div>
                  <span className="font-bold text-emerald-700">{displayVal(stats.netProfitUsd)}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-6 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                💡 El <span className="text-indigo-600 font-bold uppercase tracking-tighter">Capital de Reinversión</span> es el dinero que debes guardar para comprar tu próximo pallet. La <span className="text-emerald-600 font-bold uppercase tracking-tighter">Ganancia Libre</span> es tu utilidad real después de asegurar tu capital.
              </p>
            </div>

            <div className="bg-slate-900 text-white p-7 rounded-3xl shadow-xl overflow-hidden relative border border-slate-800">
              <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-indigo-500 rounded-full mix-blend-screen opacity-10 filter blur-3xl animate-pulse"></div>
              <h3 className="text-xl font-bold mb-6 relative z-10">Métricas Clave</h3>
              <ul className="space-y-5 relative z-10">
                <li className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm font-medium italic">Margen x Pieza</span>
                  <span className={`font-bold ${stats.averageMarginUsd > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {displayVal(stats.averageMarginUsd)}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm font-medium italic">Capital a Recuperar</span>
                  <span className="font-bold text-indigo-300">{displayVal(stats.remainingInvestmentUsd)}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm font-medium italic">Meta Proyectada</span>
                  <span className="font-bold text-white">
                    {displayVal(stats.totalRevenueUsd + (stats.remainingPieces * currentAvgPriceUsd))}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Sale Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl transform transition-all border border-slate-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800">Registrar Venta</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <form onSubmit={handleAddSale} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide italic">Precio de Venta ({displayCurrency})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    autoFocus
                    value={newSale.price === 0 ? '' : newSale.price}
                    onChange={e => setNewSale({...newSale, price: parseFloat(e.target.value) || 0})}
                    className="w-full pl-8 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none text-lg font-bold transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between mt-2 px-1">
                  <p className="text-xs text-slate-500 font-medium italic">
                    Costo Dinámico: <span className="font-bold text-indigo-600">{displayVal(stats.dynamicCostPerPieceUsd)}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide italic">Método</label>
                  <select 
                    value={newSale.method}
                    onChange={e => setNewSale({...newSale, method: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:outline-none font-bold text-slate-700"
                  >
                    <option>Efectivo</option>
                    <option>Transferencia</option>
                    <option>Tarjeta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide italic">Fecha</label>
                  <input 
                    type="date"
                    value={newSale.date}
                    onChange={e => setNewSale({...newSale, date: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:outline-none font-bold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide italic">Cliente</label>
                <input 
                  type="text"
                  value={newSale.client}
                  onChange={e => setNewSale({...newSale, client: e.target.value})}
                  placeholder="Nombre o referencia"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:outline-none font-bold"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 border-2 border-slate-100 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition-all uppercase tracking-widest text-xs italic"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all transform hover:-translate-y-1 active:translate-y-0 uppercase tracking-widest text-xs italic"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulation Modal */}
      {isSimulationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl transform transition-all border border-slate-200 overflow-y-auto max-h-[95vh]">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Simular Impacto
              </h2>
              <button onClick={() => { setIsSimulationModalOpen(false); setSimPrice(0); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide italic">¿Venta promedio proyectada?</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    autoFocus
                    value={simPrice === 0 ? '' : simPrice}
                    onChange={e => setSimPrice(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none text-xl font-black transition-all"
                    placeholder="Ej. 15.00"
                  />
                </div>
              </div>

              {simResults ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  {/* Single Piece Impact */}
                  <div className="bg-indigo-50 border-2 border-indigo-100 p-5 rounded-3xl">
                    <h4 className="text-indigo-600 text-xs font-black uppercase tracking-widest mb-4 italic">Impacto Inmediato</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-xs font-bold uppercase italic">Utilidad Neta Pieza</span>
                        <span className={`font-black ${simResults.profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {displayVal(simResults.profit)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-xs font-bold uppercase italic">Nuevo Costo Dinámico</span>
                        <div className="text-right">
                          <span className="font-black text-indigo-700">{displayVal(simResults.dynamicCost)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Projection */}
                  <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl">
                    <h4 className="text-indigo-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center justify-between italic">
                      Proyección Final del Pallet
                      {simResults.meetsTarget && (
                        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider animate-bounce">
                          Meta x{config.targetMultiplier} Lograda
                        </span>
                      )}
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-indigo-200">
                        <span className="text-[10px] font-bold uppercase italic">Reinversión (Costo)</span>
                        <span className="text-sm font-black">{displayVal(stats.totalInvestmentUsd)}</span>
                      </div>
                      <div className="flex justify-between items-center text-blue-200 border-t border-slate-800 pt-3">
                        <span className="text-[10px] font-bold uppercase italic tracking-wider">Ingreso Total Proyectado</span>
                        <span className="text-lg font-black">{displayVal(simResults.projectedTotalRevenue)}</span>
                      </div>
                      <div className="h-px bg-slate-800"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[10px] font-bold uppercase italic tracking-wider">Ganancia Libre Final</span>
                        <div className="text-right">
                          <span className={`text-2xl font-black ${simResults.projectedNetProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {displayVal(simResults.projectedNetProfit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-slate-400 text-sm font-medium italic">Ingresa un precio para ver el futuro del pallet.</p>
                </div>
              )}

              <button 
                onClick={() => { setIsSimulationModalOpen(false); setSimPrice(0); }}
                className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px] italic"
              >
                Cerrar Simulación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 italic">Ajustes del Negocio</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 italic">Costo Pallet (USD)</label>
                  <input 
                    type="number"
                    value={config.investmentUsd}
                    onChange={e => setConfig({...config, investmentUsd: parseFloat(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 italic">Dólar Hoy (MXN)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={config.exchangeRate}
                    onChange={e => setConfig({...config, exchangeRate: parseFloat(e.target.value) || 1})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 italic">Total Piezas</label>
                  <input 
                    type="number"
                    value={config.totalPieces}
                    onChange={e => setConfig({...config, totalPieces: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 italic">Otros Gastos (USD)</label>
                  <input 
                    type="number"
                    value={config.additionalExpensesUsd}
                    onChange={e => setConfig({...config, additionalExpensesUsd: parseFloat(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide italic">Multiplicador Meta</label>
                <div className="flex gap-3">
                  {[2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      onClick={() => setConfig({...config, targetMultiplier: num})}
                      className={`flex-1 py-4 rounded-2xl font-black transition-all transform hover:-translate-y-0.5 ${config.targetMultiplier === num ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border-2 border-slate-100'}`}
                    >
                      x{num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-4">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all transform hover:-translate-y-1 active:translate-y-0 italic"
                >
                  Guardar Cambios
                </button>
                <button 
                  onClick={() => {
                    if(confirm("¿Seguro? Borrarás todas las ventas y el historial.")) {
                      setSales([]);
                      setIsSettingsOpen(false);
                    }
                  }}
                  className="w-full py-4 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all text-xs uppercase tracking-widest italic"
                >
                  Resetear Todo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 lg:hidden bg-indigo-600 text-white p-5 rounded-[2rem] shadow-2xl z-40 transform transition-all active:scale-95 shadow-indigo-300"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
      </button>

    </div>
  );
};

export default App;
