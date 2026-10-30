import { http, isMockEnabled } from './client';

export const activitiesApi = {
  recordSearch: (query: string) => isMockEnabled
    ? Promise.resolve()
    : http.post('/activities', { searchQuery: query, activityType: 'SEARCH' }).then(() => undefined),
  record: (activityType: 'VIEW' | 'ADD_TO_CART', productId: string) => isMockEnabled
    ? Promise.resolve()
    : http.post('/activities', { productId, activityType }).then(() => undefined),
};