/* Archive page: month calendar of past daily sets. */
(function () {
  'use strict';
  const MG = window.MG, app = document.getElementById('app'), today = MG.today(), earliest = MG.earliestDay();
  const now = MG.parseDate(today);
  let y = now.getFullYear(), m = now.getMonth();

  function render() {
    const first = new Date(y, m, 1), daysIn = new Date(y, m + 1, 0).getDate(), offset = first.getDay();
    const minD = MG.parseDate(earliest);
    const canPrev = new Date(y, m, 0) >= new Date(minD.getFullYear(), minD.getMonth(), 1);
    const canNext = y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth());
    let cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < offset; i++) cells += '<div class="day blank"></div>';
    let full = 0, any = 0;
    for (let d = 1; d <= daysIn; d++) {
      const key = MG.dateKey(new Date(y, m, d));
      if (key > today || key < earliest) { cells += `<div class="day dis">${d}</div>`; continue; }
      const solved = MG.daySolvedTypes(key), count = Object.keys(solved).length;
      if (count) any++;
      if (count === MG.ORDER.length) full++;
      const dots = MG.ORDER.map((t) => `<i class="${solved[t] ? 'on' : ''}" style="--pc:${MG.puzzles[t].color}"></i>`).join('');
      cells += `<a class="day${key === today ? ' today' : ''}${count === MG.ORDER.length ? ' full' : ''}" href="daily.html?date=${key}"
        aria-label="${MG.prettyDate(key)}: ${count} of ${MG.ORDER.length} solved">${d}<span class="dots">${dots}</span></a>`;
    }
    app.innerHTML = `
      <header class="topbar"><div class="brand">${MG.LOGO}Archive</div></header>
      <p class="muted" style="margin:0">Every past day stays free to play, going back a full year.</p>
      <div class="calhead">
        <button type="button" class="iconbtn" id="prev" aria-label="Previous month" ${canPrev ? '' : 'disabled style="opacity:.3"'}>${MG.icon('back')}</button>
        <strong>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button type="button" class="iconbtn" id="next" aria-label="Next month" ${canNext ? '' : 'disabled style="opacity:.3"'}>${MG.icon('next')}</button>
      </div>
      <div class="cal">${cells}</div>
      <p class="muted" style="font-size:14px;margin-top:14px">This month: <b>${any}</b> day${any === 1 ? '' : 's'} played · <b>${full}</b> completed.</p>
      <div class="legend">${MG.ORDER.map((t) => `<span><i style="--pc:${MG.puzzles[t].color}"></i>${MG.puzzles[t].name}</span>`).join('')}</div>`;
    const p = document.getElementById('prev'), n = document.getElementById('next');
    if (canPrev) p.addEventListener('click', () => { m--; if (m < 0) { m = 11; y--; } render(); });
    if (canNext) n.addEventListener('click', () => { m++; if (m > 11) { m = 0; y++; } render(); });
  }
  render();
  MG.renderTabs('daily');
})();
