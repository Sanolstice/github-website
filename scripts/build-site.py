#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run(*command: str) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> None:
    run("node", str(ROOT / "scripts" / "optimize-images.js"))
    run(sys.executable, str(ROOT / "scripts" / "build-public-data.py"))
    run(sys.executable, str(ROOT / "scripts" / "build-deploy.py"))
    run(sys.executable, str(ROOT / "scripts" / "build-branch-preview.py"))


if __name__ == "__main__":
    main()
