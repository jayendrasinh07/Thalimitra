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
const paymentMigration = readFileSync('supabase/migrations/20260926062000_delivery_day_plan_payment_gate.sql', 'utf8');
const occurrenceMigration = readFileSync('supabase/migrations/20260926064000_delivery_day_plan_occurrences.sql', 'utf8');
const occurrenceSmoke = readFileSync('supabase/migrations/20260926065000_delivery_day_plan_occurrence_smoke.sql', 'utf8');
const planOrderMigration = readFileSync('supabase/migrations/20260926066000_delivery_day_plan_order_materialization.sql', 'utf8');
const planOrderSmoke = readFileSync('supabase/migrations/20260926067000_delivery_day_plan_order_smoke.sql', 'utf8');
const ledgerMigration = readFileSync('supabase/migrations/20260926068000_delivery_day_plan_ledger.sql', 'utf8');
const exceptionMigration = readFileSync('supabase/migrations/20260926080020_delivery_day_plan_exception_workflows.sql', 'utf8');
const exceptionSmoke = readFileSync('supabase/migrations/20260926080303_delivery_day_plan_exception_smoke.sql', 'utf8');
const advisorCleanup = readFileSync('supabase/migrations/20260926080710_delivery_day_plan_advisor_cleanup.sql', 'utf8');
const rlsInitPlanFix = readFileSync('supabase/migrations/20260926080811_delivery_day_plan_rls_initplan_fix.sql', 'utf8');
const phase5Migration = readFileSync('supabase/migrations/20260926082808_delivery_day_plan_phase5_lifecycle.sql', 'utf8');
const phase5Smoke = readFileSync('supabase/migrations/20260926083519_delivery_day_plan_phase5_smoke.sql', 'utf8');
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
  assert.match(managementService, /verify_and_activate_delivery_day_plan/);
  assert.match(management, /Offer revised quote/);
  assert.match(management, /The customer must accept this exact quote first/);
  assert.match(management, /Verify payment & activate/);
  assert.match(paymentMigration, /CREATE UNIQUE INDEX meal_plan_payments_reference_unique/);
  assert.match(paymentMigration, /CREATE TRIGGER meal_plan_subscriptions_activation_gate/);
  assert.match(paymentMigration, /v_subscription\.status <> 'accepted'/);
  assert.match(paymentMigration, /payment\.amount = q\.total_amount/);
  assert.match(paymentMigration, /payment_verified_and_activated/);
  assert.doesNotMatch(paymentMigration, /'payment_reference',\s*payment\.payment_reference/);
  assert.match(occurrenceMigration, /CREATE TABLE public\.meal_plan_service_blackouts/);
  assert.match(occurrenceMigration, /CREATE TABLE public\.meal_plan_pause_days/);
  assert.match(occurrenceMigration, /CREATE OR REPLACE FUNCTION private\.generate_meal_plan_occurrences/);
  assert.match(occurrenceMigration, /ON CONFLICT \(subscription_id, service_date, meal_type\) DO NOTHING/);
  assert.match(occurrenceMigration, /v_generated := private\.generate_meal_plan_occurrences\(p_subscription_id\)/);
  assert.match(occurrenceMigration, /v_subscription\.status <> 'active'/);
  assert.match(occurrenceSmoke, /v_count <> 14/);
  assert.match(occurrenceSmoke, /private\.generate_meal_plan_occurrences\(v_subscription\) <> 0/);
  assert.match(planOrderMigration, /CREATE TRIGGER enforce_subscription_order_occurrence/);
  assert.match(planOrderMigration, /pg_advisory_xact_lock/);
  assert.match(planOrderMigration, /orders\.subscription_occurrence_id = v_occurrence\.occurrence_id/);
  assert.match(planOrderMigration, /v_booked < v_candidate_slot\.max_orders/);
  assert.match(planOrderMigration, /CREATE TRIGGER materialize_plan_orders_after_menu_publish/);
  assert.match(planOrderMigration, /CREATE TRIGGER materialize_plan_order_after_occurrence/);
  assert.match(planOrderMigration, /private\.require_kitchen_access\(\)/);
  assert.match(planOrderSmoke, /v_count <> 1/);
  assert.match(planOrderSmoke, /missing from the Kitchen queue/);
  assert.match(ledgerMigration, /CREATE TRIGGER meal_plan_ledger_balance_guard/);
  assert.match(ledgerMigration, /CREATE OR REPLACE FUNCTION private\.append_meal_plan_ledger/);
  assert.match(ledgerMigration, /v_ledger_services := private\.initialize_meal_plan_ledger/);
  assert.match(ledgerMigration, /CREATE TRIGGER meal_plan_occurrence_ledger/);
  assert.match(ledgerMigration, /CREATE TRIGGER meal_plan_order_resolution/);
  assert.match(exceptionMigration, /CREATE TABLE private\.meal_plan_commands/);
  assert.match(exceptionMigration, /CREATE OR REPLACE FUNCTION public\.skip_delivery_day_plan/);
  assert.match(exceptionMigration, /CREATE OR REPLACE FUNCTION public\.pause_delivery_day_plan/);
  assert.match(exceptionMigration, /CREATE OR REPLACE FUNCTION public\.resume_delivery_day_plan/);
  assert.match(exceptionMigration, /CREATE OR REPLACE FUNCTION public\.cancel_delivery_day_plan_occurrence/);
  assert.match(exceptionMigration, /private\.assert_meal_plan_change_cutoff/);
  assert.match(exceptionMigration, /private\.append_replacement_meal_plan_occurrence/);
  assert.match(exceptionMigration, /private\.require_customer_access\(\)/);
  assert.match(exceptionMigration, /private\.require_kitchen_access\(\)/);
  assert.match(exceptionSmoke, /Full-day skip did not move both services/);
  assert.match(exceptionSmoke, /Service-only skip moved the wrong number/);
  assert.match(exceptionSmoke, /Ledger entries do not reconcile/);
  assert.match(advisorCleanup, /CREATE INDEX meal_plan_commands_actor_idx/);
  assert.match(advisorCleanup, /SELECT coalesce\(auth\.jwt\(\)->>'aal'/);
  assert.match(rlsInitPlanFix, /coalesce\(\(SELECT auth\.jwt\(\)\)->>'aal'/);
  assert.match(phase5Migration, /CREATE TABLE public\.meal_plan_commercial_policy/);
  assert.match(phase5Migration, /CREATE TABLE private\.meal_plan_financial_decisions/);
  assert.match(phase5Migration, /CREATE OR REPLACE FUNCTION public\.record_delivery_day_plan_decision/);
  assert.match(phase5Migration, /CREATE OR REPLACE FUNCTION public\.get_kitchen_delivery_day_plan_production/);
  assert.match(phase5Migration, /Customer and payment details stay hidden|excludes customer identity/);
  assert.match(phase5Migration, /private\.complete_delivery_day_plan_if_ready/);
  assert.doesNotMatch(phase5Migration, /'payment_reference'/);
  assert.match(phase5Smoke, /Customer unexpectedly opened plan management/);
  assert.match(phase5Smoke, /Customer lifecycle document is unsafe or incomplete/);
  assert.match(page, /Upcoming deliveries/);
  assert.match(page, /Pause next 7 days/);
  assert.match(managementService, /record_delivery_day_plan_decision/);
  assert.match(management, /Pilot commercial policy/);
  assert.match(management, /Cancellation & refund decision/);
  assert.match(page, /Accept exact quote/);
  assert.match(page, /Acceptance does not charge you/);
  assert.match(dashboard, /DELIVERY_DAY_PLANS_ENABLED \? <DeliveryDayPlanManagement \/> : <SubscriptionManagement \/>/);
  assert.match(app, /DELIVERY_DAY_PLANS_ENABLED \? <DeliveryDayPlansPage \/> : <MealPlansPage \/>/);
  assert.match(flags, /DELIVERY_DAY_PLANS_ENABLED = false/);
  console.log('PASS: delivery-day totals, guarded preview/request mapping, schedule estimate UI and rollout flag');
})().catch(error => { console.error(error); process.exitCode = 1; });
