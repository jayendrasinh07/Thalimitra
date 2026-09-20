const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const publicSource = readFileSync('src/services/publicDeliveryAreaService.ts', 'utf8');
const mapsSource = readFileSync('src/services/googleMapsLoader.ts', 'utf8');
assert.doesNotMatch(publicSource, /list_public_delivery_areas/);
assert.match(publicSource, /join_area_waitlist/);
assert.match(publicSource, /p_formatted_address/);
const selectorSource = readFileSync('src/components/location/GoogleMapDeliverySelector.tsx', 'utf8');
const locationServiceSource = readFileSync('src/services/locationService.ts', 'utf8');
const appContextSource = readFileSync('src/context/AppContext.tsx', 'utf8');
assert.match(selectorSource, /Not here yet — but your area could be next/);
assert.match(selectorSource, /!serverAvailability\?\.areaId/);
assert.match(selectorSource, /!waitlistRegistrationEnabled/);
assert.doesNotMatch(selectorSource, /listPublicDeliveryAreas|comingSoonAreas|availableAreas/);
assert.match(selectorSource, /<details className="group rounded-2xl/);
assert.match(selectorSource, /View meal availability/);
assert.doesNotMatch(selectorSource, /â|Ã|Â|�/);
assert.match(locationServiceSource, /database boundary is authoritative\. Fail closed/);
assert.doesNotMatch(appContextSource, /evaluateLocationServiceability/);
const coverageSource = readFileSync('src/pages/GandhinagarCoveragePage.tsx', 'utf8');
assert.doesNotMatch(coverageSource, /listPublicDeliveryAreas|Available now|Coming soon/);
assert.match(coverageSource, /Search your address and get the latest delivery status/);
assert.match(coverageSource, /Check my area/);
assert.doesNotMatch(coverageSource, /GANDHINAGAR_AREAS/);
assert.match(readFileSync('src/components/kitchen/AreaWaitlistManagement.tsx', 'utf8'), /Notify-me requests/);
assert.match(mapsSource, /q: `\$\{query\}, Gujarat, India`/);
assert.doesNotMatch(mapsSource, /query \+ ' Gandhinagar Gujarat'/);

const adminSource = readFileSync('src/services/areaWaitlistAdminService.ts', 'utf8')
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace(/export /g, '');
const api = vm.runInNewContext(
  stripTypeScriptTypes(adminSource) + '\n;({ parseAdminWaitlist })',
  { Error, Number, Date, getSupabaseClient: () => ({}) },
);
const parsed = api.parseAdminWaitlist({ generated_at: '2026-09-20T06:00:00Z', total: 1, entries: [{
  id: '11111111-1111-1111-1111-111111111111', name: 'Customer', contact: '9000000011',
  area: 'Sector 4', city: 'Gandhinagar', pincode: '382004',
  formatted_address: 'Block A, Sector 4, Gandhinagar', latitude: '23.22', longitude: '72.65',
  source: 'map', created_at: '2026-09-20T05:59:00Z',
}] });
assert.equal(parsed.total, 1);
assert.equal(parsed.entries[0].latitude, 23.22);
assert.equal(parsed.entries[0].formattedAddress, 'Block A, Sector 4, Gandhinagar');
assert.throws(() => api.parseAdminWaitlist({ entries: [{ id: 'bad' }] }), /Invalid waitlist entry/);
console.log('PASS: private exact-area discovery, compact meal details, cloud waitlist and admin parsing');
