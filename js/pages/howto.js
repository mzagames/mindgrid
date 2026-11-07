/* How-to page: rules for every puzzle plus the game modes. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app');
  const cards = MG.ORDER.map((t) => {
    const P = MG.puzzles[t];
    return `<div class="card" style="--pc:${P.color}"><div class="pic">${P.icon}</div>
      <div class="body"><div class="title">${P.name}</div><ol>${P.rules.map((r) => '<li>' + r + '</li>').join('')}</ol>
      <p class="ctl"><b>Controls:</b> ${P.controls}</p>
      <a class="status go" style="margin-top:8px" href="play.html?mode=practice&type=${t}">${MG.icon('play')} Play ${P.name}</a></div></div>`;
  }).join('');
  app.innerHTML = `
    <header class="topbar"><div class="brand">${MG.LOGO}How to play</div></header>
    <div class="howto">${cards}</div>
    <h2>Modes</h2>
    <div class="group">
      <div class="row"><div class="lbl">Journey<small>A world map of endless levels that cycles through every puzzle. A new themed world every 12 levels.</small></div></div>
      <div class="row"><div class="lbl">Puzzle modes<small>Pick one puzzle (Blocks, Pipes, Link, Crowns, Glow or Balance) and climb its own levels from Easy to Expert.</small></div></div>
      <div class="row"><div class="lbl">Mix Mode<small>A surprise puzzle every level, never the same one twice in a row. Difficulty climbs faster.</small></div></div>
      <div class="row"><div class="lbl">Daily challenge<small>Six new puzzles every day, the same for everyone. Solve one to keep your streak. Replay old days in the Archive.</small></div></div>
      <div class="row"><div class="lbl">Stars<small>3 stars: no hints and within par time. 2 stars: at most one hint and within twice the par. 1 star: solved.</small></div></div>
      <div class="row"><div class="lbl">Puzzle IQ<small>A for-fun score from your speed, the difficulty, hints and undos. It moves toward how you play now. Not a clinical IQ test.</small></div></div>
      <div class="row"><div class="lbl">Tools<small>Undo (Ctrl+Z), Reset and Hint (H). Your progress saves automatically.</small></div></div>
    </div>`;
  MG.renderTabs('home');
})();
