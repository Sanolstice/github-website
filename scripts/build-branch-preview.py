#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_TEMPLATE = ROOT / "src" / "index.template.html"
INDEX_OUTPUT = ROOT / "index.html"
SCRIPT_PATH = ROOT / "script.js"
STYLE_PATH = ROOT / "style.css"
HERO_MANIFEST_PATH = ROOT / "public" / "assets" / "hero-manifest.json"


def content_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def public_path(value: str) -> str:
    return f"public/{value}"


def main() -> None:
    hero = json.loads(HERO_MANIFEST_PATH.read_text(encoding="utf-8"))
    replacements = {
        "__APP_CSS__": f"style.css?v={content_hash(STYLE_PATH)}",
        "__APP_JS__": f"script.js?v={content_hash(SCRIPT_PATH)}",
        "__PUBLIC_BASE__": "public/",
        "__HERO_FALLBACK__": public_path(hero["fallback"]),
        "__HERO_SRC__": public_path(hero["src"]),
        "__HERO_SRCSET__": ", ".join(
            f"{public_path(item.strip().split(' ', 1)[0])} {item.strip().split(' ', 1)[1]}"
            for item in hero["srcset"].split(",")
        ),
        "__HERO_WIDTH__": str(hero["width"]),
        "__HERO_HEIGHT__": str(hero["height"]),
    }

    index = INDEX_TEMPLATE.read_text(encoding="utf-8")
    for marker, value in replacements.items():
        index = index.replace(marker, value)

    unresolved = re.findall(r"__[A-Z0-9_]+__", index)
    if unresolved:
        raise SystemExit(f"branch index 尚有未替換標記：{', '.join(unresolved)}")
    INDEX_OUTPUT.write_text(index, encoding="utf-8")
    print(f"Built branch-compatible preview at {INDEX_OUTPUT}.")


if __name__ == "__main__":
    main()
