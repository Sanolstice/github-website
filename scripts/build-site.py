#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_IMAGES_DIR = ROOT / "public" / "generated-images"
SERVED_IMAGES_DIR = ROOT / "generated-images"
SUPPORTED_IMAGE_SUFFIXES = {".png", ".webp", ".jpg", ".jpeg"}


def sync_generated_images() -> None:
    PUBLIC_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    SERVED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    source_images = {
        path.relative_to(PUBLIC_IMAGES_DIR): path
        for path in PUBLIC_IMAGES_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGE_SUFFIXES
    }

    for target in SERVED_IMAGES_DIR.rglob("*"):
        if (
            target.is_file()
            and target.name != ".gitkeep"
            and target.relative_to(SERVED_IMAGES_DIR) not in source_images
        ):
            target.unlink()

    for relative_path, source in source_images.items():
        target = SERVED_IMAGES_DIR / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    print(
        f"Synced {len(source_images)} image(s) from "
        "public/generated-images/ to generated-images/."
    )


def main() -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "update-field-notes-index.py")],
        check=True,
    )
    sync_generated_images()


if __name__ == "__main__":
    main()
