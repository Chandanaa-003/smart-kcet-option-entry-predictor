/*
  ════════════════════════════════════════
  app.js  —  Main App Controller
  ════════════════════════════════════════

  WHAT THIS FILE DOES:
  This file is the "glue" that connects everything together.
  It is loaded LAST so it can safely use functions from the other files.

  RESPONSIBILITIES:
  1. switchTab()           → switches between the 3 main tabs
  2. onReady()             → called by data.js once JSON data is loaded
  3. buildTags()           → builds the branch tag cloud in the sidebar
  4. toggleBranch()        → selects / deselects a branch tag
  5. pickPopular/All/None  → quick-select buttons for branches
  6. getSelectedBranches() → returns the set of selected branches
  7. updatePriorityPanel() → fills the Priority List tab after a search
  8. doSearch / doExport   → proxy methods called from HTML buttons

  LOAD ORDER (index.html loads these in this order):
  1. data.js      → sets window.KCET_DATA, window.COURSES
  2. predictor.js → registers window.Predictor
  3. ai.js        → registers window.AI
  4. app.js       → this file, wires everything up
*/

window.App = (function () {

  // ── state ──
  let selectedBranches = new Set();   // branches the student has ticked


  // ══════════════════════════════════════
  // switchTab(name)
  // Called by the nav tab buttons in index.html.
  // Shows the matching panel, hides the others.
  // ══════════════════════════════════════
  window.switchTab = function (name) {
    // hide all panels
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    // deactivate all nav tab buttons
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    // show the selected panel and activate its tab
    document.getElementById(`panel-${name}`).classList.add('active');
    document.getElementById(`tab-${name}`).classList.add('active');
  };


  // ══════════════════════════════════════
  // onReady()
  // data.js calls this global function once the JSON files have loaded.
  // This is the entry point that starts the UI.
  // ══════════════════════════════════════
  window.onReady = function () {
    buildTags();       // populate the branch tag cloud
    pickPopular();     // pre-select CS/IT/AI branches by default
    bindEvents();      // attach keyboard shortcuts

    console.log('[app.js] App is ready!');
  };


  // ══════════════════════════════════════
  // buildTags(filter)
  // Renders the branch tag cloud in the sidebar.
  // If filter is given, only shows matching branches.
  // ══════════════════════════════════════
  function buildTags(filter = '') {
    const cloud = document.getElementById('tagCloud');
    if (!cloud) return;

    // filter the list if the student is searching for a specific branch
    const list = filter
      ? window.COURSES.filter(c => c.toLowerCase().includes(filter.toLowerCase()))
      : window.COURSES;

    // build one <div class="tag"> for each branch
    cloud.innerHTML = list.map(course => `
      <div class="tag ${selectedBranches.has(course) ? 'on' : ''}"
           onclick="App.toggleBranch('${course.replace(/'/g, "\\'")}')">
        ${cap(course)}
      </div>`
    ).join('');
  }


  // ══════════════════════════════════════
  // toggleBranch(course)
  // Adds or removes a branch from the selection when a tag is clicked.
  // ══════════════════════════════════════
  function toggleBranch(course) {
    if (selectedBranches.has(course)) {
      selectedBranches.delete(course);   // deselect
    } else {
      selectedBranches.add(course);      // select
    }

    // rebuild tags to update the visual "on" state
    buildTags(document.getElementById('branchSearch')?.value || '');
  }


  // ══════════════════════════════════════
  // Branch quick-select helpers
  // Called by the chip buttons in the sidebar
  // ══════════════════════════════════════

  // select all branches that contain CS/IT/AI keywords
  function pickPopular() {
    selectedBranches.clear();
    window.COURSES.forEach(course => {
      if (window.POPULAR_KEYWORDS.some(kw => course.includes(kw))) {
        selectedBranches.add(course);
      }
    });
    buildTags(document.getElementById('branchSearch')?.value || '');
  }

  // select every branch
  function pickAll() {
    window.COURSES.forEach(c => selectedBranches.add(c));
    buildTags();
  }

  // deselect everything
  function pickNone() {
    selectedBranches.clear();
    buildTags();
  }


  // ══════════════════════════════════════
  // getSelectedBranches()
  // Used by predictor.js to know which branches to include in search.
  // If nothing is selected, we return ALL branches (no filter).
  // ══════════════════════════════════════
  function getSelectedBranches() {
    return selectedBranches.size > 0
      ? selectedBranches
      : new Set(window.COURSES);     // no filter = include everything
  }


  // ══════════════════════════════════════
  // updatePriorityPanel(rank, cat, results)
  // Called by predictor.js after every search.
  // Fills the Priority List tab with the top 20 eligible colleges.
  // ══════════════════════════════════════
  function updatePriorityPanel(rank, cat, results) {
    const area = document.getElementById('priorityArea');

    // only show Safe and Borderline (not Unlikely) in the priority list
    const eligible = results.filter(r => r.chance !== 'reach').slice(0, 20);

    if (!eligible.length) {
      area.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">😕</div>
          <div class="empty-title">No safe colleges found</div>
          <p>Try selecting more branches or a different category.</p>
        </div>`;
      return;
    }

    // build the dark priority box
    area.innerHTML = `
      <div class="priority-box">
        <h3>🎯 Recommended Option Entry Order — Rank ${rank.toLocaleString()} · ${cat}</h3>
        <ul class="plist">
          ${eligible.map((r, i) => `
            <li class="pitem" style="animation-delay:${i * 0.04}s">
              <div class="pnum">${i + 1}</div>
              <div>
                <div class="p-college">${r.cn}</div>
                <div class="p-branch">${cap(r.course)}</div>
              </div>
              <div class="p-cutoff">Cutoff: ${r.cutoff.toLocaleString()}</div>
            </li>`).join('')}
        </ul>
      </div>

      <div class="tips-card">
        <b>💡 How to fill the KEA portal:</b><br>
        • Fill all <b>${eligible.length} options above</b> in this exact order<br>
        • Always put your <b>dream college first</b>, even if it's a stretch<br>
        • KEA automatically gives you the <b>best seat you qualify for</b><br>
        • Never submit with <b>fewer than 30–40 options</b> — more is always safer
      </div>

      <button class="export-big-btn" onclick="Predictor.doExport()">
        ⬇ Download Option Entry List (.txt)
      </button>`;
  }


  // ══════════════════════════════════════
  // bindEvents()
  // Attaches keyboard shortcuts and other event listeners.
  // ══════════════════════════════════════
  function bindEvents() {
    // typing in the branch search box → filter the tags
    const branchSearch = document.getElementById('branchSearch');
    if (branchSearch) {
      branchSearch.addEventListener('input', e => buildTags(e.target.value));
    }

    // pressing Enter in the rank input → trigger search
    const rankInput = document.getElementById('rank');
    if (rankInput) {
      rankInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') window.Predictor.doSearch();
      });
    }
  }


  // ── public API ──
  // These are the functions that index.html and other files can call.
  return {
    toggleBranch,
    pickPopular,
    pickAll,
    pickNone,
    getSelectedBranches,
    buildTags,
    updatePriorityPanel,

    // proxy methods so HTML buttons can call App.doSearch() etc.
    doSearch: () => window.Predictor.doSearch(),
    doExport: () => window.Predictor.doExport(),
  };

})();
