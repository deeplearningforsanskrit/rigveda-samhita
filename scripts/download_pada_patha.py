import json
import re
import requests
from bs4 import BeautifulSoup

BASE_WEB_URL = "https://sri-aurobindo.co.in/workings/matherials/rigveda/{mandala}/{mandala}-{suktam}.htm"

RIK_PAT = re.compile(r"^\d{2}\.\d{3}\.\d{2}$")        # 01.001.01
ASHTAKA_PAT = re.compile(r"^\d+\.\d+\.\d+\.\d+$")     # 1.1.01.01
ANUVAKA_PAT = re.compile(r"^\d{2}\.\d{2}\.\d{3}$")    # 01.01.001

SECTION_NAMES = {
    "Samhita Devanagari Accented",
    "Samhita Devanagari Nonaccented",
    "Samhita transliteration accented",
    "Samhita transliteration nonaccented",
    "Padapatha Devanagari Accented",
    "Padapatha Devanagari Nonaccented",
    "Padapatha transliteration accented",
    "Padapatha transliteration nonaccented",
    "interlinear translation",
    "Translation — Padapatha — Grammar",
}


def clean_text(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_block(lines, start_idx):
    collected = []
    i = start_idx

    while i < len(lines):
        line = lines[i]

        if (
            line in SECTION_NAMES
            or RIK_PAT.match(line)
            or ASHTAKA_PAT.match(line)
            or ANUVAKA_PAT.match(line)
        ):
            break

        collected.append(line)
        i += 1

    return " ".join(collected).strip(), i


def extract_from_html(html: str):
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n")

    lines = [clean_text(line) for line in text.splitlines()]
    lines = [line for line in lines if line]

    results = []
    i = 0

    while i < len(lines):
        if not RIK_PAT.match(lines[i]):
            i += 1
            continue

        rik_num = lines[i]
        ashtaka_ref = ""
        anuvaka_ref = ""
        samh_dev_acc = ""
        pada_dev_acc = ""

        j = i + 1

        # Search forward until we find the first ashtaka and anuvaka refs,
        # but stop if next rik begins first.
        while j < len(lines) and not RIK_PAT.match(lines[j]):
            if not ashtaka_ref and ASHTAKA_PAT.match(lines[j]):
                ashtaka_ref = lines[j]

            elif not anuvaka_ref and ANUVAKA_PAT.match(lines[j]):
                anuvaka_ref = lines[j]

            elif lines[j] == "Samhita Devanagari Accented":
                samh_dev_acc, _ = extract_block(lines, j + 1)

            elif lines[j] == "Padapatha Devanagari Accented":
                pada_dev_acc, _ = extract_block(lines, j + 1)

            j += 1

        results.append({
            "rik_num": rik_num,
            "ashtaka_ref": ashtaka_ref,
            "anuvaka_ref": anuvaka_ref,
            "samh_dev_acc": samh_dev_acc,
            "pada_dev_acc": pada_dev_acc,
        })

        i = j

    return results


def download_pada_patha(mandala: int, suktam: int):
    mandala_str = f"{mandala:02d}"
    suktam_str = f"{suktam:03d}"

    url = BASE_WEB_URL.format(mandala=mandala_str, suktam=suktam_str)
    print(f"Downloading from {url}...")

    response = requests.get(url, timeout=20)

    if response.status_code == 404:
        return None

    response.raise_for_status()
    html = response.content.decode("utf-8", errors="replace")
    return extract_from_html(html)


def main():
    for mandala in range(7, 11):
        suktam = 1
        all_data = []

        while True:
            page_data = download_pada_patha(mandala, suktam)

            if page_data is None:
                print(f"No more suktas for mandala {mandala:02d}. Stopping.")
                break

            all_data.extend(page_data)
            print(f"Added {len(page_data)} riks from mandala {mandala:02d}, sukta {suktam:03d}")

            suktam += 1

        output_file = f"rigveda_pada_patha_{mandala:02d}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)

        print(f"Saved {len(all_data)} total records to {output_file}")


if __name__ == "__main__":
    main()