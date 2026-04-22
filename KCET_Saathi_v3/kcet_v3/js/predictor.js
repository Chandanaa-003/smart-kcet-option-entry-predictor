/*
  ════════════════════════════════════════
  predictor.js  —  College Search Engine
  ════════════════════════════════════════

  WHAT THIS FILE DOES:
  1. doSearch()     → reads form inputs, filters KCET_DATA, scores each college
  2. getChance()    → decides if a college is Safe / Stretch / Unlikely
  3. getTrend()     → checks if cutoff is Rising / Falling / Stable over 3 years
  4. renderResults()→ builds and injects HTML result cards into the page
  5. toggleChart()  → draws a Chart.js line chart inside a card when clicked
  6. doExport()     → downloads a .txt file the student can use at the KEA portal

  HOW SCORING WORKS:
  In KCET, a LOWER rank number is BETTER (rank 1 = top student).
  margin = cutoff rank − student rank
    → positive margin means student is BETTER than the cutoff → good chance
    → negative margin means student is WORSE than the cutoff → risky

  DEPENDENCIES:
  - window.KCET_DATA (set by data.js)
  - window.COURSES   (set by data.js)
  - window.App.getSelectedBranches() (set by app.js)
  - Chart.js (loaded from CDN in index.html)
*/

window.Predictor = (function () {

  // ── module-level state ──
  let results      = [];    // all scored results from the last search
  let activeFilter = 'all'; // which filter pill is active
  let charts       = {};    // Chart.js instances stored by card id


  // ══════════════════════════════════════
  // doSearch()
  // Called when user clicks "Find My Colleges"
  // ══════════════════════════════════════
  function doSearch() {

    // Step 1: read values from the form
    const rank   = parseInt(document.getElementById('rank').value);
    const cat    = document.getElementById('cat').value;
    const quota  = document.getElementById('quota').value;
    const region = document.getElementById('region').value;

    // Step 2: validate — stop if something is missing
    if (!rank || rank < 1) return showError('Please enter a valid rank (e.g. 8500)');
    if (!cat)              return showError('Please select your category');
    if (!window.DATA_READY) return showError('Data is still loading, please wait…');

    // Step 3: look up the correct slice of data
    // The data is organized by keys like "GM|General|General"
    const key  = `${cat}|${quota}|${region}`;
    const pool = window.KCET_DATA[key];

    if (!pool || pool.length === 0)
      return showError(`No data found for ${cat} / ${quota} quota / ${region} region`);

    // Step 4: get which branches the student wants
    // If none selected, include all branches
    const branches = window.App
      ? window.App.getSelectedBranches()
      : new Set(window.COURSES);

    // Step 5: loop through every college-branch in the pool and score it
    results = [];

    for (const entry of pool) {

      // skip if this branch isn't in the student's selection
      if (!branches.has(entry.course)) continue;

      // pick the most recent year's cutoff
      const years      = Object.keys(entry.cutoffs).map(Number).sort((a, b) => b - a);
      const latestYear = years[0];
      const cutoff     = entry.cutoffs[latestYear];

      // score it and push to results
      results.push({
        cn:         entry.cn,           // college name
        course:     entry.course,       // branch name
        cutoff,                         // latest cutoff rank
        latestYear,                     // e.g. 2025
        cutoffs:    entry.cutoffs,      // all years { "2023": 5000, "2024": 5800 }
        margin:     cutoff - rank,      // positive = good
        ...getChance(rank, cutoff),     // adds .chance and .label
        ...getTrend(entry.cutoffs),     // adds .trend and .trendLabel
      });
    }

    // Step 6: sort — safe first (best margin), then stretch, then reach
    const order = { safe: 0, stretch: 1, reach: 2 };
    results.sort((a, b) =>
      order[a.chance] !== order[b.chance]
        ? order[a.chance] - order[b.chance]
        : a.margin - b.margin           // within same group, closest to cutoff first
    );

    // Step 7: render the results on screen
    activeFilter = 'all';
    renderResults(rank, cat);

    // Step 8: update the Priority List tab
    if (window.App) window.App.updatePriorityPanel(rank, cat, results);
  }


  // ══════════════════════════════════════
  // getChance(studentRank, cutoff)
  // Decides: Safe / Stretch / Unlikely
  //
  // margin = cutoff - studentRank
  //  +5000 or more   → very safe
  //  +1000 to +5000  → good chance
  //  -1000 to +1000  → borderline (could go either way)
  //  -3000 to -1000  → stretch (risky but possible)
  //  below -3000     → unlikely
  // ══════════════════════════════════════
  function getChance(studentRank, cutoff) {
    const margin = cutoff - studentRank;

    if      (margin >= 5000)  return { chance: 'safe',    label: 'Safe Bet' };
    else if (margin >= 1000)  return { chance: 'safe',    label: 'Good Chance' };
    else if (margin >= -1000) return { chance: 'stretch', label: 'Borderline' };
    else if (margin >= -3000) return { chance: 'stretch', label: 'Stretch' };
    else                      return { chance: 'reach',   label: 'Unlikely' };
  }


  // ══════════════════════════════════════
  // getTrend(cutoffsObj)
  // Checks if a college is getting harder or easier over years.
  //
  // Example: { "2023": 5000, "2024": 6000, "2025": 8000 }
  //   diff = 8000 - 5000 = +3000 → Rising (harder to get)
  //
  // Rising means more students want this college each year.
  // Falling means fewer → easier to get.
  // ══════════════════════════════════════
  function getTrend(cutoffsObj) {
    const years = Object.keys(cutoffsObj).map(Number).sort((a, b) => a - b);
    if (years.length < 2) return { trend: 'flat', trendLabel: '— Stable' };

    const oldest = cutoffsObj[years[0]];
    const newest = cutoffsObj[years.at(-1)];
    const diff   = newest - oldest;

    if      (diff >  3000) return { trend: 'up',   trendLabel: '↑ Rising' };
    else if (diff < -3000) return { trend: 'down',  trendLabel: '↓ Falling' };
    else                   return { trend: 'flat',  trendLabel: '— Stable' };
  }


  // ══════════════════════════════════════
  // renderResults(rank, cat)
  // Builds HTML for all result cards and injects into #resultArea
  // ══════════════════════════════════════
  function renderResults(rank, cat) {
    const area = document.getElementById('resultArea');

    // hide the welcome message once we have results
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.style.display = 'none';

    if (!results.length) {
      area.innerHTML = emptyHTML('🔍', 'No colleges found', 'Try selecting more branches or a different quota / region.');
      return;
    }

    // split into three groups
    const safe    = results.filter(r => r.chance === 'safe');
    const stretch = results.filter(r => r.chance === 'stretch');
    const reach   = results.filter(r => r.chance === 'reach');

    // top bar
    let html = `
      <div class="results-bar">
        <div class="results-count">
          Found <b>${results.length}</b> matches — Rank <b>${rank.toLocaleString()}</b> · ${cat}
        </div>
        <button class="export-btn" onclick="Predictor.doExport()">⬇ Export List</button>
      </div>

      <div class="filter-row">
        <button class="fpill ${activeFilter === 'all'     ? 'on' : ''}" onclick="Predictor.setFilter('all',${rank},'${cat}')">All (${results.length})</button>
        <button class="fpill ${activeFilter === 'safe'    ? 'on' : ''}" onclick="Predictor.setFilter('safe',${rank},'${cat}')">✅ Safe (${safe.length})</button>
        <button class="fpill ${activeFilter === 'stretch' ? 'on' : ''}" onclick="Predictor.setFilter('stretch',${rank},'${cat}')">⚠️ Stretch (${stretch.length})</button>
        <button class="fpill ${activeFilter === 'reach'   ? 'on' : ''}" onclick="Predictor.setFilter('reach',${rank},'${cat}')">❌ Unlikely (${reach.length})</button>
      </div>

      <div class="legend">
        <div class="legend-item"><div class="ldot safe"></div> Safe / Good Chance (rank is better than cutoff)</div>
        <div class="legend-item"><div class="ldot stretch"></div> Borderline / Stretch (close to cutoff)</div>
        <div class="legend-item"><div class="ldot reach"></div> Unlikely (rank weaker than cutoff)</div>
      </div>`;

    // render cards — grouped or filtered
    if (activeFilter === 'all') {
      if (safe.length)    html += groupHeader('safe',    `✅ Safe Bets — ${safe.length}`)    + safe.map((r, i) => cardHTML(r, i + 1)).join('');
      if (stretch.length) html += groupHeader('stretch', `⚠️ Borderline — ${stretch.length}`) + stretch.map((r, i) => cardHTML(r, safe.length + i + 1)).join('');
      if (reach.length)   html += groupHeader('reach',   `❌ Unlikely — ${reach.length}`)    + reach.map((r, i) => cardHTML(r, safe.length + stretch.length + i + 1)).join('');
    } else {
      html += results
        .filter(r => r.chance === activeFilter)
        .map((r, i) => cardHTML(r, i + 1))
        .join('');
    }

    area.innerHTML = html;
    charts = {};  // clear old chart references (DOM was replaced)
  }


  // ── helper: section group header ──
  function groupHeader(cls, text) {
    return `
      <div class="group-header ${cls}">
        <div class="line"></div>
        <div class="label">${text}</div>
        <div class="line"></div>
      </div>`;
  }


  // ── helper: single result card HTML ──
  function cardHTML(r, position) {
    // unique id for this card's trend chart
    const uid   = `card${position}_${Math.random().toString(36).slice(2, 6)}`;
    const data  = JSON.stringify(r.cutoffs).replace(/"/g, "'");  // will go into onclick
    const delay = Math.min(position * 0.025, 0.5);

    return `
      <div class="rcard ${r.chance}" style="animation-delay:${delay}s"
           onclick="Predictor.toggleChart('${uid}', ${data})">

        <!-- position number -->
        <div class="rank-num ${r.chance}">${position}</div>

        <!-- college name, branch, status -->
        <div>
          <div class="card-college">${r.cn}</div>
          <div class="card-branch">${cap(r.course)}</div>
          <span class="card-status ${r.chance}">${r.label}</span>
        </div>

        <!-- cutoff rank and trend -->
        <div class="card-right">
          <div class="card-trend ${r.trend}">${r.trendLabel}</div>
        </div>

        <!-- trend chart — hidden until card is clicked -->
        <div class="trend-area" id="${uid}">
          <canvas id="${uid}_c" height="140"></canvas>
        </div>
      </div>`;
  }


  // ── helper: empty / error state ──
  function emptyHTML(icon, title, msg) {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <div class="empty-title">${title}</div>
        <p>${msg}</p>
      </div>`;
  }

  function showError(msg) {
    document.getElementById('resultArea').innerHTML = emptyHTML('⚠️', msg, '');
    const welcome = document.getElementById('welcomeMsg');
    if (welcome) welcome.style.display = 'none';
  }


  // ══════════════════════════════════════
  // toggleChart(uid, cutoffsStr)
  // Expands / collapses the trend line chart inside a result card.
  // Uses Chart.js to draw the chart.
  // ══════════════════════════════════════
  function toggleChart(uid, cutoffsStr) {
    const cutoffs = JSON.parse(cutoffsStr.replace(/'/g, '"'));
    const el      = document.getElementById(uid);
    const isOpen  = el.classList.contains('open');

    // if already open → close it and destroy the chart
    if (isOpen) {
      el.classList.remove('open');
      if (charts[uid]) { charts[uid].destroy(); delete charts[uid]; }
      return;
    }

    // open it
    el.classList.add('open');

    // wait 50ms for CSS transition, then draw the chart
    setTimeout(() => {
      const years  = Object.keys(cutoffs).sort();
      const values = years.map(y => cutoffs[y]);

      charts[uid] = new Chart(
        document.getElementById(`${uid}_c`).getContext('2d'),
        {
          type: 'line',
          data: {
            labels: years,
            datasets: [{
              label:                'Cutoff Rank',
              data:                 values,
              borderColor:          '#1d4ed8',
              backgroundColor:      'rgba(29,78,216,0.07)',
              pointBackgroundColor: '#1d4ed8',
              pointRadius:          5,
              tension:              0.35,
              fill:                 true,
            }],
          },
          options: {
            responsive: true,
            plugins: {
              legend:  { display: false },
              tooltip: {
                callbacks: {
                  // show "Rank: 5,000" in tooltip instead of just the number
                  label: ctx => `Rank: ${ctx.raw.toLocaleString()}`
                }
              },
            },
            scales: {
              y: {
                reverse: true,   // rank 1 is best → show at top of chart
                ticks:   { font: { size: 10 }, callback: v => v.toLocaleString() },
                grid:    { color: 'rgba(0,0,0,0.05)' },
              },
              x: {
                ticks: { font: { size: 10 } },
                grid:  { display: false },
              },
            },
          },
        }
      );
    }, 50);
  }


  // ══════════════════════════════════════
  // setFilter(filter, rank, cat)
  // Called when a filter pill is clicked (All / Safe / Stretch / Unlikely)
  // ══════════════════════════════════════
  function setFilter(filter, rank, cat) {
    activeFilter = filter;
    renderResults(rank, cat);
  }


  // ══════════════════════════════════════
  // doExport()
  // Generates a numbered text file the student can keep open
  // while filling the KEA option entry portal.
  // ══════════════════════════════════════
  function doExport() {
    if (!results.length) { alert('Search for colleges first!'); return; }

    const rank     = document.getElementById('rank').value;
    const cat      = document.getElementById('cat').value;
    const eligible = results.filter(r => r.chance !== 'reach'); // skip unlikely ones

    // build the text content
    let txt = 'KCET OPTION ENTRY LIST\n';
    txt += `Rank: ${parseInt(rank).toLocaleString()}  |  Category: ${cat}\n`;
    txt += `Generated: ${new Date().toLocaleDateString('en-IN')}\n`;
    txt += '='.repeat(60) + '\n\n';
    txt += 'FILL IN THIS EXACT ORDER IN THE KEA PORTAL:\n\n';

    eligible.forEach((r, i) => {
      txt += `${i + 1}. ${r.cn}\n`;
      txt += `   Branch  : ${r.course}\n`;
      txt += `   Cutoff  : ${r.cutoff.toLocaleString()} (${r.latestYear})  —  ${r.label}\n\n`;
    });

    txt += '─'.repeat(60) + '\n';
    txt += 'TIPS:\n';
    txt += '• Fill ALL options above — more options = more safety\n';
    txt += '• Dream college goes FIRST, safest college goes LAST\n';
    txt += '• KEA gives you the BEST seat you qualify for\n';
    txt += '• Always double-check at kea.kar.nic.in\n';

    // trigger download
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `KCET_Rank${rank}_OptionEntry.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }


  // ── getters used by other files ──
  function getResults()  { return results; }
  function getEligible() { return results.filter(r => r.chance !== 'reach'); }


  // ── public functions exposed to rest of the app ──
  return { doSearch, setFilter, toggleChart, doExport, getResults, getEligible };

})();
