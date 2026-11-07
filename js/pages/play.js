/* Play page: mounts a puzzle, runs the timer, autosaves, undo/reset/hint, tutorial and the win celebration.
 * Modes: daily (?type&date&diff), journey (?mode=journey&level), practice (?mode=practice&type&level), mix (?mode=mix&level). */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app'), q = new URLSearchParams(location.search), today = MG.today();
  const mode = ['journey', 'practice', 'mix'].indexOf(q.get('mode')) >= 0 ? q.get('mode') : 'daily';
  const s0 = MG.load();
  let type, diff, key, day = null, level = 0, backHref, meta;
  const lvlParam = (max) => Math.max(1, Math.min(max, parseInt(q.get('level'), 10) || max));

  if (mode === 'journey') {
    level = lvlParam(s0.journey.level);
    ({ type, diff } = MG.journeySpec(level));
    key = MG.journeyKey(level);
    backHref = 'journey.html';
    meta = 'Journey · Level ' + level + ' · ' + MG.DIFF_LABEL[diff];
  } else if (mode === 'practice') {
    type = MG.puzzles[q.get('type')] ? q.get('type') : MG.ORDER[0];
    level = lvlParam(MG.practiceLevel(type));
    diff = MG.practiceDiff(level);
    key = MG.practiceKey(type, level);
    backHref = 'index.html';
    meta = 'Level ' + level + ' · ' + MG.DIFF_LABEL[diff];
  } else if (mode === 'mix') {
    level = lvlParam(s0.mix.level);
    ({ type, diff } = MG.mixSpec(level));
    key = MG.mixKey(level);
    backHref = 'index.html';
    meta = 'Mix · Level ' + level + ' · ' + MG.DIFF_LABEL[diff];
  } else {
    day = q.get('date');
    if (!MG.isValidDate(day) || day > today || day < MG.earliestDay()) day = today;
    type = MG.puzzles[q.get('type')] ? q.get('type') : MG.ORDER[0];
    diff = MG.DIFFS.indexOf(q.get('diff')) >= 0 ? q.get('diff') : MG.settings().dailyDiff;
    key = MG.dailyKey(day, type, diff);
    backHref = day === today ? 'daily.html' : 'daily.html?date=' + day;
    meta = MG.DIFF_LABEL[diff] + ' · ' + (day === today ? 'Today' : MG.prettyDate(day, { month: 'short', day: 'numeric' }));
  }

  const P = MG.puzzles[type];
  const par = MG.PAR[type][MG.DIFFS.indexOf(diff)];
  document.title = P.name + ' · MindGrid';
  document.body.style.setProperty('--pc', P.color);
  const puzzle = P.generate(MG.rng(MG.seedFor(key)), diff);

  app.innerHTML = `
    <header class="playbar">
      <a class="iconbtn" href="${backHref}" aria-label="Back">${MG.icon('back')}</a>
      <div class="mid"><div class="name"><span class="pic" style="--pc:${P.color}">${P.icon}</span>${P.name}</div><div class="meta">${meta}</div></div>
      <div class="timer${MG.settings().timer ? '' : ' hidden'}" aria-label="Elapsed time">${MG.icon('clock')}<span id="t">0:00</span></div>
    </header>
    <div class="parline" id="parline"></div>
    <div class="banner" id="banner"></div>
    <div class="stage" id="stage"></div>
    <div class="tools">
      <button type="button" class="tool" id="undo" title="Undo (Ctrl+Z)">${MG.icon('undo')}Undo</button>
      <button type="button" class="tool" id="reset" title="Reset">${MG.icon('reset')}Reset</button>
      <button type="button" class="tool hint" id="hint" title="Hint (H)">${MG.icon('hint')}Hint<span class="count" id="hc"></span></button>
    </div>
    <details class="rules"><summary>${MG.icon('help')} How to play ${P.name}</summary>
      <ol>${P.rules.map((r) => '<li>' + r + '</li>').join('')}</ol><p>${P.controls}</p></details>`;

  const stage = document.getElementById('stage'), tEl = document.getElementById('t'), banner = document.getElementById('banner');
  const parline = document.getElementById('parline');
  const undoBtn = document.getElementById('undo'), resetBtn = document.getElementById('reset'), hintBtn = document.getElementById('hint');
  const hc = document.getElementById('hc');
  let elapsed = 0, hints = 0, undos = 0, running = false, solved = false, lastTick = performance.now();
  const history = [];
  const ctrl = P.mount(stage, puzzle, { changed: changed, sfx: MG.sfx, buzz: MG.buzz });
  const initial = JSON.stringify(ctrl.snapshot());
  history.push(initial);

  const prev = MG.getResult(key), prog = MG.getProgress(key);
  if (prog && prog.snap) {
    ctrl.restore(prog.snap);
    const s = JSON.stringify(ctrl.snapshot());
    if (s !== initial) history.push(s);
    elapsed = prog.elapsed || 0; hints = prog.hints || 0; undos = prog.undos || 0;
  }
  if (prev) banner.innerHTML = 'Best ' + MG.fmtTime(prev.time) + ' ' + MG.stars(MG.getStars(key)) + ' · beat it!';
  updateTools(); tick();

  /** Live target: what you still need for 3 (or 2) stars. */
  var lastTarget = ''; // var: tick() runs (and calls target) before this line
  function target() {
    const t = hints === 0 && elapsed <= par ? [3, par] : hints <= 1 && elapsed <= par * 2 ? [2, par * 2] : [1, 0];
    const txt = t[0] === 1 ? MG.stars(1) + ' Keep going, you’ve got this' : MG.stars(t[0]) + ' Solve within ' + MG.fmtTime(t[1]) +
      (hints === 0 && t[0] === 3 ? ' with no hints' : '');
    if (txt !== lastTarget) { parline.innerHTML = txt; lastTarget = txt; }
  }
  function tick() {
    const now = performance.now();
    if (running && !document.hidden) elapsed += (now - lastTick) / 1000;
    lastTick = now;
    tEl.textContent = MG.fmtTime(elapsed);
    if (!solved) target();
  }
  setInterval(tick, 250);
  function start() { running = true; lastTick = performance.now(); }

  function persist() {
    if (solved) return;
    const snap = ctrl.snapshot();
    if (JSON.stringify(snap) === initial && !hints) { MG.clearProgress(key); return; }
    MG.saveProgress(key, { snap: snap, elapsed: Math.floor(elapsed), hints: hints, undos: undos });
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
    history.pop(); undos++;
    ctrl.restore(JSON.parse(history[history.length - 1]));
    MG.sfx('undo'); updateTools(); persist();
  });
  resetBtn.addEventListener('click', () => {
    if (solved || history[history.length - 1] === initial) return;
    history.push(initial); undos += 2;
    ctrl.restore(JSON.parse(initial));
    MG.sfx('undo'); updateTools(); persist();
  });
  hintBtn.addEventListener('click', () => {
    if (solved) return;
    if (ctrl.hint()) { hints++; MG.sfx('hint'); MG.buzz(15); changed(); target(); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoBtn.click(); }
    else if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) hintBtn.click();
  });

  function nextHref() {
    if (mode === 'journey') return { href: 'play.html?mode=journey&level=' + (level + 1), label: 'Next level' };
    if (mode === 'practice') return { href: 'play.html?mode=practice&type=' + type + '&level=' + (level + 1), label: 'Next level' };
    if (mode === 'mix') return { href: 'play.html?mode=mix&level=' + (level + 1), label: 'Next surprise' };
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
    const out = MG.recordResult(key, { type: type, diff: diff, mode: mode, day: day, level: level, time: time, hints: hints, undos: undos });
    const best = MG.getResult(key);
    if (MG.adsSolved) MG.adsSolved();
    stage.querySelector('.board').classList.add('solved');
    updateTools();
    MG.sfx('win'); MG.buzz([20, 40, 30, 40, 60]);
    parline.innerHTML = '';
    setTimeout(() => MG.confetti(out.stars === 3), 150);
    setTimeout(() => {
      const titles = out.stars === 3 ? ['Perfect!', 'Brilliant!', 'Genius move!', 'Flawless!'] : out.stars === 2 ? ['Great job!', 'Nicely done!', 'Sharp!'] : ['Solved!', 'You did it!', 'Got there!'];
      const nx = nextHref(), st = MG.streak();
      const rankUp = !out.calibrating && out.iqAfter > out.iqBefore && MG.rankOf(out.iqAfter) !== MG.rankOf(out.iqBefore);
      const delta = out.iqAfter - out.iqBefore, reveal = !out.calibrating && out.iqN === 3;
      if (reveal) out.iqBefore = 70; // first reveal: count up from the bottom of the scale
      const streakLine = mode === 'daily' && day === today ? `<p class="muted" style="margin:0 0 10px">${MG.icon('flame')} Daily streak: <b>${st.current}</b> day${st.current === 1 ? '' : 's'}</p>` : '';
      const allDone = mode === 'daily' && !nx ? '<p class="muted">You finished every puzzle for this day. See you tomorrow!</p>' : '';
      const iqHtml = out.calibrating
        ? `<div class="iqbox">${MG.icon('brain')}<div><small>Puzzle IQ</small><b>${3 - out.iqN} more</b><span class="rk">solve${3 - out.iqN === 1 ? 's' : ''} to reveal your Puzzle IQ</span></div></div>`
        : `<div class="iqbox">${MG.icon('brain')}<div><small>Puzzle IQ</small><b id="iqv">${out.iqBefore}</b><span class="rk">${MG.rankOf(out.iqAfter)}</span></div>
            <span class="delta">${reveal ? 'Revealed!' : delta > 0 ? '▲ +' + delta : delta < 0 ? '▼ ' + delta : '= 0'}</span></div>`;
      const wm = MG.modal(`
        <div class="ribbon"><small>${P.name} · ${meta}</small>${titles[Math.floor(Math.random() * titles.length)]}</div>
        <div class="bigstars">${[1, 2, 3].map(() => `<i>${MG.icon('star')}</i>`).join('')}</div>
        <div class="speed">${MG.icon('bolt')} ${out.perf.speed} · ${MG.fmtTime(time)} <span class="muted">(3★ par ${MG.fmtTime(par)})</span></div>
        ${out.newBest ? '<div><span class="newbest">New best time</span></div>' : ''}
        ${iqHtml}
        ${rankUp ? `<div class="levelup">${MG.icon('trophy')} New rank: ${MG.rankOf(out.iqAfter)}</div>` : ''}
        ${out.flow >= 3 ? `<div class="flowtag">🔥 ${out.flow} in a row without hints</div>` : ''}
        <div class="statrow">
          <div><b>${MG.fmtTime(best.time)}</b><span>Best</span></div>
          <div><b>${hints}</b><span>Hints</span></div>
          <div><b>${out.skillAfter}</b><span>${MG.SKILL[type]}</span></div>
        </div>
        ${streakLine}${allDone}
        ${nx ? `<a class="btn" href="${nx.href}">${nx.label} ${MG.icon('next')}</a>` : ''}
        ${mode === 'daily' ? `<button type="button" class="btn ghost" id="shareWin">${MG.icon('share')} Share result</button>` : ''}
        <a class="btn ghost" href="${backHref}">${mode === 'journey' ? 'World map' : mode === 'daily' ? 'Back to puzzles' : 'Home'}</a>`, { dismissable: true, cls: 'win' });
      wm.el.style.setProperty('--pc', P.color);
      // stars pop in one by one
      const starEls = wm.el.querySelectorAll('.bigstars i');
      for (let i = 0; i < out.stars; i++) {
        setTimeout(() => { starEls[i].classList.add('on'); MG.sfx('star' + (i + 1)); MG.buzz(12); }, 350 + i * 330);
      }
      const iqv = wm.el.querySelector('#iqv');
      if (iqv) setTimeout(() => MG.countUp(iqv, out.iqBefore, out.iqAfter, 900), 450 + out.stars * 330);
      if (rankUp) setTimeout(() => { MG.sfx('levelup'); MG.confetti(true); }, 1000 + out.stars * 330);
      const sw = wm.el.querySelector('#shareWin');
      if (sw) sw.addEventListener('click', () => MG.shareDay(day, diff));
      // Between levels: leaving the win screen is the only place an interstitial may appear.
      wm.el.querySelectorAll('a.btn').forEach((a) => a.addEventListener('click', (e) => {
        if (!MG.adsBetweenLevels) return;
        e.preventDefault();
        MG.adsBetweenLevels(() => { location.href = a.href; });
      }));
    }, 900);
  }

  function intro(done) { // Mix Mode: a quick "next up" reveal
    const el = MG.h('div', 'mixintro', `<div class="mi-card" style="--pc:${P.color}"><small>Mix · Level ${level}</small><div class="pic">${P.icon}</div><b>${P.name}</b><span>${MG.DIFF_LABEL[diff]}</span></div>`);
    document.body.appendChild(el);
    MG.sfx('whoosh');
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); done(); }, 300); }, MG.reduced ? 500 : 1300);
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
      <button type="button" class="btn" id="go">Let’s play ${MG.icon('play')}</button>`, {
      onClose: () => { const s = MG.settings(); s.seen = Object.assign({}, s.seen, { [type]: true }); MG.save(); start(); }
    });
    m.el.style.setProperty('--pc', P.color);
    m.el.querySelector('#go').addEventListener('click', m.close);
  } else if (mode === 'mix' && !prog) intro(start);
  else start();
})();
