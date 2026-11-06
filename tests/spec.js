/* Shared generator spec: used by tests/test.html (browser) and tests/generators.test.js (Node). */
(function (global) {
  'use strict';
  global.runSpec = function (MG, SEEDS, log) {
    var fails = 0;
    function assert(cond, msg) { if (!cond) { fails++; log('FAIL: ' + msg, true); } }
    MG.DIFFS.forEach(function (diff) {
      var t0 = Date.now(), uniq = 0;
      for (var s = 0; s < SEEDS; s++) {
        var key = 'test:' + diff + ':' + s;
        var a = JSON.stringify(MG.puzzles.crowns.generate(MG.rng(key), diff));
        var b = JSON.stringify(MG.puzzles.crowns.generate(MG.rng(key), diff));
        assert(a === b, 'crowns deterministic ' + key);

        var B = MG.puzzles.blocks.generate(MG.rng(key), diff);
        assert(MG.puzzles.blocks._check(B, B.solution), 'blocks solution valid ' + key);

        var Pp = MG.puzzles.pipes.generate(MG.rng(key), diff);
        assert(MG.puzzles.pipes._check(Pp, Pp.solution), 'pipes solution valid ' + key);
        assert(!MG.puzzles.pipes._check(Pp, Pp.tiles), 'pipes not pre-solved ' + key);

        var L = MG.puzzles.link.generate(MG.rng(key), diff);
        assert(MG.puzzles.link._check(L, L.solution), 'link solution valid ' + key);

        var C = MG.puzzles.crowns.generate(MG.rng(key), diff);
        var marks = new Array(C.n * C.n).fill(0);
        C.solution.forEach(function (c, r) { marks[r * C.n + c] = 2; });
        assert(MG.puzzles.crowns._check(C, marks), 'crowns solution valid ' + key);
        var regions = {};
        C.regions.forEach(function (g) { regions[g] = true; });
        assert(Object.keys(regions).length === C.n, 'crowns has n regions ' + key);
        if (C.unique) uniq++;

        var Bl = MG.puzzles.balance.generate(MG.rng(key), diff);
        assert(MG.puzzles.balance._check(Bl, Bl.solution), 'balance solution valid ' + key);
        assert(Bl.givens.every(function (v, i) { return v === -1 || v === Bl.solution[i]; }), 'balance givens match solution ' + key);
        assert(Bl.givens.indexOf(-1) >= 0, 'balance has empty cells ' + key);
        assert(MG.puzzles.balance._count(Bl, Bl.givens) === 1, 'balance unique ' + key);

        var G = MG.puzzles.lights.generate(MG.rng(key), diff);
        var st = G.start.slice();
        G.solution.forEach(function (v, i) { if (v) MG.puzzles.lights._press(G.n, st, i); });
        assert(st.every(function (v) { return v === 0; }), 'lights solution clears board ' + key);
      }
      log(diff + ': ' + SEEDS + ' seeds x ' + MG.ORDER.length + ' puzzles checked in ' + (Date.now() - t0) + 'ms; crowns unique ' + uniq + '/' + SEEDS);
    });
    log(fails ? fails + ' FAILURES' : 'ALL PASSED', !!fails);
    return fails;
  };
})(typeof window !== 'undefined' ? window : globalThis);
