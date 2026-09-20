const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const operationsHeaders = readFileSync('ops/public/_headers', 'utf8');
const customerHeaders = readFileSync('public/_headers', 'utf8');
assert.match(customerHeaders, /script-src[^\n]*https:\/\/static\.cloudflareinsights\.com/);
assert.match(operationsHeaders, /script-src[^\n]*https:\/\/static\.cloudflareinsights\.com/);
assert.match(operationsHeaders, /connect-src[^\n]*https:\/\/basemaps\.cartocdn\.com/);
assert.match(operationsHeaders, /connect-src[^\n]*https:\/\/nominatim\.openstreetmap\.org/);
assert.match(operationsHeaders, /img-src[^\n]*https:\/\/basemaps\.cartocdn\.com/);

const managementSource = readFileSync('src/components/kitchen/DeliveryAreaManagement.tsx', 'utf8');
assert.match(managementSource, /createLeafletMap/);
assert.match(managementSource, /https:\/\/basemaps\.cartocdn\.com\/light_all/);
assert.match(managementSource, /leafletPolygon/);
assert.match(managementSource, /draggable: true/);
assert.match(managementSource, /insertBoundaryPoint/);
assert.match(managementSource, /Remove point/);
assert.doesNotMatch(managementSource, /MapLibreMap/);
assert.match(managementSource, /Use as editable draft/);
assert.match(managementSource, /searchDeliveryAreaBoundaries/);
assert.match(managementSource, /referenceLayerRef/);
assert.match(managementSource, /Click any saved boundary to edit it/);
assert.match(managementSource, /Coming soon/);
assert.match(managementSource, /Paused/);

const source = readFileSync('src/services/deliveryAreaService.ts', 'utf8')
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace(/export /g, '');
const calls = [];
let response = { data: null, error: null };
const api = vm.runInNewContext(
  stripTypeScriptTypes(source) + '\n;({ deliveryAreaService, parseDeliveryAreaDocument, DeliveryAreaError })',
  { Error, Number, getSupabaseClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return response; } }) },
);

const document = { generated_at: '2026-09-19T10:00:00Z', areas: [{
  id: 'area_1', name: 'Sector 21', status: 'available', boundary: null,
  breakfast_enabled: false, lunch_enabled: true, dinner_enabled: true,
  waitlist_enabled: true, delivery_fee: '10', min_order_amount: '99',
  estimated_duration_minutes: '30', priority: '500', version: '2',
  published_at: null, updated_at: '2026-09-19T10:00:00Z',
}] };

(async () => {
  const parsed = api.parseDeliveryAreaDocument(document);
  assert.equal(parsed.areas[0].delivery_fee, 10);
  assert.equal(parsed.areas[0].priority, 500);
  assert.throws(() => api.parseDeliveryAreaDocument({ ...document, areas: [{ ...document.areas[0], status: 'public' }] }));
  response = { data: document, error: null };
  await api.deliveryAreaService.get();
  await api.deliveryAreaService.save({
    id: 'area_1', name: 'Sector 21', status: 'available', boundary: null,
    breakfastEnabled: false, lunchEnabled: true, dinnerEnabled: true,
    waitlistEnabled: true, deliveryFee: 10, minOrderAmount: 99,
    estimatedDurationMinutes: 30, priority: 500,
  });
  assert.equal(calls[0].name, 'get_delivery_areas');
  assert.equal(calls[1].name, 'save_delivery_area');
  assert.equal(calls[1].args.p_lunch_enabled, true);
  assert.equal(calls[1].args.p_boundary, null);
  assert.throws(() => api.deliveryAreaService.save({ name: '', deliveryFee: 0, minOrderAmount: 0, estimatedDurationMinutes: 30, priority: 1 }), /Check/);
  response = { data: null, error: { code: '42501', message: '' } };
  await assert.rejects(api.deliveryAreaService.get(), /Admin access/);
  console.log('PASS: delivery area parsing, admin RPC contracts and validation');
})().catch(error => { console.error(error); process.exitCode = 1; });
