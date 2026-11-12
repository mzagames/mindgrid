/* MindGrid ads (Android app only): Google AdMob via @capacitor-community/admob.
 * - Banner: menu screens only (Home, Daily, Journey, Archive, IQ/Stats). Never on the puzzle screen.
 * - Interstitial: only BETWEEN levels, after a solve, when the player taps Next/Back on the win screen.
 *   Frequency-capped: at most once every `everySolves` solves and `minGapMs` apart.
 * - Consent: Google UMP form for EEA/UK players before ads are requested.
 * - Remove ads (1.6.0, js/billing.js): once owned, no banner, no interstitial and no ad break at all.
 * In a normal browser (the web version) there is no Capacitor bridge, so this file does nothing. */
(function () {
  'use strict';
  var MG = window.MG;
  var CFG = MG.ADS = {
    appId: 'ca-app-pub-8128005061512507~3594605896',
    interstitial: 'ca-app-pub-8128005061512507/6467201302',
    banner: 'ca-app-pub-8128005061512507/3841037968',
    everySolves: 3,
    minGapMs: 90 * 1000,
    testing: false // true = Google test ads (use while developing; never click your own live ads)
  };
  var BANNER_PAGES = ['page-home', 'page-daily', 'page-journey', 'page-archive', 'page-stats'];
  var Cap = window.Capacitor;
  var AdMob = Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform() && Cap.Plugins ? Cap.Plugins.AdMob : null;
  function adFree() { return !!(MG.removeAds && MG.removeAds.owned()); }
  MG.adsAvailable = !!AdMob;

  var KEY = 'mindgrid.ads';
  var state = { solves: 0, last: 0 };
  try { state = Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  var ready = null, canRequest = true, interstitialLoaded = false;
  function init() {
    if (!AdMob) return Promise.resolve(false);
    if (ready) return ready;
    ready = AdMob.initialize({})
      .then(function () { return AdMob.requestConsentInfo(); })
      .then(function (info) {
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') {
          return AdMob.showConsentForm().then(function (after) { return after || info; });
        }
        return info;
      })
      .then(function (info) { canRequest = !info || info.canRequestAds !== false; return canRequest; })
      .catch(function () { return true; });
    return ready;
  }
  /* ---------- Banner ----------
   * Why it used to vanish: a failed load (no fill, which is common while AdMob limits a new app, or a network blip)
   * was never retried, and every page re-created the banner from scratch. Now:
   *  - one banner per app session: the puzzle screen only HIDES it, menu screens RESUME it (no reload, no gap);
   *  - a failed load retries with backoff (15s, 30s, 60s ... up to 3 min) while a menu screen is open;
   *  - when the app comes back to the foreground, the banner is checked and restored;
   *  - the last known height is remembered so the tab bar never jumps or covers the ad. */
  var SKEY = 'mindgrid.banner';
  var bs = { state: 'none', h: 0 }; // none | shown | hidden
  try { bs = Object.assign(bs, JSON.parse(sessionStorage.getItem(SKEY) || '{}')); } catch (e) { /* ignore */ }
  function saveBs() { try { sessionStorage.setItem(SKEY, JSON.stringify(bs)); } catch (e) { /* ignore */ } }
  function setAdHeight(px) { document.documentElement.style.setProperty('--ad-h', Math.max(0, Math.round(px || 0)) + 'px'); }

  var wantBanner = false, retryTimer = null, retryDelay = 15000, listening = false, busy = false;
  function listen() {
    if (listening) return;
    listening = true;
    AdMob.addListener('bannerAdSizeChanged', function (s) {
      if (s && s.height) { bs.h = s.height; saveBs(); }
      if (wantBanner) setAdHeight(s && s.height);
    });
    AdMob.addListener('bannerAdLoaded', function () {
      bs.state = 'shown'; saveBs(); retryDelay = 15000;
      if (wantBanner) setAdHeight(bs.h); else AdMob.hideBanner().catch(function () {});
    });
    AdMob.addListener('bannerAdFailedToLoad', function () { failed(); });
  }
  function failed() {
    bs.state = 'none'; saveBs(); setAdHeight(0);
    AdMob.removeBanner().catch(function () {});
    scheduleRetry();
  }
  function scheduleRetry() {
    clearTimeout(retryTimer);
    if (!wantBanner) return;
    retryTimer = setTimeout(function () { if (wantBanner && !document.hidden) loadBanner(); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 180000);
  }
  function loadBanner() {
    if (busy) return;
    busy = true;
    AdMob.showBanner({ adId: CFG.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: CFG.testing })
      .then(function () { busy = false; bs.state = 'shown'; saveBs(); if (bs.h) setAdHeight(bs.h); })
      .catch(function () { busy = false; failed(); });
  }
  function showBanner() {
    if (adFree()) { hideBanner(); return; }
    wantBanner = true;
    if (bs.state !== 'none' && bs.h) setAdHeight(bs.h); // keep layout stable while it comes back
    init().then(function (ok) {
      if (!ok || !wantBanner) return;
      listen();
      if (bs.state === 'hidden' || bs.state === 'shown') {
        // already loaded in this app session: just make it visible again
        AdMob.resumeBanner().then(function () { bs.state = 'shown'; saveBs(); setAdHeight(bs.h); }, function () { bs.state = 'none'; loadBanner(); });
      } else loadBanner();
    });
  }
  function hideBanner() {
    wantBanner = false; clearTimeout(retryTimer); setAdHeight(0);
    if (!AdMob) return;
    if (bs.state === 'shown') { bs.state = 'hidden'; saveBs(); }
    AdMob.hideBanner().catch(function () { /* none shown */ });
  }
  // back from the background / the lock screen: make sure the banner is still there
  document.addEventListener('visibilitychange', function () {
    if (!AdMob || document.hidden || !wantBanner) return;
    if (bs.state === 'none') { retryDelay = 15000; loadBanner(); }
    else AdMob.resumeBanner().catch(function () { bs.state = 'none'; loadBanner(); });
  });

  function dueSoon() { return state.solves + 1 >= CFG.everySolves; }
  function due() { return state.solves >= CFG.everySolves && Date.now() - state.last >= CFG.minGapMs; }
  function prepareInterstitial() {
    if (!AdMob || interstitialLoaded || adFree()) return;
    init().then(function (ok) {
      if (!ok) return;
      AdMob.prepareInterstitial({ adId: CFG.interstitial, isTesting: CFG.testing })
        .then(function () { interstitialLoaded = true; })
        .catch(function () { interstitialLoaded = false; });
    });
  }

  /** Call once when a puzzle is solved. */
  MG.adsSolved = function () {
    state.solves++; save();
    if (dueSoon()) prepareInterstitial();
  };

  /** Between levels: maybe show an interstitial, then run `go` (navigation) when it closes. */
  MG.adsBetweenLevels = function (go) {
    if (!AdMob || adFree() || !interstitialLoaded || !due()) { go(); return; }
    var finished = false;
    var handles = [];
    function finish() {
      if (finished) return;
      finished = true;
      handles.forEach(function (h) { Promise.resolve(h).then(function (x) { if (x && x.remove) x.remove(); }); });
      go();
    }
    handles.push(AdMob.addListener('interstitialAdDismissed', finish));
    handles.push(AdMob.addListener('interstitialAdFailedToShow', finish));
    state.solves = 0; state.last = Date.now(); save();
    interstitialLoaded = false;
    // a short branded "ad break" card first, so the ad never appears out of nowhere
    var card = MG.adBreakCard ? MG.adBreakCard() : null;
    setTimeout(function () {
      AdMob.showInterstitial().catch(finish);
      if (card) setTimeout(function () { card.remove(); }, 1500);
    }, card ? 1100 : 0);
  };

  /** Re-open Google's privacy choices (required by UMP for EEA/UK users). */
  MG.adsPrivacyOptions = function () {
    if (!AdMob) return Promise.resolve(false);
    return init().then(function () {
      return (AdMob.showPrivacyOptionsForm ? AdMob.showPrivacyOptionsForm() : AdMob.showConsentForm());
    }).then(function () { return true; }).catch(function () { return false; });
  };

  if (AdMob) {
    document.documentElement.classList.add('native-app');
    var onPage = function () {
      var cls = document.body.className;
      if (BANNER_PAGES.some(function (c) { return cls.indexOf(c) >= 0; })) showBanner(); else hideBanner();
      if (/page-play/.test(cls) && dueSoon()) prepareInterstitial();
    };
    if (document.body) onPage(); else document.addEventListener('DOMContentLoaded', onPage);
    // Bought or restored: the banner goes at once. A refund brings ads back on the next menu screen.
    if (MG.removeAds) MG.removeAds.onChange(function (st, changed) {
      if (!changed) return;
      if (st.owned) { hideBanner(); interstitialLoaded = false; AdMob.removeBanner().catch(function () {}); bs.state = 'none'; saveBs(); }
      else if (document.body) onPage();
    });
  }
})();
