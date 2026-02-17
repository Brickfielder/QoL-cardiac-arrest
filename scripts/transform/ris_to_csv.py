#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Dict, Iterable, List

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
NORMALIZED_DIR = ROOT / "data" / "normalized"

CSV_FIELDS = [
    "source_database",
    "source_file",
    "record_type",
    "title",
    "abstract",
    "journal",
    "year",
    "authors",
    "doi",
    "pmid",
    "accession_number",
    "query_id",
]


def parse_ris(path: Path) -> Iterable[Dict[str, str]]:
    records: List[Dict[str, List[str]]] = []
    current: Dict[str, List[str]] = {}

    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line.strip():
            continue
        m = re.match(r"^([A-Z0-9]{2})\s*-\s*(.*)$", line)
        if not m:
            continue
        tag, value = m.group(1), m.group(2).strip()
        if tag == "TY":
            current = {"TY": [value]}
            continue
        if tag == "ER":
            if current:
                records.append(current)
            current = {}
            continue
        if not current:
            continue
        current.setdefault(tag, []).append(value)

    if current:
        records.append(current)

    for rec in records:
        authors = rec.get("AU", []) or rec.get("A1", [])
        accession = next((x for x in rec.get("AN", []) if x), "")
        pmid = next((x for x in rec.get("PM", []) if x), "")
        if not pmid:
            pmid = next((x for x in rec.get("M3", []) if x.lower().startswith("pmid")), "").replace("PMID", "").replace(":", "").strip()
        doi = next((x for x in rec.get("DO", []) if x), "")
        year = ""
        for candidate in rec.get("PY", []) + rec.get("Y1", []) + rec.get("DA", []):
            yr = re.search(r"(19|20)\d{2}", candidate)
            if yr:
                year = yr.group(0)
                break
        yield {
            "record_type": "; ".join(rec.get("TY", [])),
            "title": " ".join(rec.get("TI", []) or rec.get("T1", [])),
            "abstract": " ".join(rec.get("AB", [])),
            "journal": " ".join(rec.get("JO", []) or rec.get("JF", []) or rec.get("T2", [])),
            "year": year,
            "authors": "; ".join(authors),
            "doi": doi,
            "pmid": pmid,
            "accession_number": accession,
        }


def source_query_id(path: Path) -> str:
    name = path.stem.lower()
    if "querya" in name:
        return "A"
    if "queryb" in name:
        return "B"
    return ""


def write_csv(path: Path, rows: Iterable[Dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in CSV_FIELDS})


def normalize_ris_source(source: str) -> None:
    source_output_dir = NORMALIZED_DIR / source
    if source_output_dir.exists():
        for stale_file in source_output_dir.glob("*.csv"):
            stale_file.unlink()

    legacy_output = NORMALIZED_DIR / f"{source}.csv"
    if legacy_output.exists():
        legacy_output.unlink()

    for ris_file in sorted((RAW_DIR / source).glob("*.ris")):
        rows: List[Dict[str, str]] = []
        for row in parse_ris(ris_file):
            row.update(
                {
                    "source_database": source,
                    "source_file": ris_file.name,
                    "query_id": source_query_id(ris_file),
                }
            )
            rows.append(row)
        write_csv(source_output_dir / f"{ris_file.stem}.csv", rows)


def normalize_pubmed_csv() -> None:
    rows: List[Dict[str, str]] = []
    for source_file in sorted((RAW_DIR / "pubmed").glob("pubmed_*.csv")):
        if source_file.name == "pubmed_merged.csv":
            continue
        with source_file.open(newline="", encoding="utf-8") as f:
            for item in csv.DictReader(f):
                rows.append(
                    {
                        "source_database": "pubmed",
                        "source_file": source_file.name,
                        "record_type": "",
                        "title": item.get("title", ""),
                        "abstract": item.get("abstract", ""),
                        "journal": item.get("journal", ""),
                        "year": item.get("year", ""),
                        "authors": item.get("authors", ""),
                        "doi": item.get("doi", ""),
                        "pmid": item.get("pmid", ""),
                        "accession_number": "",
                        "query_id": item.get("query_id", ""),
                    }
                )
    write_csv(NORMALIZED_DIR / "pubmed.csv", rows)


def main() -> None:
    normalize_ris_source("cinahl")
    normalize_ris_source("wos")
    normalize_pubmed_csv()
    print(f"Wrote normalized CSV files to: {NORMALIZED_DIR}")


if __name__ == "__main__":
    main()
