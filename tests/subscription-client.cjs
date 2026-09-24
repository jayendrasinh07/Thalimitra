const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const migration = readFileSync('supabase/migrations/20260923235154_meal_subscription_requests.sql', 'utf8');
const paymentMigration = readFileSync('supabase/migrations/20260923235803_subscription_payment_reference.sql', 'utf8');
const modal = readFileSync('src/components/modals/SubscribeModal.tsx', 'utf8');
const management = readFileSync('src/components/kitchen/SubscriptionManagement.tsx', 'utf8');
const source = readFileSync('src/services/subscriptionService.ts', 'utf8')
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace(/export /g, '');
const calls = [];
let response = { data: null, error: null };
const api = vm.runInNewContext(
  stripTypeScriptTypes(source) + '\n;({ subscriptionService, SubscriptionError })',
  { Error, Number, Object, Array, getSupabaseClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return response; } }) },
);

const subscription = { id: 'sub', plan_code: 'weekly_7', plan_name: '7-Meal Routine', total_meals: 7, remaining_meals: 7, meal_type: 'lunch', preferred_start_date: '2026-09-25', status: 'requested', payment_status: 'pending', quoted_total: null, customer_note: null, created_at: '2026-09-24T00:00:00Z', updated_at: '2026-09-24T00:00:00Z' };

(async () => {
  response = { data: subscription, error: null };
  await api.subscriptionService.request({ planCode: 'weekly_7', mealType: 'lunch', addressId: 'address', preferredStartDate: '2026-09-25', note: ' weekdays ' });
  assert.equal(JSON.stringify(calls[0]), JSON.stringify({ name: 'request_meal_subscription', args: { p_plan_code: 'weekly_7', p_meal_type: 'lunch', p_address_id: 'address', p_preferred_start_date: '2026-09-25', p_customer_note: 'weekdays' } }));
  response = { data: [subscription], error: null };
  assert.equal((await api.subscriptionService.getMine())[0].remaining_meals, 7);
  response = { data: { subscriptions: [{ ...subscription, customer_name: 'Customer', customer_email: null, customer_phone: null, address: 'Gandhinagar', admin_note: null, payment_reference: null }] }, error: null };
  await api.subscriptionService.manage('sub', 'activate', null, undefined, 'PAYMENT-123');
  assert.equal(calls.at(-1).name, 'manage_meal_subscription');
  assert.equal(calls.at(-1).args.p_payment_reference, 'PAYMENT-123');

  assert.match(migration, /UNIQUE INDEX meal_subscriptions_one_open_per_customer/i);
  assert.match(migration, /p_action = 'activate'[\s\S]*v_previous <> 'payment_pending'/);
  assert.match(migration, /payment_status='paid'/);
  assert.match(migration, /private\.require_admin_access\(\)/);
  assert.match(migration, /REVOKE ALL ON public\.meal_subscriptions FROM PUBLIC, anon, authenticated/);
  assert.match(modal, /No automatic charge/);
  assert.doesNotMatch(modal, /Aarav Patel|98254 99120|Meal Plan Activated/);
  assert.match(management, /Mark paid & activate/);
  assert.match(management, /Use only after payment is visible in the business account/);
  assert.match(paymentMigration, /meal_subscriptions_paid_reference_required/);
  assert.match(paymentMigration, /Add the verified payment reference before activation/);
  console.log('PASS: subscription requests, admin quote/payment gate and safe customer messaging');
})().catch(error => { console.error(error); process.exitCode = 1; });
