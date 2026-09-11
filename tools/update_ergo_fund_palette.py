#!/usr/bin/env python3
"""Refresh the ERGO/Union fund palette used by the insurance comparison tool.

The ERGO PDF is the canonical source for which Union Investment funds are offered.
Union Investment's price list is preferred for the regular issue load. Fondsweb is
used as a best-effort source for standardized annualized historical performance.

The script intentionally has no scheduling logic. It is run manually by the
"Update ERGO fund palette" GitHub Actions workflow.
"""

from __future__ import annotations

import argparse
import io
import json
import re
from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Any

ERGO_PDF_URL = (
    "https://ergo-versicherung.at/fileadmin/user_upload/pdf/produktreports/"
    "DIE_FONDSPALETTE_ERGO_FUERS_LEBEN_SPAREN_INVESTMENT_GESAMT.pdf"
)
UNION_PRICE_LIST_URL = (
    "https://www.union-investment.de/fonds_depot/uniondepot/"
    "besonderes-preis-leistungsverzeichnis"
)
FONDSWEB_URL_TEMPLATE = "https://www.fondsweb.com/at/{isin}"

ROOT = Path(__file__).resolve().parents[1]
CANONICAL_PATH = ROOT / "data" / "ergo_union_funds.json"

ISIN_RE = re.compile(r"\b[A-Z]{2}[A-Z0-9]{10}\b")
DATE_DE_RE = re.compile(r"\b(\d{2})\.(\d{2})\.(\d{4})\b")


def de_number(value: str) -> float:
    raw = str(value or "").strip().replace("\xa0", " ").replace(" ", "")
    raw = raw.replace("%", "").replace("+", "")
    if not raw:
        raise ValueError("empty number")
    if "," in raw and "." in raw:
        raw = raw.replace(".", "").replace(",", ".")
    elif "," in raw:
        raw = raw.replace(",", ".")
    return float(raw)


def iso_from_de(value: str) -> str:
    match = DATE_DE_RE.search(value or "")
    if not match:
        return ""
    day, month, year = match.groups()
    return f"{year}-{month}-{day}"


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\x02", " ")).strip()


def extract_ergo_union_funds(pdf_text: str) -> tuple[str, list[dict[str, str]]]:
    """Extract source date plus current Union funds from ERGO's text layer."""
    text = str(pdf_text or "").replace("\x00", "")
    source_match = re.search(r"Stand:\s*(\d{2}\.\d{2}\.\d{4})", text)
    if not source_match:
        raise ValueError("ERGO-PDF: Datenstand konnte nicht ermittelt werden.")
    source_updated_at = iso_from_de(source_match.group(1))

    lines = [normalize_spaces(line) for line in text.splitlines()]
    funds: list[dict[str, str]] = []
    seen: set[str] = set()

    for index, line in enumerate(lines):
        match = ISIN_RE.search(line)
        if not match:
            continue
        context_lines = [line]
        for following in lines[index + 1 : index + 3]:
            # Do not let the manager of the next fund bleed into this row.
            if ISIN_RE.search(following):
                break
            context_lines.append(following)
        context = " ".join(context_lines)
        if "Union Investment" not in context:
            continue

        isin = match.group(0)
        if isin in seen:
            continue
        name = normalize_spaces(line[: match.start()])
        # Defensive cleanup if page/section markers ever bleed into the text line.
        name = re.sub(r"^(?:\d+\s+)+", "", name).strip(" -–—")
        if not name or name.lower().startswith(("fondsname", "isin")):
            continue
        funds.append({"name": name, "isin": isin})
        seen.add(isin)

    if len(funds) < 5:
        raise ValueError(
            f"ERGO-PDF: nur {len(funds)} Union-Fonds erkannt; Aktualisierung wird aus Sicherheitsgründen abgebrochen."
        )
    return source_updated_at, funds


