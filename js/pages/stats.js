/* Stats page: streaks, totals, this week, best times. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app'), s = MG.load(), st = MG.streak(), today = MG.today();
  const results = Object.keys(s.results).map((k) => s.results[k]);
  const perfect = results.filter((r) => !r.hints).length;
  const played = s.log.reduce((sum, e) => sum + (e.time || 0), 0);

  let week = '';
  for (let i = 6; i >= 0; i--) {
    const d = MG.addDays(today, -i), on = !!s.days[d];
    const label = MG.parseDate(d).toLocaleDateString(undefined, { weekday: 'narrow' });
    week += `<div>${label}<i class="${on ? 'on' : ''}">${on ? MG.icon('check') : MG.parseDate(d).getDate()}</i></div>`;
  }

  const rows = MG.ORDER.map((t) => {
    const P = MG.puzzles[t], mine = results.filter((r) => r.type === t);
    const cols = MG.DIFFS.map((d) => {
      const times = mine.filter((r) => r.diff === d).map((r) => r.time);
      return `<td>${times.length ? MG.fmtTime(Math.min.apply(null, times)) : '<span class="muted">–</span>'}</td>`;
    }).join('');
    return `<tr><td><span class="dotname" style="--pc:${P.color}"><i></i>${P.name}</span></td><td>${mine.length}</td>${cols}</tr>`;
  }).join('');

  app.innerHTML = `
    <header class="topbar"><div class="brand">${MG.LOGO}Stats</div></header>
    <div class="tiles">
      <div class="tile"><b>${st.current}</b><span>Current streak</span></div>
      <div class="tile"><b>${st.best}</b><span>Best streak</span></div>
      <div class="tile"><b>${results.length}</b><span>Puzzles solved</span></div>
      <div class="tile"><b>${s.journey.level - 1}</b><span>Journey levels</span></div>
      <div class="tile"><b>${perfect}</b><span>Solved without hints</span></div>
      <div class="tile"><b>${MG.fmtTime(played)}</b><span>Time thinking</span></div>
    </div>
    <h2>Last 7 days</h2>
    <div class="week">${week}</div>
    <h2>Best times</h2>
    <div style="overflow-x:auto"><table class="table">
      <thead><tr><th>Puzzle</th><th>Solved</th>${['Easy', 'Med', 'Hard', 'Exp'].map((d) => `<th>${d}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p class="about">Stats live only on this device.</p>`;
  MG.renderTabs('stats');
})();
