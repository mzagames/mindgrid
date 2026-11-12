/* 1.6.0: "Remove ads" (js/billing.js + js/ads.js) and the feedback sender (js/feedback.js).
 * Usage: node tests/monetization.test.js */
'use strict';
var path = require('path'), fs = require('fs'), vm = require('vm');
var root = path.join(__dirname, '..');
var fails = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; console.log('FAIL: ' + msg); } }

function context(native, store) {
  store = store || {};
  var calls = [];
  var listeners = {};
  var ctx = {
    console: console, Date: Date, JSON: JSON, Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout,
    localStorage: { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
    sessionStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: { documentElement: { setAttribute: function () {}, removeAttribute: function () {}, classList: { add: function () {} }, style: { setProperty: function () {} } },
      addEventListener: function () {}, readyState: 'complete', body: { className: 'page-home', classList: { contains: function () { return false; } } }, hidden: false },
    navigator: { onLine: true, userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8)' }, location: { protocol: 'file:' }
  };
  ctx.window = ctx;
  if (native) {
    var plugin = function (name) {
      return new Proxy({}, { get: function (t, method) {
        if (method === 'addListener') return function (ev, fn) { listeners[name + ':' + ev] = fn; return Promise.resolve({ remove: function () {} }); };
        return function (arg) { calls.push(name + '.' + method); return Promise.resolve(native[name + '.' + method] ? native[name + '.' + method](arg) : {}); };
      } });
    };
    ctx.Capacitor = { isNativePlatform: function () { return true; }, Plugins: { AdMob: plugin('AdMob'), MzaBilling: plugin('MzaBilling') } };
  }
  vm.createContext(ctx);
  ['js/core.js', 'js/billing.js', 'js/ads.js', 'js/feedback.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  });
  return { ctx: ctx, MG: ctx.MG, calls: calls, listeners: listeners, store: store };
}
function tick() { return new Promise(function (r) { setTimeout(r, 5); }); }

(async function () {
  // ---- web version: nothing to buy, no ads
  var web = context(null);
  ok(!web.MG.removeAds.supported && !web.MG.removeAds.owned(), 'web: no purchase offered');

  // ---- Android, not owned: Play reports the price; ads stay on
  var a = context({ 'MzaBilling.getState': function () { return { owned: false, price: '$3.99', available: true }; } });
  await tick();
  ok(a.MG.removeAds.supported && a.MG.removeAds.price() === '$3.99' && !a.MG.removeAds.owned(), 'android: price from Google Play');
  ok(a.calls.indexOf('MzaBilling.getState') >= 0, 'owned purchases are asked on start');
  // purchase completes: Play sends "changed"
  var changes = [];
  a.MG.removeAds.onChange(function (st, changed) { changes.push(changed); });
  a.listeners['MzaBilling:changed']({ owned: true, price: '$3.99', available: true });
  ok(a.MG.removeAds.owned() && a.store['mindgrid.noads'] === '1', 'bought: remembered on the device');
  ok(changes[0] === true, 'listeners hear the ownership change');
  ok(a.calls.indexOf('AdMob.removeBanner') >= 0, 'bought: the banner is removed at once');
  var went = false, shown = a.calls.length;
  for (var i = 0; i < 10; i++) a.MG.adsSolved();
  a.MG.adsBetweenLevels(function () { went = true; });
  ok(went, 'bought: straight to the next level');
  ok(a.calls.slice(shown).every(function (c) { return c !== 'AdMob.showInterstitial' && c !== 'AdMob.prepareInterstitial'; }), 'bought: no interstitial is loaded or shown');

  // ---- next launch offline: cached answer applies before Google Play answers
  var b = context({ 'MzaBilling.getState': function () { return new Promise(function () {}); } }, { 'mindgrid.noads': '1' });
  ok(b.MG.removeAds.owned(), 'offline launch stays ad-free');
  // refund: Play says not owned
  b.listeners['MzaBilling:changed']({ owned: false, price: '$3.99', available: true });
  ok(!b.MG.removeAds.owned() && b.store['mindgrid.noads'] === '0', 'refund turns ads back on');
  // restore button
  var c = context({ 'MzaBilling.getState': function () { return { owned: false }; }, 'MzaBilling.restore': function () { return { owned: true }; } });
  await c.MG.removeAds.restore();
  ok(c.MG.removeAds.owned(), 'Restore purchase brings it back');

  // ---- feedback
  var FB = web.MG.FEEDBACK;
  ok(FB.emailOk('') && FB.emailOk('fan@mail.co') && !FB.emailOk('a@b') && !FB.emailOk('two words@x.com'), 'e-mail check');
  var body = JSON.parse(FB.body('Idea', '  More pipes  ', '', 'Web'));
  ok(body.key === 'mza-feedback-v1' && body.app === 'MindGrid' && body.version === web.MG.VERSION && body.message === 'More pipes' && body.website === '', 'body fields');
  ok(JSON.parse(FB.body('Nope', 'x', '', '')).category === 'Other', 'unknown category becomes Other');
  ok(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(FB.url), 'the deployed relay URL is set');
  var deployed = FB.url; FB.url = '';
  ok(await FB.send('{}', function () { return Promise.resolve(); }) === 'not_configured', 'no relay URL = not configured');
  FB.url = deployed;
  var sentBody = null, sentOpts = null;
  var good = function (url, opts) { sentBody = opts.body; sentOpts = opts; return Promise.resolve({ ok: true, text: function () { return Promise.resolve('{"ok":true}'); } }); };
  ok(await FB.send('{"a":1}', good) === 'sent' && sentBody === '{"a":1}', 'relay {ok:true} = sent');
  ok(sentOpts.method === 'POST' && sentOpts.headers['Content-Type'].indexOf('text/plain') === 0, 'POST as text/plain (no CORS preflight)');
  ok(await FB.send('{}', function () { return Promise.resolve({ ok: true, text: function () { return Promise.resolve('<html>error</html>'); } }); }) === 'failed', 'HTML error page = failed');
  ok(await FB.send('{}', function () { return Promise.resolve({ ok: true, text: function () { return Promise.resolve('{"ok":false,"error":"busy"}'); } }); }) === 'failed', 'relay refusal = failed');
  ok(await FB.send('{}', function () { return Promise.reject(new TypeError('Failed to fetch')); }) === 'offline', 'network error = offline');
  web.ctx.navigator.onLine = false;
  ok(await FB.send('{}', good) === 'offline', 'navigator offline = offline without trying');
  ok(/Android 15/.test(FB.device()), 'device line has the Android version only');

  console.log((fails ? 'FAILED ' : 'PASSED ') + (checks - fails) + '/' + checks + ' monetization checks');
  process.exit(fails ? 1 : 0);
})();
