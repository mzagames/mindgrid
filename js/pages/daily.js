/* Daily page: the six daily puzzles for a date (default today). */
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
        : prog ? '<span class="status prog">Resume</span>' : `<span class="status go">${MG.icon('play')}Play</span>`;
      return `<a class="card" style="--pc:${P.color}" href="play.html?type=${t}&date=${day}&diff=${diff}">
        <div class="pic">${P.icon}</div>
        <div class="body"><div class="title">${P.name}</div><div class="sub">${res ? MG.stars(MG.getStars(key)) : P.tagline}</div></div>${status}</a>`;
    }).join('');
    app.innerHTML = `
      <header class="topbar">
        <div class="brand">${MG.LOGO}Daily</div>
        <div class="chips">
          <span class="chip flame${st.today ? '' : ' cold'}" title="Daily streak: solve one daily puzzle each day">${MG.icon('flame')}${st.current}</span>
          <a class="chip" href="archive.html" title="Archive of past days">${MG.icon('archive')}Archive</a>
        </div>
      </header>
      ${isToday ? '<div class="eyebrow">Daily challenge</div>' : '<a class="eyebrow" href="archive.html">‹ Back to archive</a>'}
      <h1>${MG.prettyDate(day)}</h1>
      <p class="muted" style="margin:0 0 16px">${isToday ? 'Six fresh puzzles, the same for everyone today. Solve one to keep your streak.' : 'Replaying a past day. It won’t change your streak.'}</p>
      <div class="seg" role="group" aria-label="Difficulty">
        ${MG.DIFFS.map((d) => `<button type="button" data-d="${d}" class="${d === diff ? 'on' : ''}" aria-pressed="${d === diff}">${MG.DIFF_LABEL[d]}</button>`).join('')}
      </div>
      <div class="progress"><div class="bar"><i style="width:${(solved / MG.ORDER.length) * 100}%"></i></div>${solved} / ${MG.ORDER.length}
        ${solved ? `<button type="button" class="chip sharebtn" id="share">${MG.icon('share')}Share</button>` : ''}</div>
      ${cards}`;
    const sb = document.getElementById('share');
    if (sb) sb.addEventListener('click', () => MG.shareDay(day, diff));
    app.querySelectorAll('.seg button').forEach((b) => {
      b.addEventListener('click', () => { MG.setSetting('dailyDiff', b.dataset.d); MG.sfx('tap'); render(); });
    });
  }
  render();
  MG.renderTabs('daily');
  MG.pageIntro(() => {
    const jd = MG.takeJustDone((j) => j.mode === 'daily' && j.day === day);
    if (!jd) return false;
    const el = app.querySelector(`a.card[href*="type=${jd.type}&"]`);
    if (!el) return false;
    const bar = app.querySelector('.progress .bar i');
    if (bar) { const w = bar.style.width; bar.style.transition = 'none'; bar.style.width = Math.max(0, parseFloat(w) - 100 / 6) + '%'; requestAnimationFrame(() => { bar.style.transition = 'width .9s .5s ease'; bar.style.width = w; }); }
    MG.celebrate(el, MG.starLabel(jd.stars) + ' Solved!');
    return true;
  }, 'daily', [
    { el: '.seg', title: 'Pick a difficulty', text: 'Easy, Medium, Hard or Expert. Each difficulty has its own six daily puzzles.' },
    { el: '#app a.card', title: 'Today’s puzzles', text: 'Tap any puzzle to play. Everyone in the world gets the same ones today.' },
    { el: '.chip.flame', title: 'Daily streak', text: 'Solve at least one daily puzzle every day to keep your 🔥 streak growing.' },
    { el: 'a.chip[href="archive.html"]', title: 'Archive', text: 'Missed a day? Replay any day from the past year here.' }
  ]);
  window.addEventListener('pageshow', (e) => { if (e.persisted) render(); });
})();
