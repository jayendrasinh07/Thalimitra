const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('src/services/kitchenMenuService.ts', 'utf8')
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace(/export /g, '');

const calls = [];
let response = { data: null, error: null };
const api = vm.runInNewContext(
  stripTypeScriptTypes(source) + '\n;({ kitchenMenuService, parseKitchenMenu, KitchenMenuError })',
  {
    Error, Number, Set,
    getSupabaseClient: () => ({
      rpc: async (name, args) => { calls.push({ name, args }); return response; },
    }),
  }
);

const document = {
  menu_date: '2026-09-05', is_published: false, is_locked: false, updated_at: null,
  meals: [
    { id: 'shared', selection_key: 'shared:lunch', name: 'Executive Thali', description: null, meal_type: 'both', service_meal_type: 'lunch', diet_type: 'standard_gujarati', base_price: 119, selected: true },
    { id: 'shared', selection_key: 'shared:dinner', name: 'Executive Thali', description: 'Dinner option', meal_type: 'both', service_meal_type: 'dinner', diet_type: 'standard_gujarati', base_price: '119', selected: false },
  ],
};

(async () => {
  const parsed = api.parseKitchenMenu(document);
  assert.equal(parsed.menuDate, '2026-09-05');
  assert.equal(parsed.meals[0].description, '');
  assert.equal(parsed.meals[1].basePrice, 119);
  for (const invalid of [null, { ...document, meals: null }, { ...document, meals: [{ ...document.meals[0], selected: 'yes' }] }]) {
    assert.throws(() => api.parseKitchenMenu(invalid));
  }

  response = { data: document, error: null };
  await api.kitchenMenuService.get('2026-09-05');
  assert.equal(JSON.stringify(calls[0]), JSON.stringify({ name: 'get_kitchen_menu', args: { p_menu_date: '2026-09-05' } }));

  response = { data: { ...document, is_published: true }, error: null };
  const published = await api.kitchenMenuService.save('2026-09-05', [
    { mealId: 'shared', serviceMealType: 'lunch' },
  ], true);
  assert.equal(published.isPublished, true);
  assert.equal(JSON.stringify(calls[1]), JSON.stringify({
    name: 'save_kitchen_menu',
    args: { p_menu_date: '2026-09-05', p_meal_ids: ['shared'], p_service_meal_types: ['lunch'], p_publish: true },
  }));

  await assert.rejects(api.kitchenMenuService.save('2026-09-05', [
    { mealId: 'shared', serviceMealType: 'lunch' },
    { mealId: 'shared', serviceMealType: 'lunch' },
  ], false), /only be selected once per service/);
  response = { data: null, error: { code: '42501', message: 'denied' } };
  await assert.rejects(api.kitchenMenuService.get('2026-09-05'), /authorized account/);
  console.log('PASS: kitchen menu response validation, exact RPC contract, duplicate guard and access errors');
})().catch(error => { console.error(error); process.exitCode = 1; });

