import type { StoreDeliveryZone } from '../../modules/stores/schemas/store.schema';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

export function matchesDeliveryZone(address: string, zones: StoreDeliveryZone[]): boolean {
  if (!zones.length) return false;
  const normalizedAddress = normalize(address);
  return zones.some((zone) => {
    const districtMatches = normalizedAddress.includes(normalize(zone.district));
    const wardMatches = zone.wards.length === 0 || zone.wards.some((ward) => normalizedAddress.includes(normalize(ward)));
    return districtMatches && wardMatches;
  });
}
