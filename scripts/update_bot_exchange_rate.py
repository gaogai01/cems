#!/usr/bin/env python3
"""Fetch the latest Bank of Taiwan USD spot-selling reference rate."""

import csv
from datetime import date
import io
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

# 臺銀官方匯率 CSV，欄位順序：日期、幣別、現金買入/賣出、即期買入/賣出。
SOURCE_URL = "https://rate.bot.com.tw/xrt/flcsv/0/L3M/USD"
OUTPUT_PATH = Path("data/bot_usd_twd.json")


def parse_rate(page: str):
    for row in csv.reader(io.StringIO(page)):
        if len(row) < 6:
            continue

        date_text = row[0].strip().lstrip("\ufeff")
        currency = row[1].strip()
        date_match = re.fullmatch(r"(\d{4})/(\d{1,2})/(\d{1,2})", date_text)
        if not date_match:
            continue
        if "USD" not in currency.upper() and not any(word in currency for word in ("美金", "美元")):
            continue

        try:
            spot_sell = float(row[5].replace(",", "").strip())
        except (ValueError, IndexError):
            continue
        if spot_sell <= 0:
            continue

        year, month, day = map(int, date_match.groups())
        return {
            "source": "臺灣銀行營業時間牌告匯率",
            "sourceUrl": SOURCE_URL,
            "currency": "USD/TWD",
            "rateType": "即期賣出",
            "rateDate": date(year, month, day).isoformat(),
            "rate": spot_sell,
        }
    return None


def main():
    request = Request(
        SOURCE_URL,
        headers={"User-Agent": "CEMS-USD-TWD-Reference-Rate/1.0"},
    )
    with urlopen(request, timeout=45) as response:
        page = response.read().decode("utf-8-sig", errors="replace")

    result = parse_rate(page)
    if result is None:
        raise RuntimeError("Could not locate the latest USD spot-selling rate in Bank of Taiwan CSV.")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated BOT USD/TWD spot sell: {result['rateDate']} = {result['rate']}")


if __name__ == "__main__":
    main()
