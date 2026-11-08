/* Link: draw one path that fills every cell and passes the numbers in order. */
(function () {
  'use strict';
  var MG = window.MG;
  var SIZES = { easy: [5, 8], medium: [6, 9], hard: [7, 10], expert: [8, 11] };

  function hamPath(rng, n) {
    var p = [], r, c;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) p.push(r * n + (r % 2 ? n - 1 - c : c));
    var pos = new Array(n * n);
    function reindex() { for (var i = 0; i < p.length; i++) pos[p[i]] = i; }
    reindex();
    var iters = n * n * 60, last = p.length - 1;
    for (var it = 0; it < iters; it++) {
      if (rng.chance(0.5)) { p.reverse(); reindex(); }
      var t = p[last], tr = Math.floor(t / n), tc = t % n, nbs = [];
      if (tr > 0) nbs.push(t - n);
      if (tr < n - 1) nbs.push(t + n);
      if (tc > 0) nbs.push(t - 1);
      if (tc < n - 1) nbs.push(t + 1);
      var i = pos[rng.pick(nbs)];
      if (i === last - 1) continue;
      // backbite: connect tail to p[i], drop edge p[i]-p[i+1]
      var tail = p.slice(i + 1).reverse();
      p = p.slice(0, i + 1).concat(tail);
      for (var k = i + 1; k <= last; k++) pos[p[k]] = k;
    }
    return p;
  }

  /** Difficulty dial: d 0..100 -> [grid size, number of clues]. Fewer clues per cell = harder. */
  function cfgFor(d) {
    var n = Math.max(4, Math.min(9, Math.round(MG.tierLerp(d, [5, 6, 7, 8]))));
    return [n, Math.max(4, Math.round(MG.tierLerp(d, [8, 9, 10, 11]) + (n > 8 ? 1 : 0)))];
  }
  /** Quality gate: the hidden path should twist (long straight runs make it trivial). */
  function quality(P) {
    var p = P.solution, n = P.n, turns = 0;
    for (var i = 1; i + 1 < p.length; i++) {
      var d1 = p[i] - p[i - 1], d2 = p[i + 1] - p[i];
      if (d1 !== d2) turns++;
    }
    var ratio = turns / Math.max(1, p.length - 2);
    return { ok: ratio >= (n <= 5 ? 0.3 : 0.4), effort: turns };
  }

  function generate(rng, diff, opt) {
    var cfg = opt || SIZES[diff] || SIZES.medium, n = cfg[0], K = cfg[1];
    var path = hamPath(rng, n), last = path.length - 1, seg = last / (K - 1), idx = [0];
    for (var j = 1; j < K - 1; j++) {
      var v = Math.round(j * seg + (rng.next() - 0.5) * seg * 0.7);
      v = Math.max(idx[idx.length - 1] + 1, Math.min(last - (K - 1 - j), v));
      idx.push(v);
    }
    idx.push(last);
    var clues = new Array(n * n).fill(0);
    idx.forEach(function (pi, k) { clues[path[pi]] = k + 1; });
    return { n: n, K: K, clues: clues, solution: path, checkpoints: idx };
  }

  function adjacent(n, a, b) {
    var ar = Math.floor(a / n), ac = a % n, br = Math.floor(b / n), bc = b % n;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  }
  function validPath(P, path) {
    if (path.length !== P.n * P.n || P.clues[path[0]] !== 1) return false;
    var next = 1, seen = {};
    for (var i = 0; i < path.length; i++) {
      if (seen[path[i]]) return false; seen[path[i]] = true;
      if (i > 0 && !adjacent(P.n, path[i - 1], path[i])) return false;
      var v = P.clues[path[i]];
      if (v) { if (v !== next) return false; next++; }
    }
    return next === P.K + 1 && P.clues[path[path.length - 1]] === P.K;
  }

  function mount(root, P, api) {
    var n = P.n, N = n * n, path = [], dragging = false, before = '';
    root.innerHTML = '';
    var board = MG.h('div', 'board link-board');
    board.style.setProperty('--n', n);
    var bg = MG.h('div', 'grid bg'), top = MG.h('div', 'grid top'), cells = [];
    var svgNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + n + ' ' + n); svg.setAttribute('class', 'trail');
    var line = document.createElementNS(svgNS, 'polyline'), head = document.createElementNS(svgNS, 'circle');
    head.setAttribute('r', '0.26'); svg.appendChild(line); svg.appendChild(head);
    for (var i = 0; i < N; i++) {
      var cell = MG.h('div', 'cell'); bg.appendChild(cell); cells.push(cell);
      top.appendChild(MG.h('div', 'slot', P.clues[i] ? '<span class="num">' + P.clues[i] + '</span>' : ''));
    }
    board.appendChild(bg); board.appendChild(svg); board.appendChild(top);
    root.appendChild(board);

    function maxNum() { var m = 0; path.forEach(function (c) { if (P.clues[c] > m) m = P.clues[c]; }); return m; }
    function render() {
      var on = {}; path.forEach(function (c) { on[c] = true; });
      for (var i = 0; i < N; i++) cells[i].classList.toggle('on', !!on[i]);
      line.setAttribute('points', path.map(function (c) { return (c % n + 0.5) + ',' + (Math.floor(c / n) + 0.5); }).join(' '));
      if (path.length) {
        var h = path[path.length - 1];
        head.setAttribute('cx', h % n + 0.5); head.setAttribute('cy', Math.floor(h / n) + 0.5); head.style.display = '';
      } else head.style.display = 'none';
    }
    var lastErr = 0;
    function err() { var t = Date.now(); if (t - lastErr > 400) { api.sfx('error'); lastErr = t; } }
    function tryAdd(j) {
      if (path.indexOf(j) >= 0) return false;
      if (P.clues[j] && P.clues[j] !== maxNum() + 1) { err(); return false; }
      path.push(j);
      if (P.clues[j]) { api.sfx('place'); api.buzz(8); }
      return true;
    }
    function stepTo(j) {
      var last = path[path.length - 1];
      if (j === last) return;
      if (path.length > 1 && j === path[path.length - 2]) { path.pop(); return; }
      var lr = Math.floor(last / n), lc = last % n, jr = Math.floor(j / n), jc = j % n;
      if (adjacent(n, last, j)) { tryAdd(j); return; }
      if (lr === jr || lc === jc) { // fast swipe skipped cells: walk the straight line
        var dr = Math.sign(jr - lr), dc = Math.sign(jc - lc), r = lr, c = lc;
        while (r !== jr || c !== jc) { r += dr; c += dc; if (!tryAdd(r * n + c)) break; }
      }
    }
    board.addEventListener('pointerdown', function (e) {
      var cell = MG.cellAt(board, e, n, n); if (!cell) return;
      e.preventDefault();
      var j = cell.r * n + cell.c, at = path.indexOf(j);
      before = path.join(',');
      if (at >= 0) path = path.slice(0, at + 1);
      else if (!path.length && P.clues[j] === 1) path = [j];
      else if (path.length && adjacent(n, path[path.length - 1], j)) tryAdd(j);
      else if (!path.length) { err(); board.classList.add('nudge'); setTimeout(function () { board.classList.remove('nudge'); }, 300); return; }
      else return;
      dragging = true;
      try { board.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      render();
    });
    board.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var cell = MG.cellAt(board, e, n, n); if (!cell) return;
      // ignore pointer near cell corners to avoid accidental diagonal hops
      var b = board.getBoundingClientRect(), fx = ((e.clientX - b.left) / b.width) * n - cell.c, fy = ((e.clientY - b.top) / b.height) * n - cell.r;
      if (Math.min(fx, 1 - fx) < 0.12 && Math.min(fy, 1 - fy) < 0.12) return;
      stepTo(cell.r * n + cell.c); render();
    });
    function end() {
      if (!dragging) return;
      dragging = false;
      if (path.join(',') !== before) api.changed();
    }
    board.addEventListener('pointerup', end);
    board.addEventListener('pointercancel', end);
    render();

    return {
      snapshot: function () { return path.slice(); },
      restore: function (s) { path = (s || []).slice(); render(); },
      isSolved: function () { return validPath(P, path); },
      hint: function () {
        var sol = P.solution, L = 0;
        while (L < path.length && path[L] === sol[L]) L++;
        var target = P.checkpoints.find(function (ci) { return ci >= L && ci > 0; });
        if (target === undefined) target = sol.length - 1;
        if (L >= sol.length) return false;
        path = sol.slice(0, Math.max(target, L) + 1);
        render(); return true;
      }
    };
  }

  MG.register({
    id: 'link', name: 'Link', tagline: 'One line, every cell, numbers in order', color: 'var(--c-link)',
    icon: '<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8h24v8H8v8h24v8H8"/><circle cx="8" cy="8" r="4" fill="currentColor"/><circle cx="8" cy="32" r="4" fill="currentColor"/></svg>',
    rules: [
      'Start on 1 and draw a single continuous path.',
      'Pass through the numbers in increasing order, finishing on the highest one.',
      'The path must fill every cell exactly once and only moves up, down, left or right.'
    ],
    controls: 'Press on 1 and drag. Drag back over your line, or press any earlier cell, to backtrack.',
    generate: generate, mount: mount, cfgFor: cfgFor, quality: quality, _check: validPath
  });
})();
