/* How-to page: rules for every puzzle plus the game modes. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app');
  const cards = MG.ORDER.map((t) => {
    const P = MG.puzzles[t];
    return `<div class="card" style="--pc:${P.color}"><div class="pic">${P.icon}</div>
      <div class="body"><div class="title">${P.name}</div><ol>${P.rules.map((r) => '<li>' + r + '</li>').join('')}</ol>
      <p class="ctl"><b>Controls:</b> ${P.controls}</p>
      <a class="status" style="margin-top:8px" href="play.html?type=${t}">${MG.icon('play')} Try today’s</a></div></div>`;
  }).join('');
  app.innerHTML = `
    <header class="topbar"><div class="brand">${MG.LOGO}How to play</div></header>
    <div class="howto">${cards}</div>
    <h2>Modes</h2>
    <div class="group">
      <div class="row"><div class="lbl">Today<small>Five new puzzles every day, the same for everyone. Solve one to keep your streak.</small></div></div>
      <div class="row"><div class="lbl">Journey<small>Endless levels cycling through every puzzle, from Easy to Expert.</small></div></div>
      <div class="row"><div class="lbl">Archive<small>Replay any day from the past year for free.</small></div></div>
      <div class="row"><div class="lbl">Tools<small>Undo (Ctrl+Z), Reset and Hint (H). Your progress saves automatically.</small></div></div>
    </div>`;
  MG.renderTabs('');
})();
