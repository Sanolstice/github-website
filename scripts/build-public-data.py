#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PRIVATE_DATA_DIR = ROOT / "private-data" / "field-notes"
IMAGE_MANIFEST_PATH = ROOT / ".build" / "image-manifest.json"
PUBLIC_DATA_DIR = ROOT / "public" / "data"
PAGE_SIZE = 9

INTERNAL_TAG_PATTERN = re.compile(
    r"ABB|路線\s*A|巡熱詞|温若喬|社群來源|Threads|收詞",
    re.IGNORECASE,
)


def text(value: Any, fallback: str = "") -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    return fallback


def first_value(record: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        value = record.get(key)
        if value:
            return value
    return ""


def public_definition(entry: dict[str, Any]) -> str:
    definition = first_value(
        entry,
        ["definition", "meaning", "description", "explanation", "釋義"],
    )
    if isinstance(definition, dict):
        definition = definition.get("本義", "")
    return re.sub(r"[（(]\s*ABB\s*[）)]|\bABB\b\s*", "", text(definition, "釋義未提供")).strip()


def public_tags(entry: dict[str, Any]) -> list[str]:
    value = entry.get("sensoryTags") or first_value(
        entry,
        ["tags", "sensoryCategory", "category", "分類"],
    )
    if isinstance(value, list):
        tags = [text(tag) for tag in value]
    elif isinstance(value, str):
        tags = re.split(r"[,，、/]", value)
    else:
        tags = []

    tags = [
        tag.strip()
        for tag in tags
        if tag.strip() and not INTERNAL_TAG_PATTERN.search(tag)
    ]
    return tags or ["未分類"]


def source_url(entry: dict[str, Any]) -> str:
    direct = first_value(entry, ["sourceUrl", "sourceURL", "url", "link"])
    if direct:
        candidate = text(direct)
        return candidate if candidate.startswith("https://") else ""

    source = entry.get("source")
    if isinstance(source, str) and source.startswith("https://"):
        return source
    if isinstance(source, dict):
        candidate = text(source.get("url") or source.get("href"))
        return candidate if candidate.startswith("https://") else ""

    links = entry.get("字典連結")
    if isinstance(links, dict):
        candidate = text(
            links.get("教育部臺灣台語常用詞辭典") or links.get("教育部")
        )
        return candidate if candidate.startswith("https://") else ""
    return ""


def sanitize_entry(entry: dict[str, Any], images: dict[str, Any]) -> dict[str, Any]:
    stable_id = text(first_value(entry, ["id", "slug"]))
    term = text(first_value(entry, ["term", "word", "title", "name", "詞", "詞目"]), "未提供")
    image = images.get(stable_id)

    public_entry: dict[str, Any] = {
        "term": term,
        "pronunciation": text(
            first_value(
                entry,
                ["pronunciation", "reading", "romanization", "pinyin", "音讀", "台羅"],
            ),
            "音讀未提供",
        ),
        "definition": public_definition(entry),
        "fieldNote": text(
            first_value(
                entry,
                [
                    "fieldNote",
                    "field_note",
                    "note",
                    "memo",
                    "observation",
                    "description",
                    "田調筆記",
                ],
            ),
            "還沒有田調筆記，先把這個詞留在口袋裡。",
        ),
        "sensoryTags": public_tags(entry),
        "sourceUrl": source_url(entry),
        "imageAlt": text(
            first_value(
                entry,
                ["alt", "imageAlt", "image_alt", "title", "description", "詞目"],
            ),
            f"{term}田調插圖",
        ),
    }
    if image:
        public_entry["image"] = image
    return public_entry


def minified_json(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")


def main() -> None:
    if not PRIVATE_DATA_DIR.is_dir():
        raise SystemExit(f"找不到私有資料目錄：{PRIVATE_DATA_DIR}")
    if not IMAGE_MANIFEST_PATH.is_file():
        raise SystemExit("找不到圖片 manifest，請先執行 npm run optimize-images。")

    image_manifest = json.loads(IMAGE_MANIFEST_PATH.read_text(encoding="utf-8"))
    images = image_manifest.get("notes", {})
    raw_entries: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for file_path in sorted(PRIVATE_DATA_DIR.glob("*.json")):
        if file_path.name == "index.json":
            continue
        payload = json.loads(file_path.read_text(encoding="utf-8"))
        entries = payload if isinstance(payload, list) else payload.get("entries", [])
        if not isinstance(entries, list):
            raise SystemExit(f"{file_path} 缺少 entries 陣列。")

        for entry in entries:
            stable_id = text(first_value(entry, ["id", "slug"]))
            if not stable_id:
                raise SystemExit(f"{file_path} 有資料缺少 id/slug。")
            if stable_id in seen_ids:
                raise SystemExit(f"發現重複 id：{stable_id}")
            seen_ids.add(stable_id)
            raw_entries.append(entry)

    notes = [sanitize_entry(entry, images) for entry in reversed(raw_entries)]
    if PUBLIC_DATA_DIR.exists():
        shutil.rmtree(PUBLIC_DATA_DIR)
    PUBLIC_DATA_DIR.mkdir(parents=True)

    page_paths: list[str] = []
    expected_files: set[str] = {"manifest.json"}
    for page_index in range(0, len(notes), PAGE_SIZE):
        page = notes[page_index : page_index + PAGE_SIZE]
        page_bytes = minified_json({"items": page})
        digest = hashlib.sha256(page_bytes).hexdigest()[:16]
        file_name = f"page-{digest}.json"
        (PUBLIC_DATA_DIR / file_name).write_bytes(page_bytes + b"\n")
        expected_files.add(file_name)
        page_paths.append(f"data/{file_name}")

    manifest_payload = {
        "version": hashlib.sha256("|".join(page_paths).encode("utf-8")).hexdigest()[:16],
        "pageSize": PAGE_SIZE,
        "totalItems": len(notes),
        "pages": page_paths,
    }
    (PUBLIC_DATA_DIR / "manifest.json").write_bytes(minified_json(manifest_payload) + b"\n")
    for path in PUBLIC_DATA_DIR.iterdir():
        if path.is_file() and path.name not in expected_files:
            path.unlink()
    print(
        f"Published {len(notes)} sanitized note(s) in {len(page_paths)} page chunk(s)."
    )


if __name__ == "__main__":
    main()
