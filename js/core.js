/* MindGrid core: RNG, dates, storage, modes, Puzzle IQ, stars, theme, sound, haptics, icons, splash, navigation. */
(function () {
  'use strict';
  var MG = (window.MG = window.MG || {});
  MG.VERSION = '1.5.0';
  MG.puzzles = {};
  MG.ORDER = ['blocks', 'pipes', 'link', 'crowns', 'lights', 'balance'];
  MG.EMOJI = { blocks: '🟧', pipes: '🟩', link: '🟥', crowns: '🟪', lights: '🟦', balance: '🟨' };
  MG.DIFFS = ['easy', 'medium', 'hard', 'expert'];
  MG.DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
  MG.SKILL = { blocks: 'Spatial', pipes: 'Flow', link: 'Planning', crowns: 'Deduction', lights: 'Patterns', balance: 'Logic' };
  MG.register = function (p) { if (MG.ART[p.id]) p.icon = MG.ART[p.id]; MG.puzzles[p.id] = p; };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  MG.reduced = reduced;

  /* ---------- Seeded RNG ---------- */
  MG.hash = function (str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  };
  MG.rng = function (seed) {
    var a = typeof seed === 'number' ? seed : MG.hash(String(seed));
    function next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      int: function (n) { return Math.floor(next() * n); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      chance: function (p) { return next() < p; },
      shuffle: function (arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      }
    };
  };

  /* ---------- Dates (local time, YYYY-MM-DD) ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  MG.pad = pad;
  MG.dateKey = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  MG.today = function () { return MG.dateKey(new Date()); };
  MG.parseDate = function (s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  MG.addDays = function (s, n) { var d = MG.parseDate(s); d.setDate(d.getDate() + n); return MG.dateKey(d); };
  MG.isValidDate = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && MG.dateKey(MG.parseDate(s)) === s; };
  MG.prettyDate = function (s, opts) {
    return MG.parseDate(s).toLocaleDateString(undefined, opts || { weekday: 'long', month: 'long', day: 'numeric' });
  };
  MG.earliestDay = function () { return MG.addDays(MG.today(), -365); };
  MG.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(sec);
  };

  /* ---------- Storage ---------- */
  var KEY = 'mindgrid.v1';
  function defaults() {
    return {
      settings: { theme: 'system', sound: true, haptics: true, timer: true, dailyDiff: 'medium', seen: {} },
      results: {}, progress: {}, journey: { level: 1 }, days: {}, log: [],
      practice: {}, mix: { level: 1 }, stars: {}, iq: null,
      form: {}, levels: {}, fps: [], salt: 0 // level director: per-puzzle form, generated levels, fingerprints, player seed
    };
  }
  var mem = null;
  MG.load = function () {
    if (mem) return mem;
    var data = null;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
    var d = defaults();
    if (data && typeof data === 'object') {
      Object.keys(d).forEach(function (k) { if (data[k] !== undefined && data[k] !== null) d[k] = data[k]; });
      d.settings = Object.assign(defaults().settings, data.settings || {});
      if (!d.settings.seen) d.settings.seen = {};
    }
    mem = d;
    if (!mem.iq) migrateIQ();
    return mem;
  };
  MG.save = function () { try { localStorage.setItem(KEY, JSON.stringify(MG.load())); } catch (e) { /* storage unavailable */ } };
  MG.resetAll = function () { mem = defaults(); mem.iq = newIQ(); MG.save(); };
  MG.settings = function () { return MG.load().settings; };
  MG.setSetting = function (k, v) { MG.load().settings[k] = v; MG.save(); if (k === 'theme') MG.applyTheme(); };

  /* ---------- Modes ----------
   * daily    d:<date>:<type>:<diff>   six puzzles a day, same for everyone
   * journey  j:<n>                    endless map cycling through all six puzzles
   * practice p:<type>:<n>             endless levels of ONE puzzle type (Puzzle Modes)
   * mix      m:<n>                    endless random puzzle types, faster difficulty ramp */
  MG.dailyKey = function (date, type, diff) { return 'd:' + date + ':' + type + ':' + diff; };
  MG.journeyKey = function (n) { return 'j:' + n; };
  MG.practiceKey = function (type, n) { return 'p:' + type + ':' + n; };
  MG.mixKey = function (n) { return 'm:' + n; };
  MG.seedFor = function (key) { return MG.hash('mindgrid|' + key); };
  MG.journeyDiff = function (n) { return n <= 10 ? 'easy' : n <= 30 ? 'medium' : n <= 60 ? 'hard' : 'expert'; };
  MG.journeySpec = function (n) { return { type: MG.ORDER[(n - 1) % MG.ORDER.length], diff: MG.journeyDiff(n) }; };
  MG.practiceDiff = function (n) { return n <= 5 ? 'easy' : n <= 15 ? 'medium' : n <= 35 ? 'hard' : 'expert'; };
  MG.practiceLevel = function (type) { return MG.load().practice[type] || 1; };
  MG.mixDiff = function (n) { return n <= 4 ? 'easy' : n <= 12 ? 'medium' : n <= 28 ? 'hard' : 'expert'; };
  var mixCache = [0];
  MG.mixSpec = function (n) { // never the same puzzle twice in a row
    for (var k = mixCache.length; k <= n; k++) {
      mixCache[k] = k === 1 ? MG.hash('mix|1') % 6 : (mixCache[k - 1] + 1 + MG.hash('mix|' + k) % 5) % 6;
    }
    return { type: MG.ORDER[mixCache[n]], diff: MG.mixDiff(n) };
  };
  /** Stars needed on the map: 3 per level. */
  MG.getStars = function (key) { return MG.load().stars[key] || 0; };

  MG.getResult = function (key) { return MG.load().results[key] || null; };
  MG.getProgress = function (key) { return MG.load().progress[key] || null; };
  MG.saveProgress = function (key, p) { MG.load().progress[key] = p; MG.save(); };
  MG.clearProgress = function (key) { delete MG.load().progress[key]; MG.save(); };

  /* ---------- Puzzle IQ ----------
   * A for-fun rating (not a clinical IQ test). Every solve gets a performance score from:
   *  - difficulty (harder puzzles carry a higher base),
   *  - speed against a par time for that puzzle and difficulty,
   *  - hints used, and accuracy (how many moves were undone),
   *  - a small "flow" bonus for solving several in a row without hints.
   * Your Puzzle IQ moves toward each performance (bigger steps while it is calibrating), so it reflects
   * how you play now. Each puzzle also has its own skill rating. */
  MG.PAR = { // seconds: easy, medium, hard, expert
    blocks: [40, 75, 150, 260], pipes: [35, 70, 140, 240], link: [30, 60, 120, 210],
    crowns: [45, 90, 180, 300], lights: [25, 50, 100, 170], balance: [50, 100, 190, 320]
  };
  var DBASE = { easy: 92, medium: 104, hard: 116, expert: 128 };
  /* Continuous difficulty d (0..100). The four classic tiers sit at d = 12 / 37 / 62 / 87, so every
   * generator setting and par time is interpolated between values that were already tuned for those tiers. */
  MG.TIER_D = { easy: 12, medium: 37, hard: 62, expert: 87 };
  MG.tierLerp = function (d, v) {
    var x = (d - 12) / 25, i = Math.max(0, Math.min(2, Math.floor(x)));
    return v[i] + (v[i + 1] - v[i]) * (x - i); // extrapolates gently below 'easy' and above 'expert'
  };
  MG.dLabel = function (d) { return d < 25 ? 'easy' : d < 50 ? 'medium' : d < 75 ? 'hard' : 'expert'; };
  MG.parFor = function (type, d) { return Math.max(12, Math.round(MG.tierLerp(d, MG.PAR[type] || MG.PAR.blocks))); };
  MG.RANKS = [[0, 'Rising Thinker'], [90, 'Curious Mind'], [100, 'Sharp Thinker'], [110, 'Quick Wit'],
    [120, 'Brilliant Mind'], [130, 'Genius'], [140, 'Mastermind'], [150, 'Grand Master']];
  MG.rankOf = function (iq) { var r = MG.RANKS[0]; MG.RANKS.forEach(function (x) { if (iq >= x[0]) r = x; }); return r[1]; };
  MG.nextRank = function (iq) { for (var i = 0; i < MG.RANKS.length; i++) if (MG.RANKS[i][0] > iq) return MG.RANKS[i]; return null; };
  function newIQ() { return { score: 100, n: 0, flow: 0, hist: [], skills: {} }; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /** Performance of one solve: {score, stars, ratio, speed:'Lightning'|'Fast'|'Steady'|'Careful'}. */
  MG.perf = function (type, diff, time, hints, undos, flow, d) {
    if (d == null) d = MG.TIER_D[diff] != null ? MG.TIER_D[diff] : 37;
    var par = MG.parFor(type, d);
    var ratio = time / par;
    var sp = ratio <= 0.4 ? 1 : ratio <= 1 ? 1 - (ratio - 0.4) / 0.6 : ratio >= 3 ? -1 : -(ratio - 1) / 2;
    var score = 87.2 + d * 0.48 + sp * 22 - Math.min(hints, 4) * 7 - Math.min(8, Math.max(0, (undos || 0) - 5) * 0.8) +
      (hints ? 0 : Math.min(6, (flow || 0) * 1.5));
    var stars = !hints && ratio <= 1 ? 3 : hints <= 1 && ratio <= 2 ? 2 : 1;
    var speed = ratio <= 0.5 ? 'Lightning' : ratio <= 1 ? 'Fast' : ratio <= 2 ? 'Steady' : 'Careful';
    return { score: clamp(score, 60, 170), stars: stars, ratio: ratio, speed: speed, par: par };
  };
  function applyIQ(iq, type, p, at) {
    var K = iq.n < 5 ? 0.4 : iq.n < 20 ? 0.2 : 0.1;
    iq.score = clamp(iq.score + K * (p.score - iq.score), 70, 160);
    var sk = iq.skills[type] || (iq.skills[type] = { score: 100, n: 0 });
    var K2 = sk.n < 3 ? 0.5 : sk.n < 10 ? 0.25 : 0.15;
    sk.score = clamp(sk.score + K2 * (p.score - sk.score), 70, 160); sk.n++;
    iq.n++;
    var last = iq.hist[iq.hist.length - 1];
    if (last && last.at === at) last.v = Math.round(iq.score); else iq.hist.push({ at: at, v: Math.round(iq.score) });
    if (iq.hist.length > 90) iq.hist = iq.hist.slice(-90);
  }
  function migrateIQ() { // existing players: build their IQ from the solve log they already have
    var iq = newIQ();
    (mem.log || []).forEach(function (e) {
      if (!e || !MG.PAR[e.type] || !DBASE[e.diff]) return;
      var p = MG.perf(e.type, e.diff, e.time || 60, e.hints || 0, 0, e.hints ? 0 : iq.flow);
      iq.flow = e.hints ? 0 : iq.flow + 1;
      applyIQ(iq, e.type, p, e.at || MG.today());
    });
    mem.iq = iq;
  }
  MG.iq = function () {
    var iq = MG.load().iq, v = Math.round(iq.score);
    return { score: v, n: iq.n, calibrating: iq.n < 3, rank: MG.rankOf(v), next: MG.nextRank(v), skills: iq.skills, hist: iq.hist };
  };

  /** info: {type, diff, mode, day, level, time, hints, undos}. */
  MG.recordResult = function (key, info) {
    var s = MG.load(), prev = s.results[key] || null, today = MG.today();
    var rec = { type: info.type, diff: info.diff, mode: info.mode, day: info.day || null,
      time: info.time, hints: info.hints, at: today, plays: (prev ? prev.plays || 1 : 0) + 1 };
    if (prev && prev.time <= info.time) { rec.time = prev.time; rec.hints = prev.hints; }
    s.results[key] = rec;
    if (!prev && info.mode === 'daily' && info.day === today) s.days[today] = (s.days[today] || 0) + 1;
    if (info.mode === 'journey' && info.level >= s.journey.level) s.journey.level = info.level + 1;
    if (info.mode === 'practice' && info.level >= (s.practice[info.type] || 1)) s.practice[info.type] = info.level + 1;
    if (info.mode === 'mix' && info.level >= s.mix.level) s.mix.level = info.level + 1;
    s.log.push({ type: info.type, diff: info.diff, time: info.time, hints: info.hints, at: today, mode: info.mode });
    if (s.log.length > 1000) s.log = s.log.slice(-1000);
    delete s.progress[key];

    var iq = s.iq, before = Math.round(iq.score), skillBefore = Math.round((iq.skills[info.type] || { score: 100 }).score);
    var p = MG.perf(info.type, info.diff, info.time, info.hints, info.undos, iq.flow, info.d);
    iq.flow = info.hints ? 0 : iq.flow + 1;
    applyIQ(iq, info.type, p, today);
    // "form": how the player is doing on this puzzle right now. Feeds the level director (js/levels.js).
    var fd = (p.stars === 3 ? (p.ratio < 0.6 ? 6 : 4) : p.stars === 2 ? 1 : -5) - Math.min(info.hints, 3) * 2;
    var formBefore = s.form[info.type] || 0;
    s.form[info.type] = clamp(Math.round(formBefore * 0.8 + fd), -20, 20);
    var starsBefore = s.stars[key] || 0;
    if (p.stars > starsBefore) s.stars[key] = p.stars;
    MG.save();
    return {
      newBest: !!prev && info.time < prev.time, prev: prev, perf: p, stars: p.stars, starsBefore: starsBefore,
      iqBefore: before, iqAfter: Math.round(iq.score), calibrating: iq.n < 3, iqN: iq.n,
      skillBefore: skillBefore, skillAfter: Math.round(iq.skills[info.type].score), flow: iq.flow,
      formDelta: s.form[info.type] - formBefore
    };
  };

  MG.daySolvedTypes = function (day) {
    var res = MG.load().results, out = {};
    MG.ORDER.forEach(function (t) {
      MG.DIFFS.forEach(function (d) { if (res[MG.dailyKey(day, t, d)]) out[t] = true; });
    });
    return out;
  };

  MG.streak = function () {
    var days = MG.load().days, cur = 0, d = MG.today();
    if (!days[d]) d = MG.addDays(d, -1);
    while (days[d]) { cur++; d = MG.addDays(d, -1); }
    var keys = Object.keys(days).sort(), best = 0, run = 0, prevKey = null;
    keys.forEach(function (k) {
      run = prevKey && MG.addDays(prevKey, 1) === k ? run + 1 : 1;
      if (run > best) best = run;
      prevKey = k;
    });
    return { current: cur, best: Math.max(best, cur), today: !!days[MG.today()] };
  };

  /* ---------- Theme ---------- */
  MG.applyTheme = function () {
    var t = MG.settings().theme, root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
  };
  MG.applyTheme();

  /* ---------- Sound & haptics (synthesised, no audio files) ---------- */
  var actx = null;
  // [freq, start, length, wave?, volume?]
  var NOTES = {
    tap: [[660, 0, 0.05, 'triangle', 0.08]],
    place: [[523, 0, 0.07, 'triangle'], [784, 0.04, 0.09, 'sine', 0.06]],
    undo: [[392, 0, 0.07, 'triangle', 0.07]],
    error: [[196, 0, 0.12, 'square', 0.04], [174, 0.07, 0.14, 'square', 0.035]],
    hint: [[740, 0, 0.08], [988, 0.08, 0.14]],
    win: [[523, 0, 0.16, 'triangle'], [659, 0.09, 0.16, 'triangle'], [784, 0.18, 0.16, 'triangle'], [1047, 0.27, 0.42, 'triangle'],
      [523, 0.27, 0.42, 'sine', 0.05], [659, 0.27, 0.42, 'sine', 0.05], [1568, 0.36, 0.3, 'sine', 0.03]],
    star1: [[880, 0, 0.18, 'triangle'], [1320, 0.02, 0.2, 'sine', 0.04]],
    star2: [[988, 0, 0.18, 'triangle'], [1480, 0.02, 0.2, 'sine', 0.04]],
    star3: [[1175, 0, 0.26, 'triangle'], [1760, 0.02, 0.3, 'sine', 0.05]],
    levelup: [[392, 0, 0.12, 'triangle'], [523, 0.1, 0.12, 'triangle'], [659, 0.2, 0.12, 'triangle'], [784, 0.3, 0.12, 'triangle'],
      [1047, 0.4, 0.5, 'triangle'], [1319, 0.4, 0.5, 'sine', 0.04]],
    tick: [[1200, 0, 0.03, 'sine', 0.035]],
    whoosh: [[300, 0, 0.18, 'sine', 0.04], [600, 0.05, 0.16, 'sine', 0.03]]
  };
  MG.sfx = function (kind) {
    if (!MG.settings().sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var t0 = actx.currentTime;
      (NOTES[kind] || []).forEach(function (n) {
        var o = actx.createOscillator(), g = actx.createGain(), vol = n[4] || 0.09;
        o.type = n[3] || 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(vol, t0 + n[1] + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
        o.connect(g); g.connect(actx.destination);
        o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + 0.03);
      });
    } catch (e) { /* audio unavailable */ }
  };
  MG.buzz = function (pattern) {
    if (!MG.settings().haptics || !navigator.vibrate) return;
    try { navigator.vibrate(pattern || 8); } catch (e) { /* ignore */ }
  };

  /* ---------- DOM helpers ---------- */
  MG.h = function (tag, cls, html) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined) el.innerHTML = html;
    return el;
  };
  MG.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  /** Cell under a pointer event for an element split into rows x cols. */
  MG.cellAt = function (el, e, rows, cols, clamp) {
    var b = el.getBoundingClientRect();
    var c = Math.floor(((e.clientX - b.left) / b.width) * cols);
    var r = Math.floor(((e.clientY - b.top) / b.height) * rows);
    if (clamp) {
      r = Math.max(0, Math.min(rows - 1, r)); c = Math.max(0, Math.min(cols - 1, c));
    } else if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
    return { r: r, c: c };
  };
  /** Animate a number in an element from a to b. */
  MG.countUp = function (el, a, b, ms, fmt) {
    fmt = fmt || function (v) { return Math.round(v); };
    if (reduced || a === b) { el.textContent = fmt(b); return; }
    var t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(a + (b - a) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  };

  /* ---------- Puzzle art: colourful animated tiles (white art on the puzzle colour) ---------- */
  MG.ART = {
    blocks: '<svg class="art art-blocks" viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="6" width="16" height="11" rx="3" fill="#fff"/>' +
      '<rect class="a-slide" x="25" y="6" width="9" height="28" rx="3" fill="#fff" fill-opacity=".62"/><rect x="6" y="20" width="16" height="14" rx="3" fill="#fff" fill-opacity=".85"/>' +
      '<text x="14" y="30.6" text-anchor="middle" font-size="9.5" font-weight="900" fill="var(--pc)" font-family="system-ui,sans-serif">6</text></svg>',
    pipes: '<svg class="art art-pipes" viewBox="0 0 40 40" fill="none" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M7 20h13v13M20 20V7M20 20h13" stroke="#fff" stroke-opacity=".45" stroke-width="7"/>' +
      '<path class="a-flow" d="M7 20h13v13M20 20V7M20 20h13" stroke="#fff" stroke-width="3" stroke-dasharray="3 5"/>' +
      '<circle cx="20" cy="20" r="6" fill="#fff"/><circle class="a-pulse" cx="20" cy="20" r="2.6" fill="var(--pc)"/></svg>',
    link: '<svg class="art art-link" viewBox="0 0 40 40" fill="none" aria-hidden="true">' +
      '<path d="M9 9h22v11H9v11h22" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path class="a-draw" d="M9 9h22v11H9v11h22" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" pathLength="100"/>' +
      '<circle cx="9" cy="9" r="5.4" fill="#fff"/><circle cx="31" cy="31" r="5.4" fill="#fff"/>' +
      '<text x="9" y="12.2" text-anchor="middle" font-size="8.5" font-weight="900" fill="var(--pc)" font-family="system-ui,sans-serif">1</text>' +
      '<text x="31" y="34.2" text-anchor="middle" font-size="8.5" font-weight="900" fill="var(--pc)" font-family="system-ui,sans-serif">9</text></svg>',
    crowns: '<svg class="art art-crowns" viewBox="0 0 40 40" aria-hidden="true"><g class="a-bob">' +
      '<path d="M7 15l7 5.5L20 9.5l6 11L33 15l-3 15H10z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<rect x="10" y="31.5" width="20" height="3.6" rx="1.8" fill="#fff" fill-opacity=".7"/>' +
      '<circle cx="20" cy="23.5" r="2.6" fill="var(--pc)"/><circle cx="14" cy="25" r="1.7" fill="var(--pc)" fill-opacity=".7"/><circle cx="26" cy="25" r="1.7" fill="var(--pc)" fill-opacity=".7"/></g>' +
      '<path class="a-twinkle" d="M32.5 4l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8L28.5 8l2.8-1.2z" fill="#fff"/></svg>',
    lights: '<svg class="art art-lights" viewBox="0 0 40 40" aria-hidden="true">' +
      '<rect x="4.5" y="4.5" width="9" height="9" rx="2.6" fill="#fff" fill-opacity=".2"/><rect x="26.5" y="4.5" width="9" height="9" rx="2.6" fill="#fff" fill-opacity=".2"/>' +
      '<rect x="4.5" y="26.5" width="9" height="9" rx="2.6" fill="#fff" fill-opacity=".2"/><rect x="26.5" y="26.5" width="9" height="9" rx="2.6" fill="#fff" fill-opacity=".2"/>' +
      '<rect class="a-glow g1" x="15.5" y="4.5" width="9" height="9" rx="2.6" fill="#fff"/><rect class="a-glow g2" x="4.5" y="15.5" width="9" height="9" rx="2.6" fill="#fff"/>' +
      '<rect class="a-glow g2" x="26.5" y="15.5" width="9" height="9" rx="2.6" fill="#fff"/><rect class="a-glow g1" x="15.5" y="26.5" width="9" height="9" rx="2.6" fill="#fff"/>' +
      '<rect x="15.5" y="15.5" width="9" height="9" rx="2.6" fill="#fff"/></svg>',
    balance: '<svg class="art art-balance" viewBox="0 0 40 40" aria-hidden="true"><g class="a-spin">' +
      '<circle cx="14" cy="20" r="5.6" fill="#fff"/><path d="M14 9.6v2.6M14 27.8v2.6M3.6 20h2.6M21.8 20h2.6M6.6 12.6l1.8 1.8M19.6 25.6l1.8 1.8M6.6 27.4l1.8-1.8M19.6 14.4l1.8-1.8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></g>' +
      '<path class="a-rock" d="M31 10.5a9.5 9.5 0 1 0 6.2 16.6A8 8 0 0 1 31 10.5z" fill="#fff" fill-opacity=".85"/></svg>',
    mix: '<svg class="art art-mix" viewBox="0 0 40 40" aria-hidden="true">' +
      '<rect class="a-hop h1" x="5" y="5" width="13" height="13" rx="4" fill="#ffb02e"/><rect class="a-hop h2" x="22" y="5" width="13" height="13" rx="4" fill="#22d3a6"/>' +
      '<rect class="a-hop h3" x="5" y="22" width="13" height="13" rx="4" fill="#a78bfa"/><rect class="a-hop h4" x="22" y="22" width="13" height="13" rx="6.5" fill="#ff5c7a"/>' +
      '<path d="M15 20h10M21.5 16.5L25 20l-3.5 3.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ---------- UI icons (duotone, rounded) ---------- */
  var ICON_PATHS = {
    home: '<path class="fd" d="M5 10.5L12 4.6l7 5.9V20H5z"/><path d="M3 12l9-8 9 8"/><path d="M5.5 10.3V20h13v-9.7"/><path d="M10 20v-5.2h4V20"/>',
    journey: '<path class="fd" d="M13 3.5h7l-2 3 2 3h-7z"/><path d="M13 21V3.5h7l-2 3 2 3h-7"/><path d="M3.5 21c2.5-5.5 6-1 8-6" stroke-dasharray="2.2 2.6"/>',
    daily: '<rect class="fd" x="3.5" y="5" width="17" height="15.5" rx="3.5"/><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>' +
      '<path class="fl" d="M12 11.8l1.3 2.6 2.8.4-2 2 .5 2.8-2.6-1.4-2.6 1.4.5-2.8-2-2 2.8-.4z" stroke-width="1"/>',
    archive: '<rect class="fd" x="3.5" y="5" width="17" height="15.5" rx="3.5"/><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01"/>',
    stats: '<path class="fd" d="M3.5 17a8.5 8.5 0 0 1 17 0z"/><path d="M3.5 17a8.5 8.5 0 0 1 17 0"/><path d="M12 17l4.2-5.2"/><circle class="fl" cx="12" cy="17" r="1.8"/><path d="M3 20.5h18"/>',
    settings: '<circle class="fd" cx="12" cy="12" r="8.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/><circle cx="12" cy="12" r="5.6"/><circle class="fl" cx="12" cy="12" r="2"/>',
    back: '<path d="M15 5l-7 7 7 7" stroke-width="2.6"/>',
    next: '<path d="M9 5l7 7-7 7" stroke-width="2.6"/>',
    hint: '<path class="fd" d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/><path d="M9 18.5h6M10 21.5h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/><path d="M12 7.5l-1.6 3h3.2L12 13.5"/>',
    undo: '<path d="M9 14L4 9l5-5" stroke-width="2.4"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" stroke-width="2.4"/>',
    reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" stroke-width="2.4"/><path d="M3.5 3.5v5h5" stroke-width="2.4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.8"/>',
    flame: '<path class="fl" d="M12 22c4 0 7-2.7 7-6.5 0-3-1.8-5-3.5-6.8-.5 1.8-1.5 3-3 3.3.6-3.3-.6-6.5-3.5-9-.3 3-1.8 5-3.5 7C4.3 11.8 5 13.7 5 15.5 5 19.3 8 22 12 22z"/><path class="fd2" d="M12 22c-2 0-3.2-1.4-3.2-3.2 0-2 1.8-3 3-4.8.6 1.6 3.4 2.4 3.4 4.8 0 1.8-1.2 3.2-3.2 3.2z"/>',
    lock: '<rect class="fd" x="5" y="11" width="14" height="10" rx="2.5"/><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11M12 15v2"/>',
    help: '<circle class="fd" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.7M12 17h.01"/>',
    play: '<path class="fl" d="M8 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8c.6-.4.6-1.2 0-1.6l-10-6.8C8.9 3.9 8 4.4 8 5.2z"/>',
    clock: '<circle class="fd" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/>',
    trophy: '<path class="fd" d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/>',
    star: '<path class="fl" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" stroke-width="1.2"/>',
    brain: '<path class="fd" d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3.2 3.2 0 0 0 2 5 3 3 0 0 0 6 .5V6a2.5 2.5 0 0 0-3-1.5zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3.2 3.2 0 0 1-2 5 3 3 0 0 1-6 .5V6a2.5 2.5 0 0 1 3-1.5z"/>' +
      '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3.2 3.2 0 0 0 2 5 3 3 0 0 0 6 .5V6a2.5 2.5 0 0 0-3-1.5zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3.2 3.2 0 0 1-2 5 3 3 0 0 1-6 .5V6a2.5 2.5 0 0 1 3-1.5zM6 12.5h2.5M15.5 12.5H18M9 8.5h.5M14.5 15.5h.5"/>',
    bolt: '<path class="fl" d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z" stroke-width="1.4"/>',
    mix: '<path d="M3.5 7h3.5c4.5 0 5.5 10 10 10h3.5M3.5 17h3.5c1.8 0 3-1.5 4-3.2M20.5 7H17c-1.8 0-3 1.5-4 3.2M17.5 4l3 3-3 3M17.5 14l3 3-3 3" stroke-width="2.2"/>'
  };
  MG.icon = function (name, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[name] || '') + '</svg>';
  };
  MG.LOGO = '<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lgbg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#2a1f6e"/><stop offset="1" stop-color="#120d33"/></linearGradient></defs>' +
    '<rect width="64" height="64" rx="17" fill="url(#lgbg)"/>' +
    '<rect class="lt t1" x="12" y="12" width="18" height="18" rx="5" fill="#ffb02e"/><rect class="lt t2" x="34" y="12" width="18" height="18" rx="5" fill="#22d3a6"/>' +
    '<rect class="lt t3" x="12" y="34" width="18" height="18" rx="5" fill="#a78bfa"/><rect class="lt t4" x="34" y="34" width="18" height="18" rx="9" fill="#ff5c7a"/></svg>';
  MG.stars = function (n, max) {
    var out = '';
    for (var i = 1; i <= (max || 3); i++) out += '<i class="st' + (i <= n ? ' on' : '') + '">' + MG.icon('star') + '</i>';
    return '<span class="stars">' + out + '</span>';
  };

  /* ---------- Navigation ---------- */
  MG.renderTabs = function (active) {
    var tabs = [['index.html', 'home', 'Home'], ['journey.html', 'journey', 'Journey'], ['daily.html', 'daily', 'Daily'],
      ['stats.html', 'stats', 'IQ'], ['settings.html', 'settings', 'Settings']];
    var nav = MG.h('nav', 'tabbar');
    nav.setAttribute('aria-label', 'Main');
    nav.innerHTML = tabs.map(function (t) {
      return '<a href="' + t[0] + '" class="tab tab-' + t[1] + (t[1] === active ? ' active' : '') + '"' +
        (t[1] === active ? ' aria-current="page"' : '') + '><span class="tb">' + MG.icon(t[1]) + '</span><span>' + t[2] + '</span></a>';
    }).join('');
    document.body.appendChild(nav);
  };

  MG.modal = function (html, opts) {
    opts = opts || {};
    var back = MG.h('div', 'modal-back'), box = MG.h('div', 'modal' + (opts.cls ? ' ' + opts.cls : ''), html);
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    back.appendChild(box);
    document.body.appendChild(back);
    function close() { back.classList.add('out'); setTimeout(function () { back.remove(); }, 160); if (opts.onClose) opts.onClose(); }
    if (opts.dismissable !== false) back.addEventListener('click', function (e) { if (e.target === back) close(); });
    return { el: box, close: close };
  };

  /** Confetti burst from a point (defaults to upper middle) in the puzzle colours. */
  MG.confetti = function (big) {
    if (reduced) return;
    var colors = ['#ffb02e', '#22d3a6', '#ff5c7a', '#a78bfa', '#38bdf8', '#ffd43b', '#ffffff'];
    var layer = MG.h('div', 'confetti'), n = big ? 110 : 70;
    for (var i = 0; i < n; i++) {
      var p = MG.h('i', 'c' + (i % 3)), ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * (big ? 320 : 240);
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang) * dist * 0.75 - 80 + 'px');
      p.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
      p.style.animationDelay = Math.random() * 0.12 + 's';
      p.style.animationDuration = 1.3 + Math.random() * 0.9 + 's';
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 2600);
  };

  /* ---------- Splash: MZA Games, then MindGrid (once per app session) ---------- */
  var splashing = false, afterQ = [];
  /** Run cb once the intro splash (if any) has finished, so tours never start underneath it. */
  MG.afterSplash = function (cb) {
    function go() { if (splashing) afterQ.push(cb); else cb(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(go, 0); });
    else setTimeout(go, 0);
  };
  function splashEnded() { splashing = false; var q = afterQ; afterQ = []; q.forEach(function (f) { f(); }); }
  MG.splash = function (force) {
    var seen = false;
    try { seen = sessionStorage.getItem('mindgrid.splash') === '1'; sessionStorage.setItem('mindgrid.splash', '1'); } catch (e) { /* ignore */ }
    if (seen && !force) return;
    splashing = true;
    var el = MG.h('div', 'splash', '<div class="sp-studio"><img src="assets/mza-games-logo.png" alt="MZA Games"><span>presents</span></div>' +
      '<div class="sp-game">' + MG.LOGO + '<h1 class="sp-title"><span>Mind</span><span>Grid</span></h1>' +
      '<p class="sp-tag">Train your brain. Raise your Puzzle IQ.</p><div class="sp-load"><i></i></div><p class="sp-tip"></p></div>');
    var tips = ['Tip: solve without hints to earn 3 stars', 'Tip: faster solves raise your Puzzle IQ', 'Tip: try Mix Mode for a surprise every level',
      'Tip: a daily puzzle keeps your streak alive'];
    el.querySelector('.sp-tip').textContent = tips[Math.floor(Math.random() * tips.length)];
    document.body.appendChild(el);
    var done = false;
    function end() { if (done) return; done = true; el.classList.add('out'); setTimeout(function () { el.remove(); splashEnded(); }, 420); }
    el.addEventListener('click', end);
    if (reduced) { el.classList.add('step2'); setTimeout(end, 900); return; }
    setTimeout(function () { el.classList.add('step2'); MG.sfx('whoosh'); }, 1300);
    setTimeout(end, 3000);
  };
  /** Shown just before an interstitial ad (see ads.js). */
  MG.adBreakCard = function () {
    var el = MG.h('div', 'adbreak', '<div class="ab-card">' + MG.LOGO + '<b>Quick ad break</b><span>MindGrid stays free thanks to ads.<br>Your next level is ready right after.</span><div class="sp-load"><i></i></div>' +
      '<small>MindGrid · by MZA Games</small></div>');
    document.body.appendChild(el);
    return el;
  };

  /* ---------- Sharing ---------- */
  MG.siteUrl = function () { return new URL('./', location.href).href; };
  MG.shareText = function (day, diff) {
    var solved = 0;
    var lines = MG.ORDER.map(function (t) {
      var r = MG.getResult(MG.dailyKey(day, t, diff));
      if (r) solved++;
      return (r ? MG.EMOJI[t] : '⬜') + ' ' + MG.puzzles[t].name + ' ' +
        (r ? MG.fmtTime(r.time) + (r.hints ? ' 💡' + r.hints : '') : '–');
    });
    var iq = MG.iq();
    return 'MindGrid · ' + MG.prettyDate(day, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' +
      MG.DIFF_LABEL[diff] + '\n' + solved + '/' + MG.ORDER.length + ' solved' + (iq.calibrating ? '' : ' · Puzzle IQ ' + iq.score) +
      '\n' + lines.join('\n') + '\n' + MG.siteUrl();
  };
  /** Native share sheet when available, otherwise clipboard. Resolves 'shared' | 'copied' | 'cancelled' | 'failed'. */
  MG.share = function (text) {
    function legacyCopy() {
      var ta = MG.h('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok ? 'copied' : 'failed';
    }
    function copy() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { return 'copied'; }, legacyCopy);
      }
      return Promise.resolve(legacyCopy());
    }
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (navigator.share && touch) {
      return navigator.share({ text: text }).then(function () { return 'shared'; }, function (e) {
        return e && e.name === 'AbortError' ? 'cancelled' : copy();
      });
    }
    return copy();
  };
  MG.toast = function (msg) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = MG.h('div', 'toast', MG.esc(msg));
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 250); }, 2200);
  };
  MG.shareDay = function (day, diff) {
    var text = MG.shareText(day, diff);
    return MG.share(text).then(function (res) {
      if (res === 'copied') MG.toast('Result copied to clipboard');
      else if (res === 'failed') {
        var m = MG.modal('<h3>Your result</h3><p class="muted">Copy this and paste it anywhere.</p>' +
          '<textarea class="sharebox" readonly rows="9">' + MG.esc(text) + '</textarea>' +
          '<button type="button" class="btn" id="shareDone">Done</button>');
        var box = m.el.querySelector('textarea');
        box.focus(); box.select();
        m.el.querySelector('#shareDone').addEventListener('click', m.close);
      }
      return res;
    });
  };

  /* ---------- App start ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    if (/page-(home|daily|journey|archive|stats|settings|howto)/.test(document.body.className)) MG.splash();
  });

  /* ---------- Offline (service worker) ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) &&
      !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
