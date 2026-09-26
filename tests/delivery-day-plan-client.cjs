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
const previewMigration = readFileSync('supabase/migrations/20260926041101_delivery_day_plan_preview.sql', 'utf8');
const customerMigration = readFileSync('supabase/migrations/20260926043000_delivery_day_plan_customer_rpcs.sql', 'utf8');
const quoteMigration = readFileSync('supabase/migrations/20260926060000_delivery_day_plan_quotes.sql', 'utf8');
const managementService = readFileSync('src/services/deliveryDayPlanManagementService.ts', 'utf8');
const management = readFileSync('src/components/kitchen/DeliveryDayPlanManagement.tsx', 'utf8');
const dashboard = readFileSync('src/pages/KitchenDashboard.tsx', 'utf8');
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
  meals_per_delivery_day: 3, total_meal_occurrences: 45, current_quote: null, accepted_quote: null,
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

  const preview = {
    template_code: 'regular_15_days', plan_name: '15-Day Regular Plan', delivery_days: 15,
    meal_types: ['breakfast', 'lunch', 'dinner'], weekdays: [1,2,3], meals_per_delivery_day: 3,
    total_meal_occurrences: 45, first_delivery_date: '2026-09-28', expected_completion_date: '2026-10-30',
    currency: 'INR', estimated_subtotal_min: '4305.00', estimated_subtotal_max: '9255.00',
    estimated_delivery_fee: '0.00', estimated_total_min: '4305.00', estimated_total_max: '9255.00',
    estimate_basis: 'current_active_menu_range', final_quote_required: true,
  };
  response = { data: preview, error: null };
  const parsedPreview = await api.deliveryDayPlanService.preview({
    templateCode: 'regular_15_days', mealTypes: ['breakfast', 'lunch', 'dinner'], weekdays: [1,2,3],
    addressId: 'address-1', preferredStartDate: '2026-09-28',
  });
  assert.equal(parsedPreview.estimated_total_min, 4305);
  assert.equal(parsedPreview.total_meal_occurrences, 45);
  assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify({ name: 'preview_delivery_day_plan', args: {
    p_template_code: 'regular_15_days', p_meal_types: ['breakfast', 'lunch', 'dinner'], p_weekdays: [1,2,3],
    p_address_id: 'address-1', p_preferred_start_date: '2026-09-28',
  } }));

  const quote = {
    id: 'quote-1', version: 1, status: 'offered', currency: 'INR', subtotal_amount: '4305.00',
    discount_amount: '305.00', delivery_fee: '0.00', tax_amount: '0.00', total_amount: '4000.00',
    valid_until: '2026-09-28T12:00:00Z', offered_at: '2026-09-26T10:00:00Z', accepted_at: null, declined_at: null,
    items: [{ id: 'line-1', item_type: 'service', meal_type: 'breakfast', label: 'Breakfast service', quantity: 15, unit_amount: '59.00', line_amount: '885.00' }],
  };
  response = { data: { ...plan, status: 'accepted', current_quote: { ...quote, status: 'accepted', accepted_at: '2026-09-26T11:00:00Z' }, accepted_quote: { ...quote, status: 'accepted', accepted_at: '2026-09-26T11:00:00Z' } }, error: null };
  const accepted = await api.deliveryDayPlanService.respondToQuote('plan-1', 'quote-1', 'accept');
  assert.equal(accepted.accepted_quote.total_amount, 4000);
  assert.equal(accepted.accepted_quote.items[0].unit_amount, 59);
  assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify({ name: 'respond_delivery_day_plan_quote', args: {
    p_subscription_id: 'plan-1', p_quote_id: 'quote-1', p_decision: 'accept',
  } }));

  assert.match(page, /delivery days/);
  assert.match(page, /total_meal_occurrences/);
  assert.match(page, /Breakfast, Lunch, Dinner or any combination/);
  assert.match(modal, /plans\[planCode\]\.days \* mealTypes\.length/);
  assert.match(modal, /Preferred delivery weekdays/);
  assert.match(modal, /requestIdempotencyKey: requestKey\.current/);
  assert.match(modal, /address\.houseNumber/);
  assert.match(modal, /No automatic charge/);
  assert.match(modal, /Database-calculated preview/);
  assert.match(modal, /expected_completion_date/);
  assert.match(modal, /current active menu prices/);
  assert.match(previewMigration, /private\.require_customer_access\(\)/);
  assert.match(previewMigration, /public\.quote_delivery_address\(p_address_id\)/);
  assert.match(previewMigration, /v_template\.delivery_days \* cardinality\(v_meal_types\)/);
  assert.match(previewMigration, /GRANT EXECUTE ON FUNCTION public\.preview_delivery_day_plan[\s\S]*TO authenticated/);
  assert.match(customerMigration, /expected_completion_date, customer_note, request_idempotency_key/);
  assert.match(customerMigration, /v_preview := public\.preview_delivery_day_plan/);
  assert.match(quoteMigration, /CREATE TRIGGER meal_plan_quotes_guard_immutable/);
  assert.match(quoteMigration, /PERFORM private\.require_admin_access\(\)/);
  assert.match(quoteMigration, /v_actor UUID := private\.require_customer_access\(\)/);
  assert.match(quoteMigration, /v_delivery_days \* v_unit_price/);
  assert.match(quoteMigration, /status = 'accepted', accepted_at = now\(\)/);
  assert.match(quoteMigration, /SET locked_unit_price = item\.unit_amount/);
  assert.match(quoteMigration, /GRANT EXECUTE ON FUNCTION public\.respond_delivery_day_plan_quote[\s\S]*TO authenticated/);
  assert.match(managementService, /offer_delivery_day_plan_quote/);
  assert.match(management, /Offer revised quote/);
  assert.match(management, /The customer must accept this exact quote first/);
  assert.match(page, /Accept exact quote/);
  assert.match(page, /Acceptance does not charge you/);
  assert.match(dashboard, /DELIVERY_DAY_PLANS_ENABLED \? <DeliveryDayPlanManagement \/> : <SubscriptionManagement \/>/);
  assert.match(app, /DELIVERY_DAY_PLANS_ENABLED \? <DeliveryDayPlansPage \/> : <MealPlansPage \/>/);
  assert.match(flags, /DELIVERY_DAY_PLANS_ENABLED = false/);
  console.log('PASS: delivery-day totals, guarded preview/request mapping, schedule estimate UI and rollout flag');
})().catch(error => { console.error(error); process.exitCode = 1; });
