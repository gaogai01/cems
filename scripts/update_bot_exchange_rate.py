#!/usr/bin/env python3
"""Fetch the latest Bank of Taiwan USD spot-selling reference rate."""

import csv
from datetime import datetime
from io import StringIO
import json
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

# 臺銀官方當日匯率 CSV；第 13 欄為即期賣出。
SOURCE_URL = "https://rate.bot.com.tw/xrt/flcsv/0/day"
OUTPUT_PATH = Path("data/bot_usd_twd.json")
TAIPEI = ZoneInfo("Asia/Taipei")


def parse_rate(csv_text: str):
    for row in csv.reader(StringIO(csv_text)):
        if len(row) < 14 or row[0].strip().upper() != "USD":
            continue
        try:
            spot_sell = float(row[13].replace(",", "").strip())
        except (ValueError, IndexError):
            continue
        if not 1 <= spot_sell <= 100:
            continue

        return {
            "source": "臺灣銀行營業時間牌告匯率",
            "sourceUrl": "https://rate.bot.com.tw/xrt?Lang=zh-TW",
            "currency": "USD/TWD",
            "rateType": "即期賣出",
            "rateDate": datetime.now(TAIPEI).date().isoformat(),
            "rate": spot_sell,
        }
    return None


def main():
    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; CEMS-USD-TWD-Reference-Rate/1.0)",
            "Accept": "text/csv,text/plain,*/*",
        },
    )
    with urlopen(request, timeout=45) as response:
        csv_text = response.read().decode("utf-8-sig", errors="replace")

    result = parse_rate(csv_text)
    if result is None:
        preview = csv_text[:180].replace("\n", " ").replace("\r", " ")
        raise RuntimeError("Could not locate USD spot-selling rate in Bank of Taiwan CSV. Response: " + preview)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated BOT USD/TWD spot sell: {result['rateDate']} = {result['rate']}")


if __name__ == "__main__":
    main()
