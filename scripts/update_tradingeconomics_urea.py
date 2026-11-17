#!/usr/bin/env python3
"""Fetch the public Trading Economics urea benchmark page and publish its daily quote."""
import json
import re
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

URL = "https://tradingeconomics.com/commodity/urea"
OUTPUT = Path("data/tradingeconomics_urea.json")


def main():
    request = Request(
        URL,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; CEMS-UreaPriceBot/1.0)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urlopen(request, timeout=30) as response:
        page = response.read().decode("utf-8", "replace")

    chart_match = re.search(r"TEChartsMeta\s*=\s*(\[.*?\]);", page, re.DOTALL)
    if not chart_match:
        raise RuntimeError("Trading Economics chart data was not found")

    chart_data = json.loads(unescape(chart_match.group(1)))
    if not chart_data or str(chart_data[0].get("name", "")).lower() != "urea":
        raise RuntimeError("Trading Economics returned unexpected chart data")

    price = float(chart_data[0].get("value", 0))
    if not (price > 0):
        raise RuntimeError("Trading Economics returned an invalid urea price")

    # The page's dataset range identifies the date of the latest published daily observation.
    date_match = re.search(
        r"Urea - Historical Dataset \(\d{4}-\d{2}-\d{2}/(\d{4}-\d{2}-\d{2})\)",
        page,
    )
    if not date_match:
        # Fallback to the page's summary, e.g. "on November 16, 2026".
        summary_match = re.search(
            r"Urea fell to [\d,.]+ USD/T on ([A-Za-z]+ \d{1,2}, \d{4})",
            page,
        )
        if not summary_match:
            raise RuntimeError("Trading Economics observation date was not found")
        observed_date = datetime.strptime(summary_match.group(1), "%B %d, %Y").date().isoformat()
    else:
        observed_date = date_match.group(1)

    payload = {
        "source": "Trading Economics",
        "sourceUrl": URL,
        "latest": {
            "value": round(price, 4),
            "date": observed_date,
            "unit": "USD/T",
        },
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated Trading Economics urea: {price:g} USD/T ({observed_date})")


if __name__ == "__main__":
    main()