def parse_union_issue_loads(html: str) -> dict[str, float]:
    """Parse regular issue loads by ISIN from Union's official price list."""
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:  # pragma: no cover - dependency installed in workflow
        raise RuntimeError("beautifulsoup4 ist für die Aktualisierung erforderlich") from exc

    soup = BeautifulSoup(html or "", "html.parser")
    result: dict[str, float] = {}
    for row in soup.find_all("tr"):
        cells = [normalize_spaces(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"])]
        if not cells:
            continue
        joined = " | ".join(cells)
        isin_match = ISIN_RE.search(joined)
        if not isin_match:
            continue
        isin = isin_match.group(0)
        percent_cells = [cell for cell in cells if re.fullmatch(r"[+-]?\d+(?:[.,]\d+)?\s*%", cell)]
        if not percent_cells:
            continue
        try:
            result[isin] = de_number(percent_cells[0])
        except ValueError:
            continue
    return result


def parse_fondsweb_metrics(html: str, isin: str) -> dict[str, Any]:
    """Best-effort parser for Fondsweb annualized performance and issue load."""
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("beautifulsoup4 ist für die Aktualisierung erforderlich") from exc

    soup = BeautifulSoup(html or "", "html.parser")
    text = soup.get_text("\n", strip=True)
    metrics: dict[str, Any] = {
        "source": "Fondsweb",
        "source_url": FONDSWEB_URL_TEMPLATE.format(isin=isin),
        "annualized": {},
    }

    nav_match = re.search(r"NAV\s+vom\s+(\d{2}\.\d{2}\.\d{4})", text, re.IGNORECASE)
    if nav_match:
        metrics["stand"] = iso_from_de(nav_match.group(1))

    issue_match = re.search(
        r"Maximaler\s+Ausgabeaufschlag[^\d+-]*([+-]?\d+(?:[.,]\d+)?)\s*%",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if issue_match:
        metrics["max_issue_load_percent"] = de_number(issue_match.group(1))

    annual_heading = None
    for heading in soup.find_all(["h2", "h3", "h4"]):
        if "Annualisiert" in normalize_spaces(heading.get_text(" ", strip=True)):
            annual_heading = heading
            break
    table = annual_heading.find_next("table") if annual_heading else None
    if table:
        for row in table.find_all("tr"):
            cells = [normalize_spaces(cell.get_text(" ", strip=True)) for cell in row.find_all(["th", "td"])]
            if len(cells) < 2:
                continue
            period_match = re.fullmatch(r"(1|3|5|10|15|20)\s+Jahr(?:e)?", cells[0])
            if not period_match:
                continue
            value_match = re.search(r"([+-]?\d+(?:[.,]\d+)?)\s*%", cells[1])
            if not value_match:
                continue
            metrics["annualized"][period_match.group(1)] = de_number(value_match.group(1))

    if not metrics["annualized"]:
        # Some Fondsweb variants expose table rows as plain text without a semantic table.
        annual_segment = text.split("Annualisiert", 1)[1] if "Annualisiert" in text else ""
        annual_segment = annual_segment.split("Eckdaten", 1)[0]
        for period in (1, 3, 5, 10, 15, 20):
            match = re.search(
                rf"\b{period}\s+Jahr(?:e)?\s*\n?\s*([+-]?\d+(?:[.,]\d+)?)\s*%",
                annual_segment,
                re.IGNORECASE,
            )
            if match:
                metrics["annualized"][str(period)] = de_number(match.group(1))

    return metrics


def _http_get(url: str, *, accept: str = "text/html,*/*", timeout: int = 30) -> bytes:
    try:
        import requests
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("requests ist für die Aktualisierung erforderlich") from exc

    response = requests.get(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; ToolboxFundPalette/1.0; +GitHub Actions)",
            "Accept": accept,
            "Accept-Language": "de-AT,de;q=0.9,en;q=0.6",
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return response.content


def download_ergo_pdf_text() -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pypdf ist für die Aktualisierung erforderlich") from exc

    content = _http_get(ERGO_PDF_URL, accept="application/pdf,*/*")
    reader = PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def fetch_union_issue_loads() -> dict[str, float]:
    html = _http_get(UNION_PRICE_LIST_URL).decode("utf-8", errors="replace")
    return parse_union_issue_loads(html)


def fetch_fondsweb_metrics(isin: str) -> dict[str, Any]:
    url = FONDSWEB_URL_TEMPLATE.format(isin=isin)
    html = _http_get(url).decode("utf-8", errors="replace")
    return parse_fondsweb_metrics(html, isin)


def load_existing(path: Path = CANONICAL_PATH) -> dict[str, Any]:
    if not path.exists():
        return {"schema_version": 1, "funds": [], "removed_funds": []}
    return json.loads(path.read_text(encoding="utf-8"))


def merge_palette(
    existing: dict[str, Any],
    source_updated_at: str,
    source_funds: list[dict[str, str]],
    issue_loads: dict[str, float],
    performance_by_isin: dict[str, dict[str, Any]],
    *,
    checked_at: str,
) -> dict[str, Any]:
    old_by_isin = {str(item.get("isin", "")).upper(): item for item in existing.get("funds", []) if item.get("isin")}
    removed_by_isin = {
        str(item.get("isin", "")).upper(): item for item in existing.get("removed_funds", []) if item.get("isin")
    }
    active_isins = {item["isin"] for item in source_funds}

    funds: list[dict[str, Any]] = []
    for source_item in source_funds:
        isin = source_item["isin"]
        previous = deepcopy(old_by_isin.get(isin) or removed_by_isin.get(isin) or {})
        item: dict[str, Any] = previous
        item["name"] = source_item["name"]
        item["isin"] = isin
        item.setdefault("aliases", [])
        item.pop("removed_at", None)

        if isin in issue_loads:
            item["issue_load_percent"] = issue_loads[isin]
            item["issue_load_source"] = "Union Investment"
        elif "issue_load_percent" not in item:
            fw = performance_by_isin.get(isin, {})
            if "max_issue_load_percent" in fw:
                item["issue_load_percent"] = fw["max_issue_load_percent"]
                item["issue_load_source"] = "Fondsweb (maximal)"
            else:
                item["issue_load_percent"] = None
                item["issue_load_source"] = ""

        fw = performance_by_isin.get(isin)
        if fw and fw.get("annualized"):
            item["performance"] = {
                "kind": "bvi",
                "source": fw.get("source", "Fondsweb"),
                "source_url": fw.get("source_url", FONDSWEB_URL_TEMPLATE.format(isin=isin)),
                "stand": fw.get("stand", ""),
                "annualized": fw["annualized"],
            }
        elif "performance" not in item:
            item["performance"] = None
        funds.append(item)

    removed: list[dict[str, Any]] = []
    for isin, old in {**removed_by_isin, **old_by_isin}.items():
        if isin in active_isins:
            continue
        item = deepcopy(old)
        item["removed_at"] = item.get("removed_at") or checked_at
        removed.append(item)
    removed.sort(key=lambda x: (str(x.get("removed_at", "")), str(x.get("name", ""))))

    result = deepcopy(existing)
    result["schema_version"] = 1
    result["source"] = {
        "name": "ERGO Fondsliste – ERGO fürs Leben / ERGO fürs Sparen / ERGO fürs Investment",
        "url": ERGO_PDF_URL,
        "source_updated_at": source_updated_at,
        "checked_at": checked_at,
    }
    result["issue_load_source"] = {
        "name": "Union Investment – Besonderes Preis- und Leistungsverzeichnis",
        "url": UNION_PRICE_LIST_URL,
        "checked_at": checked_at,
    }
    result.setdefault(
        "performance_policy",
        {
            "preferred": "standardized_total_return",
            "preferred_source": "Fondsweb / Union Investment",
            "fallback": "union_price_cagr",
            "fallback_note": "Kursbasierte Näherung; Ausschüttungen sind darin nicht enthalten.",
        },
    )
    result["funds"] = funds
    result["removed_funds"] = removed
    return result


def save_palette(payload: dict[str, Any]) -> None:
    """Write only the canonical palette; publication mirrors are synced centrally."""
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    CANONICAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    CANONICAL_PATH.write_text(text, encoding="utf-8")


def update_palette(*, enrich_performance: bool = True) -> dict[str, Any]:
    checked_at = date.today().isoformat()
    pdf_text = download_ergo_pdf_text()
    source_updated_at, source_funds = extract_ergo_union_funds(pdf_text)
    existing = load_existing()

    try:
        issue_loads = fetch_union_issue_loads()
        print(f"[union] Ausgabeaufschläge geladen: {len(issue_loads)}")
    except Exception as exc:  # noqa: BLE001 - data refresh should keep prior values
        print(f"WARN: Union-Ausgabeaufschläge konnten nicht geladen werden: {exc}")
        issue_loads = {}

    performance_by_isin: dict[str, dict[str, Any]] = {}
    if enrich_performance:
        for fund in source_funds:
            isin = fund["isin"]
            try:
                metrics = fetch_fondsweb_metrics(isin)
                if metrics.get("annualized") or "max_issue_load_percent" in metrics:
                    performance_by_isin[isin] = metrics
                    print(f"[fondsweb] {isin}: {len(metrics.get('annualized', {}))} Renditezeiträume")
                else:
                    print(f"WARN: Fondsweb {isin}: keine verwertbaren Kennzahlen")
            except Exception as exc:  # noqa: BLE001 - best effort fallback
                print(f"WARN: Fondsweb {isin}: {exc}")

    payload = merge_palette(
        existing,
        source_updated_at,
        source_funds,
        issue_loads,
        performance_by_isin,
        checked_at=checked_at,
    )
    save_palette(payload)
    print(
        f"[ergo] Stand {source_updated_at}; geprüft {checked_at}; "
        f"aktive Union-Fonds: {len(payload['funds'])}; entfernt archiviert: {len(payload['removed_funds'])}"
    )
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--no-performance",
        action="store_true",
        help="Fondsweb-Anreicherung überspringen (nur für Diagnose/Test).",
    )
    args = parser.parse_args()
    update_palette(enrich_performance=not args.no_performance)


if __name__ == "__main__":
    main()
