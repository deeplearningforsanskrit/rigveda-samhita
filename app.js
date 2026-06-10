let ENTRIES = [];
let SUKTA_PAGES = [];
let CURRENT_PAGE_INDEX = 0;
let searchDebounceTimer = null;
let SHOW_PADA_PATHA = false;

let RIK_INDEX = new Map();       // "06.064.04" -> entry
let ASHTAKA_INDEX = new Map();   // "5.1.05.04" -> entry
let PAGE_INDEX = new Map();      // "6-64" -> pageIndex

const MAX_RESULTS = 200;

let CURRENT_FILTERS = {
  ashtaka: "",
  adhyaya: "",
  mandala: ""
};

let LAST_SEARCH_RESULTS = [];
let LAST_SEARCH_MODE = null;
let LAST_SEARCH_QUERY = "";

let ADHYAYA_DROPDOWN_CACHE = new Map();

// Rigveda Mapping: Mandala index (1 to 10) -> Total Suktas
const rikSuktaMapping = {
  1: 191, 2: 43, 3: 62, 4: 58, 5: 87, 
  6: 75, 7: 104, 8: 103, 9: 114, 10: 191
};

const MAX_MANTRA_FALLBACK = 100;

// Vasishtha-Dveshinī flagged mantras (Mandala.Sukta.Mantra)
const VASISHTHA_DVESHINI = new Set([
  "3.53.21", "3.53.22", "3.53.23", "3.53.24"
]);

const topbar = document.getElementById("topbar");
const headerToggle = document.getElementById("headerToggle");

if (headerToggle && topbar) {
  headerToggle.addEventListener("click", () => {
    const collapsed = topbar.classList.toggle("collapsed");
    headerToggle.setAttribute(
      "aria-label",
      collapsed ? "Show header" : "Hide header"
    );
  });
}

function syncHeaderFieldsFromCurrentPage() {
  const page = SUKTA_PAGES[CURRENT_PAGE_INDEX];
  if (!page) return;

  const jumpMode = document.getElementById("jumpMode")?.value || "rik";
  const jump1 = document.getElementById("jump1");
  const jump2 = document.getElementById("jump2");
  const jump3 = document.getElementById("jump3");

  if (!jump1 || !jump2 || !jump3) return;

  if (jumpMode === "rik") {
    jump1.value = String(page.mandala ?? 1);
    jump2.value = String(page.sukta ?? 1);
    jump3.value = "1";
  } else {
    const firstItem = page.items?.[0];
    jump1.value = String(firstItem?.ashtaka ?? 1);
    jump2.value = String(firstItem?.adhyaya ?? 1);
    jump3.value = String(firstItem?.varga ?? 1);
  }
}

async function loadData() {
  try {
    setStatus("Loading data...");

    const res = await fetch("rigveda.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    ENTRIES = flattenFlatRigvedaData(data);
    SUKTA_PAGES = buildSuktaPages(ENTRIES);
    buildIndexes();

    if (SUKTA_PAGES.length === 0) {
      setStatus("No data found");
      return;
    }

    populateFilterDropdowns();
    bindEvents();
    setupFilterModal();
    updatePadaToggleButton();
    updateJumpModeUI();
    renderBrowseMode();
  } catch (err) {
    setStatus(`Error: ${err.message}`);
    console.error(err);
  }
}

function setStatus(message) {
  const status = document.getElementById("status");
  if (status) status.textContent = message;
}

function flattenFlatRigvedaData(data) {
  const entries = [];

  for (const [ref, value] of Object.entries(data || {})) {
    const rikNum = String(value?.rik_num ?? ref ?? "").trim();
    const ashtakaRef = String(value?.ashtaka_ref ?? "").trim();
    const anuvakaRef = String(value?.anuvaka_ref ?? "").trim();

    const text = String(
      value?.text ??
      value?.samh_dev_acc ??
      ""
    ).trim();

    const padaPatha = String(
      value?.pada_dev_acc ??
      value?.pada_patha ??
      ""
    ).trim();

    const rikParsed = parseRikRef(rikNum);
    const ashtakaParsed = parseAshtakaRef(ashtakaRef);

    entries.push(makeEntryObject({
      ref: rikNum || String(ref),
      rikNum,
      ashtakaRef,
      anuvakaRef,
      text,
      padaPatha,

      mandala: rikParsed.mandala,
      sukta: rikParsed.sukta,
      mantra: rikParsed.mantra,

      ashtaka: ashtakaParsed.ashtaka,
      adhyaya: ashtakaParsed.adhyaya,
      varga: ashtakaParsed.varga,
      ashtakaRicha: ashtakaParsed.richa,

      entryId: rikParsed.mantra ?? 0,
    }));
  }

  entries.sort((a, b) => {
    if ((a.mandala ?? Infinity) !== (b.mandala ?? Infinity)) {
      return (a.mandala ?? Infinity) - (b.mandala ?? Infinity);
    }
    if ((a.sukta ?? Infinity) !== (b.sukta ?? Infinity)) {
      return (a.sukta ?? Infinity) - (b.sukta ?? Infinity);
    }
    return (a.mantra ?? Infinity) - (b.mantra ?? Infinity);
  });

  return entries;
}

function makeEntryObject({
  ref,
  rikNum,
  ashtakaRef,
  anuvakaRef,
  text,
  padaPatha,
  mandala,
  sukta,
  mantra,
  ashtaka,
  adhyaya,
  varga,
  ashtakaRicha,
  entryId
}) {
  const searchRef = normalizeForSearch(ref);
  const searchText = normalizeForSearch(text);
  const latinRef = normalizeLatinQuery(ref);
  const latinText = transliterateForSearch(text);

  return {
    ref,
    rikNum,
    ashtakaRef,
    anuvakaRef,
    text,
    padaPatha,

    mandala,
    sukta,
    mantra,

    ashtaka,
    adhyaya,
    varga,
    ashtakaRicha,

    entryId,

    searchRef,
    searchText,
    compactRef: compactForSearch(searchRef),
    compactText: compactForSearch(searchText),

    latinRef,
    latinText,
    compactLatinRef: compactForSearch(latinRef),
    compactLatinText: compactForSearch(latinText),
  };
}

function parseRikRef(ref) {
  const m = String(ref ?? "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    return {
      mandala: null,
      sukta: null,
      mantra: null,
    };
  }

  return {
    mandala: Number(m[1]),
    sukta: Number(m[2]),
    mantra: Number(m[3]),
  };
}

