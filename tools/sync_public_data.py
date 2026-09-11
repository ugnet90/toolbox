#!/usr/bin/env python3
"""Synchronize canonical Toolbox data files into the GitHub Pages tree.

`data/` is the canonical source. Files under `docs/data/` listed here are
publication mirrors only and must not be maintained independently.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PUBLIC_DATA_MAPPINGS = (
    (ROOT / "data" / "tools.json", ROOT / "docs" / "data" / "tools.json"),
    (ROOT / "data" / "ergo_union_funds.json", ROOT / "docs" / "data" / "ergo_union_funds.json"),
)


def _bytes(path: Path) -> bytes:
    return path.read_bytes()


def check_public_data() -> list[str]:
    """Return human-readable mismatches without changing files."""
    errors: list[str] = []
    for source, target in PUBLIC_DATA_MAPPINGS:
        rel_source = source.relative_to(ROOT)
        rel_target = target.relative_to(ROOT)
        if not source.is_file():
            errors.append(f"Kanonische Datei fehlt: {rel_source}")
            continue
        if not target.is_file():
            errors.append(f"Öffentliche Kopie fehlt: {rel_target}")
            continue
        if _bytes(source) != _bytes(target):
            errors.append(f"Öffentliche Kopie weicht ab: {rel_source} -> {rel_target}")
    return errors


def sync_public_data() -> int:
    changed = 0
    for source, target in PUBLIC_DATA_MAPPINGS:
        rel_source = source.relative_to(ROOT)
        rel_target = target.relative_to(ROOT)
        if not source.is_file():
            raise FileNotFoundError(f"Kanonische Datei fehlt: {rel_source}")
        source_bytes = _bytes(source)
        if target.is_file() and _bytes(target) == source_bytes:
            print(f"[sync] unverändert: {rel_target}")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source_bytes)
        changed += 1
        print(f"[sync] {rel_source} -> {rel_target}")
    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Nur prüfen, ob alle öffentlichen Spiegel byte-identisch zur kanonischen Quelle sind.",
    )
    args = parser.parse_args()

    if args.check:
        errors = check_public_data()
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print("[sync] Öffentliche Datenkopien sind aktuell.")
        return 0

    changed = sync_public_data()
    print(f"[sync] Fertig; geänderte öffentliche Dateien: {changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
