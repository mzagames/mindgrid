/* MindGrid "Remove ads" (Android app only): a one-time Google Play purchase through the app's own
 * MzaBilling Capacitor plugin (android-app/native/MzaBillingPlugin.java).
 * The last known answer is cached so an offline launch stays ad-free; Google Play is asked again on
 * every start, so a reinstall restores the purchase and a refund turns ads back on.
 * In a normal browser (the web version) there are no ads and nothing to buy. Load before ads.js. */
(function () {
  'use strict';
  var MG = window.MG;
  var Cap = window.Capacitor;
  var Billing = Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform() && Cap.Plugins ? Cap.Plugins.MzaBilling : null;
  var KEY = 'mindgrid.noads';
  var listeners = [];
  var st = { owned: false, price: '', available: false, busy: false };
  try { st.owned = localStorage.getItem(KEY) === '1'; } catch (e) { /* ignore */ }

  function apply(next) {
    if (!next) return;
    var was = st.owned;
    st.owned = !!next.owned;
    st.price = next.price || '';
    st.available = !!next.available;
    st.busy = !!next.busy;
    try { localStorage.setItem(KEY, st.owned ? '1' : '0'); } catch (e) { /* ignore */ }
    listeners.forEach(function (fn) { try { fn(st, was !== st.owned); } catch (e) { /* ignore */ } });
    if (next.message && MG.toast) MG.toast(next.message);
  }

  MG.removeAds = {
    /** True on Android when Google Play billing is present (the web version sells nothing). */
    supported: !!Billing,
    owned: function () { return st.owned; },
    price: function () { return st.price; },
    available: function () { return st.available; },
    busy: function () { return st.busy; },
    /** fn(state, ownershipChanged) runs on every update from Google Play. */
    onChange: function (fn) { listeners.push(fn); },
    buy: function () { return Billing ? Billing.buy().then(apply, function () { MG.toast && MG.toast('The purchase couldn\'t start. Please try again.'); }) : Promise.resolve(); },
    restore: function () { return Billing ? Billing.restore().then(apply, function () {}) : Promise.resolve(); },
    _apply: apply // tests
  };

  if (Billing) {
    if (Billing.addListener) Billing.addListener('changed', apply);
    Billing.getState().then(apply, function () { /* no Google Play: keep the cached answer */ });
  }
})();
