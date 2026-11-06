/* Journey page: a winding map of endless levels. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app');
  const lvl = MG.load().journey.level, total = Math.max(lvl + 14, 30), ROW = 104, PAD = 70;
  const BANDS = [[1, 'Easy'], [11, 'Medium'], [31, 'Hard'], [61, 'Expert']];

  app.innerHTML = `
    <header class="topbar"><div class="brand">${MG.LOGO}Journey</div><span class="chip">${MG.icon('trophy')}${lvl - 1} cleared</span></header>
    <p class="muted" style="margin:0">An endless path through all five puzzles. Difficulty rises as you go.</p>
    <a class="btn" style="margin:16px 0 4px" href="play.html?mode=journey&level=${lvl}">${MG.icon('play')} Play level ${lvl}</a>
    <div class="map" id="map"></div>`;
  const map = document.getElementById('map');
  map.style.height = (total - 1) * ROW + PAD * 2 + 'px';

  function pos(i, w) {
    const amp = Math.min(120, w * 0.28);
    return { x: w / 2 + Math.sin((i - 1) * 0.85) * amp, y: PAD + (i - 1) * ROW };
  }
  function layout() {
    const w = map.clientWidth;
    let d = '', html = '';
    for (let i = 1; i <= total; i++) {
      const p = pos(i, w);
      if (i === 1) d += `M${p.x},${p.y}`;
      else { const a = pos(i - 1, w), my = (a.y + p.y) / 2; d += ` C${a.x},${my} ${p.x},${my} ${p.x},${p.y}`; }
    }
    html += `<svg class="road" viewBox="0 0 ${w} ${map.clientHeight}" preserveAspectRatio="none"><path d="${d}"/></svg>`;
    BANDS.forEach(([start, label]) => {
      if (start <= total) html += `<div class="band" style="top:${pos(start, w).y - 58}px">${label}</div>`;
    });
    for (let i = 1; i <= total; i++) {
      const p = pos(i, w), spec = MG.journeySpec(i), P = MG.puzzles[spec.type];
      const style = `left:${p.x}px;top:${p.y}px;--pc:${P.color}`;
      if (i < lvl) {
        html += `<a class="node done" style="${style}" href="play.html?mode=journey&level=${i}" aria-label="Level ${i} (done), replay">${MG.icon('check')}<small>${i}</small></a>`;
      } else if (i === lvl) {
        html += `<a class="node current" id="cur" style="${style}" href="play.html?mode=journey&level=${i}" aria-label="Play level ${i}">${i}<small>${P.name}</small></a>`;
      } else {
        html += `<div class="node locked" style="${style}" aria-label="Level ${i} locked">${MG.icon('lock')}</div>`;
      }
    }
    map.innerHTML = html;
  }
  layout();
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  requestAnimationFrame(() => {
    const cur = document.getElementById('cur');
    if (cur && lvl > 3) cur.scrollIntoView({ block: 'center' });
  });
  MG.renderTabs('journey');
})();
