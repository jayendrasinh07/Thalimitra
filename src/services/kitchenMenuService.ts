import { getSupabaseClient } from './supabaseClient';

export type KitchenMenuMealType = 'breakfast' | 'lunch' | 'dinner' | 'both';

export interface KitchenMenuMeal {
  id: string;
  selectionKey: string;
  name: string;
  description: string;
  mealType: KitchenMenuMealType;
  serviceMealType: Exclude<KitchenMenuMealType, 'both'>;
  dietType: string;
  basePrice: number;
  selected: boolean;
}

export interface KitchenMenuSelection {
  mealId: string;
  serviceMealType: Exclude<KitchenMenuMealType, 'both'>;
}

export interface KitchenMenuPlan {
  menuDate: string;
  isPublished: boolean;
  isLocked: boolean;
  updatedAt: string | null;
  meals: KitchenMenuMeal[];
}

export class KitchenMenuError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(
      code === '42501'
        ? 'Kitchen access is unavailable. Sign in with an authorized account.'
        : code === '22023' || code === '23514'
          ? message || 'Check the menu date and select at least one lunch and one dinner meal.'
          : message || 'The menu could not be saved. Refresh and try again.'
    );
    this.code = code;
  }
}

const isMealType = (value: unknown): value is KitchenMenuMealType =>
  value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'both';
const isServiceMealType = (value: unknown): value is Exclude<KitchenMenuMealType, 'both'> =>
  value === 'breakfast' || value === 'lunch' || value === 'dinner';

export function parseKitchenMenu(value: unknown): KitchenMenuPlan {
  const plan = value as any;
  if (!plan || typeof plan.menu_date !== 'string' || typeof plan.is_published !== 'boolean'
    || typeof plan.is_locked !== 'boolean' || !(plan.updated_at === null || typeof plan.updated_at === 'string')
    || !Array.isArray(plan.meals)) {
    throw new KitchenMenuError('INVALID_RESPONSE');
  }

  const meals: KitchenMenuMeal[] = plan.meals.map((row: any) => {
    if (!row || typeof row.id !== 'string' || typeof row.selection_key !== 'string' || typeof row.name !== 'string'
      || !(row.description === null || typeof row.description === 'string') || !isMealType(row.meal_type)
      || !isServiceMealType(row.service_meal_type)
      || typeof row.diet_type !== 'string' || !Number.isFinite(Number(row.base_price))
      || typeof row.selected !== 'boolean') {
      throw new KitchenMenuError('INVALID_RESPONSE');
    }
    return {
      id: row.id,
      selectionKey: row.selection_key,
      name: row.name,
      description: row.description ?? '',
      mealType: row.meal_type,
      serviceMealType: row.service_meal_type,
      dietType: row.diet_type,
      basePrice: Number(row.base_price),
      selected: row.selected,
    };
  });

  return {
    menuDate: plan.menu_date,
    isPublished: plan.is_published,
    isLocked: plan.is_locked,
    updatedAt: plan.updated_at,
    meals,
  };
}

const toError = (error: any) => new KitchenMenuError(error?.code || 'CONNECTION', error?.message);

export const kitchenMenuService = {
  async get(date: string): Promise<KitchenMenuPlan> {
    const { data, error } = await getSupabaseClient().rpc('get_kitchen_menu', { p_menu_date: date });
    if (error) throw toError(error);
    return parseKitchenMenu(data);
  },

  async save(date: string, selections: KitchenMenuSelection[], publish: boolean): Promise<KitchenMenuPlan> {
    const uniqueKeys = new Set(selections.map(selection => `${selection.mealId}:${selection.serviceMealType}`));
    if (uniqueKeys.size !== selections.length) throw new KitchenMenuError('22023', 'A meal can only be selected once per service.');
    const { data, error } = await getSupabaseClient().rpc('save_kitchen_menu', {
      p_menu_date: date,
      p_meal_ids: selections.map(selection => selection.mealId),
      p_service_meal_types: selections.map(selection => selection.serviceMealType),
      p_publish: publish,
    });
    if (error) throw toError(error);
    return parseKitchenMenu(data);
  },
};

