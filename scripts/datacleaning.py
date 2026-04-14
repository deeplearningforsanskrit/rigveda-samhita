import json
import json
import re

INPUT_FILE = "/home/abhijit/sanskrit_OCR/better_data/rig_veda_multiscript.json"



OUTPUT_FILE = "rigveda.json"

DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

def extract_ref(c_text: str) -> str | None:
    m = re.search(r'([०-९]+\.[०-९]+\.[०-९]+)', c_text)
    if not m:
        return None
    return m.group(1).translate(DEVANAGARI_DIGITS)

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

out = {}

for mandala in data.get("mandalams", []):
    mandala_id = mandala.get("id")

    for aadhaya in mandala.get("aadhayaa", []):
        aadhaya_id = aadhaya.get("id")

        for entry in aadhaya.get("sukta", []):
            entry_id = entry.get("id")
            a = (entry.get("a") or "").strip()
            c = (entry.get("c") or "").strip()
            text = f"{a} {c}".strip()

            if not text:
                continue

            ref = extract_ref(c)
            if ref is None:
                ref = f"{mandala_id}.{aadhaya_id}.{entry_id}"

            out[ref] = {
                "mandala": mandala_id,
                "aadhaya": aadhaya_id,
                "entryId": entry_id,
                "a": a,
                "c": c,
                "text": text,
            }

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

print(f"Saved {len(out)} entries to {OUTPUT_FILE}")