/* Today page: the six daily puzzles for a date (default today). */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app'), q = new URLSearchParams(location.search), today = MG.today();
  const asked = q.get('date');
  const day = MG.isValidDate(asked) && asked <= today && asked >= MG.earliestDay() ? asked : today;
  const isToday = day === today;

  function render() {
    const diff = MG.settings().dailyDiff, st = MG.streak();
    let solved = 0;
    const cards = MG.ORDER.map((t) => {
      const P = MG.puzzles[t], key = MG.dailyKey(day, t, diff), res = MG.getResult(key), prog = MG.getProgress(key);
      if (res) solved++;
      const status = res ? `<span class="status done">${MG.icon('check')}${MG.fmtTime(res.time)}</span>`
        : prog ? '<span class="status prog">Resume</span>' : '<span class="status">Play</span>';
      return `<a class="card" style="--pc:${P.color}" href="play.html?type=${t}&date=${day}&diff=${diff}">
        <div class="pic">${P.icon}</div>
        <div class="body"><div class="title">${P.name}</div><div class="sub">${P.tagline}</div></div>${status}</a>`;
    }).join('');
    const jl = MG.load().journey.level, js = MG.journeySpec(jl), JP = MG.puzzles[js.type];
    app.innerHTML = `
      <header class="topbar">
        <div class="brand">${MG.LOGO}MindGrid</div>
        <span class="chip flame${st.today ? '' : ' cold'}" title="Daily streak: solve one daily puzzle each day">${MG.icon('flame')}${st.current} day${st.current === 1 ? '' : 's'}</span>
      </header>
      ${isToday ? '<div class="eyebrow">Daily puzzles</div>' : '<a class="eyebrow" href="archive.html">‹ Back to archive</a>'}
      <h1>${MG.prettyDate(day)}</h1>
      <p class="muted" style="margin:0 0 16px">${isToday ? 'Six fresh puzzles, the same for everyone today.' : 'Replaying a past day. It won’t change your streak.'}</p>
      <div class="seg" role="group" aria-label="Difficulty">
        ${MG.DIFFS.map((d) => `<button type="button" data-d="${d}" class="${d === diff ? 'on' : ''}" aria-pressed="${d === diff}">${MG.DIFF_LABEL[d]}</button>`).join('')}
      </div>
      <div class="progress"><div class="bar"><i style="width:${(solved / MG.ORDER.length) * 100}%"></i></div>${solved} / ${MG.ORDER.length} solved
        ${solved ? `<button type="button" class="chip sharebtn" id="share">${MG.icon('share')}Share</button>` : ''}</div>
      ${cards}
      <h2>Keep going</h2>
      <a class="card hero" href="play.html?mode=journey&level=${jl}">
        <div class="pic">${MG.icon('journey')}</div>
        <div class="body"><div class="title">Journey · Level ${jl}</div><div class="sub">${JP.name} · ${MG.DIFF_LABEL[js.diff]}</div></div>${MG.icon('play')}
      </a>
      <a class="card" href="howto.html" style="--pc:var(--accent)">
        <div class="pic">${MG.icon('help')}</div>
        <div class="body"><div class="title">How to play</div><div class="sub">Rules and controls for all six puzzles</div></div>
      </a>`;
    const sb = document.getElementById('share');
    if (sb) sb.addEventListener('click', () => MG.shareDay(day, diff));
    app.querySelectorAll('.seg button').forEach((b) => {
      b.addEventListener('click', () => { MG.setSetting('dailyDiff', b.dataset.d); render(); });
    });
  }
  render();
  MG.renderTabs(isToday ? 'today' : 'archive');
  window.addEventListener('pageshow', (e) => { if (e.persisted) render(); });
})();
