const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('src/services/areaBoundarySearch.ts', 'utf8').replace(/export /g, '');
const { parseDeliveryAreaPrediction } = vm.runInNewContext(
  stripTypeScriptTypes(source) + '\n;({ parseDeliveryAreaPrediction })',
  { Map, Date, Promise, Number, Math, Array, Boolean, setTimeout, clearTimeout, AbortController, URLSearchParams },
);

const mapped = parseDeliveryAreaPrediction({
  place_id: 21, name: 'Sector 21', display_name: 'Sector 21, Gandhinagar, Gujarat, India', lat: '23.23', lon: '72.66',
  boundingbox: ['23.22', '23.24', '72.65', '72.67'],
  geojson: { type: 'Polygon', coordinates: [[[72.65, 23.22], [72.67, 23.22], [72.67, 23.24], [72.65, 23.24], [72.65, 23.22]]] },
});
assert.equal(mapped.outlineKind, 'mapped');
assert.equal(mapped.outline.length, 4);

const approximate = parseDeliveryAreaPrediction({
  place_id: 22, name: 'Kudasan', display_name: 'Kudasan, Gandhinagar, Gujarat, India', lat: '23.19', lon: '72.63',
  boundingbox: ['23.18', '23.20', '72.62', '72.64'], geojson: { type: 'Point', coordinates: [72.63, 23.19] },
});
assert.equal(approximate.outlineKind, 'approximate');
assert.deepEqual(Array.from(approximate.outline[0]), [72.62, 23.18]);
assert.equal(parseDeliveryAreaPrediction({ display_name: 'Broken' }), null);
console.log('PASS: mapped area outlines and safe approximate bounding boxes');
