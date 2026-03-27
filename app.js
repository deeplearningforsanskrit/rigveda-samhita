let ENTRIES = [];
const MAX_RESULTS = 200;

async function loadData() {
  const status = document.getElementById("status");

  try {
    const res = await fetch("rigveda.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    ENTRIES = Object.entries(data).map(([ref, value]) => {
      const text =
        typeof value === "string"
          ? value
          : (value?.text ?? `${value?.a ?? ""} ${value?.c ?? ""}`).trim();

      const searchRef = normalizeForSearch(ref);
      const searchText = normalizeForSearch(text);

      const latinRef = normalizeLatinQuery(ref);
      const latinText = transliterateForSearch(text);

      return {
        ref: String(ref),
        text: String(text),

        searchRef,
        searchText,
        compactRef: compactForSearch(searchRef),
        compactText: compactForSearch(searchText),

        latinRef,
        latinText,
        compactLatinRef: compactForSearch(latinRef),
        compactLatinText: compactForSearch(latinText),
      };
    });

    status.textContent = `Loaded ${ENTRIES.length} mantras`;
    render(ENTRIES.slice(0, 100));
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }
}

function render(list) {
  const root = document.getElementById("results");
  root.innerHTML = "";

  if (list.length === 0) {
    root.innerHTML = `<div class="mantra">No results</div>`;
    return;
  }

  for (const item of list) {
    const card = document.createElement("div");
    card.className = "mantra";
    card.innerHTML = `
      <div class="ref">${escapeHtml(item.ref)}</div>
      <div>${escapeHtml(item.text)}</div>
    `;
    root.appendChild(card);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
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
    .replace(/[āáàâä]/g, "aa")
    .replace(/[īíìîï]/g, "ii")
    .replace(/[ūúùûü]/g, "uu")
    .replace(/[ṛŕ]/g, "r")
    .replace(/[ṝ]/g, "rr")
    .replace(/[ḷ]/g, "l")
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

  if (!rawQuery.trim()) {
    return {
      mode: "default",
      results: ENTRIES.slice(0, 100),
    };
  }

  const exact = [];
  for (const item of ENTRIES) {
    if (
      item.searchRef.includes(q) ||
      item.searchText.includes(q) ||
      item.latinRef.includes(latinQ) ||
      item.latinText.includes(latinQ)
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
      item.compactLatinRef.includes(latinCompactQ) ||
      item.compactLatinText.includes(latinCompactQ)
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

  const baseLen = Math.max(qCompact.length, latinCompactQ.length);
  if (baseLen < 3) {
    return {
      mode: "fuzzy",
      results: [],
    };
  }

  const fuzzyCandidates = [];
  for (const item of ENTRIES) {
    const refScore = qCompact ? fuzzyScore(qCompact, item.compactRef) : Infinity;
    const textScore = qCompact ? fuzzyScore(qCompact, item.compactText) : Infinity;
    const latinRefScore = latinCompactQ ? fuzzyScore(latinCompactQ, item.compactLatinRef) : Infinity;
    const latinTextScore = latinCompactQ ? fuzzyScore(latinCompactQ, item.compactLatinText) : Infinity;

    const score = Math.min(refScore, textScore, latinRefScore, latinTextScore);

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

document.getElementById("search").addEventListener("input", (e) => {
  const rawQuery = e.target.value.trim();
  const status = document.getElementById("status");

  const { mode, results } = searchEntries(rawQuery);

  if (!rawQuery) {
    status.textContent = `Loaded ${ENTRIES.length} mantras`;
    render(results);
    return;
  }

  if (mode === "exact") {
    status.textContent = `${results.length} result${results.length === 1 ? "" : "s"} for "${rawQuery}"`;
  } else if (mode === "compact") {
    status.textContent = `${results.length} result${results.length === 1 ? "" : "s"} for "${rawQuery}" (space-insensitive / transliteration match)`;
  } else if (mode === "fuzzy") {
    status.textContent = `${results.length} result${results.length === 1 ? "" : "s"} for "${rawQuery}" (fuzzy fallback)`;
  } else {
    status.textContent = `Loaded ${ENTRIES.length} mantras`;
  }

  render(results);
});

loadData();