function parseAshtakaRef(ref) {
  const m = String(ref ?? "").match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    return {
      ashtaka: null,
      adhyaya: null,
      varga: null,
      richa: null,
    };
  }

  return {
    ashtaka: Number(m[1]),
    adhyaya: Number(m[2]),
    varga: Number(m[3]),
    richa: Number(m[4]),
  };
}

function buildSuktaPages(entries) {
  const map = new Map();

  for (const item of entries) {
    const key = `${item.mandala}-${item.sukta}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        mandala: item.mandala,
        sukta: item.sukta,
        items: [],
      });
    }

    map.get(key).items.push(item);
  }

  const pages = [...map.values()];

  pages.sort((a, b) => {
    if ((a.mandala ?? Infinity) !== (b.mandala ?? Infinity)) {
      return (a.mandala ?? Infinity) - (b.mandala ?? Infinity);
    }
    return (a.sukta ?? Infinity) - (b.sukta ?? Infinity);
  });

  for (const page of pages) {
    page.items.sort((a, b) => (a.mantra ?? Infinity) - (b.mantra ?? Infinity));
  }

  return pages;
}

function buildIndexes() {
  RIK_INDEX = new Map();
  ASHTAKA_INDEX = new Map();
  PAGE_INDEX = new Map();

  for (const item of ENTRIES) {
    if (item.rikNum) {
      RIK_INDEX.set(normalizeDotRef(item.rikNum), item);
    }
    if (item.ashtakaRef) {
      ASHTAKA_INDEX.set(normalizeDotRef(item.ashtakaRef), item);
    }
  }

  SUKTA_PAGES.forEach((page, index) => {
    PAGE_INDEX.set(`${page.mandala}-${page.sukta}`, index);
  });
}

function populateFilterDropdowns() {
  const ashtakaSet = new Set();
  const mandalaSet = new Set();
  const adhyayaByAshtaka = new Map();

  for (const entry of ENTRIES) {
    if (entry.ashtaka) {
      ashtakaSet.add(entry.ashtaka);
      if (!adhyayaByAshtaka.has(entry.ashtaka)) {
        adhyayaByAshtaka.set(entry.ashtaka, new Set());
      }
      if (entry.adhyaya) {
        adhyayaByAshtaka.get(entry.ashtaka).add(entry.adhyaya);
      }
    }
    if (entry.mandala) {
      mandalaSet.add(entry.mandala);
    }
  }

  const ashtakaSelect = document.getElementById("filterAshtaka");
  const ashtakaValues = Array.from(ashtakaSet).sort((a, b) => a - b);
  for (const val of ashtakaValues) {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val;
    ashtakaSelect.appendChild(option);
  }

  const mandalaSelect = document.getElementById("filterMandala");
  const mandalaValues = Array.from(mandalaSet).sort((a, b) => a - b);
  for (const val of mandalaValues) {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val;
    mandalaSelect.appendChild(option);
  }

  window.ADHYAYA_BY_ASHTAKA = adhyayaByAshtaka;
}

function populateAdhyayaDropdown(ashtaka) {
  const adhyayaSelect = document.getElementById("filterAdhyaya");

  if (!ashtaka) {
    adhyayaSelect.innerHTML = '<option value="">All</option>';
    return;
  }

  if (ADHYAYA_DROPDOWN_CACHE.has(ashtaka)) {
    adhyayaSelect.innerHTML = ADHYAYA_DROPDOWN_CACHE.get(ashtaka);
    return;
  }

  if (!window.ADHYAYA_BY_ASHTAKA) {
    adhyayaSelect.innerHTML = '<option value="">All</option>';
    return;
  }

  const values = window.ADHYAYA_BY_ASHTAKA.get(Number(ashtaka));
  if (!values) {
    adhyayaSelect.innerHTML = '<option value="">All</option>';
    return;
  }

  const sortedValues = Array.from(values).sort((a, b) => a - b);
  let html = '<option value="">All</option>';
  for (const val of sortedValues) {
    html += `<option value="${val}">${val}</option>`;
  }

  ADHYAYA_DROPDOWN_CACHE.set(ashtaka, html);
  adhyayaSelect.innerHTML = html;
}

function filterSearchResults(results) {
  if (!CURRENT_FILTERS.ashtaka && !CURRENT_FILTERS.adhyaya && !CURRENT_FILTERS.mandala) {
    return results;
  }

  return results.filter((item) => {
    if (CURRENT_FILTERS.ashtaka && Number(item.ashtaka) !== Number(CURRENT_FILTERS.ashtaka)) {
      return false;
    }
    if (CURRENT_FILTERS.adhyaya && Number(item.adhyaya) !== Number(CURRENT_FILTERS.adhyaya)) {
      return false;
    }
    if (CURRENT_FILTERS.mandala && Number(item.mandala) !== Number(CURRENT_FILTERS.mandala)) {
      return false;
    }
    return true;
  });
}

function updateFilterButton() {
  const btn = document.getElementById("filterBtn");
  const count = Object.values(CURRENT_FILTERS).filter(v => v !== "").length;

  if (count > 0) {
    btn.classList.add("active");
    btn.setAttribute("data-count", count);
    btn.textContent = `Filter (${count})`;
  } else {
    btn.classList.remove("active");
    btn.removeAttribute("data-count");
    btn.textContent = "Filter";
  }
}

function setupFilterModal() {
  const filterBtn = document.getElementById("filterBtn");
  const filterModal = document.getElementById("filterModal");
  const closeBtn = document.getElementById("closeFilterModal");
  const applyBtn = document.getElementById("applyFiltersBtn");
  const clearBtn = document.getElementById("clearFiltersBtn");
  const ashtakaSelect = document.getElementById("filterAshtaka");

  filterBtn.addEventListener("click", () => {
    filterModal.classList.remove("hidden");
  });

  closeBtn.addEventListener("click", () => {
    filterModal.classList.add("hidden");
  });

  filterModal.addEventListener("click", (e) => {
    if (e.target === filterModal) {
      filterModal.classList.add("hidden");
    }
  });

  ashtakaSelect.addEventListener("change", (e) => {
    const adhyayaSelect = document.getElementById("filterAdhyaya");
    if (e.target.value) {
      adhyayaSelect.disabled = false;
      populateAdhyayaDropdown(e.target.value);
      adhyayaSelect.value = "";
    } else {
      adhyayaSelect.disabled = true;
      adhyayaSelect.innerHTML = '<option value="">All</option>';
    }
  });

  applyBtn.addEventListener("click", () => {
    CURRENT_FILTERS.ashtaka = document.getElementById("filterAshtaka").value;
    CURRENT_FILTERS.adhyaya = document.getElementById("filterAdhyaya").value;
    CURRENT_FILTERS.mandala = document.getElementById("filterMandala").value;

    updateFilterButton();
    filterModal.classList.add("hidden");

    const search = document.getElementById("search");
    const rawQuery = search ? search.value.trim() : "";

    if (rawQuery && LAST_SEARCH_RESULTS.length > 0) {
      const filteredResults = filterSearchResults(LAST_SEARCH_RESULTS);
      renderSearchMode(rawQuery, LAST_SEARCH_MODE, filteredResults);
    }
  });

  clearBtn.addEventListener("click", () => {
    document.getElementById("filterAshtaka").value = "";
    document.getElementById("filterAdhyaya").value = "";
    document.getElementById("filterAdhyaya").disabled = true;
    document.getElementById("filterMandala").value = "";

    CURRENT_FILTERS.ashtaka = "";
    CURRENT_FILTERS.adhyaya = "";
    CURRENT_FILTERS.mandala = "";

    updateFilterButton();
    filterModal.classList.add("hidden");

    const search = document.getElementById("search");
    const rawQuery = search ? search.value.trim() : "";

    if (rawQuery && LAST_SEARCH_RESULTS.length > 0) {
      renderSearchMode(rawQuery, LAST_SEARCH_MODE, LAST_SEARCH_RESULTS);
    }
  });
}

// Helper function to populate data-lists with options up to max limit
function populateDatalist(datalistId, maxLimit) {
  const datalistElement = document.getElementById(datalistId);
  if (!datalistElement) return;
  datalistElement.innerHTML = '';
  for (let i = 1; i <= maxLimit; i++) {
    const option = document.createElement('option');
    option.value = i;
    datalistElement.appendChild(option);
  }
}

function bindEvents() {
  const search = document.getElementById("search");
  if (search) {
    search.addEventListener("input", (e) => {
      const rawQuery = e.target.value.trim();

      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }

      if (!rawQuery) {
        renderBrowseMode();
        return;
      }

      setStatus("Waiting for typing to stop...");

      searchDebounceTimer = setTimeout(() => {
        onSearchInput(e);
      }, 2000);
    });
  }

  const prevTop = document.getElementById("prevTop");
  const nextTop = document.getElementById("nextTop");
  const prevBottom = document.getElementById("prevBottom");
  const nextBottom = document.getElementById("nextBottom");

  if (prevTop) prevTop.addEventListener("click", () => goToPage(CURRENT_PAGE_INDEX - 1));
  if (nextTop) nextTop.addEventListener("click", () => goToPage(CURRENT_PAGE_INDEX + 1));
  if (prevBottom) prevBottom.addEventListener("click", () => goToPage(CURRENT_PAGE_INDEX - 1));
  if (nextBottom) nextBottom.addEventListener("click", () => goToPage(CURRENT_PAGE_INDEX + 1));

  const togglePadaBtn = document.getElementById("togglePadaBtn");
  if (togglePadaBtn) {
    togglePadaBtn.addEventListener("click", () => {
      SHOW_PADA_PATHA = !SHOW_PADA_PATHA;
      updatePadaToggleButton();

      const search = document.getElementById("search");
      const rawQuery = search ? search.value.trim() : "";

      if (rawQuery && LAST_SEARCH_RESULTS.length > 0) {
        const filteredResults = filterSearchResults(LAST_SEARCH_RESULTS);
        renderSearchMode(rawQuery, LAST_SEARCH_MODE, filteredResults);
      } else {
        renderBrowseMode();
      }
    });
  }

  const jumpMode = document.getElementById("jumpMode");
  if (jumpMode) {
    jumpMode.addEventListener("change", () => {
      updateJumpModeUI();
      syncHeaderFieldsFromCurrentPage();
    });
  }

  const jumpGo = document.getElementById("jumpGo");
  if (jumpGo) {
    jumpGo.addEventListener("click", onJumpGo);
  }

  // Monitor alterations inside jump1 input to rebuild dynamic options of listJump2 immediately
  const jump1El = document.getElementById("jump1");
  if (jump1El) {
    jump1El.addEventListener("input", () => {
      const mode = document.getElementById("jumpMode")?.value || "rik";
      if (mode === "rik") {
        const v1 = parseInt(jump1El.value) || 1;
        populateDatalist("listJump2", rikSuktaMapping[v1] || 191);
      }
    });
  }

  const jumpInputs = ["jump1", "jump2", "jump3"];
  for (const id of jumpInputs) {
    const el = document.getElementById(id);
    if (!el) continue;
    
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        onJumpGo();
      }
    });

    // Automatically wipes value on element selection focus so the picker scrolls cleanly from start
    el.addEventListener("focus", function() {
      this.value = '';
    });
  }

  const copyAllBtn = document.getElementById("copyAllBtn");
  if (copyAllBtn) {
    copyAllBtn.addEventListener("click", copyAllVisible);
  }
}

function updatePadaToggleButton() {
  const btn = document.getElementById("togglePadaBtn");
  if (!btn) return;

  btn.textContent = SHOW_PADA_PATHA ? "पद पाठ: ON" : "पद पाठ: OFF";
  btn.classList.toggle("active", SHOW_PADA_PATHA);
}

function updateJumpModeUI() {
  const mode = document.getElementById("jumpMode")?.value || "rik";

  const jump1 = document.getElementById("jump1");
  const jump2 = document.getElementById("jump2");
  const jump3 = document.getElementById("jump3");
  const wrapperJump3 = document.getElementById("wrapperJump3");

  // Fetch the label elements to alter their text dynamically
  const lblJump1 = document.getElementById("lblJump1");
  const lblJump2 = document.getElementById("lblJump2");
  const lblJump3 = document.getElementById("lblJump3");

  if (!jump1 || !jump2 || !jump3) return;

  const v1 = parseInt(jump1.value) || 1;

  if (mode === "rik") {
    // 1. Reset text elements to Rik mode values
    // if (lblJump1) lblJump1.textContent = "";
    // if (lblJump2) lblJump2.textContent = "सुक्त:";
    // if (lblJump3) lblJump3.textContent = "मण्डल  :";

    // jump1.placeholder = "मण्डल";
    // jump2.placeholder = "सूक्त";
    // jump3.placeholder = "मन्त्र";

    populateDatalist("listJump1", 10);
    populateDatalist("listJump2", rikSuktaMapping[v1] || 191);
    populateDatalist("listJump3", MAX_MANTRA_FALLBACK);

    if (wrapperJump3) wrapperJump3.classList.add("hidden"); 
    else jump3.classList.add("hidden");
  } else {
    // 2. Change text elements to Ashtaka mode values
    // if (lblJump1) lblJump1.textContent = "अष्टक:";
    // if (lblJump2) lblJump2.textContent = "अध्याय:"; // Or just "अ:" depending on preference
    // if (lblJump3) lblJump3.textContent = "वर्ग:";

    jump1.placeholder = "अष्टक";
    jump2.placeholder = "अध्याय";
    jump3.placeholder = "वर्ग";

    populateDatalist("listJump1", 8);
    populateDatalist("listJump2", 8);
    populateDatalist("listJump3", 64); 

    if (wrapperJump3) wrapperJump3.classList.remove("hidden");
    else jump3.classList.remove("hidden");
  }
}

function onJumpGo() {
  const mode = document.getElementById("jumpMode")?.value || "rik";

  const v1 = document.getElementById("jump1")?.value.trim();
  const v2 = document.getElementById("jump2")?.value.trim();
  let v3 = document.getElementById("jump3")?.value.trim();

  if (mode === "rik") {
    if (!v1 || !v2) {
      setStatus("Please enter Mandala and Sukta.");
      return;
    }
    
    // Default to first mantra if omitted by interface configurations
    if (!v3) v3 = "1";

    const key = buildRikKey(v1, v2, v3);
    const entry = RIK_INDEX.get(key);

    if (!entry) {
      setStatus(`Not found: ${key}`);
      return;
    }

    openEntryInContext(entry.ref);
    return;
  }

  if (!v1 || !v2 || !v3) {
    setStatus("Please enter Ashtaka, Adhyaya, and Varga.");
    return;
  }

  const key = buildAshtakaKey(v1, v2, v3, 1);
  const entry = ASHTAKA_INDEX.get(key);

  if (!entry) {
    setStatus(`Not found: ${key}`);
    return;
  }

  openEntryInContext(entry.ref);
}

function buildRikKey(mandala, sukta, richa) {
  return [
    padInt(mandala, 2),
    padInt(sukta, 3),
    padInt(richa, 2)
  ].join(".");
}

function buildAshtakaKey(ashtaka, adhyaya, varga, richa) {
  return [
    String(Number(ashtaka)),
    String(Number(adhyaya)),
    padInt(varga, 2),
    padInt(richa, 2)
  ].join(".");
}

function normalizeDotRef(ref) {
  return String(ref ?? "").trim();
}

function padInt(value, width) {
  return String(Number(value)).padStart(width, "0");
}

function onSearchInput(e) {
  const rawQuery = e.target.value.trim();

  if (!rawQuery) {
    LAST_SEARCH_RESULTS = [];
    LAST_SEARCH_MODE = null;
    LAST_SEARCH_QUERY = "";
    renderBrowseMode();
    return;
  }

  setStatus("Searching...");

  const { mode, results } = searchEntries(rawQuery);
  LAST_SEARCH_RESULTS = results;
  LAST_SEARCH_MODE = mode;
  LAST_SEARCH_QUERY = rawQuery;

  const filteredResults = filterSearchResults(results);
  renderSearchMode(rawQuery, mode, filteredResults);
}

function goToPage(index) {
  if (index < 0 || index >= SUKTA_PAGES.length) return;

  CURRENT_PAGE_INDEX = index;

  syncHeaderFieldsFromCurrentPage();   // important
  renderBrowseMode();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderBrowseMode(targetRef = null) {
  const page = SUKTA_PAGES[CURRENT_PAGE_INDEX];
  const root = document.getElementById("results");

  if (!page || !root) {
    if (root) root.innerHTML = `<div class="mantra">No page found.</div>`;
    return;
  }

  syncHeaderFieldsFromCurrentPage();   // important
  updatePageInfo();
  enablePagerButtons();
  updatePagerButtons();

  setStatus(
    `\n${page.items.length} mantras · Mandala ${page.mandala} · Sukta ${String(page.sukta).padStart(3, "0")}`
  );

  root.innerHTML = "";

  for (const item of page.items) {
    const card = document.createElement("div");
    const vdKey = `${item.mandala}.${item.sukta}.${item.mantra}`;
    const isVD = VASISHTHA_DVESHINI.has(vdKey);
    card.className = "mantra" + (isVD ? " vasishtha-dveshini" : "");
    card.setAttribute("data-ref", item.ref);

    card.innerHTML = `
      <div class="ref">${escapeHtml(item.ref)}${isVD ? ' <span class="vd-badge">वसिष्ठ-द्वेषिणी</span>' : ""}</div>
      <div class="meta-ref">
        ${item.ashtakaRef ? `Ashtaka: ${escapeHtml(item.ashtakaRef)}` : ""}
      </div>
      <div class="samhita-text">${escapeHtml(item.text)}</div>
      ${
        SHOW_PADA_PATHA && item.padaPatha
          ? `<div class="pada-patha">${escapeHtml(item.padaPatha)}</div>`
          : ""
      }
    `;

    const refEl = card.querySelector(".ref");
    if (refEl) {
      refEl.style.cursor = "pointer";
      refEl.addEventListener("click", (e) => {
        e.stopPropagation();
        copyToClipboard(item.ref, refEl);
      });
    }

    const textEl = card.querySelector(".samhita-text");
    if (textEl) {
      textEl.style.cursor = "pointer";
      textEl.addEventListener("click", (e) => {
        e.stopPropagation();
        copyToClipboard(item.text, textEl);
      });
    }

    const padaEl = card.querySelector(".pada-patha");
    if (padaEl) {
      padaEl.style.cursor = "pointer";
      padaEl.addEventListener("click", (e) => {
        e.stopPropagation();
        copyToClipboard(item.padaPatha, padaEl);
      });
    }

    root.appendChild(card);
  }

  if (targetRef) {
    centerAndHighlight(targetRef);
  }
}


function renderSearchMode(rawQuery, mode, results) {
  const root = document.getElementById("results");
  if (!root) return;

  updatePageInfo("Search results");
  disablePagerButtons();

  let statusText = "";
  if (mode === "exact") {
    statusText = `${results.length} result${results.length === 1 ? "" : "s"} for "${rawQuery}"`;
  } else if (mode === "compact") {
    statusText = `${results.length} result${results.length === 1 ? "" : "s"} for "${rawQuery}" (space-insensitive / transliteration match)`;
  } else {
    statusText = `${results.length} result${results.length === 1 ? "" : "s"} for "${rawQuery}" (fuzzy fallback)`;
  }

  const activeFilters = Object.values(CURRENT_FILTERS).filter(v => v !== "").length;
  if (activeFilters > 0) {
    statusText += ` [${activeFilters} filter${activeFilters === 1 ? "" : "s"} applied]`;
  }

  root.innerHTML = "";

  if (results.length === 0) {
    root.innerHTML = `<div class="mantra">No results</div>`;
    return;
  }

  for (const item of results) {
    const card = document.createElement("div");
    const vdKey = `${item.mandala}.${item.sukta}.${item.mantra}`;
    const isVD = VASISHTHA_DVESHINI.has(vdKey);
    card.className = "mantra clickable" + (isVD ? " vasishtha-dveshini" : "");

    card.innerHTML = `
      <div class="ref">${escapeHtml(item.ref)} · Mandala ${item.mandala} · Sukta ${String(item.sukta).padStart(3, "0")}${isVD ? ' <span class="vd-badge">वसिष्ठ-द्वेषिणी</span>' : ""}</div>
      <div class="meta-ref">
        ${item.ashtakaRef ? `Ashtaka: ${escapeHtml(item.ashtakaRef)}` : ""}
      </div>
      <div class="samhita-text">${escapeHtml(item.text)}</div>
      ${
        SHOW_PADA_PATHA && item.padaPatha
          ? `<div class="pada-patha">${escapeHtml(item.padaPatha)}</div>`
          : ""
      }
    `;

    // --- LONG PRESS & CLICK HANDLING FOR MOBILE/DESKTOP ---
    let touchTimer = null;
    let isLongPress = false;

    // Helper function to attach handlers to copyable text elements
    const setupLongPressCopy = (element, textToCopy) => {
      if (!element) return;
      
      element.style.cursor = "pointer";

      // 1. Mobile Touch Events
      element.addEventListener("touchstart", (e) => {
        isLongPress = false;
        // Start a timer for 600ms to detect a long press
        touchTimer = setTimeout(() => {
          isLongPress = true;
          copyToClipboard(textToCopy, element);
          
          // Provide a light haptic feedback vibration if supported
          if (navigator.vibrate) navigator.vibrate(50); 
        }, 600);
      }, { passive: true });

      element.addEventListener("touchend", (e) => {
        // If they lift their finger before 600ms, clear the timer
        if (touchTimer) {
          clearTimeout(touchTimer);
        }
        // If it was a long press, stop the event so it doesn't trigger card navigation
        if (isLongPress) {
          e.preventDefault();
          e.stopPropagation();
        }
      });

      element.addEventListener("touchmove", () => {
        // If they scroll or drag away, cancel the copy timer
        if (touchTimer) clearTimeout(touchTimer);
      });

      // 2. Desktop Click Event Fallback
      element.addEventListener("click", (e) => {
        // On mobile touchend handles it; on desktop, standard clicks copy text without navigation
        if (e.pointerType === "mouse" || !("ontouchstart" in window)) {
          e.stopPropagation(); 
          copyToClipboard(textToCopy, element);
        }
      });
    };

    // Apply the setup to all three pieces of text
    setupLongPressCopy(card.querySelector(".ref"), item.ref);
    setupLongPressCopy(card.querySelector(".samhita-text"), item.text);
    setupLongPressCopy(card.querySelector(".pada-patha"), item.padaPatha);

    // Clicking anywhere else (or a standard quick tap on mobile) opens the context
    card.addEventListener("click", (e) => {
      if (!isLongPress) {
        openEntryInContext(item.ref);
      }
    });

    root.appendChild(card);
  }
}

function openEntryInContext(ref) {
  const entry = RIK_INDEX.get(normalizeDotRef(ref));
  if (!entry) return;

  const pageKey = `${entry.mandala}-${entry.sukta}`;
  const pageIndex = PAGE_INDEX.get(pageKey);

  if (pageIndex == null) return;

  CURRENT_PAGE_INDEX = pageIndex;

  const search = document.getElementById("search");
  if (search) search.value = "";

  renderBrowseMode(ref);
}

function centerAndHighlight(ref) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-ref="${cssEscape(ref)}"]`);
    if (!el) return;

    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    el.classList.add("highlight");
    setTimeout(() => {
      el.classList.remove("highlight");
    }, 2500);
  });
}

