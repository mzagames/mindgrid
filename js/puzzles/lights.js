/* Glow: tapping flips a cell and its four neighbours. Switch every light off. */
(function () {
  'use strict';
  var MG = window.MG;
  var SIZES = { easy: [3, 3], medium: [4, 5], hard: [5, 8], expert: [6, 12] };

  function press(n, state, i) {
    var r = Math.floor(i / n), c = i % n;
    state[i] ^= 1;
    if (r > 0) state[i - n] ^= 1;
    if (r < n - 1) state[i + n] ^= 1;
    if (c > 0) state[i - 1] ^= 1;
    if (c < n - 1) state[i + 1] ^= 1;
  }

  function generate(rng, diff) {
    var cfg = SIZES[diff] || SIZES.medium, n = cfg[0], k = cfg[1], N = n * n, state, sol;
    do {
      state = new Array(N).fill(0); sol = new Array(N).fill(0);
      var cells = rng.shuffle(Array.from({ length: N }, function (_, i) { return i; })).slice(0, k);
      cells.forEach(function (i) { sol[i] = 1; press(n, state, i); });
    } while (state.every(function (v) { return v === 0; }));
    return { n: n, start: state, solution: sol, par: k };
  }

  function mount(root, P, api) {
    var n = P.n, N = n * n, state = P.start.slice(), pressed = new Array(N).fill(0), moves = 0, hintAt = -1;
    root.innerHTML = '';
    var board = MG.h('div', 'board lights-board'), grid = MG.h('div', 'grid'), cells = [];
    board.style.setProperty('--n', n);
    for (var i = 0; i < N; i++) {
      var b = MG.h('button', 'cell'); b.type = 'button'; b.dataset.i = i;
      b.setAttribute('aria-label', 'Light ' + (Math.floor(i / n) + 1) + ',' + (i % n + 1));
      grid.appendChild(b); cells.push(b);
    }
    var meter = MG.h('div', 'moves');
    board.appendChild(grid); root.appendChild(board); root.appendChild(meter);

    function render() {
      for (var i = 0; i < N; i++) {
        cells[i].classList.toggle('on', !!state[i]);
        cells[i].classList.toggle('hint', i === hintAt);
        cells[i].setAttribute('aria-pressed', state[i] ? 'true' : 'false');
      }
      meter.innerHTML = '<span>Moves <b>' + moves + '</b></span><span>Par <b>' + P.par + '</b></span>';
    }
    grid.addEventListener('click', function (e) {
      var c = e.target.closest('.cell'); if (!c) return;
      var i = +c.dataset.i;
      press(n, state, i); pressed[i] ^= 1; moves++;
      if (i === hintAt) hintAt = -1;
      api.sfx('tap'); api.buzz(6); render(); api.changed();
    });
    render();

    return {
      snapshot: function () { return { s: state.slice(), p: pressed.slice(), m: moves }; },
      restore: function (o) {
        if (o && o.s) { state = o.s.slice(); pressed = o.p.slice(); moves = o.m; }
        else { state = P.start.slice(); pressed = new Array(N).fill(0); moves = 0; }
        hintAt = -1; render();
      },
      isSolved: function () { return state.every(function (v) { return v === 0; }); },
      hint: function () {
        for (var i = 0; i < N; i++) if (P.solution[i] ^ pressed[i]) { hintAt = i; render(); return true; }
        return false;
      }
    };
  }

  MG.register({
    id: 'lights', name: 'Glow', tagline: 'Flip the lights until the board goes dark', color: 'var(--c-lights)',
    icon: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="15" y="4" width="10" height="10" rx="3" fill="currentColor" opacity=".55"/><rect x="4" y="15" width="10" height="10" rx="3" fill="currentColor" opacity=".55"/><rect x="15" y="15" width="10" height="10" rx="3" fill="currentColor"/><rect x="26" y="15" width="10" height="10" rx="3" fill="currentColor" opacity=".55"/><rect x="15" y="26" width="10" height="10" rx="3" fill="currentColor" opacity=".55"/></svg>',
    rules: [
      'Tapping a cell flips it and the four cells next to it (up, down, left, right).',
      'Switch every light off to win.',
      'Pressing a cell twice cancels out, so order never matters. Try to match par.'
    ],
    controls: 'Tap a cell to flip the plus-shape around it.',
    generate: generate, mount: mount,
    _press: press
  });
})();
