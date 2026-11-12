/* Settings page. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app');
  let installEvt = null;

  function sw(id, label, sub) {
    const on = !!MG.settings()[id];
    return `<div class="row"><div class="lbl">${label}<small>${sub}</small></div>
      <label class="switch"><input type="checkbox" data-k="${id}" ${on ? 'checked' : ''} aria-label="${label}"><span></span></label></div>`;
  }
  /** 1.6.0: the one-time "Remove ads" purchase (Android app only). */
  function removeAdsGroup() {
    const R = MG.removeAds, owned = R.owned(), price = R.price();
    return `<h2>Ad-free</h2>
      <div class="group">
        <div class="row"><div class="lbl">${owned ? 'Ads removed ✓' : 'Remove ads'}<small>${owned
          ? 'Thank you! No banner and no ad breaks, for good.'
          : 'One payment, no subscription. No banner and no ad breaks between levels.'}</small></div>
          ${owned ? '' : `<button type="button" class="chip gold" id="buyNoAds" ${R.busy() ? 'disabled' : ''}>${R.busy() ? 'Waiting…' : price ? price : 'Buy'}</button>`}</div>
        <div class="row"><div class="lbl">Restore purchase<small>Bought it before? It's linked to your Google account</small></div><button type="button" class="chip" id="restoreNoAds">Restore</button></div>
      </div>`;
  }
  function render() {
    const theme = MG.settings().theme;
    app.innerHTML = `
      <header class="topbar"><div class="brand">${MG.LOGO}Settings</div></header>
      <div class="group">
        <div class="row"><div class="lbl">Theme</div>
          <div class="seg" role="group" aria-label="Theme">
            ${['system', 'light', 'dark'].map((t) => `<button type="button" data-t="${t}" class="${t === theme ? 'on' : ''}" aria-pressed="${t === theme}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
          </div></div>
        ${sw('sound', 'Sound', 'Soft clicks and chimes')}
        ${sw('haptics', 'Haptics', 'Vibration on supported phones')}
        ${sw('timer', 'Show timer', 'Hide it for a calmer, logic-first session')}
      </div>
      ${MG.removeAds && MG.removeAds.supported ? removeAdsGroup() : ''}
      <h2>App</h2>
      <div class="group">
        <div class="row"><div class="lbl">Send feedback<small>A bug or an idea? It goes straight to us</small></div><button type="button" class="chip" id="feedback">Write</button></div>
        <div class="row"><div class="lbl">How to play<small>Rules for every puzzle</small></div><a class="chip" href="howto.html">Open</a></div>
        <div class="row"><div class="lbl">Privacy policy<small>What MindGrid and its ad partner process</small></div><a class="chip" href="privacy.html">Open</a></div>
        ${MG.adsAvailable && !MG.removeAds.owned() ? '<div class="row"><div class="lbl">Ad privacy choices<small>Review or change your ad consent</small></div><button type="button" class="chip" id="adPrivacy">Manage</button></div>' : ''}
        <div class="row" id="installRow" style="display:${installEvt ? 'flex' : 'none'}"><div class="lbl">Install MindGrid<small>Play offline from your home screen</small></div><button type="button" class="chip" id="install">Install</button></div>
        <div class="row"><div class="lbl">Reset progress<small>Erase streaks, stats and saved games on this device</small></div><button type="button" class="chip" id="reset" style="color:var(--bad)">Reset</button></div>
      </div>
      <p class="about"><img src="assets/mza-games-logo.png" alt="MZA Games">MindGrid v${MG.VERSION} · by MZA Games<br>
        <button type="button" class="chip" id="replaySplash" style="margin:10px 0">${MG.icon('play')}Replay intro</button>
        <button type="button" class="chip" id="replayTut" style="margin:10px 0">${MG.icon('help')}Replay tutorials</button><br>No account needed. Your progress stays on this device.${MG.adsAvailable ? (MG.removeAds.owned() ? '<br>Ads removed. Thank you for supporting MindGrid!' : '<br>Ads between levels keep MindGrid free.') : ''}</p>`;
    document.getElementById('feedback').addEventListener('click', () => MG.FEEDBACK.open());
    const buy = document.getElementById('buyNoAds'), restore = document.getElementById('restoreNoAds');
    if (buy) buy.addEventListener('click', () => MG.removeAds.buy());
    if (restore) restore.addEventListener('click', () => MG.removeAds.restore());
    document.getElementById('replaySplash').addEventListener('click', () => MG.splash(true));
    document.getElementById('replayTut').addEventListener('click', () => {
      MG.resetTutorials(); MG.toast('Tutorials will show again on every screen');
    });
    const ap = document.getElementById('adPrivacy');
    if (ap) ap.addEventListener('click', () => MG.adsPrivacyOptions());
    app.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { MG.setSetting('theme', b.dataset.t); render(); }));
    app.querySelectorAll('[data-k]').forEach((i) => i.addEventListener('change', () => {
      MG.setSetting(i.dataset.k, i.checked);
      if (i.dataset.k === 'sound' && i.checked) MG.sfx('place');
      if (i.dataset.k === 'haptics' && i.checked) MG.buzz(20);
    }));
    document.getElementById('reset').addEventListener('click', () => {
      if (confirm('Erase all MindGrid progress on this device? This cannot be undone.')) { MG.resetAll(); MG.applyTheme(); render(); }
    });
    const ib = document.getElementById('install');
    ib.addEventListener('click', () => { if (installEvt) { installEvt.prompt(); installEvt = null; render(); } });
  }
  if (MG.removeAds) MG.removeAds.onChange(() => render());
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; render(); });
  render();
  MG.renderTabs('settings');
  MG.pageIntro(null, 'settings', [
    { el: '.seg', title: 'Your style', text: 'Choose a light or dark look, or follow your phone.' },
    { el: '#replayTut', title: 'Need a refresher?', text: 'Tap here any time to see every tutorial again.' }
  ]);
})();
