const ORDER_ORIGIN_KEY = 'thalimitra_order_origin';

const ORDER_ORIGINS = [
  'home',
  'todays_menu',
  'order_history',
  'customer_dashboard',
  'how_it_works',
  'students',
  'workers',
  'corporate',
] as const;

export type OrderOrigin = typeof ORDER_ORIGINS[number];

const isOrderOrigin = (value: string | null): value is OrderOrigin =>
  !!value && ORDER_ORIGINS.some(origin => origin === value);

export const rememberOrderOrigin = (tab: string) => {
  if (!isOrderOrigin(tab)) return;
  try {
    window.sessionStorage.setItem(ORDER_ORIGIN_KEY, tab);
  } catch {
    // The order still has a safe Home fallback when storage is unavailable.
  }
};

export const getOrderOrigin = (): OrderOrigin => {
  try {
    const saved = window.sessionStorage.getItem(ORDER_ORIGIN_KEY);
    return isOrderOrigin(saved) ? saved : 'home';
  } catch {
    return 'home';
  }
};

export const clearOrderOrigin = () => {
  try {
    window.sessionStorage.removeItem(ORDER_ORIGIN_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
};
