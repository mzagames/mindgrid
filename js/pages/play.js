/* Play page: mounts a puzzle, runs the timer, autosaves, undo/reset/hint, tutorial and win flow. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app'), q = new URLSearchParams(location.search), today = MG.today();
  const mode = q.get('mode') === 'journey' ? 'journey' : 'daily';
  let type, diff, key, day = null, level = 0, backHref, meta;

  if (mode === 'journey') {
    const max = MG.load().journey.level;
    level = Math.max(1, Math.min(max, parseInt(q.get('level'), 10) || max));
    ({ type, diff } = MG.journeySpec(level));
    key = MG.journeyKey(level);
    backHref = 'journey.html';
    meta = 'Level ' + level + ' · ' + MG.DIFF_LABEL[diff];
  } else {
    day = q.get('date');
    if (!MG.isValidDate(day) || day > today || day < MG.earliestDay()) day = today;
    type = MG.puzzles[q.get('type')] ? q.get('type') : MG.ORDER[0];
    diff = MG.DIFFS.indexOf(q.get('diff')) >= 0 ? q.get('diff') : MG.settings().dailyDiff;
    key = MG.dailyKey(day, type, diff);
    backHref = day === today ? 'index.html' : 'index.html?date=' + day;
    meta = MG.DIFF_LABEL[diff] + ' · ' + (day === today ? 'Today' : MG.prettyDate(day, { month: 'short', day: 'numeric' }));
  }

  const P = MG.puzzles[type];
  document.title = P.name + ' · MindGrid';
  document.body.style.setProperty('--pc', P.color);
  const puzzle = P.generate(MG.rng(MG.seedFor(key)), diff);

  app.innerHTML = `
    <header class="playbar">
      <a class="iconbtn" href="${backHref}" aria-label="Back">${MG.icon('back')}</a>
      <div class="mid"><div class="name">${P.name}</div><div class="meta">${meta}</div></div>
      <div class="timer${MG.settings().timer ? '' : ' hidden'}" aria-label="Elapsed time">${MG.icon('clock')}<span id="t">0:00</span></div>
    </header>
    <div class="banner" id="banner"></div>
    <div class="stage" id="stage"></div>
    <div class="tools">
      <button type="button" class="tool" id="undo" title="Undo (Ctrl+Z)">${MG.icon('undo')}Undo</button>
      <button type="button" class="tool" id="reset" title="Reset">${MG.icon('reset')}Reset</button>
      <button type="button" class="tool" id="hint" title="Hint (H)">${MG.icon('hint')}Hint<span class="count" id="hc"></span></button>
    </div>
    <details class="rules"><summary>${MG.icon('help')} How to play ${P.name}</summary>
      <ol>${P.rules.map((r) => '<li>' + r + '</li>').join('')}</ol><p>${P.controls}</p></details>`;

  const stage = document.getElementById('stage'), tEl = document.getElementById('t'), banner = document.getElementById('banner');
  const undoBtn = document.getElementById('undo'), resetBtn = document.getElementById('reset'), hintBtn = document.getElementById('hint');
  const hc = document.getElementById('hc');
  let elapsed = 0, hints = 0, running = false, solved = false, lastTick = performance.now();
  const history = [];
  const ctrl = P.mount(stage, puzzle, { changed: changed, sfx: MG.sfx, buzz: MG.buzz });
  const initial = JSON.stringify(ctrl.snapshot());
  history.push(initial);

  const prev = MG.getResult(key), prog = MG.getProgress(key);
  if (prog && prog.snap) {
    ctrl.restore(prog.snap);
    const s = JSON.stringify(ctrl.snapshot());
    if (s !== initial) history.push(s);
    elapsed = prog.elapsed || 0; hints = prog.hints || 0;
  }
  if (prev) banner.innerHTML = 'Solved before in ' + MG.fmtTime(prev.time) + '. Play again to beat it!';
  updateTools(); tick();

  function tick() {
    const now = performance.now();
    if (running && !document.hidden) elapsed += (now - lastTick) / 1000;
    lastTick = now;
    tEl.textContent = MG.fmtTime(elapsed);
  }
  setInterval(tick, 250);
  function start() { running = true; lastTick = performance.now(); }

  function persist() {
    if (solved) return;
    const snap = ctrl.snapshot();
    if (JSON.stringify(snap) === initial && !hints) { MG.clearProgress(key); return; }
    MG.saveProgress(key, { snap: snap, elapsed: Math.floor(elapsed), hints: hints });
  }
  document.addEventListener('visibilitychange', () => { tick(); if (document.hidden) persist(); });
  window.addEventListener('pagehide', persist);

  function updateTools() {
    undoBtn.disabled = solved || history.length < 2;
    resetBtn.disabled = solved || history[history.length - 1] === initial;
    hintBtn.disabled = solved;
    hc.textContent = hints ? hints : '';
  }
  function changed() {
    if (solved) return;
    if (!running) start();
    const s = JSON.stringify(ctrl.snapshot());
    if (s !== history[history.length - 1]) history.push(s);
    if (history.length > 400) history.splice(1, 1);
    updateTools(); persist();
    if (ctrl.isSolved()) win();
  }
  undoBtn.addEventListener('click', () => {
    if (history.length < 2 || solved) return;
    history.pop();
    ctrl.restore(JSON.parse(history[history.length - 1]));
    MG.sfx('undo'); updateTools(); persist();
  });
  resetBtn.addEventListener('click', () => {
    if (solved || history[history.length - 1] === initial) return;
    history.push(initial);
    ctrl.restore(JSON.parse(initial));
    MG.sfx('undo'); updateTools(); persist();
  });
  hintBtn.addEventListener('click', () => {
    if (solved) return;
    if (ctrl.hint()) { hints++; MG.sfx('hint'); MG.buzz(15); changed(); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoBtn.click(); }
    else if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) hintBtn.click();
  });

  function nextHref() {
    if (mode === 'journey') return { href: 'play.html?mode=journey&level=' + (level + 1), label: 'Level ' + (level + 1) };
    const i = MG.ORDER.indexOf(type);
    for (let k = 1; k < MG.ORDER.length; k++) {
      const t = MG.ORDER[(i + k) % MG.ORDER.length];
      if (!MG.getResult(MG.dailyKey(day, t, diff))) {
        return { href: 'play.html?type=' + t + '&date=' + day + '&diff=' + diff, label: 'Next: ' + MG.puzzles[t].name };
      }
    }
    return null;
  }

  function win() {
    tick();
    solved = true; running = false;
    const time = Math.max(1, Math.round(elapsed));
    const out = MG.recordResult(key, { type: type, diff: diff, mode: mode, day: day, level: level, time: time, hints: hints });
    const best = MG.getResult(key);
    stage.querySelector('.board').classList.add('solved');
    updateTools();
    MG.sfx('win'); MG.buzz([20, 40, 30]);
    setTimeout(MG.confetti, 120);
    setTimeout(() => {
      const praise = hints ? ['Solved!', 'Nicely done!', 'Got there!', 'Well played!'] : ['Brilliant!', 'Impressive!', 'Sharp mind!', 'Flawless!', 'Superb!'];
      const nx = nextHref(), st = MG.streak();
      const streakLine = mode === 'daily' && day === today ? `<p class="muted">${MG.icon('flame')} Daily streak: <b>${st.current}</b> day${st.current === 1 ? '' : 's'}</p>` : '';
      const allDone = mode === 'daily' && !nx ? '<p class="muted">You finished every puzzle for this day. See you tomorrow!</p>' : '';
      const wm = MG.modal(`
        <div class="pic" style="--pc:${P.color}">${P.icon}</div>
        <div class="eyebrow">${P.name} · ${meta}</div>
        <h3>${praise[Math.floor(Math.random() * praise.length)]}</h3>
        ${out.newBest ? '<span class="newbest">New best time</span>' : ''}
        <div class="statrow">
          <div><b>${MG.fmtTime(time)}</b><span>Time</span></div>
          <div><b>${MG.fmtTime(best.time)}</b><span>Best</span></div>
          <div><b>${hints}</b><span>Hints</span></div>
        </div>
        ${streakLine}${allDone}
        ${nx ? `<a class="btn" href="${nx.href}">${nx.label} ${MG.icon('next')}</a>` : ''}
        ${mode === 'daily' ? `<button type="button" class="btn ghost" id="shareWin">${MG.icon('share')} Share result</button>` : ''}
        <a class="btn ghost" href="${backHref}">${mode === 'journey' ? 'Journey map' : 'Back to puzzles'}</a>`, { dismissable: true });
      const sw = wm.el.querySelector('#shareWin');
      if (sw) sw.addEventListener('click', () => MG.shareDay(day, diff));
    }, 800);
  }

  // first-time tutorial
  const seen = MG.settings().seen || {};
  if (!seen[type]) {
    const m = MG.modal(`
      <div class="pic" style="--pc:${P.color}">${P.icon}</div>
      <div class="eyebrow">New puzzle</div>
      <h3>${P.name}</h3>
      <ol>${P.rules.map((r) => '<li>' + r + '</li>').join('')}</ol>
      <div class="ctl">${P.controls}</div>
      <button type="button" class="btn" id="go">Let’s play</button>`, {
      onClose: () => { const s = MG.settings(); s.seen = Object.assign({}, s.seen, { [type]: true }); MG.save(); start(); }
    });
    m.el.querySelector('#go').addEventListener('click', m.close);
  } else start();
})();
