/* MindGrid core: RNG, dates, storage, theme, sound, haptics, icons, navigation. */
(function () {
  'use strict';
  var MG = (window.MG = window.MG || {});
  MG.VERSION = '1.3.0';
  MG.puzzles = {};
  MG.ORDER = ['blocks', 'pipes', 'link', 'crowns', 'lights', 'balance'];
  MG.EMOJI = { blocks: '🟧', pipes: '🟩', link: '🟥', crowns: '🟪', lights: '🟦', balance: '🟨' };
  MG.DIFFS = ['easy', 'medium', 'hard', 'expert'];
  MG.DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
  MG.register = function (p) { MG.puzzles[p.id] = p; };

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
      results: {}, progress: {}, journey: { level: 1 }, days: {}, log: []
    };
  }
  var mem = null;
  MG.load = function () {
    if (mem) return mem;
    var data = null;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
    var d = defaults();
    if (data && typeof data === 'object') {
      Object.keys(d).forEach(function (k) { if (data[k] !== undefined) d[k] = data[k]; });
      d.settings = Object.assign(defaults().settings, data.settings || {});
      if (!d.settings.seen) d.settings.seen = {};
    }
    mem = d;
    return mem;
  };
  MG.save = function () { try { localStorage.setItem(KEY, JSON.stringify(MG.load())); } catch (e) { /* storage unavailable */ } };
  MG.resetAll = function () { mem = defaults(); MG.save(); };
  MG.settings = function () { return MG.load().settings; };
  MG.setSetting = function (k, v) { MG.load().settings[k] = v; MG.save(); if (k === 'theme') MG.applyTheme(); };

  MG.dailyKey = function (date, type, diff) { return 'd:' + date + ':' + type + ':' + diff; };
  MG.journeyKey = function (n) { return 'j:' + n; };
  MG.seedFor = function (key) { return MG.hash('mindgrid|' + key); };
  MG.journeyDiff = function (n) { return n <= 10 ? 'easy' : n <= 30 ? 'medium' : n <= 60 ? 'hard' : 'expert'; };
  MG.journeySpec = function (n) { return { type: MG.ORDER[(n - 1) % MG.ORDER.length], diff: MG.journeyDiff(n) }; };

  MG.getResult = function (key) { return MG.load().results[key] || null; };
  MG.getProgress = function (key) { return MG.load().progress[key] || null; };
  MG.saveProgress = function (key, p) { MG.load().progress[key] = p; MG.save(); };
  MG.clearProgress = function (key) { delete MG.load().progress[key]; MG.save(); };

  /** info: {type, diff, mode, day, level, time, hints}. Returns {newBest, prev}. */
  MG.recordResult = function (key, info) {
    var s = MG.load(), prev = s.results[key] || null, today = MG.today();
    var rec = { type: info.type, diff: info.diff, mode: info.mode, day: info.day || null,
      time: info.time, hints: info.hints, at: today, plays: (prev ? prev.plays || 1 : 0) + 1 };
    if (prev && prev.time <= info.time) { rec.time = prev.time; rec.hints = prev.hints; }
    s.results[key] = rec;
    if (!prev && info.mode === 'daily' && info.day === today) s.days[today] = (s.days[today] || 0) + 1;
    if (info.mode === 'journey' && info.level >= s.journey.level) s.journey.level = info.level + 1;
    s.log.push({ type: info.type, diff: info.diff, time: info.time, hints: info.hints, at: today, mode: info.mode });
    if (s.log.length > 1000) s.log = s.log.slice(-1000);
    delete s.progress[key];
    MG.save();
    return { newBest: !!prev && info.time < prev.time, prev: prev };
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

  /* ---------- Sound & haptics ---------- */
  var actx = null;
  var NOTES = {
    tap: [[620, 0, 0.05]], place: [[520, 0, 0.07]], undo: [[360, 0, 0.07]], error: [[190, 0, 0.14]],
    hint: [[740, 0, 0.08], [990, 0.08, 0.12]],
    win: [[523, 0, 0.14], [659, 0.1, 0.14], [784, 0.2, 0.14], [1047, 0.3, 0.3]]
  };
  MG.sfx = function (kind) {
    if (!MG.settings().sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var t0 = actx.currentTime;
      (NOTES[kind] || []).forEach(function (n) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(0.1, t0 + n[1] + 0.012);
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

  /* ---------- Icons ---------- */
  var ICON_PATHS = {
    today: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><circle cx="12" cy="15" r="2"/>',
    journey: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    archive: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h1M11.5 13.5h1M15.5 13.5h1M7.5 17h1M11.5 17h1"/>',
    stats: '<path d="M5 20v-8M12 20V5M19 20v-5"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-6.5 0-3-1.8-5-3.5-6.8-.5 1.8-1.5 3-3 3.3.6-3.3-.6-6.5-3.5-9-.3 3-1.8 5-3.5 7C4.3 11.8 5 13.7 5 15.5 5 19.3 8 22 12 22z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.7M12 17h.01"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/>'
  };
  MG.icon = function (name, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[name] || '') + '</svg>';
  };
  MG.LOGO = '<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="var(--text)"/>' +
    '<rect x="13" y="13" width="17" height="17" rx="4" fill="var(--c-blocks)"/><rect x="34" y="13" width="17" height="17" rx="4" fill="var(--c-pipes)"/>' +
    '<rect x="13" y="34" width="17" height="17" rx="4" fill="var(--c-crowns)"/><rect x="34" y="34" width="17" height="17" rx="8.5" fill="var(--c-link)"/></svg>';

  /* ---------- Navigation ---------- */
  MG.renderTabs = function (active) {
    var tabs = [['index.html', 'today', 'Today'], ['journey.html', 'journey', 'Journey'], ['archive.html', 'archive', 'Archive'],
      ['stats.html', 'stats', 'Stats'], ['settings.html', 'settings', 'Settings']];
    var nav = MG.h('nav', 'tabbar');
    nav.setAttribute('aria-label', 'Main');
    nav.innerHTML = tabs.map(function (t) {
      return '<a href="' + t[0] + '" class="tab' + (t[1] === active ? ' active' : '') + '"' +
        (t[1] === active ? ' aria-current="page"' : '') + '>' + MG.icon(t[1]) + '<span>' + t[2] + '</span></a>';
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

  MG.confetti = function () {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['var(--c-blocks)', 'var(--c-pipes)', 'var(--c-link)', 'var(--c-crowns)', 'var(--c-lights)'];
    var layer = MG.h('div', 'confetti');
    for (var i = 0; i < 46; i++) {
      var p = MG.h('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = Math.random() * 0.25 + 's';
      p.style.animationDuration = 1.1 + Math.random() * 0.8 + 's';
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 2400);
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
    return 'MindGrid · ' + MG.prettyDate(day, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' +
      MG.DIFF_LABEL[diff] + '\n' + solved + '/' + MG.ORDER.length + ' solved\n' + lines.join('\n') + '\n' + MG.siteUrl();
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

  /* ---------- Offline (service worker) ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) &&
      !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
