/*
  ════════════════════════════════════════
  data.js  —  Data Loader
  ════════════════════════════════════════

  WHAT THIS FILE DOES:
  - Fetches the two JSON files from the /data folder
  - Stores them in global variables so other JS files can use them
  - Calls window.onReady() once loading is complete (defined in app.js)

  GLOBALS IT SETS:
  - window.KCET_DATA   → object with 48 keys like "GM|General|General"
                         each key holds an array of { cn, course, cutoffs }
  - window.COURSES     → array of 146 branch names
  - window.DATA_READY  → true once both files are loaded

  OTHER FILES THAT USE THESE:
  - predictor.js uses KCET_DATA and COURSES to filter results
  - app.js uses COURSES to build the branch tag cloud
*/


// ── Global variables (shared with other files) ──
window.KCET_DATA  = null;
window.COURSES    = [];
window.DATA_READY = false;

// Branches shown when user clicks "⚡ CS/IT/AI"
window.POPULAR_KEYWORDS = [
  'COMPUTER SCIENCE',
  'INFORMATION SCIENCE',
  'ARTIFICIAL INTELLIGENCE',
  'INFORMATION TECHNOLOGY',
  'DATA SCIENCE',
  'MACHINE LEARNING',
];


/*
  cap(str)
  Converts "COMPUTER SCIENCE" → "Computer science"
  Used to make course names readable in the UI.
*/
window.cap = function (str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};


/*
  loadData()
  Fetches both JSON files at the same time using Promise.all().
  This is faster than fetching them one after the other.
*/
async function loadData() {
  try {
    // fetch both files at the same time
    const [dataResponse, metaResponse] = await Promise.all([
      fetch('data/kcet_data.json'),
      fetch('data/meta.json'),
    ]);

    // check if both requests succeeded
    if (!dataResponse.ok) throw new Error('Could not load kcet_data.json');
    if (!metaResponse.ok) throw new Error('Could not load meta.json');

    // parse JSON from both responses
    window.KCET_DATA = await dataResponse.json();
    const meta       = await metaResponse.json();
    window.COURSES   = meta.courses || [];
    window.DATA_READY = true;

    console.log('[data.js] Loaded:', Object.keys(KCET_DATA).length, 'keys,', COURSES.length, 'courses');

    // tell app.js the data is ready — it will build the UI
    window.onReady();

  } catch (error) {
    console.error('[data.js] Error:', error.message);
    showError(error.message);
  }
}


/*
  showError(msg)
  If data fails to load, replace the entire page with a helpful error message.
  Most common cause: opening index.html directly (file://) instead of using a server.
*/
function showError(msg) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:24px;">
      <div>
        <div style="font-size:3rem;margin-bottom:16px">⚠️</div>
        <h2 style="margin-bottom:8px;color:#1a1208">Data failed to load</h2>
        <p style="color:#6b5e4a;margin-bottom:12px">${msg}</p>
        <p style="color:#a89880;font-size:0.85rem">
          Run a local server instead of opening the file directly.<br>
          <strong>python3 -m http.server 8000</strong> then open http://localhost:8000
        </p>
      </div>
    </div>`;
}


// Start loading as soon as this script runs
loadData();
