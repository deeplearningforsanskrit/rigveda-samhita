# ऋग्वेद संहिता

A clean, offline-capable web reader for the Rigveda Samhita — with Udātta/Anudātta svaras, Pada Pāṭha, dual indexing by Maṇḍala/Sūkta and Aṣṭaka/Adhyāya, and full-text search in both Devanāgarī and transliteration.

**→ [Open the reader](https://deeplearningforsanskrit.github.io/rigveda-samhita/)**

---

## Features

**Reading**
- Browse all 10,552 mantras across 10 Maṇḍalas and 1,028 Sūktas
- Samhitā Pāṭha with Vedic accent marks (Udātta ॑, Anudātta ॒)
- Toggle Pada Pāṭha alongside the Samhitā text
- Navigate by Maṇḍala/Sūkta or Aṣṭaka/Adhyāya/Varga — switch modes freely
- Tap any mantra text or ref to copy it to clipboard; long-press on mobile

**Search**
- Search in Devanāgarī script or Roman transliteration
- Three-tier matching: exact → space-insensitive compact → fuzzy (Levenshtein)
- Filter results by Maṇḍala, Aṣṭaka, or Adhyāya
- Click any search result to jump directly to it in context

**Offline / PWA**
- Installable as a Progressive Web App on Android, iOS, and desktop
- Full offline support via Service Worker — works without a network connection after first load
- Auto-updates: on every page load while online, the app checks `version.json` on the server and busts the cache if a new version is available — no manual refresh needed

**Typography**
- Rendered in [Tiro Devanāgarī Sanskrit](https://fonts.google.com/specimen/Tiro+Devanagari+Sanskrit), designed for classical Sanskrit texts
- Collapsible header for distraction-free reading on small screens

---

## Project Structure

```
rigveda-samhita/
├── index.html       # App shell and layout
├── app.js           # All rendering, search, navigation logic
├── style.css        # Styling and typography
├── rigveda.json     # Full text data (Samhitā + Pada Pāṭha, with accents)
├── sw.js            # Service Worker with version-aware cache busting
├── manifest.json    # PWA manifest
├── version.json     # Cache version string — bump to push updates to users
└── scripts/         # Data processing scripts (Python)
```

---

## Pushing an Update

To force all users to fetch fresh assets after a deployment:

1. Edit `version.json` and increment the version string:
   ```json
   { "cache_version": "rigveda-v5" }
   ```
2. Commit and push. The next time a user opens the app while online, the old cache is deleted and all assets are re-fetched automatically.

---

## Data

The text is stored in `rigveda.json` — a flat key-value structure keyed by Rik number (`MM.SSS.RR`), with each entry containing:

- `text` / `samh_dev_acc` — Samhitā text in Devanāgarī with Vedic accent Unicode marks
- `pada_dev_acc` / `pada_patha` — Pada Pāṭha
- `rik_num` — Maṇḍala.Sūkta.Mantra reference
- `ashtaka_ref` — Aṣṭaka.Adhyāya.Varga.Ṛcā reference

The accent marks use standard Unicode: `U+0951` (Udātta), `U+0952` (Anudātta), and the Vedic Extensions block `U+1CD0–U+1CFA`.

---

## Local Development

No build step. Just serve the files from a local HTTP server:

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve .
```

Then open `http://localhost:8000`. The Service Worker will register but cache-version checks won't behave identically to production — use DevTools → Application → Service Workers → "Update on reload" during development.

---

## Acknowledgements

वन्दे गुरु परम्पराम्

Developed by [Abhijit Deo](https://abhi-glitchhg.github.io/) · [Project Website](https://deeplearningforsanskrit.github.io/)