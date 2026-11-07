import { http, isMockEnabled, unwrapApiResponse } from './client';

export type ForecastAlert = 'SHORTAGE' | 'OVERSTOCK' | 'NORMAL';

export interface ForecastRow {
  productId: string;
  productName: string;
  unit: string;
  predictedQuantity: number;
  currentStock: number;
  alertType: ForecastAlert;
  suggestedQuantity: number;
}

export const forecastsApi = {
  run: async (storeId: string, periodDays: number): Promise<ForecastRow[]> => {
    if (isMockEnabled) return [];
    const response = await http.get<{ success: true; data: ForecastRow[] }>('/forecasts', { params: { storeId, periodDays } });
    return unwrapApiResponse(response);
  },
};
