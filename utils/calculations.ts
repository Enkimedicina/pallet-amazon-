
import { PalletConfig, Sale } from '../types';

export const calculateFinancials = (config: PalletConfig, sales: Sale[]) => {
  const totalInvestmentUsd = config.investmentUsd + config.additionalExpensesUsd;
  const totalInvestmentMxn = totalInvestmentUsd * config.exchangeRate;
  
  const totalRevenueUsd = sales.reduce((acc, s) => acc + s.price, 0);
  const remainingInvestmentUsd = Math.max(0, totalInvestmentUsd - totalRevenueUsd);
  
  const piecesSold = sales.length;
  const remainingPieces = config.totalPieces - piecesSold;
  
  // Dynamic Cost Per Piece: Current remaining debt divided by remaining inventory
  const dynamicCostPerPieceUsd = remainingPieces > 0 
    ? remainingInvestmentUsd / remainingPieces 
    : 0;

  const capitalRecoveredUsd = Math.min(totalRevenueUsd, totalInvestmentUsd);
  const netProfitUsd = Math.max(0, totalRevenueUsd - totalInvestmentUsd);
  
  const recoveryProgress = (capitalRecoveredUsd / totalInvestmentUsd) * 100;
  
  // Real profit per piece (Only starts after investment is cleared)
  // Or more accurately: Revenue minus "Initial Cost"
  const initialCostPerPieceUsd = totalInvestmentUsd / config.totalPieces;
  
  const averageMarginUsd = sales.length > 0 
    ? (totalRevenueUsd / sales.length) - initialCostPerPieceUsd
    : 0;

  const targetRevenueUsd = totalInvestmentUsd * config.targetMultiplier;
  const progressToTarget = (totalRevenueUsd / targetRevenueUsd) * 100;

  const isROIReached = totalRevenueUsd >= totalInvestmentUsd;

  return {
    totalInvestmentUsd,
    totalInvestmentMxn,
    totalRevenueUsd,
    remainingInvestmentUsd,
    piecesSold,
    remainingPieces,
    dynamicCostPerPieceUsd,
    capitalRecoveredUsd,
    netProfitUsd,
    recoveryProgress,
    initialCostPerPieceUsd,
    averageMarginUsd,
    targetRevenueUsd,
    progressToTarget,
    isROIReached
  };
};

export const formatCurrency = (amount: number, currency: 'USD' | 'MXN') => {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-MX', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};