function updatePageInfo(overrideText = null) {
  const top = document.getElementById("pageInfo");
  const bottom = document.getElementById("pageInfoBottom");

  let text = overrideText;

  if (!text) {
    const page = SUKTA_PAGES[CURRENT_PAGE_INDEX];
    text = `Mandala ${page.mandala} · Sukta ${String(page.sukta).padStart(3, "0")} · ${CURRENT_PAGE_INDEX + 1}/${SUKTA_PAGES.length}`;
  }

  if (top) top.textContent = text;
  if (bottom) bottom.textContent = text;
}

function updatePagerButtons() {
  const atStart = CURRENT_PAGE_INDEX <= 0;
  const atEnd = CURRENT_PAGE_INDEX >= SUKTA_PAGES.length - 1;

  const prevTop = document.getElementById("prevTop");
  const prevBottom = document.getElementById("prevBottom");
  const nextTop = document.getElementById("nextTop");
  const nextBottom = document.getElementById("nextBottom");

  if (prevTop) prevTop.disabled = atStart;
  if (prevBottom) prevBottom.disabled = atStart;
  if (nextTop) nextTop.disabled = atEnd;
  if (nextBottom) nextBottom.disabled = atEnd;
}

function disablePagerButtons() {
  const ids = ["prevTop", "prevBottom", "nextTop", "nextBottom"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  }
}

