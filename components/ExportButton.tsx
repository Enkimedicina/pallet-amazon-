
import React from 'react';
import { PalletConfig, Sale } from '../types';
import { calculateFinancials, formatCurrency } from '../utils/calculations';

// @ts-ignore
const XLSX = window.XLSX;

interface Props {
  config: PalletConfig;
  sales: Sale[];
}

const ExportButton: React.FC<Props> = ({ config, sales }) => {
  const handleExport = () => {
    const stats = calculateFinancials(config, sales);

    // 1. Resumen General
    const summaryData = [
      ["PALLET PROFIT MASTER - REPORTE GENERAL"],
      [""],
      ["CONCEPTO", "VALOR USD", "VALOR MXN"],
      ["Inversión Inicial", config.investmentUsd, config.investmentUsd * config.exchangeRate],
      ["Gastos Adicionales", config.additionalExpensesUsd, config.additionalExpensesUsd * config.exchangeRate],
      ["Inversión Total", stats.totalInvestmentUsd, stats.totalInvestmentMxn],
      ["Tipo de Cambio", config.exchangeRate, "1.00"],
      [""],
      ["ESTADO ACTUAL", "VALOR USD", "VALOR MXN"],
      ["Total Vendido", stats.totalRevenueUsd, stats.totalRevenueUsd * config.exchangeRate],
      ["Capital Recuperado", stats.capitalRecoveredUsd, stats.capitalRecoveredUsd * config.exchangeRate],
      ["Capital Pendiente", stats.remainingInvestmentUsd, stats.remainingInvestmentUsd * config.exchangeRate],
      ["Ganancia Neta", stats.netProfitUsd, stats.netProfitUsd * config.exchangeRate],
      [""],
      ["INVENTARIO", "CANTIDAD", "VALOR"],
      ["Piezas Iniciales", config.totalPieces, ""],
      ["Piezas Vendidas", stats.piecesSold, ""],
      ["Piezas Restantes", stats.remainingPieces, ""],
      ["Costo Real por Pieza", stats.dynamicCostPerPieceUsd, stats.dynamicCostPerPieceUsd * config.exchangeRate],
    ];

    // 2. Historial de Ventas
    const salesData = [
      ["FECHA", "CLIENTE", "MÉTODO PAGO", "PRECIO VENTA (USD)", "COSTO MOMENTO (USD)", "GANANCIA (USD)", "CAPITAL PENDIENTE (USD)"],
      ...sales.map(s => [
        s.date,
        s.client || 'General',
        s.method,
        s.price,
        s.realCostAtSale,
        Math.max(0, s.price - s.realCostAtSale),
        0 // Placeholder for dynamic calc in sheets if needed
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    const ws2 = XLSX.utils.aoa_to_sheet(salesData);

    XLSX.utils.book_append_sheet(wb, ws1, "Resumen General");
    XLSX.utils.book_append_sheet(wb, ws2, "Historial de Ventas");

    XLSX.writeFile(wb, `Reporte_Pallet_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <button 
      onClick={handleExport}
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      Exportar Excel
    </button>
  );
};

export default ExportButton;
