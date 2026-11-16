#!/usr/bin/env python3
"""Add a Khanda entry to the flat Rigveda JSON dataset.

Run from the repository root:
    python scripts/add_khanda.py

The script only changes rigveda.json. It creates a timestamped backup first,
checks for duplicate references, and asks for confirmation before writing.
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_FILE = ROOT / "rigveda.json"


def ask_number(label: str, minimum: int = 1, maximum: int | None = None) -> int:
    while True:
        raw = input(f"{label}: ").strip()
        try:
            value = int(raw)
        except ValueError:
            print("Please enter a whole number.")
            continue
        if value < minimum or (maximum is not None and value > maximum):
            limit = f" and at most {maximum}" if maximum is not None else ""
            print(f"Please enter a number of at least {minimum}{limit}.")
            continue
        return value


def load_data(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except FileNotFoundError:
        raise SystemExit(f"Data file not found: {path}")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Could not parse {path}: {exc}")

    if not isinstance(data, dict):
        raise SystemExit("Expected rigveda.json to contain a top-level JSON object.")
    return data


def derive_rik_num(data: dict[str, Any], ashtaka: int, adhyaya: int) -> str:
    """Derive Mandala.Sukta from the first Richa of the first Varga."""
    first_richa_ref = f"{ashtaka}.{adhyaya}.01.01"
    for key, item in data.items():
        if str(item.get("ashtaka_ref", "")).strip() == first_richa_ref:
            first_rik = str(item.get("rik_num", key)).strip()
            parts = first_rik.split(".")
            if len(parts) != 3 or not all(part.isdigit() for part in parts):
                raise SystemExit(
                    f"Cannot derive Mandala/Sukta: invalid rik_num {first_rik!r} "
                    f"for {first_richa_ref}."
                )
            return f"{int(parts[0]):02d}.{int(parts[1]):03d}.00"

    raise SystemExit(
        f"Cannot find the first Richa of Varga 1 ({first_richa_ref}) in rigveda.json. "
        "No changes made."
    )


def find_insertion_index(data: dict[str, Any], ashtaka: int, adhyaya: int) -> int:
    """Return the position after the last entry in the selected Adhyaya."""
    prefix = f"{ashtaka}.{adhyaya}."
    matching = [
        index for index, (_, item) in enumerate(data.items())
        if str(item.get("ashtaka_ref", "")).startswith(prefix)
    ]
    return matching[-1] + 1 if matching else len(data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Add a Khanda entry to rigveda.json.")
    parser.add_argument("--file", type=Path, default=DEFAULT_DATA_FILE,
                        help="Path to rigveda.json (default: repository root).")
    args = parser.parse_args()
    data_path = args.file.resolve()

    print("\nAdd a new Khanda to Rigveda Samhita")
    print("-----------------------------------")
    print("Enter the Ashtaka and Adhyaya. Mandala and Sukta are derived automatically.")

    ashtaka = ask_number("Ashtaka")
    adhyaya = ask_number("Adhyaya")
    varga = 0  # Khandas are assigned Varga 0 by convention.
    print("Varga: 0 (default for Khanda)")

    print("\nPaste the complete Khanda text. Finish with an empty line:")
    text_lines: list[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line == "":
            break
        text_lines.append(line)

    khanda_text = "\n".join(text_lines).strip()
    if not khanda_text:
        raise SystemExit("Khanda text cannot be empty.")

    data = load_data(data_path)

    # The first Richa of Varga 1 carries the Mandala/Sukta mapping for this
    # Ashtaka-Adhyaya. Khanda uses that same Mandala/Sukta with Mantra 00.
    rik_num = derive_rik_num(data, ashtaka, adhyaya)
    ashtaka_ref = f"{ashtaka}.{adhyaya}.{varga:02d}.00"

    if rik_num in data:
        existing = data[rik_num]
        if existing.get("is_khanda") is True:
            raise SystemExit(f"A Khanda already exists with rik_num {rik_num}. No changes made.")
        raise SystemExit(
            f"Reference {rik_num} is already used by a non-Khanda entry. No changes made."
        )

    for key, item in data.items():
        if item.get("is_khanda") is True and (
            str(item.get("rik_num", "")) == rik_num
            or str(item.get("ashtaka_ref", "")) == ashtaka_ref
        ):
            raise SystemExit(
                f"A Khanda already exists at {key} "
                f"(rik_num={item.get('rik_num')}, ashtaka_ref={item.get('ashtaka_ref')}). "
                "No changes made."
            )

    entry = {
        "text": khanda_text,
        "pada_dev_acc": "",
        "rik_num": rik_num,
        "ashtaka_ref": ashtaka_ref,
        "is_khanda": True,
    }

    print("\nProposed entry")
    print("--------------")
    print(json.dumps({rik_num: entry}, ensure_ascii=False, indent=2))
    confirm = input("\nAdd this Khanda to rigveda.json? [y/N]: ").strip().lower()
    if confirm not in {"y", "yes"}:
        print("Cancelled. No files were changed.")
        return

    insertion_index = find_insertion_index(data, ashtaka, adhyaya)
    items = list(data.items())
    items.insert(insertion_index, (rik_num, entry))
    updated_data = dict(items)

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = data_path.with_name(
        f"{data_path.stem}.backup-{timestamp}{data_path.suffix}"
    )
    shutil.copy2(data_path, backup_path)

    try:
        with data_path.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(updated_data, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
    except OSError as exc:
        shutil.copy2(backup_path, data_path)
        raise SystemExit(
            f"Could not write {data_path}: {exc}. Original restored from backup."
        )

    print(f"\nKhanda added successfully: {rik_num}")
    print(f"Backup created: {backup_path}")


if __name__ == "__main__":
    main()
