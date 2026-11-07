/* IQ & Stats page: Puzzle IQ, rank ladder, skills per puzzle, IQ trend, streaks, totals, best times. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app'), s = MG.load(), st = MG.streak(), today = MG.today(), iq = MG.iq();
  const results = Object.keys(s.results).map((k) => s.results[k]);
  const perfect = results.filter((r) => !r.hints).length;
  const played = s.log.reduce((sum, e) => sum + (e.time || 0), 0);
  const stars = Object.values(s.stars).reduce((a, b) => a + b, 0);

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

  const skills = MG.ORDER.map((t) => {
    const P = MG.puzzles[t], sk = iq.skills[t], v = sk ? Math.round(sk.score) : null;
    const pct = v ? Math.max(4, Math.min(100, ((v - 70) / 90) * 100)) : 0;
    return `<div class="skill" style="--pc:${P.color}"><div class="pic">${P.icon}</div><div class="sk">
      <div>${MG.SKILL[t]} <span>${P.name} · ${v ? v : 'not rated yet'}</span></div><div class="sbar"><i style="width:${pct}%"></i></div></div></div>`;
  }).join('');

  const ranks = MG.RANKS.map((r, i) => {
    const nextMin = MG.RANKS[i + 1] ? MG.RANKS[i + 1][0] : 999, on = !iq.calibrating && iq.score >= r[0] && iq.score < nextMin;
    return `<div class="${on ? 'on' : ''}"><b>${r[1]}</b>${i === 0 ? 'under 90' : r[0] + '+'}</div>`;
  }).join('');

  function trend() {
    const h = iq.hist.slice(-30);
    if (h.length < 2) return '<p class="muted" style="margin:0">Your IQ trend appears after you play on two different days.</p>';
    const vals = h.map((p) => p.v), lo = Math.min.apply(null, vals) - 4, hi = Math.max.apply(null, vals) + 4, W = 300, Hh = 100;
    const pts = h.map((p, i) => [(i / (h.length - 1)) * W, Hh - ((p.v - lo) / (hi - lo)) * Hh]);
    const line = pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    return `<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><polygon class="ta" points="0,${Hh} ${line} ${W},${Hh}"/><polyline class="tl" points="${line}"/></svg>
      <p><span>${MG.prettyDate(h[0].at, { month: 'short', day: 'numeric' })}: ${h[0].v}</span><span>Now: ${h[h.length - 1].v}</span></p>`;
  }

  app.innerHTML = `
    <header class="topbar"><div class="brand">${MG.LOGO}Puzzle IQ</div><span class="chip gold">${MG.icon('star')}${stars}</span></header>
    <div class="iqhero">
      <div class="gauge"><svg viewBox="0 0 104 104"><circle class="g-bg" cx="52" cy="52" r="44" stroke-dasharray="${2 * Math.PI * 44 * 0.75} 999"/>
        <circle class="g-fg" cx="52" cy="52" r="44" stroke-dasharray="${iq.calibrating ? 20 : Math.max(8, ((iq.score - 70) / 90) * 2 * Math.PI * 44 * 0.75)} 999"/></svg>
        <div class="g-num"><div><b>${iq.calibrating ? '?' : iq.score}</b><small>PUZZLE IQ</small></div></div></div>
      <div class="info"><div class="rank">${iq.calibrating ? 'Calibrating…' : iq.rank}</div>
        <p>${iq.calibrating ? `Solve ${3 - iq.n} more puzzle${3 - iq.n === 1 ? '' : 's'} to reveal your score.` : iq.next ? `${iq.next[0] - iq.score} to ${iq.next[1]}` : 'Highest rank!'}</p>
        <span class="pill">${MG.icon('brain')} ${iq.n} rated solves</span></div>
    </div>
    <h2>${MG.icon('trophy')}Ranks</h2>
    <div class="ranks">${ranks}</div>
    <h2>${MG.icon('brain')}Skills</h2>
    <div class="skills">${skills}</div>
    <h2>${MG.icon('stats')}IQ trend</h2>
    <div class="trend">${trend()}</div>
    <p class="note">How it works: every solve scores your speed against a par time, the difficulty, hints used and how often you undo. Solving several in a row without hints adds a small bonus. Your Puzzle IQ moves toward how you play now. It’s a for-fun game score, not a medical or clinical IQ test.</p>
    <h2>${MG.icon('flame')}Streaks and totals</h2>
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
  const on = app.querySelector('.ranks .on');
  if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  window.scrollTo(0, 0);
  MG.renderTabs('stats');
})();
