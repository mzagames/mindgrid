/* MindGrid tutorials: an animated hand that shows players what to do.
 *  - MG.tutorial(type, {onDone})  first-time puzzle intro: a mini board plays itself while captions explain each step.
 *  - MG.tour(id, steps, {onDone}) first-visit coach marks: dims the screen, spotlights one element at a time, hand taps it.
 *  - MG.resetTutorials()          show every intro and tour again. */
(function () {
  'use strict';
  var MG = window.MG, STOP = {};
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function seen(k) { return !!(MG.settings().seen || {})[k]; }
  function markSeen(k) { var s = MG.settings(); s.seen = Object.assign({}, s.seen); s.seen[k] = true; MG.save(); }
  MG.resetTutorials = function () {
    var s = MG.settings(), out = {};
    Object.keys(s.seen || {}).forEach(function (k) { if (!/^(tour|demo):/.test(k)) out[k] = s.seen[k]; });
    s.seen = out; MG.save();
  };

  /* Pointing hand: shaded skin, nail, knuckle creases and a MindGrid-violet sleeve cuff.
   * Drawn as one silhouette (outline pass, then fill pass) so overlapping fingers read as a single hand.
   * The fingertip (30.5, 3 in the viewBox) is the element's origin (see .hand svg offset in CSS). */
  var HS = '<rect x="23" y="3" width="15" height="54" rx="7.5"/><rect x="36" y="35" width="14.5" height="31" rx="7.2"/>' +
    '<rect x="48.5" y="40" width="13" height="28" rx="6.5"/><rect x="59.5" y="46.5" width="11" height="23" rx="5.5"/>' +
    '<path d="M28 58c-7-4.5-14.5-5-17.5-1s0 10.5 8 14.5l9 3z"/><path d="M22 50h48.5v20c0 11-9.5 17-24 17s-24.5-6-24.5-17z"/>';
  MG.HAND = '<svg viewBox="0 0 80 102" aria-hidden="true"><defs>' +
    '<linearGradient id="mgSkin" x1="0" y1="0" x2="1" y2=".35"><stop offset="0" stop-color="#ffe3cc"/><stop offset=".55" stop-color="#ffcfa8"/><stop offset="1" stop-color="#f0a97c"/></linearGradient>' +
    '<linearGradient id="mgCuff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a7bff"/><stop offset="1" stop-color="#5a3bd6"/></linearGradient></defs>' +
    '<g fill="#a8623c" stroke="#a8623c" stroke-width="4.5" stroke-linejoin="round">' + HS + '</g>' +
    '<g fill="url(#mgSkin)">' + HS + '</g>' +
    '<g fill="none" stroke="#d98a5f" stroke-width="1.6" stroke-linecap="round" opacity=".8">' +
    '<path d="M26 29.5h9M26 42h9"/><path d="M38.5 40.5c3-1.6 6.5-1.6 9.5 0M51 45c2.6-1.3 5.4-1.3 8 0M62 51.2c2-1 4-1 6 0"/>' +
    '<path d="M50 56v7M61 58v6"/><path d="M18 61c3 1.5 6 3.5 9 6"/></g>' +
    '<rect x="26.3" y="5.5" width="8.4" height="10.5" rx="4.2" fill="#fff0e6" stroke="#e7a47e" stroke-width="1"/>' +
    '<rect x="26.5" y="19" width="2.6" height="24" rx="1.3" fill="#fff" opacity=".55"/>' +
    '<rect x="24.5" y="84" width="43" height="17" rx="5" fill="url(#mgCuff)" stroke="#3e2799" stroke-width="2"/>' +
    '<rect x="24.5" y="88" width="43" height="3.4" fill="#ffd43b"/><circle cx="62" cy="95.5" r="2" fill="#fff" opacity=".8"/></svg>';

  function makeHand(parent) {
    var h = MG.h('div', 'hand', MG.HAND + '<i class="ripple"></i>');
    parent.appendChild(h);
    return {
      el: h,
      jump: function (x, y) { h.style.transitionDuration = '0ms'; h.style.transform = 'translate(' + x + 'px,' + y + 'px)'; },
      to: function (x, y, ms) {
        ms = ms == null ? 480 : ms;
        h.style.transitionDuration = ms + 'ms'; h.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        return sleep(ms);
      },
      press: function (on) { h.classList.toggle('press', !!on); if (on) this.ripple(); },
      ripple: function () { var r = h.querySelector('.ripple'); r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); }
    };
  }

  /* ---------- mini boards ---------- */
  var W = 216;
  function grid(wrap, rows, cols) {
    var cw = W / cols, ch = cw, b = MG.h('div', 'dboard');
    b.style.width = W + 'px'; b.style.height = ch * rows + 'px';
    b.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)'; b.style.gridTemplateRows = 'repeat(' + rows + ',1fr)';
    var cells = [];
    for (var r = 0; r < rows; r++) { cells.push([]); for (var c = 0; c < cols; c++) { var d = MG.h('div', 'dcell'); b.appendChild(d); cells[r].push(d); } }
    wrap.appendChild(b);
    wrap.style.width = W + 'px'; wrap.style.height = ch * rows + 'px';
    return { el: b, cells: cells, at: function (r, c) { return { x: (c + 0.5) * cw, y: (r + 0.5) * ch }; }, cw: cw, ch: ch };
  }
  var CROWN = '<svg viewBox="0 0 24 24" class="dcrown"><path d="M3 8.5l4.5 3.5L12 5l4.5 7L21 8.5 19 19H5z" fill="currentColor"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" class="dsun"><circle cx="12" cy="12" r="5" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" class="dmoon"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 14.6A7 7 0 0 1 15.5 3.5z"/></svg>';

  /* Each demo: caps (captions) + play(ctx). ctx: wrap, hand, cap(i), wait(ms), tap(x,y), drag(points). */
  var DEMOS = {
    blocks: {
      caps: ['Press on a corner and drag to the opposite corner to draw a rectangle.',
        'Each rectangle must hold exactly one number, and that number is its size.',
        'Cover the whole grid with rectangles to win!'],
      play: async function (x) {
        var g = grid(x.wrap, 3, 3), clues = [[0, 0, 4], [1, 2, 2], [2, 1, 3]];
        clues.forEach(function (k) { g.cells[k[0]][k[1]].innerHTML = '<b>' + k[2] + '</b>'; });
        var layer = MG.h('div', 'dlayer'); g.el.appendChild(layer);
        function rectEl(r0, c0, r1, c1, cls, color) {
          var e = MG.h('div', 'drect ' + cls);
          e.style.left = c0 * g.cw + 3 + 'px'; e.style.top = r0 * g.ch + 3 + 'px';
          e.style.width = (c1 - c0 + 1) * g.cw - 6 + 'px'; e.style.height = (r1 - r0 + 1) * g.ch - 6 + 'px';
          if (color) e.style.setProperty('--rc', color);
          layer.appendChild(e); return e;
        }
        async function draw(a, b, color, capIdx) {
          if (capIdx != null) x.cap(capIdx);
          var p = g.at(a[0], a[1]); await x.hand.to(p.x, p.y); x.hand.press(true);
          var ghost = rectEl(a[0], a[1], a[0], a[1], 'ghost');
          var path = [a];
          if (a[0] !== b[0] && a[1] !== b[1]) path.push([a[0], b[1]]);
          path.push(b);
          for (var i = 1; i < path.length; i++) {
            var q = g.at(path[i][0], path[i][1]); await x.hand.to(q.x, q.y, 380);
            ghost.remove();
            ghost = rectEl(Math.min(a[0], path[i][0]), Math.min(a[1], path[i][1]), Math.max(a[0], path[i][0]), Math.max(a[1], path[i][1]), 'ghost');
          }
          await x.wait(200); ghost.remove(); x.hand.press(false);
          rectEl(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), 'ok', color);
          await x.wait(450);
        }
        await draw([0, 0], [1, 1], '#ff8a1f', 0);
        await draw([0, 2], [1, 2], '#1fa2f2', 1);
        await draw([2, 0], [2, 2], '#8b5cf6');
        x.cap(2); g.el.classList.add('dwin'); await x.wait(2200);
      }
    },
    pipes: {
      caps: ['Tap a tile to rotate it.', 'Turn the pipes so they connect to the glowing source.', 'No loose ends: the whole network lights up!'],
      play: async function (x) {
        var g = grid(x.wrap, 1, 3);
        var ARM = { u: '<line x1="50" y1="50" x2="50" y2="0"/>', d: '<line x1="50" y1="50" x2="50" y2="100"/>', r: '<line x1="50" y1="50" x2="100" y2="50"/>' };
        var tiles = [{ arms: 'r', rot: 0, src: true }, { arms: 'ud', rot: 0 }, { arms: 'u', rot: 180, end: true }];
        tiles.forEach(function (t, i) {
          var inner = t.arms.split('').map(function (a) { return ARM[a]; }).join('') +
            (t.src ? '<circle cx="50" cy="50" r="22" class="src"/><circle cx="50" cy="50" r="8" class="dot"/>' : t.end ? '<circle cx="50" cy="50" r="17" class="end"/>' : '');
          g.cells[0][i].innerHTML = '<svg viewBox="0 0 100 100" class="dpipe"><g style="transform:rotate(' + t.rot + 'deg)">' + inner + '</g></svg>';
          t.g = g.cells[0][i].querySelector('g');
          if (t.src) g.cells[0][i].classList.add('on');
        });
        async function turn(i, to) { var p = g.at(0, i); await x.hand.to(p.x, p.y); await x.tap(); tiles[i].rot = to; tiles[i].g.style.transform = 'rotate(' + to + 'deg)'; await x.wait(260); }
        x.cap(0); await x.wait(300); await turn(1, 90); g.cells[0][1].classList.add('on'); await x.wait(500);
        x.cap(1); await turn(2, 270); g.cells[0][2].classList.add('on'); await x.wait(300);
        x.cap(2); g.el.classList.add('dwin'); await x.hand.to(W + 30, 60, 500); await x.wait(1800);
      }
    },
    link: {
      caps: ['Press on 1 and drag through the cells next to it.', 'Pass the numbers in order: 1, then 2, then 3.', 'Visit every cell exactly once to finish!'],
      play: async function (x) {
        var g = grid(x.wrap, 3, 3);
        var path = [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0], [2, 0], [2, 1], [2, 2]], nums = { 0: 1, 4: 2, 8: 3 };
        Object.keys(nums).forEach(function (i) { var p = path[i]; g.cells[p[0]][p[1]].innerHTML = '<span class="dnum">' + nums[i] + '</span>'; });
        var svg = MG.h('div', 'dtrail', '<svg viewBox="0 0 3 3"><polyline points=""/></svg>'); g.el.appendChild(svg);
        var pl = svg.querySelector('polyline'), pts = [];
        x.cap(0);
        var p0 = g.at(0, 0); await x.hand.to(p0.x, p0.y); x.hand.press(true);
        for (var i = 0; i < path.length; i++) {
          var c = path[i];
          if (i) { var p = g.at(c[0], c[1]); await x.hand.to(p.x, p.y, 330); }
          if (i === 3) x.cap(1);
          pts.push((c[1] + 0.5) + ',' + (c[0] + 0.5)); pl.setAttribute('points', pts.join(' '));
          g.cells[c[0]][c[1]].classList.add('on');
        }
        x.hand.press(false); x.cap(2); g.el.classList.add('dwin'); await x.wait(2200);
      }
    },
    crowns: {
      caps: ['Tap once to mark ✕ where a crown can’t go.', 'Tap the same square again to place a crown.', 'Drag across squares to mark many ✕ at once.',
        'One crown in every row, column and colour, and crowns never touch, not even corners.'],
      play: async function (x) {
        var g = grid(x.wrap, 4, 4), reg = ['0011', '0011', '2233', '2233'], col = ['var(--r4)', 'var(--r1)', 'var(--r3)', 'var(--r2)'];
        for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) g.cells[r][c].style.background = col[+reg[r][c]];
        function set(r, c, v) { g.cells[r][c].innerHTML = v === 1 ? '<span class="dx">✕</span>' : v === 2 ? CROWN : ''; }
        x.cap(0); var p = g.at(0, 0); await x.hand.to(p.x, p.y); await x.tap(); set(0, 0, 1); await x.wait(500);
        x.cap(1); p = g.at(0, 1); await x.hand.to(p.x, p.y); await x.tap(); set(0, 1, 1); await x.wait(350); await x.tap(); set(0, 1, 2); await x.wait(600);
        x.cap(2); p = g.at(1, 0); await x.hand.to(p.x, p.y); x.hand.press(true); set(1, 0, 1);
        for (var k = 1; k <= 2; k++) { p = g.at(1, k); await x.hand.to(p.x, p.y, 320); set(1, k, 1); }
        x.hand.press(false); await x.wait(500);
        x.cap(3); await x.hand.to(W + 30, 100, 500);
        var rest = [[1, 3], [2, 0], [3, 2]];
        for (var j = 0; j < rest.length; j++) { set(rest[j][0], rest[j][1], 2); g.cells[rest[j][0]][rest[j][1]].classList.add('pop'); await x.wait(380); }
        g.el.classList.add('dwin'); await x.wait(2400);
      }
    },
    lights: {
      caps: ['Tapping a light flips it and the four lights touching it.', 'Switch every light off to win!'],
      play: async function (x) {
        var g = grid(x.wrap, 3, 3), on = { '0,1': 1, '1,0': 1, '1,1': 1, '1,2': 1, '2,1': 1 };
        g.el.classList.add('dglow');
        for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) g.cells[r][c].classList.toggle('lit', !!on[r + ',' + c]);
        x.cap(0); await x.wait(1300);
        var p = g.at(1, 1); await x.hand.to(p.x, p.y); await x.tap();
        [[1, 1], [0, 1], [1, 0], [1, 2], [2, 1]].forEach(function (q) { g.cells[q[0]][q[1]].classList.toggle('lit'); });
        await x.wait(400); x.cap(1); g.el.classList.add('dwin'); await x.hand.to(W + 30, 120, 500); await x.wait(2000);
      }
    },
    balance: {
      caps: ['Tap an empty square once for a sun.', 'Tap it again for a moon.', 'Every row and column needs half suns and half moons, and never three alike in a line.'],
      play: async function (x) {
        var g = grid(x.wrap, 4, 4), sol = ['SMSM', 'MSMS', 'SSMM', 'MMSS'], empty = { '0,3': 1, '2,1': 1, '3,0': 1 };
        g.el.classList.add('dbal');
        for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
          if (empty[r + ',' + c]) continue;
          g.cells[r][c].innerHTML = sol[r][c] === 'S' ? SUN : MOON; g.cells[r][c].classList.add('given');
        }
        async function tapTo(r, c, times) {
          var p = g.at(r, c); await x.hand.to(p.x, p.y);
          for (var i = 0; i < times; i++) { await x.tap(); g.cells[r][c].innerHTML = i === 0 ? SUN : MOON; await x.wait(380); }
        }
        x.cap(0); await tapTo(2, 1, 1); await x.wait(300);
        x.cap(1); await tapTo(0, 3, 2); await x.wait(300);
        x.cap(2); await tapTo(3, 0, 2);
        g.el.classList.add('dwin'); await x.hand.to(W + 30, 120, 500); await x.wait(2400);
      }
    }
  };

  /** Run a looping demo inside host. setCap(i, text, total) is called as the steps change. */
  MG.puzzleDemo = function (type, host, setCap) {
    var D = DEMOS[type], alive = true;
    if (!D) return { stop: function () {} };
    var wrap = MG.h('div', 'demo demo-' + type);
    host.appendChild(wrap);
    (async function loop() {
      try {
        while (alive) {
          wrap.innerHTML = ''; wrap.className = 'demo demo-' + type;
          var hand = makeHand(wrap);
          hand.jump(W + 30, 230);
          var ctx = {
            wrap: wrap, hand: hand,
            cap: function (i) { setCap(i, D.caps[i], D.caps.length); },
            wait: async function (ms) { await sleep(ms); if (!alive) throw STOP; },
            tap: async function () { hand.press(true); await sleep(150); hand.press(false); await sleep(160); if (!alive) throw STOP; }
          };
          await D.play(ctx);
          await ctx.wait(300);
        }
      } catch (e) { if (e !== STOP) console.error(e); }
    })();
    return { stop: function () { alive = false; } };
  };
  MG.demoCaps = function (type) { return DEMOS[type] ? DEMOS[type].caps : []; };

  /** First-time puzzle intro modal with the animated demo. */
  MG.tutorial = function (type, opts) {
    opts = opts || {};
    var P = MG.puzzles[type], n = DEMOS[type].caps.length;
    var m = MG.modal('<div class="eyebrow">' + (opts.replay ? 'How to play' : 'New puzzle') + '</div><h3 class="tut-h">' +
      '<span class="pic" style="--pc:' + P.color + '">' + P.icon + '</span>' + P.name + '</h3>' +
      '<div class="demo-host"></div><p class="demo-cap" aria-live="polite"></p>' +
      '<div class="demo-dots">' + new Array(n + 1).join('<i></i>') + '</div>' +
      '<button type="button" class="btn" id="tutGo">' + (opts.replay ? 'Got it' : 'Let’s play') + ' ' + MG.icon('play') + '</button>' +
      '<p class="tut-more">' + MG.esc(P.controls) + '</p>', {
      cls: 'tut', onClose: function () { demo.stop(); if (!opts.replay) markSeen('demo:' + type); if (opts.onDone) opts.onDone(); }
    });
    m.el.style.setProperty('--pc', P.color);
    var capEl = m.el.querySelector('.demo-cap'), dots = m.el.querySelectorAll('.demo-dots i');
    var demo = MG.puzzleDemo(type, m.el.querySelector('.demo-host'), function (i, text) {
      capEl.classList.remove('in'); void capEl.offsetWidth; capEl.textContent = text; capEl.classList.add('in');
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    });
    m.el.querySelector('#tutGo').addEventListener('click', m.close);
    return m;
  };
  MG.needsTutorial = function (type) { return !seen('demo:' + type) && !!DEMOS[type]; };

  /* ---------- "Just completed" celebrations ----------
   * play.js remembers the level you just solved; the screen you return to finds that item, pops it, drops its stars in,
   * shows a little badge and sparkles. Journey also grows the gold road and walks the YOU marker to the next level. */
  var JD = 'mindgrid.justdone';
  MG.markJustDone = function (info) { try { sessionStorage.setItem(JD, JSON.stringify(Object.assign({ t: Date.now() }, info))); } catch (e) { /* ignore */ } };
  MG.takeJustDone = function (test) {
    var j = null;
    try { j = JSON.parse(sessionStorage.getItem(JD) || 'null'); } catch (e) { j = null; }
    if (!j || Date.now() - j.t > 15 * 60000 || (test && !test(j))) return null;
    try { sessionStorage.removeItem(JD); } catch (e) { /* ignore */ }
    return j;
  };
  MG.celebrate = function (el, label, opts) {
    if (!el) return;
    opts = opts || {};
    if (!opts.noScroll) {
      var r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 110) el.scrollIntoView({ block: 'center' });
    }
    el.classList.remove('justdone'); void el.offsetWidth; el.classList.add('justdone');
    var ring = MG.h('i', 'jd-ring'); el.appendChild(ring);
    if (label) { var b = MG.h('span', 'jd-badge', label); el.appendChild(b); setTimeout(function () { b.remove(); }, 2500); }
    setTimeout(function () { ring.remove(); el.classList.remove('justdone'); }, 2100);
    if (!MG.reduced) {
      var colors = ['#ffd43b', '#ff5c7a', '#22d3a6', '#a78bfa', '#38bdf8'];
      for (var i = 0; i < 12; i++) {
        var s = MG.h('i', 'sparkle'), a = (i / 12) * Math.PI * 2, d = 50 + Math.random() * 30;
        s.style.left = '50%'; s.style.top = '50%'; s.style.background = colors[i % colors.length];
        s.style.setProperty('--sx', Math.cos(a) * d + 'px'); s.style.setProperty('--sy', Math.sin(a) * d + 'px');
        s.style.animationDelay = 0.15 + Math.random() * 0.15 + 's';
        el.appendChild(s); (function (n) { setTimeout(function () { n.remove(); }, 1300); })(s);
      }
    }
    MG.sfx('star2'); setTimeout(function () { MG.sfx('star3'); }, 260); MG.buzz(15);
  };
  MG.starLabel = function (n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); };
  /** After the splash: run celebrate() (returns true if it played), then the first-visit tour a moment later. */
  MG.pageIntro = function (celebrate, tourId, steps, opts) {
    MG.afterSplash(function () {
      var played = celebrate ? celebrate() : false;
      setTimeout(function () { MG.tour(tourId, steps, opts); }, played ? 2300 : 250);
    });
  };

  /* ---------- Coach-mark tours ---------- */
  var touring = false;
  /** steps: [{el: selector, title, text, tap: true|false}]. Steps whose element is missing are skipped. */
  MG.tour = function (id, steps, opts) {
    opts = opts || {};
    var done = function () { if (opts.onDone) opts.onDone(); };
    if ((!opts.force && seen('tour:' + id)) || touring) { done(); return; }
    MG.afterSplash(function () {
      var list = steps.filter(function (s) { var e = document.querySelector(s.el); return e && e.getClientRects().length; });
      if (!list.length) { done(); return; }
      touring = true;
      var layer = MG.h('div', 'cm', '<div class="cm-spot"></div><div class="cm-tip" role="dialog" aria-live="polite"></div>');
      document.body.appendChild(layer);
      var spot = layer.querySelector('.cm-spot'), tip = layer.querySelector('.cm-tip'), hand = makeHand(layer), i = 0, first = true;
      function place() {
        var s = list[i], el = document.querySelector(s.el);
        if (!el) { next(); return; }
        var r = el.getBoundingClientRect(), pad = s.pad == null ? 8 : s.pad, vw = window.innerWidth, vh = window.innerHeight;
        var L = Math.max(4, r.left - pad), T = Math.max(4, r.top - pad), Wd = Math.min(vw - 8, r.width + pad * 2), Hd = Math.min(vh - 8, r.height + pad * 2);
        spot.style.left = L + 'px'; spot.style.top = T + 'px'; spot.style.width = Wd + 'px'; spot.style.height = Hd + 'px';
        spot.style.borderRadius = (s.radius || 20) + 'px';
        var hx = Math.min(vw - 50, Math.max(20, r.left + r.width * (s.hx || 0.5))), hy = Math.min(vh - 60, Math.max(20, r.top + r.height * (s.hy || 0.5)));
        if (first) hand.jump(vw / 2, vh + 40);
        first = false;
        hand.to(hx, hy, 520);
        hand.el.classList.toggle('tapping', s.tap !== false);
        tip.innerHTML = (s.title ? '<b>' + s.title + '</b>' : '') + '<p>' + s.text + '</p><div class="cm-foot"><span class="cm-dots">' +
          list.map(function (_, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</span>' +
          (i < list.length - 1 ? '<button type="button" class="cm-skip">Skip</button>' : '') +
          '<button type="button" class="cm-next">' + (i < list.length - 1 ? 'Next' : 'Got it!') + '</button></div>';
        tip.classList.remove('in'); void tip.offsetWidth; tip.classList.add('in');
        var below = vh - (T + Hd) > tip.offsetHeight + 90 || T < tip.offsetHeight + 30;
        tip.style.top = (below ? T + Hd + 72 : Math.max(10, T - tip.offsetHeight - 16)) + 'px';
        if (below && T + Hd + 72 + tip.offsetHeight > vh - 10) tip.style.top = Math.max(10, vh - tip.offsetHeight - 10) + 'px';
        var sk = tip.querySelector('.cm-skip');
        if (sk) sk.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
      }
      function show() {
        var el = document.querySelector(list[i].el);
        if (el && !list[i].fixed) {
          var r = el.getBoundingClientRect();
          if (r.top < 80 || r.bottom > window.innerHeight - 120) el.scrollIntoView({ block: 'center' });
        }
        requestAnimationFrame(function () { requestAnimationFrame(place); });
        MG.sfx('tick');
      }
      function next() { i++; if (i >= list.length) finish(); else show(); }
      function finish() {
        markSeen('tour:' + id); touring = false;
        layer.classList.add('out'); window.removeEventListener('resize', onResize);
        setTimeout(function () { layer.remove(); }, 250);
        done();
      }
      function onResize() { place(); }
      layer.addEventListener('click', next);
      window.addEventListener('resize', onResize);
      show();
    });
  };
})();