function enablePagerButtons() {
  const ids = ["prevTop", "prevBottom", "nextTop", "nextBottom"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  }
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text ?? "").replace(/[&<>"']/g, c => map[c]);
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

async function copyToClipboard(text, el) {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = el.textContent;
    el.textContent = "Copied!";
    el.style.opacity = "0.7";
    setTimeout(() => {
      el.textContent = originalText;
      el.style.opacity = "1";
    }, 1500);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

function getAllVisibleText() {
  const resultsDiv = document.getElementById("results");
  if (!resultsDiv) return "";

  const mantras = resultsDiv.querySelectorAll(".mantra");
  const lines = [];

  for (const mantra of mantras) {
    const samhita = mantra.querySelector(".samhita-text")?.textContent || "";
    const pada = mantra.querySelector(".pada-patha")?.textContent || "";

    lines.push(samhita);
    if (pada) lines.push(pada);
    lines.push("");
  }

  return lines.join("\n");
}

async function copyAllVisible() {
  const btn = document.getElementById("copyAllBtn");
  const text = getAllVisibleText();

  if (!text.trim()) {
    if (btn) {
      btn.textContent = "Nothing to copy";
      setTimeout(() => {
        btn.textContent = "Copy All";
      }, 1500);
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = `Copied ${text.split("\n").length} lines!`;
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }
  } catch (err) {
    console.error("Failed to copy all:", err);
  }
}

function normalizeForSearch(input) {
  const text = String(input ?? "");

  return text
    .normalize("NFC")
    .replace(/[०-९]/g, (d) => "०१२३४५६७८९".indexOf(d))
    .replace(/[\u0951\u0952\u1CD0-\u1CFA\uA8E0-\uA8F1]/g, "")
    .replace(/[।॥.,;:!?'"“”‘’()[\]{}\-—_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeLatinQuery(input) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/sh/g, "s")
    .replace(/w/g, "v")
    .replace(/[āáàâä]/g, "aa")
    .replace(/[īíìîï]/g, "ii")
    .replace(/[ūúùûü]/g, "uu")
    .replace(/[ṛŕ]/g, "r")
    .replace(/[ṝ]/g, "rr")
    .replace(/[ळ]/g, "l")
    .replace(/[ḹ]/g, "ll")
    .replace(/[ṅñṇ]/g, "n")
    .replace(/[ṭ]/g, "t")
    .replace(/[ḍ]/g, "d")
    .replace(/[śṣ]/g, "s")
    .replace(/[ṃṁ]/g, "m")
    .replace(/[ḥ]/g, "h")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function transliterateForSearch(input) {
  let s = String(input ?? "").normalize("NFC");

  s = s.replace(/[\u0951\u0952\u1CD0-\u1CFA\uA8E0-\uA8F1]/g, "");

  s = s
    .replace(/ं/g, "m")
    .replace(/ः/g, "h")
    .replace(/ँ/g, "m")
    .replace(/ऽ/g, "");

  const independentVowels = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu",
    "ऋ": "r", "ॠ": "rr", "ऌ": "l", "ॡ": "ll", "ए": "e", "ऐ": "ai",
    "ओ": "o", "औ": "au"
  };

  const vowelSigns = {
    "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu",
    "ृ": "r", "ॄ": "rr", "ॢ": "l", "ॣ": "ll",
    "े": "e", "ै": "ai", "ो": "o", "ौ": "au"
  };

  const consonants = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
    "च": "c", "छ": "ch", "ज": "j", "झ": "jh", "ञ": "n",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "s", "ष": "s", "स": "s", "ह": "h",
    "ळ": "l"
  };

  const digits = {
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
    "५": "5", "६": "6", "७": "7", "८": "8", "९": "9"
  };

  let out = "";

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1] || "";

    if (digits[ch]) {
      out += digits[ch];
      continue;
    }

    if (independentVowels[ch]) {
      out += independentVowels[ch];
      continue;
    }

    if (consonants[ch]) {
      let base = consonants[ch];

      if (next === "्") {
        out += base;
        i += 1;
        continue;
      }

      if (vowelSigns[next]) {
        out += base + vowelSigns[next];
        i += 1;
        continue;
      }

      out += base + "a";
      continue;
    }

    if (/[।॥.,;:!?'"“”‘’()[\]{}\-—_/\\\s]/.test(ch)) {
      out += " ";
      continue;
    }

    if (vowelSigns[ch]) {
      out += vowelSigns[ch];
      continue;
    }
  }

  return normalizeLatinQuery(out);
}

function compactForSearch(text) {
  return text.replace(/\s+/g, "");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }

    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function fuzzyScore(queryCompact, targetCompact) {
  if (!queryCompact || !targetCompact) return Infinity;
  if (targetCompact.includes(queryCompact)) return 0;

  const qLen = queryCompact.length;
  if (qLen === 0) return Infinity;

  let best = Infinity;

  const minWindow = Math.max(1, qLen - 2);
  const maxWindow = Math.min(targetCompact.length, qLen + 2);

  for (let win = minWindow; win <= maxWindow; win++) {
    for (let i = 0; i + win <= targetCompact.length; i++) {
      const slice = targetCompact.slice(i, i + win);
      const dist = levenshtein(queryCompact, slice);
      if (dist < best) best = dist;
      if (best === 0) return 0;
    }
  }

  return best;
}

function searchEntries(rawQuery) {
  const q = normalizeForSearch(rawQuery);
  const qCompact = compactForSearch(q);

  const latinQ = normalizeLatinQuery(rawQuery);
  const latinCompactQ = compactForSearch(latinQ);

  const hasLatinQuery = latinQ.length > 0;
  const hasLatinCompactQuery = latinCompactQ.length > 0;

  if (!rawQuery.trim()) {
    return {
      mode: "default",
      results: [],
    };
  }

  const exact = [];
  for (const item of ENTRIES) {
    if (
      item.searchRef.includes(q) ||
      item.searchText.includes(q) ||
      (hasLatinQuery && (
        item.latinRef.includes(latinQ) ||
        item.latinText.includes(latinQ)
      ))
    ) {
      exact.push(item);
      if (exact.length >= MAX_RESULTS) break;
    }
  }

  if (exact.length > 0) {
    return {
      mode: "exact",
      results: exact,
    };
  }

  const compact = [];
  for (const item of ENTRIES) {
    if (
      item.compactRef.includes(qCompact) ||
      item.compactText.includes(qCompact) ||
      (hasLatinCompactQuery && (
        item.compactLatinRef.includes(latinCompactQ) ||
        item.compactLatinText.includes(latinCompactQ)
      ))
    ) {
      compact.push(item);
      if (compact.length >= MAX_RESULTS) break;
    }
  }

  if (compact.length > 0) {
    return {
      mode: "compact",
      results: compact,
    };
  }

  const baseLen = hasLatinCompactQuery ? latinCompactQ.length : 0;
  if (baseLen < 3) {
    return {
      mode: "fuzzy",
      results: [],
    };
  }

  const fuzzyCandidates = [];
  for (const item of ENTRIES) {
    const latinRefScore = hasLatinCompactQuery
      ? fuzzyScore(latinCompactQ, item.compactLatinRef)
      : Infinity;

    const latinTextScore = hasLatinCompactQuery
      ? fuzzyScore(latinCompactQ, item.compactLatinText)
      : Infinity;

    const score = Math.min(latinRefScore, latinTextScore);

    const allowed =
      baseLen <= 4 ? 1 :
      baseLen <= 8 ? 2 : 3;

    if (score <= allowed) {
      fuzzyCandidates.push({ item, score });
    }
  }

  fuzzyCandidates.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.item.ref.localeCompare(b.item.ref);
  });

  return {
    mode: "fuzzy",
    results: fuzzyCandidates.slice(0, MAX_RESULTS).map((x) => x.item),
  };
}

loadData();