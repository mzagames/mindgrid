/* Crowns: one crown per row, column and colour region; crowns never touch. */
(function () {
  'use strict';
  var MG = window.MG;
  var SIZES = { easy: 5, medium: 6, hard: 8, expert: 9 };

  function placeCrowns(rng, n) {
    var cols = new Array(n), used = new Array(n).fill(false);
    function bt(r) {
      if (r === n) return true;
      var order = rng.shuffle(Array.from({ length: n }, function (_, i) { return i; }));
      for (var k = 0; k < n; k++) {
        var c = order[k];
        if (used[c] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
        used[c] = true; cols[r] = c;
        if (bt(r + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    bt(0);
    return cols;
  }

  function growRegions(rng, n, cols) {
    var reg = new Array(n * n).fill(-1), remaining = n * n - n;
    for (var r = 0; r < n; r++) reg[r * n + cols[r]] = r;
    var wts = Array.from({ length: n }, function () { return 0.2 + rng.next() * rng.next() * 3; });
    while (remaining > 0) {
      var opts = [], total = 0;
      for (var g = 0; g < n; g++) {
        var fr = [];
        for (var i = 0; i < n * n; i++) {
          if (reg[i] !== -1) continue;
          var ir = Math.floor(i / n), ic = i % n;
          if ((ir > 0 && reg[i - n] === g) || (ir < n - 1 && reg[i + n] === g) ||
              (ic > 0 && reg[i - 1] === g) || (ic < n - 1 && reg[i + 1] === g)) fr.push(i);
        }
        if (fr.length) { opts.push([g, fr]); total += wts[g]; }
      }
      var t = rng.next() * total, k = 0;
      while (k < opts.length - 1 && t > wts[opts[k][0]]) { t -= wts[opts[k][0]]; k++; }
      reg[rng.pick(opts[k][1])] = opts[k][0];
      remaining--;
    }
    return reg;
  }

  function countSolutions(n, reg, limit, found) {
    var usedC = new Array(n).fill(false), usedG = new Array(n).fill(false), cols = [], count = 0;
    function bt(r) {
      if (count >= limit) return;
      if (r === n) { count++; if (found) found.push(cols.slice()); return; }
      for (var c = 0; c < n; c++) {
        var g = reg[r * n + c];
        if (usedC[c] || usedG[g] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
        usedC[c] = usedG[g] = true; cols[r] = c;
        bt(r + 1);
        usedC[c] = usedG[g] = false;
      }
    }
    bt(0);
    return count;
  }

  function connectedWithout(n, reg, g, skip) {
    var cells = [], seen = {};
    for (var i = 0; i < n * n; i++) if (reg[i] === g && i !== skip) cells.push(i);
    if (!cells.length) return false;
    var stack = [cells[0]], count = 0; seen[cells[0]] = true;
    while (stack.length) {
      var j = stack.pop(), r = Math.floor(j / n), c = j % n; count++;
      [r > 0 ? j - n : -1, r < n - 1 ? j + n : -1, c > 0 ? j - 1 : -1, c < n - 1 ? j + 1 : -1].forEach(function (k) {
        if (k >= 0 && k !== skip && !seen[k] && reg[k] === g) { seen[k] = true; stack.push(k); }
      });
    }
    return count === cells.length;
  }

  /* Kill alternative solutions by moving one of their crown cells into a neighbouring region. */
  function refine(rng, n, reg, sol, steps) {
    for (var s = 0; s < steps; s++) {
      var found = [];
      if (countSolutions(n, reg, 2, found) === 1) return true;
      var alt = found.find(function (f) { return f.some(function (c, r) { return c !== sol[r]; }); });
      if (!alt) return true;
      var rows = rng.shuffle(alt.map(function (_, r) { return r; }).filter(function (r) { return alt[r] !== sol[r]; }));
      var moved = false;
      for (var q = 0; q < rows.length && !moved; q++) {
        var x = rows[q] * n + alt[rows[q]], xr = rows[q], xc = alt[rows[q]];
        var nbs = rng.shuffle([xr > 0 ? x - n : -1, xr < n - 1 ? x + n : -1, xc > 0 ? x - 1 : -1, xc < n - 1 ? x + 1 : -1]);
        for (var t = 0; t < nbs.length; t++) {
          if (nbs[t] < 0 || reg[nbs[t]] === reg[x]) continue;
          if (!connectedWithout(n, reg, reg[x], x)) break;
          reg[x] = reg[nbs[t]]; moved = true; break;
        }
      }
      if (!moved) return false;
    }
    return countSolutions(n, reg, 2) === 1;
  }

  function generate(rng, diff) {
    var n = SIZES[diff] || SIZES.medium, best = null;
    for (var a = 0; a < 12; a++) {
      var cols = placeCrowns(rng, n), reg = growRegions(rng, n, cols);
      var unique = refine(rng, n, reg, cols, n * 12);
      best = { n: n, regions: reg, solution: cols, unique: unique };
      if (unique) break;
    }
    return best;
  }

  function conflicts(n, reg, crowns) {
    var bad = {};
    for (var i = 0; i < crowns.length; i++) for (var j = i + 1; j < crowns.length; j++) {
      var a = crowns[i], b = crowns[j], ar = Math.floor(a / n), ac = a % n, br = Math.floor(b / n), bc = b % n;
      if (ar === br || ac === bc || reg[a] === reg[b] || (Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1)) { bad[a] = bad[b] = true; }
    }
    return bad;
  }
  function solved(P, marks) {
    var crowns = [];
    marks.forEach(function (m, i) { if (m === 2) crowns.push(i); });
    return crowns.length === P.n && Object.keys(conflicts(P.n, P.regions, crowns)).length === 0;
  }

  var CROWN = '<svg viewBox="0 0 24 24" class="crown" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/></svg>';

  function mount(root, P, api) {
    var n = P.n, N = n * n, reg = P.regions, marks = new Array(N).fill(0), drag = null;
    root.innerHTML = '';
    var board = MG.h('div', 'board crowns-board'), grid = MG.h('div', 'grid'), cells = [];
    board.style.setProperty('--n', n);
    for (var i = 0; i < N; i++) {
      var r = Math.floor(i / n), c = i % n, cell = MG.h('div', 'cell');
      cell.style.background = 'var(--r' + reg[i] + ')';
      var t = r === 0 || reg[i - n] !== reg[i], b = r === n - 1 || reg[i + n] !== reg[i];
      var l = c === 0 || reg[i - 1] !== reg[i], rt = c === n - 1 || reg[i + 1] !== reg[i];
      var sh = [];
      if (t) sh.push('inset 0 2.5px 0 var(--ink)');
      if (b) sh.push('inset 0 -2.5px 0 var(--ink)');
      if (l) sh.push('inset 2.5px 0 0 var(--ink)');
      if (rt) sh.push('inset -2.5px 0 0 var(--ink)');
      cell.style.boxShadow = sh.join(',');
      grid.appendChild(cell); cells.push(cell);
    }
    board.appendChild(grid); root.appendChild(board);

    function render() {
      var crowns = [];
      marks.forEach(function (m, i) { if (m === 2) crowns.push(i); });
      var bad = conflicts(n, reg, crowns);
      for (var i = 0; i < N; i++) {
        cells[i].innerHTML = marks[i] === 2 ? CROWN : marks[i] === 1 ? '<span class="x">×</span>' : '';
        cells[i].classList.toggle('bad', !!bad[i]);
      }
    }
    board.addEventListener('pointerdown', function (e) {
      var cell = MG.cellAt(board, e, n, n); if (!cell) return;
      e.preventDefault();
      var j = cell.r * n + cell.c;
      drag = { start: j, moved: false, paint: marks[j] === 0, changed: false };
      try { board.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    });
    board.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var cell = MG.cellAt(board, e, n, n); if (!cell) return;
      var j = cell.r * n + cell.c;
      if (j === drag.start && !drag.moved) return;
      drag.moved = true;
      if (!drag.paint) return;
      [drag.start, j].forEach(function (k) { if (marks[k] === 0) { marks[k] = 1; drag.changed = true; } });
      render();
    });
    function end() {
      if (!drag) return;
      var d = drag; drag = null;
      if (!d.moved) {
        marks[d.start] = (marks[d.start] + 1) % 3;
        api.sfx(marks[d.start] === 2 ? 'place' : 'tap'); api.buzz(marks[d.start] === 2 ? 12 : 5);
        render(); api.changed();
      } else if (d.changed) api.changed();
    }
    board.addEventListener('pointerup', end);
    board.addEventListener('pointercancel', end);
    render();

    return {
      snapshot: function () { return marks.slice(); },
      restore: function (s) { marks = s && s.length === N ? s.slice() : new Array(N).fill(0); render(); },
      isSolved: function () { return solved(P, marks); },
      hint: function () {
        var sol = {};
        P.solution.forEach(function (c, r) { sol[r * n + c] = true; });
        for (var i = 0; i < N; i++) if (marks[i] === 2 && !sol[i]) { marks[i] = 1; render(); return true; }
        for (var r = 0; r < n; r++) {
          var k = r * n + P.solution[r];
          if (marks[k] !== 2) { marks[k] = 2; render(); cells[k].classList.add('pop'); return true; }
        }
        return false;
      }
    };
  }

  MG.register({
    id: 'crowns', name: 'Crowns', tagline: 'Crown one cell in every row, column and region', color: 'var(--c-crowns)',
    icon: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 14l7 6 7-11 7 11 7-6-3 18H9z" fill="currentColor"/></svg>',
    rules: [
      'Place exactly one crown in every row, every column and every colour region.',
      'Two crowns may never touch, not even diagonally.',
      'Use × marks to note cells that cannot hold a crown.'
    ],
    controls: 'Tap a cell to cycle: empty → × → crown. Drag across empty cells to paint × marks.',
    generate: generate, mount: mount,
    _check: solved, _count: countSolutions
  });
})();
