#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.update_ergo_fund_palette import (  # noqa: E402
    extract_ergo_union_funds,
    merge_palette,
    parse_fondsweb_metrics,
    parse_union_issue_loads,
)


def assert_equal(actual, expected, label):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def main():
    pdf_text = """
    Stand: 09.09.2026 - ERGO Quality Score
    UniGlobal DE0008491051 4 Union Investment
    Management
    Some Other Fund LU0000000001 4 Other Manager
    UniRak Konservativ ESG LU1572731245 3 Union Investment
    Luxembourg S.A.
    UniSector HighTech LU0101441672 5 Union Investment
    Luxembourg S.A.
    UniAsia LU0037079034 4 Union Investment
    Luxembourg S.A.
    UniNordamerika DE0009750075 4 Union Investment
    Management
    Future Selection Fund DE000A4TEST1 3 Union Investment
    Management
    """
    stand, funds = extract_ergo_union_funds(pdf_text)
    assert_equal(stand, "2026-09-09", "ERGO date")
    assert_equal([x["isin"] for x in funds], [
        "DE0008491051", "LU1572731245", "LU0101441672", "LU0037079034", "DE0009750075", "DE000A4TEST1"
    ], "ERGO Union selection")

    union_html = """
    <table><tbody>
      <tr><td>UniGlobal DE0008491051</td><td>Union Investment</td><td>EUR</td><td>5,00 %</td><td>1,20 %</td></tr>
      <tr><td>UniRak Konservativ ESG A LU1572731245</td><td>Union Investment</td><td>EUR</td><td>2,00 %</td><td>1,20 %</td></tr>
    </tbody></table>
    """
    loads = parse_union_issue_loads(union_html)
    assert_equal(loads["DE0008491051"], 5.0, "UniGlobal load")
    assert_equal(loads["LU1572731245"], 2.0, "UniRak load")

    fondsweb_html = """
    <html><body>
      <h1>UniGlobal</h1><div>NAV vom 08.09.2026</div>
      <h3>Annualisiert</h3>
      <table>
       <tr><th></th><th>Fonds in EUR</th><th>Sektor</th></tr>
       <tr><td>1 Jahr</td><td>+17,96%</td><td>+16,90%</td></tr>
       <tr><td>3 Jahre</td><td>+14,89%</td><td>+12,73%</td></tr>
       <tr><td>5 Jahre</td><td>+9,98%</td><td>+6,42%</td></tr>
      </table>
      <div>Maximaler Ausgabeaufschlag</div><div>5,00%</div>
    </body></html>
    """
    metrics = parse_fondsweb_metrics(fondsweb_html, "DE0008491051")
    assert_equal(metrics["stand"], "2026-09-08", "Fondsweb stand")
    assert_equal(metrics["annualized"], {"1": 17.96, "3": 14.89, "5": 9.98}, "Fondsweb periods")
    assert_equal(metrics["max_issue_load_percent"], 5.0, "Fondsweb load")

    existing = {
        "schema_version": 1,
        "funds": [
            {"name": "Old", "isin": "DE0000000001", "aliases": ["Old Alias"], "issue_load_percent": 4},
            {"name": "UniGlobal", "isin": "DE0008491051", "aliases": ["UG"], "issue_load_percent": 4},
        ],
        "removed_funds": [],
    }
    merged = merge_palette(
        existing,
        "2026-09-09",
        [{"name": "UniGlobal", "isin": "DE0008491051"}, {"name": "UniAsia", "isin": "LU0037079034"}],
        {"DE0008491051": 5.0, "LU0037079034": 5.0},
        {"DE0008491051": metrics},
        checked_at="2026-09-11",
    )
    assert_equal(len(merged["funds"]), 2, "active fund count")
    assert_equal(merged["funds"][0]["aliases"], ["UG"], "aliases preserved")
    assert_equal(merged["funds"][0]["issue_load_percent"], 5.0, "issue load refreshed")
    assert_equal(merged["removed_funds"][0]["isin"], "DE0000000001", "removed archived")
    assert_equal(merged["removed_funds"][0]["removed_at"], "2026-09-11", "removed date")

    # Ensure the shipped seed data has a useful current fund count and unique ISINs.
    payload = json.loads((ROOT / "data" / "ergo_union_funds.json").read_text(encoding="utf-8"))
    isins = [item["isin"] for item in payload["funds"]]
    if len(isins) < 10 or len(isins) != len(set(isins)):
        raise AssertionError("seed palette must contain >=10 unique active Union funds")

    print("OK: ERGO fund palette updater tests passed")


if __name__ == "__main__":
    main()
