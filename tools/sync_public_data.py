#!/usr/bin/env python3
"""Synchronisiert öffentliche Datendateien von data/ nach docs/data/."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "data"
TARGET_DIR = ROOT / "docs" / "data"
PUBLIC_FILES = ("tools.json",)


def main() -> None:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    for filename in PUBLIC_FILES:
        source = SOURCE_DIR / filename
        target = TARGET_DIR / filename
        if not source.exists():
            raise FileNotFoundError(f"Fehlende Quelldatei: {source.relative_to(ROOT)}")
        shutil.copy2(source, target)
        print(f"sync: {source.relative_to(ROOT)} -> {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
