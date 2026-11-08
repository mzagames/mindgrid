/* MindGrid level director: endless levels tuned to each player, built on the phone in milliseconds.
 *
 * For Journey, Puzzle modes and Mix Mode (the Daily challenge stays the same for everyone):
 *  1. Target difficulty d (0..100) = progression ramp for that mode, pulled toward the player's skill
 *     in that puzzle (from Puzzle IQ), plus their recent "form" (fast + no hints -> harder, struggling -> easier).
 *  2. The puzzle's generator builds a candidate from d (grid size, clue density, ...).
 *  3. Quality gate: the puzzle's own solver checks it (unique answer, not trivial, right kind of logic).
 *  4. No repeats: every puzzle's fingerprint is remembered; a duplicate is never served.
 *  5. The chosen seed is saved, so replaying a level or resuming it gives the exact same puzzle.
 * World 1 of the Journey (levels 1-12) is a fixed, hand-picked intro ramp that every new player gets. */
(function () {
  'use strict';
  var MG = window.MG;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // progression ramp per mode: [start d, +d per level]
  var RAMP = { journey: [6, 1.4], practice: [6, 2.6], mix: [10, 2.2] };
  // Journey World 1 for every new player: each puzzle first at its gentlest, then a little firmer.
  // `a` = hand-picked candidate number (chosen with MG._pickIntro so each one passes the quality gate gently).
  var INTRO = [
    { d: 0, a: 19 }, { d: 0, a: 5 }, { d: 0, a: 27 }, { d: 0, a: 0 }, { d: 0, a: 0 }, { d: 0, a: 0 },
    { d: 10, a: 14 }, { d: 10, a: 0 }, { d: 12, a: 4 }, { d: 12, a: 0 }, { d: 14, a: 0 }, { d: 14, a: 0 }
  ];
  MG.INTRO_LEVELS = INTRO.length;

  function salt() {
    var s = MG.load();
    if (!s.salt) { s.salt = (Math.floor(Math.random() * 0x7ffffffe) + 1); MG.save(); }
    return s.salt;
  }
  var fpSet = null;
  function seenFp(fp) {
    if (!fpSet) fpSet = new Set(MG.load().fps);
    return fpSet.has(fp);
  }
  function addFp(fp) {
    var s = MG.load(); seenFp(fp);
    fpSet.add(fp); s.fps.push(fp);
    if (s.fps.length > 5000) { s.fps = s.fps.slice(-5000); fpSet = new Set(s.fps); }
  }

  MG.levelType = function (mode, n, type) {
    if (mode === 'journey') return MG.ORDER[(n - 1) % MG.ORDER.length];
    if (mode === 'mix') return MG.mixSpec(n).type;
    return type;
  };
  MG.levelKey = function (mode, n, type) {
    return mode === 'journey' ? MG.journeyKey(n) : mode === 'mix' ? MG.mixKey(n) : MG.practiceKey(type, n);
  };
  function isIntro(mode, n) { return mode === 'journey' && n <= INTRO.length; }

  /** Difficulty the director would pick right now for a level that hasn't been built yet. */
  MG.targetD = function (mode, type, n) {
    if (isIntro(mode, n)) return INTRO[n - 1].d;
    var r = RAMP[mode] || RAMP.journey, ramp = clamp(r[0] + (n - 1) * r[1], 0, 100);
    var s = MG.load(), sk = s.iq.skills[type], form = s.form[type] || 0;
    var w = sk ? Math.min(0.6, sk.n / 12) : 0;
    var skillD = sk ? clamp(((sk.score - 85) / 60) * 100, 0, 100) : ramp;
    var d = (1 - w) * ramp + w * skillD + form;
    return Math.round(clamp(d, Math.max(0, ramp - 25), Math.min(100, ramp + 30)));
  };

  /** Type, difficulty and label of a level, without building it (for maps and menus). */
  MG.levelInfo = function (mode, n, type) {
    type = MG.levelType(mode, n, type);
    var rec = MG.load().levels[MG.levelKey(mode, n, type)];
    var d = rec ? rec.d : MG.targetD(mode, type, n);
    return { type: type, d: d, diff: MG.dLabel(d), built: !!rec, intro: isIntro(mode, n) };
  };

  function seedOf(mode, n, key, a, intro) {
    return intro ? MG.hash('mindgrid|intro|' + n + '|' + a) : MG.hash('mindgrid|' + salt() + '|' + key + '|' + a);
  }
  function build(P, d, seed) { return P.generate(MG.rng(seed), MG.dLabel(d), P.cfgFor ? P.cfgFor(d) : undefined); }
  function fingerprint(type, puz) { return MG.hash(type + '|' + JSON.stringify(puz)); }

  /** Get (or create) a level. Returns {key, type, d, diff, puzzle, fresh, intro, tries, ms}. */
  MG.level = function (mode, n, type) {
    type = MG.levelType(mode, n, type);
    var key = MG.levelKey(mode, n, type), s = MG.load(), P = MG.puzzles[type], rec = s.levels[key], intro = isIntro(mode, n);
    var t0 = performance.now();
    if (rec) {
      return { key: key, type: type, d: rec.d, diff: MG.dLabel(rec.d), puzzle: build(P, rec.d, seedOf(mode, n, key, rec.a, rec.i)),
        fresh: false, intro: !!rec.i, tries: 0, ms: performance.now() - t0 };
    }
    var d = MG.targetD(mode, type, n), start = intro ? INTRO[n - 1].a : 0, pick = null, fallback = null, a;
    for (a = start; a < start + 40; a++) {
      var puz = build(P, d, seedOf(mode, n, key, a, intro)), fp = fingerprint(type, puz);
      if (seenFp(fp)) continue;
      var q = P.quality ? P.quality(puz, d) : { ok: true };
      if (q.ok) { pick = { a: a, puz: puz, fp: fp }; break; }
      if (!fallback) fallback = { a: a, puz: puz, fp: fp };
      if (performance.now() - t0 > 160 && fallback) break; // never keep the player waiting
    }
    pick = pick || fallback;
    s.levels[key] = { d: d, a: pick.a, i: intro ? 1 : 0 };
    addFp(pick.fp);
    MG.save();
    return { key: key, type: type, d: d, diff: MG.dLabel(d), puzzle: pick.puz, fresh: true, intro: intro, tries: a - start + 1, ms: performance.now() - t0 };
  };

  /** Build the next level in the background (e.g. while the win screen is up) so it opens instantly. */
  MG.prepareLevel = function (mode, n, type) {
    setTimeout(function () { try { MG.level(mode, n, type); } catch (e) { /* built on open instead */ } }, 400);
  };

  // Menus show Journey difficulty from the director (core's journeySpec only knew fixed tiers).
  MG.journeySpec = function (n) { var i = MG.levelInfo('journey', n); return { type: i.type, diff: i.diff, d: i.d }; };

  /** Dev helper: choose the gentlest passing candidate for each intro level (used to fill INTRO[].a). */
  MG._pickIntro = function (tries) {
    return INTRO.map(function (it, k) {
      var n = k + 1, type = MG.levelType('journey', n), P = MG.puzzles[type], best = null;
      for (var a = 0; a < (tries || 40); a++) {
        var puz = build(P, it.d, seedOf('journey', n, '', a, true)), q = P.quality(puz, it.d);
        if (q.ok && (!best || q.effort < best.effort)) best = { a: a, effort: q.effort };
      }
      return { n: n, type: type, d: it.d, a: best ? best.a : 0, effort: best ? best.effort : null };
    });
  };
})();
