#!/usr/bin/env python3
"""Fetch the latest World Bank Pink Sheet monthly urea price into JSON."""

from html.parser import HTMLParser
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import urljoin
from urllib.request import Request, urlopen

LANDING_URL = "https://www.worldbank.org/en/research/commodity-markets"
OUTPUT_PATH = Path("data/worldbank_urea.json")


class WorkbookLinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        for key, value in attrs:
            if key.lower() == "href" and value and "CMO-Historical-Data-Monthly.xlsx" in value:
                self.links.append(urljoin(LANDING_URL, value))


def fetch(url):
    request = Request(url, headers={"User-Agent": "CEMS-Urea-Monthly-Price/1.0"})
    with urlopen(request, timeout=45) as response:
        return response.read()


def parse_month(value):
    if value is None:
        return None
    match = re.fullmatch(r"(\d{4})M(\d{1,2})", str(value).strip(), re.IGNORECASE)
    if not match:
        return None
    year, month = int(match.group(1)), int(match.group(2))
    if not 1 <= month <= 12:
        return None
    return f"{year:04d}-{month:02d}"


def main():
    from openpyxl import load_workbook

    page = fetch(LANDING_URL).decode("utf-8", errors="replace")
    parser = WorkbookLinkParser()
    parser.feed(page)
    if not parser.links:
        raise RuntimeError("The official World Bank page did not expose the monthly workbook link.")

    workbook_url = parser.links[0]
    workbook_bytes = fetch(workbook_url)
    workbook = load_workbook(BytesIO(workbook_bytes), data_only=True, read_only=True)
    if "Monthly Prices" not in workbook.sheetnames:
        raise RuntimeError("The World Bank workbook no longer contains the 'Monthly Prices' sheet.")

    sheet = workbook["Monthly Prices"]
    rows = list(sheet.iter_rows(values_only=True))
    header_row = None
    urea_column = None
    for row_number, row in enumerate(rows):
        for column_number, cell in enumerate(row):
            if str(cell or "").strip().lower().startswith("urea"):
                header_row = row_number
                urea_column = column_number
                break
        if urea_column is not None:
            break
    if urea_column is None:
        raise RuntimeError("Could not locate the urea price column in the World Bank workbook.")

    observations = []
    for row in rows[header_row + 1:]:
        if not row:
            continue
        month = parse_month(row[0])
        if not month or len(row) <= urea_column:
            continue
        raw_value = row[urea_column]
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if value > 0:
            observations.append({"month": month, "value": round(value, 4)})

    observations.sort(key=lambda item: item["month"])
    if not observations:
        raise RuntimeError("The World Bank workbook contained no valid monthly urea prices.")

    result = {
        "series": "Urea, E. Europe (prill spot, FOB Middle East)",
        "unit": "USD/metric ton",
        "source": "World Bank Commodity Price Data (The Pink Sheet)",
        "sourceUrl": LANDING_URL,
        "dataUrl": workbook_url,
        "license": "CC BY 4.0",
        "latest": observations[-1],
        "previous": observations[-2] if len(observations) > 1 else None,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated World Bank urea price: {result['latest']['month']} = {result['latest']['value']} {result['unit']}")


if __name__ == "__main__":
    main()
