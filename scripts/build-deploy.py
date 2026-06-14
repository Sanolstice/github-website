#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"
DIST_DIR = ROOT / "dist"
INDEX_TEMPLATE = ROOT / "src" / "index.template.html"
SCRIPT_PATH = ROOT / "script.js"
STYLE_PATH = ROOT / "style.css"
HERO_MANIFEST_PATH = PUBLIC_DIR / "assets" / "hero-manifest.json"

FORBIDDEN_FILE_NAMES = {".env", ".env.local", ".ds_store"}
FORBIDDEN_SUFFIXES = {
    ".ai",
    ".eps",
    ".key",
    ".pem",
    ".psd",
    ".raw",
    ".sketch",
    ".svg",
}
FORBIDDEN_CONTENT = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"OPENAI_API_KEY",
        r"插圖_prompt",
        r'"社群來源"',
        r'"脈絡"',
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        r"\bsk-[A-Za-z0-9_-]{20,}\b",
        r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b",
    )
]
CONFLICT_COPY_PATTERN = re.compile(r"\s+\d+(?=\.[^.]+$)")


def content_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def copy_public_file(relative_path: str) -> None:
    source = PUBLIC_DIR / relative_path
    if not source.is_file():
        raise SystemExit(f"公開輸出缺少必要檔案：{relative_path}")
    target = DIST_DIR / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def image_paths(image: dict[str, object]) -> set[str]:
    paths = {str(image["fallback"]), str(image["src"])}
    for item in str(image["srcset"]).split(","):
        paths.add(item.strip().split(" ", 1)[0])
    return paths


def copy_public_files() -> None:
    copy_public_file("robots.txt")
    copy_public_file("data/manifest.json")

    data_manifest = json.loads(
        (PUBLIC_DIR / "data" / "manifest.json").read_text(encoding="utf-8")
    )
    referenced_images: set[str] = set()

    for page_path in data_manifest["pages"]:
        copy_public_file(page_path)
        page = json.loads((PUBLIC_DIR / page_path).read_text(encoding="utf-8"))
        for entry in page.get("items", []):
            if isinstance(entry.get("image"), dict):
                referenced_images.update(image_paths(entry["image"]))

    hero = json.loads(HERO_MANIFEST_PATH.read_text(encoding="utf-8"))
    referenced_images.update(image_paths(hero))
    for image_path in sorted(referenced_images):
        copy_public_file(image_path)


def build_index() -> None:
    hero = json.loads(HERO_MANIFEST_PATH.read_text(encoding="utf-8"))
    script_name = f"app-{content_hash(SCRIPT_PATH)}.js"
    style_name = f"app-{content_hash(STYLE_PATH)}.css"
    asset_dir = DIST_DIR / "assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SCRIPT_PATH, asset_dir / script_name)
    shutil.copy2(STYLE_PATH, asset_dir / style_name)

    replacements = {
        "__APP_CSS__": f"assets/{style_name}",
        "__APP_JS__": f"assets/{script_name}",
        "__PUBLIC_BASE__": "",
        "__HERO_FALLBACK__": hero["fallback"],
        "__HERO_SRC__": hero["src"],
        "__HERO_SRCSET__": hero["srcset"],
        "__HERO_WIDTH__": str(hero["width"]),
        "__HERO_HEIGHT__": str(hero["height"]),
    }
    index = INDEX_TEMPLATE.read_text(encoding="utf-8")
    for marker, value in replacements.items():
        index = index.replace(marker, value)

    unresolved = re.findall(r"__[A-Z0-9_]+__", index)
    if unresolved:
        raise SystemExit(f"index.html 尚有未替換標記：{', '.join(unresolved)}")
    (DIST_DIR / "index.html").write_text(index, encoding="utf-8")


def audit_dist() -> None:
    allowed_roots = {"assets", "data", "index.html", "robots.txt"}
    errors: list[str] = []

    for child in DIST_DIR.iterdir():
        if child.name not in allowed_roots:
            errors.append(f"未列入部署 allowlist：{child.relative_to(DIST_DIR)}")

    for path in DIST_DIR.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(DIST_DIR)
        lower_name = path.name.lower()
        if CONFLICT_COPY_PATTERN.search(path.name):
            errors.append(f"偵測到同步衝突副本：{relative}")
            continue
        if lower_name in FORBIDDEN_FILE_NAMES or path.suffix.lower() in FORBIDDEN_SUFFIXES:
            errors.append(f"禁止部署的檔案：{relative}")
            continue

        if path.suffix.lower() in {".html", ".js", ".css", ".json", ".txt"}:
            content = path.read_text(encoding="utf-8", errors="replace")
            for pattern in FORBIDDEN_CONTENT:
                if pattern.search(content):
                    errors.append(f"敏感內容 {pattern.pattern!r} 出現在：{relative}")

    if errors:
        raise SystemExit("部署稽核失敗：\n- " + "\n- ".join(errors))
    print("Deployment audit passed: no raw prompts, secrets, or private source assets.")


def main() -> None:
    required = [
        INDEX_TEMPLATE,
        SCRIPT_PATH,
        STYLE_PATH,
        PUBLIC_DIR / "data" / "manifest.json",
        HERO_MANIFEST_PATH,
        PUBLIC_DIR / "robots.txt",
    ]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
    if missing:
        raise SystemExit(f"缺少部署必要檔案：{', '.join(missing)}")

    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir()
    copy_public_files()
    build_index()
    audit_dist()
    print(f"Built deploy-only output at {DIST_DIR}.")


if __name__ == "__main__":
    main()
