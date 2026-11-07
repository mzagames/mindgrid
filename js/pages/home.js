/* Home hub: Puzzle IQ, continue Journey, Daily challenge, Puzzle Modes (one puzzle type) and Mix Mode. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app'), today = MG.today();

  /** IQ ring gauge: 70..160 mapped onto a 270° arc. */
  function gauge(iq, calibrating) {
    const R = 44, C = 2 * Math.PI * R, arc = C * 0.75, k = calibrating ? 0.08 : Math.max(0.04, Math.min(1, (iq - 70) / 90));
    return `<div class="gauge"><svg viewBox="0 0 104 104"><circle class="g-bg" cx="52" cy="52" r="${R}" stroke-dasharray="${arc} ${C}"/>
      <circle class="g-fg" cx="52" cy="52" r="${R}" stroke-dasharray="0 ${C}" data-to="${arc * k} ${C}"/></svg>
      <div class="g-num"><div><b id="iqn">${calibrating ? '?' : 0}</b><small>PUZZLE IQ</small></div></div></div>`;
  }

  function render() {
    const s = MG.load(), iq = MG.iq(), st = MG.streak();
    const jl = s.journey.level, js = MG.journeySpec(jl), JP = MG.puzzles[js.type];
    const dDiff = MG.settings().dailyDiff, dayDone = MG.ORDER.filter((t) => MG.getResult(MG.dailyKey(today, t, dDiff))).length;
    const iqDelta = (() => { const h = iq.hist; if (h.length < 2 || h[h.length - 1].at !== today) return 0; return h[h.length - 1].v - h[h.length - 2].v; })();
    const next = iq.next;
    const modes = MG.ORDER.map((t) => {
      const P = MG.puzzles[t], lv = MG.practiceLevel(t), d = MG.practiceDiff(lv);
      const bounds = { easy: [1, 6], medium: [6, 16], hard: [16, 36], expert: [36, 36] }[d];
      const pct = d === 'expert' ? 100 : Math.round(((lv - bounds[0]) / (bounds[1] - bounds[0])) * 100);
      return `<a class="mode" style="--pc:${P.color}" href="play.html?mode=practice&type=${t}">
        <div class="pic">${P.icon}</div><b>${P.name}</b>
        <div class="lv"><span>Level ${lv}</span><em>${MG.DIFF_LABEL[d]}</em></div>
        <div class="mbar"><i style="width:${pct}%"></i></div></a>`;
    }).join('');
    const ms = MG.mixSpec(s.mix.level);

    app.innerHTML = `
      <header class="topbar">
        <div class="brand">${MG.LOGO}MindGrid</div>
        <div class="chips">
          <span class="chip flame${st.today ? '' : ' cold'}" title="Daily streak">${MG.icon('flame')}${st.current}</span>
          <a class="chip iqchip" href="stats.html" title="Your Puzzle IQ">${MG.icon('brain')}${iq.calibrating ? '–' : iq.score}</a>
        </div>
      </header>

      <a class="iqhero" href="stats.html" aria-label="Your Puzzle IQ">
        ${gauge(iq.score, iq.calibrating)}
        <div class="info">
          <div class="rank">${iq.calibrating ? 'Find your Puzzle IQ' : iq.rank}</div>
          <p>${iq.calibrating ? `Solve ${3 - iq.n} more puzzle${3 - iq.n === 1 ? '' : 's'} to reveal it. Speed, difficulty and hints all count.`
            : next ? `${next[0] - iq.score} points to <b>${next[1]}</b>` : 'Top rank reached. Legendary!'}</p>
          ${!iq.calibrating && iqDelta ? `<span class="pill">${iqDelta > 0 ? '▲ +' : '▼ '}${iqDelta} today</span>` : `<span class="pill">${MG.icon('star')} ${Object.values(s.stars).reduce((a, b) => a + b, 0)} stars</span>`}
        </div>
      </a>

      <a class="bigplay" style="--pc:${JP.color}" href="play.html?mode=journey&level=${jl}">
        <div class="pic">${JP.icon}</div>
        <div class="body"><div class="t1">Journey</div><div class="t2">Level ${jl}</div><div class="t3">${JP.name} · ${MG.DIFF_LABEL[js.diff]}</div></div>
        <span class="go">${MG.icon('play')}</span>
      </a>

      <h2>${MG.icon('daily')}Daily challenge</h2>
      <a class="card dailycard" href="daily.html" style="--pc:var(--accent)">
        <div class="pic">${MG.icon('daily')}</div>
        <div class="body"><div class="title">${MG.prettyDate(today, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          <div class="minis">${MG.ORDER.map((t) => `<i class="${MG.getResult(MG.dailyKey(today, t, dDiff)) ? 'on' : ''}" style="--pc:${MG.puzzles[t].color}">${MG.getResult(MG.dailyKey(today, t, dDiff)) ? MG.icon('check') : ''}</i>`).join('')}</div></div>
        <span class="status ${dayDone === 6 ? 'done' : 'go'}">${dayDone === 6 ? MG.icon('check') + 'Done' : dayDone + '/6'}</span>
      </a>

      <h2>${MG.icon('mix')}Puzzle modes</h2>
      <div class="modes">
        <a class="mode mixmode" href="play.html?mode=mix" style="--pc:#a78bfa">
          <span class="tag">MIX</span>
          <div class="pic">${MG.ART.mix}</div>
          <div class="mtxt"><b>Mix Mode</b><div class="lv"><span>Level ${s.mix.level} · next: ${MG.puzzles[ms.type].name}</span></div>
            <div class="lv"><span>A surprise puzzle every level</span></div></div>
        </a>
        ${modes}
      </div>

      <a class="card" href="howto.html" style="--pc:var(--accent);margin-top:14px">
        <div class="pic">${MG.icon('help')}</div>
        <div class="body"><div class="title">How to play</div><div class="sub">Rules, modes and how Puzzle IQ works</div></div>
      </a>`;

    // animate the IQ gauge
    requestAnimationFrame(() => {
      const fg = app.querySelector('.g-fg');
      fg.style.strokeDasharray = fg.getAttribute('stroke-dasharray');
      setTimeout(() => { fg.style.strokeDasharray = fg.dataset.to; }, 60);
      if (!iq.calibrating) MG.countUp(document.getElementById('iqn'), 70, iq.score, 1000);
    });
  }
  render();
  MG.renderTabs('home');
  MG.pageIntro(() => {
    const jd = MG.takeJustDone((j) => j.mode === 'practice' || j.mode === 'mix');
    if (!jd) return false;
    const el = jd.mode === 'mix' ? app.querySelector('.mixmode') : app.querySelector(`.mode[href*="type=${jd.type}"]`);
    if (!el) return false;
    const bar = el.querySelector('.mbar i');
    if (bar) { const w = bar.style.width; bar.style.transition = 'none'; bar.style.width = '0%'; requestAnimationFrame(() => { bar.style.transition = 'width 1s .4s ease'; bar.style.width = w; }); }
    MG.celebrate(el, MG.starLabel(jd.stars) + ' Level ' + jd.level + ' cleared');
    return true;
  }, 'home', [
    { el: '.iqhero', title: 'Your Puzzle IQ', text: 'It grows when you solve puzzles fast, on harder levels and without hints. Tap it to see your skills.' },
    { el: '.bigplay', title: 'Journey', text: 'Travel through colourful worlds, one level at a time. Tap here to continue.' },
    { el: '.dailycard', title: 'Daily challenge', text: 'Six fresh puzzles every day. Solve at least one daily to build your 🔥 streak.' },
    { el: '.mixmode', title: 'Mix Mode', text: 'A surprise puzzle every level, never the same one twice in a row!' },
    { el: '.modes .mode:not(.mixmode)', title: 'Puzzle modes', text: 'Love one puzzle? Pick it here and climb its own levels from Easy to Expert.' },
    { el: '.tabbar', title: 'Find your way', text: 'Use these tabs to jump between Home, Journey, Daily, your IQ and Settings.', fixed: true, hy: 0.4 }
  ]);
  window.addEventListener('pageshow', (e) => { if (e.persisted) render(); });
})();
