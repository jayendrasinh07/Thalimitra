const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('src/services/deliveryDayPlanService.ts', 'utf8')
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace(/export /g, '');
const page = readFileSync('src/pages/DeliveryDayPlansPage.tsx', 'utf8');
const modal = readFileSync('src/components/modals/DeliveryDayPlanModal.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const flags = readFileSync('src/config/featureFlags.ts', 'utf8');
const calls = [];
let response = { data: null, error: null };
const api = vm.runInNewContext(
  stripTypeScriptTypes(source) + '\n;({ deliveryDayPlanService, DeliveryDayPlanError })',
  { Error, Number, Object, Array, getSupabaseClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return response; } }) },
);

const plan = {
  id: 'plan-1', template_code: 'regular_15_days', plan_name: '15-Day Regular Plan', delivery_days: 15,
  status: 'requested', payment_status: 'pending', preferred_start_date: '2026-09-28', expected_completion_date: null,
  customer_note: null, meal_types: ['breakfast', 'lunch', 'dinner'], weekdays_by_service: { breakfast: [1,2,3], lunch: [1,2,3], dinner: [1,2,3] },
  meals_per_delivery_day: 3, total_meal_occurrences: 45, accepted_quote: null,
  created_at: '2026-09-26T00:00:00Z', updated_at: '2026-09-26T00:00:00Z',
};

(async () => {
  response = { data: plan, error: null };
  await api.deliveryDayPlanService.request({
    templateCode: 'regular_15_days', mealTypes: ['breakfast', 'lunch', 'dinner'], weekdays: [1,2,3],
    addressId: 'address-1', preferredStartDate: '2026-09-28', requestIdempotencyKey: 'request-1', note: ' reception ',
  });
  assert.equal(JSON.stringify(calls[0]), JSON.stringify({ name: 'request_delivery_day_plan', args: {
    p_template_code: 'regular_15_days', p_meal_types: ['breakfast', 'lunch', 'dinner'], p_weekdays: [1,2,3],
    p_address_id: 'address-1', p_preferred_start_date: '2026-09-28', p_request_idempotency_key: 'request-1', p_customer_note: 'reception',
  } }));
  response = { data: [plan], error: null };
  assert.equal((await api.deliveryDayPlanService.getMine())[0].total_meal_occurrences, 45);

  assert.match(page, /delivery days/);
  assert.match(page, /total_meal_occurrences/);
  assert.match(page, /Breakfast, Lunch, Dinner or any combination/);
  assert.match(modal, /plans\[planCode\]\.days \* mealTypes\.length/);
  assert.match(modal, /Preferred delivery weekdays/);
  assert.match(modal, /requestIdempotencyKey: requestKey\.current/);
  assert.match(modal, /address\.houseNumber/);
  assert.match(modal, /No automatic charge/);
  assert.match(app, /DELIVERY_DAY_PLANS_ENABLED \? <DeliveryDayPlansPage \/> : <MealPlansPage \/>/);
  assert.match(flags, /DELIVERY_DAY_PLANS_ENABLED = false/);
  console.log('PASS: delivery-day plan totals, guarded request mapping, builder UI and rollout flag');
})().catch(error => { console.error(error); process.exitCode = 1; });
