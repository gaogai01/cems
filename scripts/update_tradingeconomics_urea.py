#!/usr/bin/env python3
"""Fetch the public Trading Economics urea benchmark page and publish its daily quote."""
import csv
import json
import re
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

URL = "https://tradingeconomics.com/commodity/urea"
OUTPUT = Path("data/tradingeconomics_urea.json")
HISTORY = Path("data/tradingeconomics_urea_history.csv")


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
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")

    # Keep one point per market date so the daily log can look up past closing quotes.
    history = {}
    if HISTORY.exists():
        with HISTORY.open("r", newline="", encoding="utf-8") as file:
            for row in csv.DictReader(file):
                date = row.get("date", "")
                try:
                    value = float(row.get("price_usd_t", ""))
                except (TypeError, ValueError):
                    continue
                if re.fullmatch(r"\\d{4}-\\d{2}-\\d{2}", date) and value > 0:
                    history[date] = value
    history[observed_date] = price
    HISTORY.parent.mkdir(parents=True, exist_ok=True)
    with HISTORY.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["date", "price_usd_t", "source"])
        for date in sorted(history):
            writer.writerow([date, f"{history[date]:.4f}", "Trading Economics"])

    print(f"Updated Trading Economics urea: {price:g} USD/T ({observed_date})")


if __name__ == "__main__":
    main()
