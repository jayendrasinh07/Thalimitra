import type { DeliveryAddress } from '../types';

const clean = (value?: string) => value?.trim() || '';

const uniqueParts = (parts: Array<string | undefined>) => {
  const seen = new Set<string>();
  return parts.flatMap(value => {
    const part = clean(value);
    const key = part.toLocaleLowerCase('en-IN');
    if (!part || seen.has(key)) return [];
    seen.add(key);
    return [part];
  });
};

export const getAddressPrimaryLine = (address: DeliveryAddress) => {
  const doorstep = uniqueParts([
    address.houseNumber,
    address.building,
    address.floor ? `Floor ${address.floor}` : undefined,
    address.street,
  ]).join(', ');
  return doorstep || clean(address.addressLine1) || clean(address.addressLine) || clean(address.sector) || clean(address.area) || 'Saved address';
};

export const getAddressFullLine = (address: DeliveryAddress) => {
  const formatted = clean(address.addressLine1) || clean(address.addressLine);
  const doorstep = uniqueParts([
    address.houseNumber,
    address.building,
    address.floor ? `Floor ${address.floor}` : undefined,
    address.street,
    address.landmark ? `Near ${address.landmark}` : undefined,
  ]);
  const base = formatted.toLocaleLowerCase('en-IN');
  const detail = doorstep.filter(part => !base.includes(part.toLocaleLowerCase('en-IN')));
  const leading = uniqueParts([...detail, formatted]);
  const leadingText = leading.join(', ').toLocaleLowerCase('en-IN');
  const locality = uniqueParts([address.sector, address.area, address.city, address.state, address.pincode])
    .filter(part => !leadingText.includes(part.toLocaleLowerCase('en-IN')));
  return [...leading, ...locality].join(', ');
};

export const getAddressCompactLine = (address: DeliveryAddress) => {
  const primary = getAddressPrimaryLine(address);
  return primary.length > 52 ? `${primary.slice(0, 49).trimEnd()}…` : primary;
};
