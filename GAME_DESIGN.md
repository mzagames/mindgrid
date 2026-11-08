# MindGrid — Game Design Document

> An original, minimalist daily logic-puzzle collection for the web (installable PWA, offline-ready).
> This document comes from studying the **public** information about a game in this genre: the Google Play
> listing of *The Almanac* by Voodoo (`com.voodoo.almanac`), its store description, user reviews and
> public UX write-ups. **MindGrid does not use that game's name, art, text, code or levels.** We kept only
> the genre conventions: daily logic puzzles, difficulty tiers, a level journey, an archive and streaks.
> The rest is our own design. Nothing was decompiled.

---

## 1. Reference analysis (what the genre leader does)

| Area | Observed in the reference (public listing / reviews) | Takeaway for MindGrid |
|---|---|---|
| Positioning | "Brain workout" and an alternative to endless scrolling. Minimalist, distraction-free. | Calm, ad-free UI. One goal per screen. |
| Content | A collection of different logic and spatial puzzles. Each new type starts with a tutorial level. | 5 puzzle families. Rules are shown the first time you play each one. |
| Structure | A linear level map, daily challenges, and past days you can replay. | Three loops: **Today**, **Journey** and **Archive**. |
| Difficulty | Several difficulty levels, including an "expert" tier. | Easy / Medium / Hard / Expert for every puzzle. |
| Feedback | Encouraging messages ("Impressive!") and comparison stats after solving. | A win modal with praise, time, best time and confetti. |
| Settings | Dark mode, haptics. | Light/Dark/System theme, sound, haptics, timer toggle. |
| Monetization | Ads, ad-gated past days, a subscription and a one-off ad removal. | **None.** Reviews complain about ads and paywalls, so MindGrid is free and open. |
| Pain points (reviews) | Too speed-focused, puzzles too easy, an ad-gated archive, lost progress after a crash. | Logic-first (timer can be hidden). Hard and Expert tiers. A free archive. **Autosave of in-progress puzzles.** |

---

## 2. Core pillars

1. **Pure logic.** Every puzzle can be solved by reasoning. Daily puzzles are deterministic: everyone gets the same puzzle on the same date.
2. **Short sessions.** Most puzzles take 1–5 minutes.
3. **No clutter.** No accounts, no network needed after the first load. Ads (Android app only) appear only between levels and on menu screens, never during a puzzle.
4. **Never lose progress.** Every move is autosaved locally, and undo is unlimited.

---

## 3. Puzzle families (all original implementations)

Every puzzle is **procedurally generated** from a seed, so we never ship level files.

| ID | Name | Rule summary | Generator | Win check |
|---|---|---|---|---|
| `blocks` | **Blocks** | Split the grid into rectangles. Each rectangle holds exactly one number, and that number equals its area. | Random rectangle tiling (row-major greedy, area-capped), then a clue placed at a random cell of each tile. | Every cell covered, and each rectangle has exactly one clue equal to its area. |
| `pipes` | **Pipes** | Rotate tiles so that every pipe connects into one network that reaches the source. No open ends. | Randomized Prim spanning tree from the centre, then each tile rotated at random. | Every pipe end meets a neighbour, and BFS from the source reaches all tiles. |
| `link` | **Link** | Draw one path from 1 that visits every cell once and passes the numbers in order. | Random Hamiltonian path (serpentine plus "backbite" moves), with checkpoints spread along it. | Path covers all cells, starts at 1, ends at the last number, and numbers appear in order. |
| `crowns` | **Crowns** | Place one crown in each row, column and colour region. Crowns may not touch, even diagonally. | Random non-touching permutation, then regions grown from each crown. A solver retries until the solution is **unique**. | N crowns and zero conflicts. |
| `lights` | **Glow** | Tapping a cell flips it and its 4 neighbours. Turn every light off. | Random presses applied to an empty board, so it is always solvable. | All cells off. |
| `balance` | **Balance** *(v1.1)* | Fill every cell with a sun or a moon. Each row and column is half and half, with never three alike in a line. | Random full grid from a propagate-and-backtrack solver, then clues removed one by one while the solution stays **unique**. | Grid full, balanced and no triples. |

### Difficulty table

