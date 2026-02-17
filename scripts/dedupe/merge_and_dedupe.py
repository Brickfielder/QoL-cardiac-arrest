#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[2]
NORMALIZED_DIR = ROOT / "data" / "normalized"
MERGED_PATH = ROOT / "data" / "merged" / "studies_merged.csv"


csv.field_size_limit(sys.maxsize)


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def first_author(authors: str) -> str:
    if not authors:
        return ""
    first = authors.split(";")[0].strip()
    return norm(first)


def dedupe_key(row: Dict[str, str]) -> Tuple[str, str]:
    doi = norm(row.get("doi", ""))
    if doi:
        return ("doi", doi)

    pmid = norm(row.get("pmid", ""))
    if pmid:
        return ("pmid", pmid)

    accession = norm(row.get("accession_number", ""))
    if accession:
        return ("accession_number", accession)

    title_year_author = "|".join(
        [
            norm(row.get("title", "")),
            norm(row.get("year", "")),
            first_author(row.get("authors", "")),
        ]
    )
    return ("title_year_author", title_year_author)


def quality_score(row: Dict[str, str]) -> int:
    score = 0
    if row.get("abstract", "").strip():
        score += 2
    if row.get("doi", "").strip():
        score += 1
    return score


def merge_query_ids(existing: str, incoming: str) -> str:
    parts = [part for part in existing.split("|") if part] + [part for part in incoming.split("|") if part]
    deduped = []
    for part in parts:
        if part not in deduped:
            deduped.append(part)
    return "|".join(deduped)


def main() -> None:
    rows: List[Dict[str, str]] = []
    for csv_file in sorted(NORMALIZED_DIR.rglob("*.csv")):
        with csv_file.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                row["source_file"] = row.get("source_file") or csv_file.name
                rows.append(row)

    deduped: Dict[Tuple[str, str], Dict[str, str]] = {}
    for row in rows:
        key = dedupe_key(row)
        existing = deduped.get(key)
        if existing is None:
            deduped[key] = row
            continue

        if quality_score(row) > quality_score(existing):
            row["query_id"] = merge_query_ids(existing.get("query_id", ""), row.get("query_id", ""))
            deduped[key] = row
        else:
            existing["query_id"] = merge_query_ids(existing.get("query_id", ""), row.get("query_id", ""))

    out_rows = list(deduped.values())
    fieldnames = sorted({key for row in out_rows for key in row.keys()})
    MERGED_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MERGED_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"Wrote {len(out_rows)} merged rows to {MERGED_PATH}")


if __name__ == "__main__":
    main()
