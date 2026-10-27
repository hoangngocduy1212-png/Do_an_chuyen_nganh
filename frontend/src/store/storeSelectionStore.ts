import { useSyncExternalStore } from 'react';
import type { ReceiveMethod, StoreSelection } from '../types/store';

const STORAGE_KEY = 'muadee-store-selection';
const DEFAULT_SELECTION: StoreSelection = { storeId: 'store-nguyen-trai', receiveMethod: 'DELIVERY', deliveryAddress: '' };

function readSelection(): StoreSelection {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_SELECTION, ...JSON.parse(stored) as Partial<StoreSelection> } : DEFAULT_SELECTION;
  } catch {
    return DEFAULT_SELECTION;
  }
}

let selection = readSelection();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateSelection(next: Partial<StoreSelection>) {
  selection = { ...selection, ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  listeners.forEach((listener) => listener());
}

export function useStoreSelection() {
  return useSyncExternalStore(subscribe, () => selection, () => DEFAULT_SELECTION);
}

export const storeSelectionStore = {
  setStore: (storeId: string) => updateSelection({ storeId }),
  setReceiveMethod: (receiveMethod: ReceiveMethod) => updateSelection({ receiveMethod }),
  setDeliveryAddress: (deliveryAddress: string) => updateSelection({ deliveryAddress }),
};