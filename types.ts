
export enum Currency {
  USD = 'USD',
  MXN = 'MXN'
}

export interface Sale {
  id: string;
  date: string;
  price: number; // In the base currency (USD)
  method: string;
  client: string;
  realCostAtSale: number;
}

export interface PalletConfig {
  investmentUsd: number;
  exchangeRate: number;
  totalPieces: number;
  additionalExpensesUsd: number;
  targetMultiplier: number; // 2 for double, 3 for triple
}

export interface FinancialState {
  config: PalletConfig;
  sales: Sale[];
}
