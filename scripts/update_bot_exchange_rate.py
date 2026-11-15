#!/usr/bin/env python3
"""Fetch the latest Bank of Taiwan USD spot-selling reference rate."""

from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

SOURCE_URL = "https://rate.bot.com.tw/xrt/quote/ltm/USD/spot"
OUTPUT_PATH = Path("data/bot_usd_twd.json")


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None


def main():
    request = Request(
        SOURCE_URL,
        headers={"User-Agent": "CEMS-USD-TWD-Reference-Rate/1.0"},
    )
    with urlopen(request, timeout=45) as response:
        page = response.read().decode("utf-8", errors="replace")

    parser = TableParser()
    parser.feed(page)

    for row in parser.rows:
        if len(row) < 6:
            continue
        date_match = re.fullmatch(r"(\d{4})/(\d{2})/(\d{2})", row[0].strip())
        currency = row[1].strip()
        if not date_match or ("USD" not in currency.upper() and "美金" not in currency):
            continue
        try:
            spot_sell = float(row[5].replace(",", "").strip())
        except ValueError:
            continue
        if spot_sell <= 0:
            continue

        year, month, day = date_match.groups()
        result = {
            "source": "臺灣銀行營業時間牌告匯率",
            "sourceUrl": SOURCE_URL,
            "currency": "USD/TWD",
            "rateType": "即期賣出",
            "rateDate": f"{year}-{month}-{day}",
            "rate": spot_sell,
        }
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated BOT USD/TWD spot sell: {result['rateDate']} = {result['rate']}")
        return

    raise RuntimeError("Could not locate the latest USD spot-selling rate on the Bank of Taiwan page.")


if __name__ == "__main__":
    main()
