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
      <h2>App</h2>
      <div class="group">
        <div class="row"><div class="lbl">How to play<small>Rules for every puzzle</small></div><a class="chip" href="howto.html">Open</a></div>
        <div class="row"><div class="lbl">Privacy policy<small>What MindGrid and its ad partner process</small></div><a class="chip" href="privacy.html">Open</a></div>
        ${MG.adsAvailable ? '<div class="row"><div class="lbl">Ad privacy choices<small>Review or change your ad consent</small></div><button type="button" class="chip" id="adPrivacy">Manage</button></div>' : ''}
        <div class="row" id="installRow" style="display:${installEvt ? 'flex' : 'none'}"><div class="lbl">Install MindGrid<small>Play offline from your home screen</small></div><button type="button" class="chip" id="install">Install</button></div>
        <div class="row"><div class="lbl">Reset progress<small>Erase streaks, stats and saved games on this device</small></div><button type="button" class="chip" id="reset" style="color:var(--bad)">Reset</button></div>
      </div>
      <p class="about">MindGrid v${MG.VERSION} · by MZA Games<br>No account needed. Your progress stays on this device.${MG.adsAvailable ? '<br>Ads between levels keep MindGrid free.' : ''}</p>`;
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
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; render(); });
  render();
  MG.renderTabs('settings');
})();
