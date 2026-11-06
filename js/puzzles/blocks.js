/* Blocks: split the grid into rectangles; each holds one number equal to its area. */
(function () {
  'use strict';
  var MG = window.MG;
  var SIZES = { easy: [5, 6], medium: [6, 8], hard: [8, 12], expert: [10, 16] };

  function generate(rng, diff) {
    var cfg = SIZES[diff] || SIZES.medium, n = cfg[0], maxA = cfg[1];
    var owner = new Array(n * n).fill(-1), rects = [];
    for (var i = 0; i < n * n; i++) {
      if (owner[i] !== -1) continue;
      var r = Math.floor(i / n), c = i % n, maxW = 0;
      while (c + maxW < n && owner[r * n + c + maxW] === -1) maxW++;
      var cands = [];
      for (var w = 1; w <= maxW; w++) {
        for (var h = 1; r + h <= n; h++) {
          var ok = true;
          for (var x = 0; x < w; x++) if (owner[(r + h - 1) * n + c + x] !== -1) { ok = false; break; }
          if (!ok || w * h > maxA) break;
          if (w * h >= 2) cands.push([w, h]);
        }
      }
      var pick = [1, 1];
      if (cands.length) {
        var weights = cands.map(function (wh) {
          var a = wh[0] * wh[1], thin = Math.max(wh[0], wh[1]) / Math.min(wh[0], wh[1]);
          return (a >= 3 ? 2 : 1) * (thin > 3 ? 0.25 : 1);
        });
        var tot = weights.reduce(function (s, v) { return s + v; }, 0), t = rng.next() * tot, k = 0;
        while (k < cands.length - 1 && t > weights[k]) { t -= weights[k]; k++; }
        pick = cands[k];
      }
      var id = rects.length;
      for (var y = 0; y < pick[1]; y++) for (var xx = 0; xx < pick[0]; xx++) owner[(r + y) * n + c + xx] = id;
      rects.push({ r: r, c: c, w: pick[0], h: pick[1], cr: r + rng.int(pick[1]), cc: c + rng.int(pick[0]) });
    }
    var clues = new Array(n * n).fill(0);
    rects.forEach(function (R) { clues[R.cr * n + R.cc] = R.w * R.h; });
    return { n: n, clues: clues, solution: rects.map(function (R) { return { r: R.r, c: R.c, w: R.w, h: R.h }; }) };
  }

  function overlaps(A, B) { return A.c < B.c + B.w && B.c < A.c + A.w && A.r < B.r + B.h && B.r < A.r + A.h; }
  function same(A, B) { return A.r === B.r && A.c === B.c && A.w === B.w && A.h === B.h; }
  function rectValid(P, R) {
    var count = 0, val = 0;
    for (var y = R.r; y < R.r + R.h; y++) for (var x = R.c; x < R.c + R.w; x++) {
      var v = P.clues[y * P.n + x]; if (v) { count++; val = v; }
    }
    return count === 1 && val === R.w * R.h;
  }
  function solved(P, rects) {
    var area = 0;
    for (var i = 0; i < rects.length; i++) { if (!rectValid(P, rects[i])) return false; area += rects[i].w * rects[i].h; }
    return area === P.n * P.n;
  }

  function mount(root, P, api) {
    var n = P.n, rects = [], drag = null;
    root.innerHTML = '';
    var board = MG.h('div', 'board blocks-board');
    board.style.setProperty('--n', n);
    var layer = MG.h('div', 'layer'), grid = MG.h('div', 'grid'), ghost = MG.h('div', 'rect ghost');
    var cells = [];
    for (var i = 0; i < n * n; i++) {
      var cell = MG.h('div', 'cell', P.clues[i] ? '<b>' + P.clues[i] + '</b>' : '');
      cells.push(cell); grid.appendChild(cell);
    }
    board.appendChild(layer); board.appendChild(grid); board.appendChild(ghost);
    root.appendChild(board);

    function place(el, R) {
      el.style.left = 'calc(' + (R.c / n) * 100 + '% + 3px)';
      el.style.top = 'calc(' + (R.r / n) * 100 + '% + 3px)';
      el.style.width = 'calc(' + (R.w / n) * 100 + '% - 6px)';
      el.style.height = 'calc(' + (R.h / n) * 100 + '% - 6px)';
    }
    function render() {
      layer.innerHTML = '';
      rects.forEach(function (R) {
        var ok = rectValid(P, R), d = MG.h('div', 'rect' + (ok ? ' ok' : ''));
        d.style.setProperty('--rc', 'hsl(' + ((R.r * 7 + R.c * 13 + R.w * 29 + R.h * 41) * 37 % 360) + ' 62% 56%)');
        place(d, R); layer.appendChild(d);
      });
    }
    function rectFrom(a, b) {
      return { r: Math.min(a.r, b.r), c: Math.min(a.c, b.c), w: Math.abs(a.c - b.c) + 1, h: Math.abs(a.r - b.r) + 1 };
    }
    function showGhost() {
      var R = rectFrom(drag.start, drag.end);
      place(ghost, R); ghost.textContent = R.w * R.h; ghost.style.display = 'flex';
    }
    board.addEventListener('pointerdown', function (e) {
      var cell = MG.cellAt(board, e, n, n);
      if (!cell) return;
      e.preventDefault();
      try { board.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      drag = { start: cell, end: cell };
      showGhost();
    });
    board.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var cell = MG.cellAt(board, e, n, n, true);
      if (cell.r !== drag.end.r || cell.c !== drag.end.c) { drag.end = cell; showGhost(); }
    });
    function finish() {
      if (!drag) return;
      var R = rectFrom(drag.start, drag.end);
      drag = null; ghost.style.display = 'none';
      if (R.w === 1 && R.h === 1) {
        var idx = rects.findIndex(function (Q) { return overlaps(Q, R); });
        if (idx >= 0) { // tap on an existing rectangle removes it
          rects.splice(idx, 1);
          api.sfx('undo'); render(); api.changed(); return;
        }
      }
      rects = rects.filter(function (Q) { return !overlaps(Q, R); });
      rects.push(R);
      api.sfx(rectValid(P, R) ? 'place' : 'tap'); api.buzz(8);
      render(); api.changed();
    }
    board.addEventListener('pointerup', finish);
    board.addEventListener('pointercancel', function () { drag = null; ghost.style.display = 'none'; });

    return {
      snapshot: function () { return rects.map(function (R) { return [R.r, R.c, R.w, R.h]; }); },
      restore: function (s) { rects = (s || []).map(function (a) { return { r: a[0], c: a[1], w: a[2], h: a[3] }; }); render(); },
      isSolved: function () { return solved(P, rects); },
      hint: function () {
        var target = P.solution.find(function (S) { return !rects.some(function (R) { return same(R, S); }); });
        if (!target) return false;
        rects = rects.filter(function (Q) { return !overlaps(Q, target); });
        rects.push({ r: target.r, c: target.c, w: target.w, h: target.h });
        render(); return true;
      }
    };
  }

  MG.register({
    id: 'blocks', name: 'Blocks', tagline: 'Slice the grid into perfect rectangles', color: 'var(--c-blocks)',
    icon: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="5" width="18" height="12" rx="3" fill="currentColor"/><rect x="26" y="5" width="9" height="30" rx="3" fill="currentColor" opacity=".55"/><rect x="5" y="20" width="18" height="15" rx="3" fill="currentColor" opacity=".8"/></svg>',
    rules: [
      'Divide the whole grid into rectangles (squares count too).',
      'Every rectangle must contain exactly one number.',
      'That number equals the rectangle’s area (width × height).'
    ],
    controls: 'Drag from one corner to the opposite corner to draw. Tap a rectangle to remove it.',
    generate: generate, mount: mount, _check: function (P, rects) { return solved(P, rects); }
  });
})();
