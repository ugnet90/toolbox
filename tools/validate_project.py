#!/usr/bin/env python3
"""Einfache Konsistenzprüfung für die Toolbox-Struktur."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    registry_path = ROOT / "data" / "tools.json"
    public_registry_path = DOCS / "data" / "tools.json"

    if not registry_path.exists():
        fail("data/tools.json fehlt")

    with registry_path.open("r", encoding="utf-8") as handle:
        registry = json.load(handle)

    if registry.get("schema_version") != 1:
        fail("Unbekannte schema_version in data/tools.json")

    ids: set[str] = set()
    hrefs: set[str] = set()

    for tool in registry.get("tools", []):
        tool_id = tool.get("id")
        href = tool.get("href")
        if not tool_id or not href:
            fail("Jedes Tool benötigt id und href")
        if tool_id in ids:
            fail(f"Doppelte Tool-ID: {tool_id}")
        if href in hrefs:
            fail(f"Doppelter Tool-Link: {href}")
        ids.add(tool_id)
        hrefs.add(href)

        if not (DOCS / href).exists():
            fail(f"Zielseite fehlt: docs/{href}")

    if not public_registry_path.exists():
        fail("docs/data/tools.json fehlt; zuerst tools/sync_public_data.py ausführen")

    if registry_path.read_bytes() != public_registry_path.read_bytes():
        fail("data/tools.json und docs/data/tools.json sind nicht synchron")

    required_files = [
        DOCS / "index.html",
        DOCS / "date_calculator.html",
        DOCS / "js" / "site-map.js",
        DOCS / "js" / "navigation.js",
    ]

    for path in required_files:
        if not path.exists():
            fail(f"Pflichtdatei fehlt: {path.relative_to(ROOT)}")

    print(f"OK: {len(ids)} Tool(s), Projektstruktur konsistent.")


if __name__ == "__main__":
    main()
