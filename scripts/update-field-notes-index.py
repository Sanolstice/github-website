#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "field-notes"
INDEX_PATH = DATA_DIR / "index.json"


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(
        path.name
        for path in DATA_DIR.glob("*.json")
        if path.name != "index.json" and path.is_file()
    )

    INDEX_PATH.write_text(
        json.dumps(files, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Updated {INDEX_PATH.relative_to(ROOT)} with {len(files)} file(s).")


if __name__ == "__main__":
    main()