| Puzzle | Easy | Medium | Hard | Expert |
|---|---|---|---|---|
| Blocks (size / max area) | 5×5 / 6 | 6×6 / 8 | 8×8 / 12 | 10×10 / 16 |
| Pipes (size) | 4×4 | 5×5 | 7×7 | 8×8 |
| Link (size / numbers) | 5×5 / 8 | 6×6 / 9 | 7×7 / 10 | 8×8 / 11 |
| Crowns (size) | 5×5 | 6×6 | 8×8 | 9×9 |
| Glow (size / presses) | 3×3 / 3 | 4×4 / 5 | 5×5 / 8 | 6×6 / 12 |
| Balance (size / clues kept) | 6×6 / ~50% | 8×8 / ~40% | 10×10 / ~34% | 10×10 / minimal |

### Controls

| Puzzle | Input |
|---|---|
| Blocks | Drag from corner to corner to draw a rectangle. Tap a rectangle to delete it. |
| Pipes | Tap to rotate clockwise. Right-click rotates counter-clockwise. |
| Link | Press on **1** and drag. Drag backwards (or press an earlier cell) to backtrack. |
| Crowns | Tap to cycle empty → ✕ → crown. Drag over empty cells to paint ✕ marks. |
| Glow | Tap a cell. |
| Balance | Tap to cycle sun → moon → empty. Right-click cycles backwards. Shaded cells are fixed. |

All puzzles support **Undo**, **Reset** and **Hint**:
- Blocks: places one correct rectangle.
- Pipes: turns one wrong tile to the right orientation.
- Link: extends the correct path to the next number.
- Crowns: removes a wrong crown, or places a correct one.
- Glow: highlights a cell to press.
- Balance: fixes a wrong cell, otherwise fills a cell that logic forces next.

---

## 4. Game loops and progression

### 4.1 Today (daily challenge)
- The 6 puzzles for each date are generated from `seed = hash("mindgrid|d:<date>:<type>:<difficulty>")`.
- **Share** (v1.1): copies an emoji summary of the day, for example `🟧 Blocks 1:23 · ⬜ Pipes –`, plus the game link. It uses the share sheet on phones and the clipboard on desktop.
- You choose a difficulty with a segmented control (it is remembered).
- Solving at least one daily puzzle **on its own date** keeps the 🔥 **streak** alive.

### 4.2 Journey (endless level map)
- Levels 1 → ∞ cycle through the 5 puzzle types.
- Difficulty bands: 1–10 Easy, 11–30 Medium, 31–60 Hard, 61+ Expert.
- Levels unlock one by one. Each seed is `hash("mindgrid|j:<level>")`.

### 4.3 Archive
- A month calendar going back 365 days. Each day shows a coloured dot per solved puzzle type.
- Past days are **free** (no ad gate). They do not change the streak.

### 4.4 Stats
- Current and best streak, total solves, journey level, the last 7 days, and a best-time grid for each puzzle and difficulty.

---

## 5. Screens (pages)

| Page | File | Contents |
|---|---|---|
| Today | `index.html` | Date, streak chip, difficulty selector, 5 puzzle cards (Play / In progress / Solved time), a Journey shortcut. `?date=YYYY-MM-DD` shows a past day. |
| Play | `play.html` | Back button, title, timer, the board, Undo/Reset/Hint, collapsible rules, a first-time tutorial modal and a win modal. `?type=&date=&diff=` or `?mode=journey&level=`. |
| Journey | `journey.html` | A winding path of level nodes (done ✓ / current / locked), with difficulty band labels. |
| Archive | `archive.html` | A month calendar with prev/next, progress dots, and links to past days. |
| Stats | `stats.html` | Stat tiles, the 7-day strip and a best-times table. |
| Settings | `settings.html` | Theme, sound, haptics, timer, reset progress, About. |
| How to play | `howto.html` | Rules and controls for every puzzle. |

Navigation: a bottom tab bar (Today · Journey · Archive · Stats · Settings). The Play page hides it to keep focus.

---

## 6. Feel and feedback
- **Visual:** a warm paper-white or deep charcoal background, rounded cards, and one accent colour per puzzle (Blocks amber, Pipes teal, Link coral, Crowns violet, Glow blue).
- **Audio:** tiny WebAudio sine blips for taps, hints, errors and wins. No audio files.
- **Haptics:** `navigator.vibrate` on placement and when you win.
- **Win:** a board pulse, confetti (skipped with *reduced motion*), and a random praise line ("Brilliant!", "Sharp mind!"…).

---

## 6b. Monetization (v1.3, Android app)
- **Google AdMob** through the Capacitor plugin `@capacitor-community/admob` (`js/ads.js`).
- **Interstitial between levels:** only when leaving the win screen (Next / Back), at most once every 3 solves and
  at least 90 s apart. It never appears while a puzzle is in progress.
