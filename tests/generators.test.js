/* Node runner for the generator spec. Usage: node tests/generators.test.js [seeds] */
'use strict';
var path = require('path'), fs = require('fs'), vm = require('vm');
var store = {};
var ctx = {
  console: console, Date: Date,
  localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = v; } },
  document: { documentElement: { setAttribute: function () {}, removeAttribute: function () {} }, addEventListener: function () {}, readyState: 'complete' },
  navigator: {}, location: { protocol: 'file:' }
};
ctx.window = ctx;
vm.createContext(ctx);
var root = path.join(__dirname, '..');
['js/core.js', 'js/puzzles/blocks.js', 'js/puzzles/pipes.js', 'js/puzzles/link.js', 'js/puzzles/crowns.js',
  'js/puzzles/lights.js', 'js/puzzles/balance.js', 'tests/spec.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});
var fails = ctx.runSpec(ctx.MG, +(process.argv[2] || 40), function (m) { console.log(m); });
process.exit(fails ? 1 : 0);
