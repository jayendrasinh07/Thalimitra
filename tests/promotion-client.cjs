const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const promotionIdFix = readFileSync('supabase/migrations/20260923162319_fix_promotion_campaign_ambiguous_id.sql', 'utf8');

const source = readFileSync('src/services/promotionService.ts', 'utf8')
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace(/export /g, '');
const calls = [];
let response = { data: null, error: null };
const api = vm.runInNewContext(
  stripTypeScriptTypes(source) + '\n;({ promotionService, parsePromotionQuote, parsePromotionManagement, PromotionError })',
  { Error, Number, Object, Date, getSupabaseClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return response; } }) },
);

const offer = { id: 'offer', code: 'WELCOME40', name: 'Welcome', description: 'Save ₹40', discount_amount: '40', minimum_subtotal: '249', ends_at: '2027-01-01T00:00:00Z' };
const quote = { meals_subtotal: '250', addons_total: '0', delivery_fee: '15', discount: '40', grand_total: '225', applied_offer: offer, available_offers: [offer] };
const campaign = { id: 'offer', code: 'WELCOME40', name: 'Welcome', description: '', discount_type: 'fixed', discount_value: '40', minimum_subtotal: '249', maximum_discount: '40', total_budget: '4000', starts_at: '2026-01-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z', service_date_start: null, service_date_end: null, is_active: false, first_order_only: true, per_user_limit: '1', eligible_meal_types: ['breakfast','lunch','dinner'], eligible_meal_ids: [], eligible_zone_ids: [], redemption_count: '0', spent: '0' };
const management = { campaigns: [campaign], meals: [], areas: [] };

(async () => {
  const parsedQuote = api.parsePromotionQuote(quote);
  assert.equal(parsedQuote.discount, 40);
  assert.equal(parsedQuote.grandTotal, 225);
  assert.equal(parsedQuote.appliedOffer.code, 'WELCOME40');
  assert.throws(() => api.parsePromotionQuote({ available_offers: 'invalid' }));
  const parsedManagement = api.parsePromotionManagement(management);
  assert.equal(parsedManagement.campaigns[0].total_budget, 4000);
  assert.equal(parsedManagement.campaigns[0].redemption_count, 0);

  response = { data: quote, error: null };
  await api.promotionService.quote({ orderDate: '2026-09-22', mealType: 'lunch', addressId: 'address', mealId: 'meal', quantity: 2, selectedAddons: { b: 0, a: 1 }, code: ' welcome40 ' });
  assert.equal(JSON.stringify(calls[0]), JSON.stringify({ name: 'get_order_promotion_quote', args: { p_order_date: '2026-09-22', p_meal_type: 'lunch', p_address_id: 'address', p_meal_id: 'meal', p_quantity: 2, p_customizations: [{ customization_id: 'a', quantity: 1 }], p_promotion_code: 'welcome40' } }));

  response = { data: management, error: null };
  await api.promotionService.getManagement();
  await api.promotionService.setActive('offer', true);
  await api.promotionService.deleteUnused('offer');
  assert.equal(calls[1].name, 'get_promotion_management');
  assert.equal(JSON.stringify(calls[2]), JSON.stringify({ name: 'set_promotion_campaign_active', args: { p_id: 'offer', p_is_active: true } }));
  assert.equal(JSON.stringify(calls[3]), JSON.stringify({ name: 'delete_unused_promotion_campaign', args: { p_id: 'offer' } }));

  response = { data: null, error: { code: '23505', message: '' } };
  await assert.rejects(api.promotionService.getManagement(), /already exists/);
  assert.doesNotMatch(promotionIdFix, /\)\s+id\s+LEFT JOIN/i);
  assert.match(promotionIdFix, /AS candidate\(candidate_id\)/);
  assert.match(promotionIdFix, /UPDATE private\.promotion_campaigns AS campaign/);
  assert.match(promotionIdFix, /WHERE campaign\.id = p_id/);
  console.log('PASS: promotion quotes, numeric normalization and admin RPC contracts');
})().catch(error => { console.error(error); process.exitCode = 1; });
