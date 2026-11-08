/* Pipes: rotate tiles so every pipe joins one leak-free network fed by the source. */
(function () {
  'use strict';
  var MG = window.MG;
  var SIZES = { easy: 4, medium: 5, hard: 7, expert: 8 };
  var DIRS = [[-1, 0, 1], [0, 1, 2], [1, 0, 4], [0, -1, 8]]; // dr, dc, bit (U R D L)
  var OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
  function rot(m) { return ((m << 1) | (m >> 3)) & 15; }
  function rotN(m, k) { k = ((k % 4) + 4) % 4; for (var i = 0; i < k; i++) m = rot(m); return m; }
  function bits(m) { return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1); }

  /** Difficulty dial: d 0..100 -> grid size. */
  function cfgFor(d) { return Math.max(3, Math.min(9, Math.round(MG.tierLerp(d, [4, 5, 7, 8])))); }
  /** Quality gate: most tiles must start turned the wrong way, and the network should branch. */
  function quality(P) {
    var N = P.n * P.n, wrong = 0, forks = 0;
    for (var i = 0; i < N; i++) {
      var t = P.tiles[i], s = P.solution[i];
      if (t !== s && !(rotN(t, 2) === s && rotN(s, 2) === s)) wrong++;
      if (bits(s) >= 3) forks++;
    }
    return { ok: wrong >= N * 0.6 && forks >= Math.max(1, Math.floor(N / 12)), effort: wrong + forks * 2 };
  }

  function generate(rng, diff, opt) {
    var n = opt || SIZES[diff] || SIZES.medium, N = n * n;
    var mask = new Array(N).fill(0), inTree = new Array(N).fill(false);
    var src = Math.floor(n / 2) * n + Math.floor(n / 2), frontier = [];
    function addEdges(i) {
      var r = Math.floor(i / n), c = i % n;
      DIRS.forEach(function (d) {
        var rr = r + d[0], cc = c + d[1];
        if (rr >= 0 && cc >= 0 && rr < n && cc < n && !inTree[rr * n + cc]) frontier.push([i, rr * n + cc, d[2]]);
      });
    }
    inTree[src] = true; addEdges(src);
    while (frontier.length) {
      var k = rng.int(frontier.length);
      for (var tries = 0; tries < 8 && bits(mask[frontier[k][0]]) >= 3; tries++) k = rng.int(frontier.length);
      var e = frontier[k];
      frontier[k] = frontier[frontier.length - 1]; frontier.pop();
      if (inTree[e[1]]) continue;
      inTree[e[1]] = true; mask[e[0]] |= e[2]; mask[e[1]] |= OPP[e[2]];
      addEdges(e[1]);
    }
    var tiles, attempt = 0;
    do {
      tiles = mask.map(function (m) { return rotN(m, rng.int(4)); });
      attempt++;
    } while (check(n, src, tiles).solved && attempt < 20);
    return { n: n, src: src, tiles: tiles, solution: mask };
  }

  function check(n, src, cur) {
    var N = n * n, matched = true;
    for (var i = 0; i < N && matched; i++) {
      var r = Math.floor(i / n), c = i % n;
      for (var d = 0; d < 4; d++) {
        if (!(cur[i] & DIRS[d][2])) continue;
        var rr = r + DIRS[d][0], cc = c + DIRS[d][1];
        if (rr < 0 || cc < 0 || rr >= n || cc >= n || !(cur[rr * n + cc] & OPP[DIRS[d][2]])) { matched = false; break; }
      }
    }
    var lit = new Array(N).fill(false), stack = [src], count = 0;
    lit[src] = true;
    while (stack.length) {
      var j = stack.pop(); count++;
      var jr = Math.floor(j / n), jc = j % n;
      for (var dd = 0; dd < 4; dd++) {
        var b = DIRS[dd][2]; if (!(cur[j] & b)) continue;
        var r2 = jr + DIRS[dd][0], c2 = jc + DIRS[dd][1];
        if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) continue;
        var t = r2 * n + c2;
        if (!lit[t] && (cur[t] & OPP[b])) { lit[t] = true; stack.push(t); }
      }
    }
    return { lit: lit, solved: matched && count === N };
  }

  function tileSVG(m, isSrc) {
    var ends = { 1: [50, 0], 2: [100, 50], 4: [50, 100], 8: [0, 50] }, s = '<svg viewBox="0 0 100 100" class="pipe">';
    [1, 2, 4, 8].forEach(function (b) {
      if (m & b) s += '<line x1="50" y1="50" x2="' + ends[b][0] + '" y2="' + ends[b][1] + '"/>';
    });
    if (isSrc) s += '<circle cx="50" cy="50" r="24" class="src"/><circle cx="50" cy="50" r="9" class="src-dot"/>';
    else if (bits(m) === 1) s += '<circle cx="50" cy="50" r="17" class="end"/>';
    else s += '<circle cx="50" cy="50" r="9"/>';
    return s + '</svg>';
  }

  function mount(root, P, api) {
    var n = P.n, N = n * n, turns = new Array(N).fill(0);
    root.innerHTML = '';
    var board = MG.h('div', 'board pipes-board'), grid = MG.h('div', 'grid');
    board.style.setProperty('--n', n);
    var cells = [], rotors = [];
    for (var i = 0; i < N; i++) {
      var cell = MG.h('button', 'cell' + (i === P.src ? ' source' : ''));
      cell.type = 'button'; cell.dataset.i = i;
      cell.setAttribute('aria-label', 'Tile ' + (Math.floor(i / n) + 1) + ',' + (i % n + 1));
      var rotor = MG.h('div', 'rotor', tileSVG(P.tiles[i], i === P.src));
      cell.appendChild(rotor); grid.appendChild(cell); cells.push(cell); rotors.push(rotor);
    }
    board.appendChild(grid); root.appendChild(board);

    function current() { return P.tiles.map(function (m, i) { return rotN(m, turns[i]); }); }
    function render() {
      var res = check(n, P.src, current());
      for (var i = 0; i < N; i++) {
        rotors[i].style.transform = 'rotate(' + turns[i] * 90 + 'deg)';
        cells[i].classList.toggle('on', res.lit[i]);
      }
    }
    function turn(i, dir) {
      turns[i] += dir; cells[i].classList.remove('hinted');
      api.sfx('tap'); api.buzz(6); render(); api.changed();
    }
    grid.addEventListener('click', function (e) {
      var c = e.target.closest('.cell'); if (c) turn(+c.dataset.i, 1);
    });
    grid.addEventListener('contextmenu', function (e) {
      var c = e.target.closest('.cell'); if (!c) return;
      e.preventDefault(); turn(+c.dataset.i, -1);
    });
    render();

    return {
      snapshot: function () { return turns.slice(); },
      restore: function (s) {
        var old = turns.slice();
        turns = s && s.length === N ? s.slice() : new Array(N).fill(0);
        // keep the visual angle close so restoring doesn't spin wildly
        for (var i = 0; i < N; i++) { var d = ((turns[i] - old[i]) % 4 + 4) % 4; turns[i] = old[i] + (d === 3 ? -1 : d); }
        render();
      },
      isSolved: function () { return check(n, P.src, current()).solved; },
      hint: function () {
        var cur = current(), lit = check(n, P.src, cur).lit, order = [];
        for (var a = 0; a < N; a++) {
          if (cur[a] === P.solution[a]) continue;
          var ar = Math.floor(a / n), ac = a % n;
          var near = lit[a] || (ar > 0 && lit[a - n]) || (ar < n - 1 && lit[a + n]) || (ac > 0 && lit[a - 1]) || (ac < n - 1 && lit[a + 1]);
          if (near) order.unshift(a); else order.push(a);
        }
        for (var o = 0; o < order.length; o++) {
          var i = order[o];
          for (var t = 1; t <= 3; t++) if (rotN(cur[i], t) === P.solution[i]) { turns[i] += t; break; }
          cells[i].classList.add('hinted');
          render(); return true;
        }
        return false;
      }
    };
  }

  MG.register({
    id: 'pipes', name: 'Pipes', tagline: 'Turn tiles until the whole network flows', color: 'var(--c-pipes)',
    icon: '<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"><path d="M6 20h14v14M20 20V6M20 20h14"/><circle cx="20" cy="20" r="6" fill="currentColor" stroke="none"/></svg>',
    rules: [
      'Tap tiles to rotate them.',
      'Connect every pipe into a single network that reaches the glowing source.',
      'No pipe end may point at a wall or an unconnected side.'
    ],
    controls: 'Tap to rotate clockwise. Right-click (desktop) rotates the other way.',
    generate: generate, mount: mount, cfgFor: cfgFor, quality: quality,
    _check: function (P, cur) { return check(P.n, P.src, cur).solved; }
  });
})();
