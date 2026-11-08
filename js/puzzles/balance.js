/* Balance: fill the grid with suns and moons. Each row/column holds equal numbers of each,
 * and never three of the same in a line. Every puzzle has exactly one solution. */
(function () {
  'use strict';
  var MG = window.MG;
  // [size, stop removing clues once givens <= ratio * cells]  (0 = remove as many as possible)
  var CFG = { easy: [6, 0.5], medium: [8, 0.4], hard: [10, 0.34], expert: [10, 0] };
  var lineCache = {};

  function linesFor(n) {
    if (lineCache[n]) return lineCache[n];
    var lines = [], r, c;
    for (r = 0; r < n; r++) { var row = []; for (c = 0; c < n; c++) row.push(r * n + c); lines.push(row); }
    for (c = 0; c < n; c++) { var col = []; for (r = 0; r < n; r++) col.push(r * n + c); lines.push(col); }
    return (lineCache[n] = lines);
  }

  /* Fill forced cells in place. Returns false on contradiction. */
  function propagate(n, g) {
    var lines = linesFor(n), half = n / 2, changed = true;
    while (changed) {
      changed = false;
      for (var L = 0; L < lines.length; L++) {
        var line = lines[L], c0 = 0, c1 = 0, i;
        for (i = 0; i < n; i++) { var v = g[line[i]]; if (v === 0) c0++; else if (v === 1) c1++; }
        if (c0 > half || c1 > half) return false;
        if ((c0 === half || c1 === half) && c0 + c1 < n) {
          var fill = c0 === half ? 1 : 0;
          for (i = 0; i < n; i++) if (g[line[i]] === -1) g[line[i]] = fill;
          changed = true;
          continue;
        }
        for (i = 0; i + 2 < n; i++) {
          var a = g[line[i]], b = g[line[i + 1]], c = g[line[i + 2]];
          if (a !== -1 && a === b && b === c) return false;
          if (a !== -1 && a === b && c === -1) { g[line[i + 2]] = 1 - a; changed = true; }
          else if (b !== -1 && b === c && a === -1) { g[line[i]] = 1 - b; changed = true; }
          else if (a !== -1 && a === c && b === -1) { g[line[i + 1]] = 1 - a; changed = true; }
        }
      }
    }
    return true;
  }

  /* Count solutions up to `limit`. With rng, branches randomly (used to build a random full grid). */
  var work = 0; // search steps used; lets generate() cap its effort deterministically
  function solve(n, grid, limit, rng, out) {
    var count = 0;
    (function rec(g) {
      work++;
      if (count >= limit || !propagate(n, g)) return;
      var e = g.indexOf(-1);
      if (e < 0) { count++; if (out) out.push(g.slice()); return; }
      var first = rng ? rng.int(2) : 0;
      for (var k = 0; k < 2 && count < limit; k++) { var h = g.slice(); h[e] = k ? 1 - first : first; rec(h); }
    })(grid.slice());
    return count;
  }

  /** Difficulty dial: d 0..100 -> [even board size, share of cells given]. */
  function cfgFor(d) {
    var n = Math.max(6, Math.min(10, Math.round(MG.tierLerp(d, [6, 8, 10, 10]) / 2) * 2));
    // floor of 0.12: stripping a 10x10 down to the bare minimum costs ~0.5 s on a phone for almost no extra challenge
    return [n, Math.max(0.12, Math.min(0.55, MG.tierLerp(d, [0.5, 0.4, 0.34, 0.16])))];
  }
  /** How many times a solver must guess (branch) before finishing. 0 = pure step-by-step logic. */
  function guesses(n, grid) {
    var branches = 0, done = false;
    (function rec(g) {
      if (done || !propagate(n, g)) return;
      var e = g.indexOf(-1);
      if (e < 0) { done = true; return; }
      branches++;
      for (var k = 0; k < 2 && !done; k++) { var h = g.slice(); h[e] = k; rec(h); }
    })(grid.slice());
    return branches;
  }
  /** Quality gate: easy levels must need no guessing; hard ones should need some. */
  function quality(P, d) {
    var gs = guesses(P.n, P.givens);
    return { ok: d == null ? true : d < 40 ? gs === 0 : d >= 70 ? gs >= 1 : true, effort: gs };
  }

  function generate(rng, diff, opt) {
    var cfg = opt || CFG[diff] || CFG.medium, n = cfg[0], N = n * n, sols = [];
    solve(n, new Array(N).fill(-1), 1, rng, sols);
    var sol = sols[0], g = sol.slice(), givens = N, target = Math.ceil(N * cfg[1]);
    var order = rng.shuffle(Array.from({ length: N }, function (_, i) { return i; }));
    // Adaptive levels (opt set) stop removing clues after a fixed amount of search work: same seed -> same puzzle,
    // and no phone ever waits long. The classic Daily tiers keep the original unlimited behaviour.
    var budget = opt ? 6000 : Infinity;
    work = 0;
    for (var k = 0; k < N && givens > target && work < budget; k++) {
      var c = order[k], v = g[c];
      g[c] = -1;
      if (solve(n, g, 2) !== 1) g[c] = v; else givens--;
    }
    return { n: n, givens: g, solution: sol };
  }

  function errors(n, g) {
    var bad = {}, half = n / 2;
    linesFor(n).forEach(function (line) {
      var c0 = 0, c1 = 0, i;
      for (i = 0; i < n; i++) { if (g[line[i]] === 0) c0++; else if (g[line[i]] === 1) c1++; }
      for (i = 0; i < n; i++) {
        var v = g[line[i]];
        if ((v === 0 && c0 > half) || (v === 1 && c1 > half)) bad[line[i]] = true;
      }
      for (i = 0; i + 2 < n; i++) {
        var a = g[line[i]];
        if (a !== -1 && a === g[line[i + 1]] && a === g[line[i + 2]]) bad[line[i]] = bad[line[i + 1]] = bad[line[i + 2]] = true;
      }
    });
    return bad;
  }
  function solved(P, g) { return g.indexOf(-1) < 0 && Object.keys(errors(P.n, g)).length === 0; }

  var SUN = '<svg viewBox="0 0 24 24" class="sym sun" aria-hidden="true"><circle cx="12" cy="12" r="6.2"/>' +
    '<path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" class="sym moon" aria-hidden="true"><path d="M15.2 3.2a8.8 8.8 0 1 0 5.6 14.6A7.4 7.4 0 0 1 15.2 3.2z"/></svg>';

  function mount(root, P, api) {
    var n = P.n, N = n * n, cur = P.givens.slice();
    root.innerHTML = '';
    var board = MG.h('div', 'board balance-board'), grid = MG.h('div', 'grid'), cells = [];
    board.style.setProperty('--n', n);
    for (var i = 0; i < N; i++) {
      var given = P.givens[i] !== -1;
      var b = MG.h('button', 'cell' + (given ? ' given' : ''));
      b.type = 'button'; b.dataset.i = i;
      if (given) b.setAttribute('aria-disabled', 'true');
      if (i % n === n / 2 - 1) b.classList.add('mid-c');
      if (Math.floor(i / n) === n / 2 - 1) b.classList.add('mid-r');
      grid.appendChild(b); cells.push(b);
    }
    board.appendChild(grid); root.appendChild(board);

    function render() {
      var bad = errors(n, cur);
      for (var i = 0; i < N; i++) {
        cells[i].innerHTML = cur[i] === 0 ? SUN : cur[i] === 1 ? MOON : '';
        cells[i].classList.toggle('bad', !!bad[i]);
        cells[i].setAttribute('aria-label', 'Cell ' + (Math.floor(i / n) + 1) + ',' + (i % n + 1) + ': ' + (cur[i] === 0 ? 'sun' : cur[i] === 1 ? 'moon' : 'empty'));
      }
    }
    function cycle(i, dir) {
      if (P.givens[i] !== -1) { api.sfx('error'); return; }
      var order = [-1, 0, 1], k = order.indexOf(cur[i]);
      cur[i] = order[(k + dir + 3) % 3];
      cells[i].classList.remove('hinted');
      api.sfx(cur[i] === -1 ? 'undo' : 'tap'); api.buzz(6);
      render(); api.changed();
    }
    grid.addEventListener('click', function (e) { var c = e.target.closest('.cell'); if (c) cycle(+c.dataset.i, 1); });
    grid.addEventListener('contextmenu', function (e) {
      var c = e.target.closest('.cell'); if (!c) return;
      e.preventDefault(); cycle(+c.dataset.i, -1);
    });
    render();

    function mark(i) { cells[i].classList.add('hinted'); render(); return true; }
    return {
      snapshot: function () { return cur.slice(); },
      restore: function (s) { cur = s && s.length === N ? s.slice() : P.givens.slice(); render(); },
      isSolved: function () { return solved(P, cur); },
      hint: function () {
        var i;
        for (i = 0; i < N; i++) if (cur[i] !== -1 && cur[i] !== P.solution[i]) { cur[i] = P.solution[i]; return mark(i); }
        var g = cur.slice();
        propagate(n, g); // all entries are correct now, so forced cells are logical next steps
        for (i = 0; i < N; i++) if (cur[i] === -1 && g[i] !== -1) { cur[i] = P.solution[i]; return mark(i); }
        for (i = 0; i < N; i++) if (cur[i] === -1) { cur[i] = P.solution[i]; return mark(i); }
        return false;
      }
    };
  }

  MG.register({
    id: 'balance', name: 'Balance', tagline: 'Even out the suns and moons', color: 'var(--c-balance)',
    icon: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="13" cy="20" r="8" fill="currentColor"/><path d="M29 10a10 10 0 1 0 6.5 17.6A8.4 8.4 0 0 1 29 10z" fill="currentColor" opacity=".55"/></svg>',
    rules: [
      'Fill every cell with a sun or a moon.',
      'Each row and each column holds the same number of suns and moons.',
      'Never three of the same symbol next to each other in a row or column.'
    ],
    controls: 'Tap an empty cell to cycle: sun → moon → empty. Right-click (desktop) cycles backwards. Bold cells are fixed.',
    generate: generate, mount: mount, cfgFor: cfgFor, quality: quality,
    _check: solved, _count: function (P, g) { return solve(P.n, g, 2); }
  });
})();