- **Adaptive banner** at the bottom of the menu screens (Today, Journey, Archive, Stats). The tab bar moves up above it.
  There is no banner on the puzzle, settings, how-to or privacy screens.
- **Consent:** the Google UMP form is shown to EEA/UK users before ads load, and Settings → *Ad privacy choices* reopens it.
- The **web version has no ads** (`js/ads.js` does nothing without the native bridge).
- The native app is built in CI: `.github/workflows/android.yml` with `android-app/` (Capacitor 8).

---

## 7. Technical architecture

```
MindGrid/
├── index.html  play.html  journey.html  archive.html  stats.html  settings.html  howto.html
├── manifest.webmanifest   sw.js (offline cache)   .nojekyll
├── assets/icon.svg
├── css/style.css                 design tokens, light/dark themes, all components
└── js/
    ├── core.js                   MG namespace: seeded RNG, dates, storage, theme, sfx, haptics, icons, nav
    ├── puzzles/{blocks,pipes,link,crowns,lights}.js   generate() + mount() per puzzle
    └── pages/{home,play,journey,archive,stats,settings,howto}.js
```

- **No build step, no dependencies.** It is plain HTML, CSS and JS, so it runs straight from GitHub Pages.
- **Puzzle module contract**
  ```js
  MG.register({
    id, name, tagline, color, icon, rules: [..],
    generate(rng, diff) -> puzzle,        // deterministic for a given rng
    mount(el, puzzle, api) -> {           // api: changed(), sfx(kind), buzz(ms)
      snapshot(), restore(s), isSolved(), hint() -> bool, reset()
    }
  })
  ```
- **RNG:** a `cyrb`-style string hash feeding `mulberry32`.
- **Persistence:** one `localStorage` key, `mindgrid.v1`:
  ```json
  { "settings": {"theme":"system","sound":true,"haptics":true,"timer":true,"dailyDiff":"medium","seen":{}},
    "results":  {"d:2026-11-06:pipes:medium": {"time":74,"hints":0,"plays":1,"at":"2026-11-06"}},
    "progress": {"j:12": {"snap": {}, "elapsed": 31, "hints": 1}},
    "journey":  {"level": 13},
    "days":     {"2026-11-06": 2},
    "log":      [{"type":"pipes","diff":"medium","time":74,"hints":0,"at":"2026-11-06"}] }
  ```
- **Undo:** the Play page keeps a stack of JSON snapshots from `controller.snapshot()`.
- **Offline:** `sw.js` pre-caches every file (cache-first). The site is installable through the manifest.

---

## 8. Step-by-step build plan (as executed)

1. **Research:** read the store listing, reviews and public UX notes, and write §1.
2. **Foundation:** `core.js` (RNG, storage, theme, sound, nav) and `style.css` (tokens, dark mode).
3. **Puzzles:** build each generator and controller one at a time (Blocks → Pipes → Link → Crowns → Glow). Test that the generated solution passes the win check.
4. **Play page:** timer, autosave/resume, undo/reset/hint, tutorial modal, win modal and "Next" flow.
5. **Meta pages:** Today, Journey, Archive, Stats, Settings, How-to.
6. **PWA:** manifest, icon, service worker.
7. **Test:** run the generators for many seeds in Node (`tests/generators.test.js`), then play in a browser on desktop and phone widths.
8. **Ship:** git init and commit, push to GitHub, enable **GitHub Pages** so the game is playable online.
9. **v1.1:** added the Balance puzzle (binary grid, unique solutions) and the Share result feature.

---

## 9. Future ideas
- ~~Binary grid puzzle~~ (shipped in v1.1 as **Balance**). Next ideas: nonogram, sum-sudoku.
- ~~Share card~~ (shipped in v1.1).
- Weekly themed challenge and achievements.
- Optional cloud sync (Supabase or Firebase) to keep progress across devices.
- Native wrappers (Capacitor) for Play Store and App Store builds.

## 9. v1.4: "Make it a game" update

