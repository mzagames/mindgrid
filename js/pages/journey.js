/* Journey page: a scrolling world map (bottom to top). 12 levels per themed world, a winding road,
 * chunky level buttons with stars, a "you are here" marker and world banners. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app');
  const s = MG.load(), lvl = s.journey.level;
  const PER = 12, ROW = 92, GAP = 120, PAD_T = 90, PAD_B = 170; // PAD_B leaves room for World 1's banner
  const WORLDS = [
    { name: 'Sunrise Meadow', bg: ['#7fdc6a', '#1fb58f'], deco: ['🌳', '🌼', '🍄', '🌷', '🦋', '🌻'] },
    { name: 'Coral Lagoon', bg: ['#5cc8ff', '#2276e8'], deco: ['🐚', '🐠', '🌊', '🐙', '🐬', '⭐'] },
    { name: 'Amber Dunes', bg: ['#ffd36b', '#ff8c5a'], deco: ['🌵', '🐪', '☀️', '🦎', '🏜️', '🌵'] },
    { name: 'Frost Peaks', bg: ['#b8d8ff', '#6f9cf0'], deco: ['❄️', '🏔️', '⛄', '🐧', '❄️', '🌨️'] },
    { name: 'Candy Clouds', bg: ['#ffb8e0', '#a58cff'], deco: ['🍭', '🍬', '☁️', '🧁', '🌈', '🍩'] },
    { name: 'Neon City', bg: ['#a43dff', '#4b1fb8'], deco: ['🌃', '✨', '🎮', '🏙️', '💡', '🎧'] },
    { name: 'Crystal Caves', bg: ['#3fd6b4', '#1a5fa0'], deco: ['💎', '🔮', '🦇', '✨', '💎', '🕯️'] },
    { name: 'Lava Forge', bg: ['#ff9a3c', '#d9283b'], deco: ['🌋', '🔥', '⚒️', '🐉', '🔥', '💥'] },
    { name: 'Starfield', bg: ['#3a4a8c', '#121838'], deco: ['🪐', '⭐', '🚀', '🌙', '☄️', '✨'] }
  ];
  const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  const worldsShown = Math.floor((lvl - 1) / PER) + 2, total = worldsShown * PER;
  const H = PAD_B + PAD_T + (total - 1) * ROW + (worldsShown - 1) * GAP + GAP;
  const worldOf = (i) => Math.floor((i - 1) / PER);
  const W = (w) => { const b = WORLDS[w % WORLDS.length]; return Object.assign({}, b, { title: b.name + (ROMAN[Math.floor(w / WORLDS.length)] ?? ' +') }); };
  const totalStars = Object.keys(s.stars).filter((k) => k.indexOf('j:') === 0).reduce((a, k) => a + s.stars[k], 0);

  app.innerHTML = `
    <div class="jhead"><header class="topbar">
      <div class="brand">${MG.LOGO}Journey</div>
      <div class="chips"><span class="chip gold">${MG.icon('star')}${totalStars}</span><span class="chip">${MG.icon('trophy')}${lvl - 1}</span></div>
    </header></div>
    <div class="world-map" id="map"></div>
    <a class="btn jplay" href="play.html?mode=journey&level=${lvl}">${MG.icon('play')} Play level ${lvl}</a>`;
  const map = document.getElementById('map');
  map.style.height = H + 'px';

  function y(i) { return H - PAD_B - (i - 1) * ROW - worldOf(i) * GAP; }
  function x(i, w) { const amp = Math.min(115, w * 0.27); return w / 2 + Math.sin((i - 1) * 0.92) * amp; }

  function layout() {
    const w = map.clientWidth;
    let html = '';
    // world backgrounds, banners and decorations
    for (let k = 0; k < worldsShown; k++) {
      const first = k * PER + 1, last = first + PER - 1, info = W(k);
      const bottom = k === 0 ? H : y(first) + ROW / 2 + GAP;
      const top = k === worldsShown - 1 ? 0 : y(last) - ROW / 2;
      let stars = 0;
      for (let i = first; i <= last; i++) stars += MG.getStars(MG.journeyKey(i));
      const rng = MG.rng('world|' + k);
      let deco = '';
      for (let d = 0; d < 9; d++) {
        const left = rng.chance(0.5) ? 2 + rng.next() * 12 : 84 + rng.next() * 12;
        deco += `<span class="deco" style="left:${left}%;top:${8 + rng.next() * 84}%;animation-delay:${-rng.next() * 6}s;font-size:${24 + rng.int(16)}px">${rng.pick(info.deco)}</span>`;
      }
      html += `<div class="world" style="top:${top}px;height:${bottom - top}px;background:linear-gradient(0deg,${info.bg[0]},${info.bg[1]})">${deco}</div>`;
      html += `<div class="world-banner" style="top:${y(first) + ROW / 2 + GAP / 2 - 30}px;background:linear-gradient(135deg,${info.bg[1]},color-mix(in srgb,${info.bg[1]} 65%,#000))">
        <small>World ${k + 1}</small><b>${info.title}</b><span class="ws">${MG.icon('star')}${stars}/${PER * 3}</span></div>`;
    }
    // road
    let d = '', dDone = '';
    for (let i = 1; i <= total; i++) {
      const px = x(i, w), py = y(i);
      if (i === 1) d = `M${px},${py}`;
      else { const ax = x(i - 1, w), ay = y(i - 1), my = (ay + py) / 2; d += ` C${ax},${my} ${px},${my} ${px},${py}`; }
      if (i === Math.min(lvl, total)) dDone = d;
    }
    html += `<svg class="road" viewBox="0 0 ${w} ${H}" preserveAspectRatio="none"><path class="r-edge" d="${d}"/><path class="r-base" d="${d}"/>
      ${lvl > 1 ? `<path class="r-done" d="${dDone}"/>` : ''}<path class="r-dash" d="${d}"/></svg>`;
    // level buttons
    for (let i = 1; i <= total; i++) {
      const spec = MG.journeySpec(i), P = MG.puzzles[spec.type], boss = i % PER === 0 ? ' boss' : '';
      const style = `left:${x(i, w)}px;top:${y(i)}px;--pc:${P.color}`;
      const mini = `<span class="pic mini" style="--pc:${P.color}">${P.icon}</span>`;
      if (i < lvl) {
        html += `<a class="lvl${boss}" style="${style}" href="play.html?mode=journey&level=${i}" aria-label="Level ${i}, ${P.name}, replay">${i}${mini}${MG.stars(MG.getStars(MG.journeyKey(i)))}</a>`;
      } else if (i === lvl) {
        html += `<a class="lvl current${boss}" id="cur" style="${style}" href="play.html?mode=journey&level=${i}" aria-label="Play level ${i}, ${P.name}">${i}${mini}</a>`;
        html += `<div class="you" style="left:${x(i, w)}px;top:${y(i)}px">${MG.LOGO}<span>YOU</span></div>`;
      } else {
        html += `<div class="lvl locked${boss}" style="${style}" aria-label="Level ${i} locked">${i <= lvl + 2 ? i : MG.icon('lock')}</div>`;
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
    if (cur) cur.scrollIntoView({ block: 'center' });
  });
  MG.renderTabs('journey');
})();
