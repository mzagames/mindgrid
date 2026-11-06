/* MindGrid ads (Android app only): Google AdMob via @capacitor-community/admob.
 * - Banner: menu screens only (Today, Journey, Archive, Stats). Never on the puzzle screen.
 * - Interstitial: only BETWEEN levels, after a solve, when the player taps Next/Back on the win screen.
 *   Frequency-capped: at most once every `everySolves` solves and `minGapMs` apart.
 * - Consent: Google UMP form for EEA/UK players before ads are requested.
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
  var BANNER_PAGES = ['page-today', 'page-journey', 'page-archive', 'page-stats'];
  var Cap = window.Capacitor;
  var AdMob = Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform() && Cap.Plugins ? Cap.Plugins.AdMob : null;
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
  function setAdHeight(px) { document.documentElement.style.setProperty('--ad-h', Math.max(0, Math.round(px || 0)) + 'px'); }

  function showBanner() {
    init().then(function (ok) {
      if (!ok) return;
      AdMob.addListener('bannerAdSizeChanged', function (s) { setAdHeight(s && s.height); });
      AdMob.showBanner({ adId: CFG.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: CFG.testing })
        .catch(function () { setAdHeight(0); });
    });
  }
  function hideBanner() {
    setAdHeight(0);
    if (AdMob) AdMob.hideBanner().catch(function () { /* none shown */ });
  }

  function dueSoon() { return state.solves + 1 >= CFG.everySolves; }
  function due() { return state.solves >= CFG.everySolves && Date.now() - state.last >= CFG.minGapMs; }
  function prepareInterstitial() {
    if (!AdMob || interstitialLoaded) return;
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
    if (!AdMob || !interstitialLoaded || !due()) { go(); return; }
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
    AdMob.showInterstitial().catch(finish);
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
  }
})();