| Area | What changed |
|---|---|
| Look | Vivid violet/navy theme (light and dark), glossy chunky buttons, floating tab bar, glowing boards, Nunito font. |
| Puzzle art | Each puzzle has its own animated tile icon (sliding block, flowing pipe, path drawing, bobbing crown, glowing cells, spinning sun). Duotone UI icons. |
| Intro | Splash once per app session: MZA Games logo, then the MindGrid tiles assemble with a loading bar and a tip. Native Android splash matches it. |
| Home hub | Puzzle IQ gauge, a big Journey button, the Daily challenge, **Puzzle modes** (one puzzle type with its own levels) and **Mix Mode**. |
| Modes | `practice` (`p:<type>:<n>`, Easy 1–5, Medium 6–15, Hard 16–35, Expert after) and `mix` (`m:<n>`, never the same puzzle twice in a row, faster ramp). |
| Journey | A world map, bottom to top: 9 themed worlds of 12 levels (Sunrise Meadow, Coral Lagoon, Amber Dunes, Frost Peaks, Candy Clouds, Neon City, Crystal Caves, Lava Forge, Starfield), a road that turns gold as you go, stars under levels, a "YOU" marker. |
| Stars | 3 = no hints and within par time; 2 = at most one hint and within 2× par; 1 = solved. A live target above the board shows what you still need. |
| Puzzle IQ | For-fun rating (70–160). Each solve scores difficulty base + speed vs par − hints − heavy undo use + a no-hint streak bonus. IQ moves toward each score (bigger steps while calibrating; revealed after 3 solves). Each puzzle has its own skill rating. Ranks: Rising Thinker → Grand Master. Existing players get an IQ built from their solve log. |
| Win screen | Ribbon, stars popping in with rising chimes, speed rating, IQ counting up with its change, rank-up fanfare, confetti burst, board shine sweep. |
| Ads | Banner is kept for the whole app session (hidden on puzzles, resumed on menus), retried with backoff when a load fails, restored when the app returns to the foreground. A short branded "ad break" card shows before an interstitial. |

## 10. v1.4.1: tutorials and "just completed" moments

| Area | What changed |
|---|---|
| Hand | A shaded pointing hand (skin gradient, nail, knuckle creases, violet MindGrid cuff) drives every tutorial. |
| Puzzle intros | First time you open a puzzle, a mini board plays itself: the hand drags, taps and rotates while step captions explain the rules (`js/tutorial.js`, `DEMOS`). Replay from How to play → Watch demo. |
| Screen tours | First visit to Home, Journey, Daily, Archive, IQ, Settings, How to play and the play screen: the screen dims, one element is spotlighted, the hand taps it, with a short tip (Next / Skip). Stored as `seen["tour:<id>"]`; Settings → Replay tutorials resets them. |
| Solved stamp | On a solve, a "Solved!/Perfect!" stamp with stars pops on the board before the win screen. |
| Just completed | Back on the screen you came from, the finished item pops, its stars drop in, a badge and sparkles appear: Journey (road grows gold, YOU walks to the next level), Puzzle mode and Mix tiles (level bar fills), Daily cards (progress bar fills). |

## 11. v1.5: the level director (endless levels tuned to each player)

Journey, Puzzle modes and Mix Mode no longer use four fixed tiers. `js/levels.js` builds every level on the phone:

1. **Difficulty dial (0-100).** Each puzzle has `cfgFor(d)` that maps d to generator settings (grid size, clue count, presses, givens). The classic tiers sit at d = 12/37/62/87, so settings and par times are interpolated between values already tuned (`MG.tierLerp`).
2. **Target difficulty** = mode ramp (Journey 6 + 1.4/level, Puzzle modes 6 + 2.6/level, Mix 10 + 2.2/level), pulled toward the player's skill in that puzzle (up to 60% weight as solves accumulate), plus **form** (−20..+20: 3 fast stars push up, hints and slow solves pull down). Clamped to ramp −25 / +30 so nobody gets stuck or skipped ahead wildly.
3. **Quality gate** (`quality(P, d)` per puzzle, using each puzzle's own solver):
   - Blocks: exactly one tiling (new exact-cover solver); not mostly slivers.
   - Crowns: exactly one solution.
   - Balance: easy levels need zero guessing; hard ones need some.
   - Pipes: most tiles start wrong, and the network branches.
   - Link: the hidden path twists.
   - Glow: enough lights on, and not trivially separable.

   Up to 40 candidates are tried, within a ~160 ms budget; the first that passes is used.
4. **No repeats**: a fingerprint of every served puzzle is stored (last 5,000); duplicates are skipped.
5. **Stable levels**: the chosen candidate and d are saved per level (`levels[key]`), seeded with a per-install salt, so replay/resume rebuilds the same puzzle and different players get different puzzles.
6. **Hand-picked intro**: Journey World 1 (levels 1-12) is the same gentle ramp for every new player, with each puzzle first at d = 0; candidates were picked with `MG._pickIntro()`.
7. **No waiting**: the next level is built in the background while the win screen plays. Average build 2.6 ms, worst ~0.13 s (9×9 Crowns).

The Daily challenge keeps the fixed tiers so everyone gets the same six puzzles.
