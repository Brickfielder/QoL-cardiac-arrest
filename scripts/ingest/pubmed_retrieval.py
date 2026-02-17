#!/usr/bin/env python3
import csv
import json
import re
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode
from urllib.request import urlopen
import xml.etree.ElementTree as ET

EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
DB = "pubmed"
BATCH_SIZE = 200

QUERY_A = r'''(
  "Heart Arrest"[Mesh]
  OR "Cardiopulmonary Resuscitation"[Mesh]
  OR "Out-of-Hospital Cardiac Arrest"[Mesh]
  OR "cardiac arrest"[tiab]
  OR "heart arrest"[tiab]
  OR resuscitation[tiab]
  OR CPR[tiab]
  OR ROSC[tiab]
  OR "return of spontaneous circulation"[tiab]
)
AND
(
  survivor*[tiab]
  OR survivorship[tiab]
  OR follow-up[tiab]
  OR "follow up"[tiab]
  OR long-term[tiab]
  OR postdischarge[tiab]
  OR "post discharge"[tiab]
  OR postresuscitation[tiab]
  OR "post-resuscitation"[tiab]
  OR "post-cardiac arrest"[tiab]
  OR "post cardiac arrest"[tiab]
  OR OHCA[tiab]
  OR IHCA[tiab]
  OR "out-of-hospital"[tiab]
  OR "out of hospital"[tiab]
  OR "in-hospital"[tiab]
  OR "in hospital"[tiab]
)
AND
(
  "Quality of Life"[Mesh]
  OR "Patient Reported Outcome Measures"[Mesh]
  OR "quality of life"[tiab]
  OR HRQoL[tiab]
  OR QoL[tiab]
  OR "health-related quality of life"[tiab]
  OR PROM*[tiab]
  OR "patient reported outcome*"[tiab]
  OR "patient-reported outcome*"[tiab]
  OR "health status"[tiab]
  OR "patient-reported"[tiab]
)
NOT
(
  animals[mh] NOT humans[mh]
)'''

QUERY_B = r'''(
  (
    "Heart Arrest"[Mesh]
    OR "Cardiopulmonary Resuscitation"[Mesh]
    OR "Out-of-Hospital Cardiac Arrest"[Mesh]
    OR "cardiac arrest"[tiab]
    OR "heart arrest"[tiab]
    OR resuscitation[tiab]
    OR CPR[tiab]
    OR ROSC[tiab]
    OR "return of spontaneous circulation"[tiab]
  )
  AND
  (
    survivor*[tiab]
    OR survivorship[tiab]
    OR follow-up[tiab]
    OR "follow up"[tiab]
    OR long-term[tiab]
    OR postdischarge[tiab]
    OR "post discharge"[tiab]
    OR postresuscitation[tiab]
    OR "post-resuscitation"[tiab]
    OR "post-cardiac arrest"[tiab]
    OR "post cardiac arrest"[tiab]
    OR OHCA[tiab]
    OR IHCA[tiab]
    OR "out-of-hospital"[tiab]
    OR "out of hospital"[tiab]
    OR "in-hospital"[tiab]
    OR "in hospital"[tiab]
  )
  AND
  (
    "Quality of Life"[Mesh]
    OR "Patient Reported Outcome Measures"[Mesh]
    OR "quality of life"[tiab]
    OR HRQoL[tiab]
    OR QoL[tiab]
    OR "health-related quality of life"[tiab]
    OR PROM*[tiab]
    OR "patient reported outcome*"[tiab]
    OR "patient-reported outcome*"[tiab]
    OR "health status"[tiab]
    OR "patient-reported"[tiab]
  )
)
AND
(
  EQ-5D[tiab] OR EQ5D[tiab] OR EQ-5D-5L[tiab] OR EQ5D5L[tiab] OR EQ5D-5L[tiab] OR EuroQol[tiab] OR "EQ VAS"[tiab]
  OR "SF-36"[tiab] OR SF36[tiab] OR "SF 36"[tiab]
  OR "SF-12"[tiab] OR SF12[tiab] OR "SF 12"[tiab]
  OR "SF-8"[tiab] OR SF8[tiab] OR "SF 8"[tiab]
  OR "RAND-36"[tiab] OR RAND36[tiab]
  OR "SF-6D"[tiab] OR SF6D[tiab]
  OR "Health Utilities Index"[tiab] OR HUI2[tiab] OR HUI3[tiab]
  OR "15D"[tiab]
  OR "Nottingham Health Profile"[tiab] OR NHP[tiab]
  OR "Sickness Impact Profile"[tiab] OR SIP[tiab]
  OR WHOQOL[tiab] OR "WHOQOL-BREF"[tiab] OR "WHOQOL BREF"[tiab]
  OR "Quality of Well-Being"[tiab] OR QWB[tiab]
  OR PROMIS[tiab] OR "PROMIS Global"[tiab] OR "Global Health"[tiab] OR "PROMIS-29"[tiab]
  OR "VR-12"[tiab] OR VR12[tiab] OR "VR 12"[tiab]
  OR "VR-36"[tiab] OR VR36[tiab] OR "VR 36"[tiab]
  OR "Duke Health Profile"[tiab]
  OR QOLIBRI[tiab]
)
NOT
(
  animals[mh] NOT humans[mh]
)'''

CSV_FIELDS = [
    "pmid",
    "doi",
    "title",
    "abstract",
    "journal",
    "year",
    "authors",
    "publication_types",
    "mesh_terms",
    "source_database",
    "query_id",
    "date_retrieved",
    "flag_instrument_token",
    "flag_hrqol_language",
    "flag_timepoint_language",
]


def has_abstract(row: Dict[str, str]) -> bool:
    return bool(row.get("abstract", "").strip())

INSTRUMENT_PATTERNS = [
    r"\beq[- ]?5d\b", r"\bsf[- ]?36\b", r"\bsf[- ]?12\b", r"\b15d\b", r"\bhui\b",
    r"\bwhoqol\b", r"\bsip\b", r"\bnhp\b", r"\bpromis\b", r"\bvr[- ]?12\b",
    r"\bvr[- ]?36\b", r"\bqwb\b", r"\bqolibri\b",
]
HRQOL_PATTERNS = [
    r"quality of life", r"\bhrqol\b", r"\bqol\b", r"patient-reported", r"\bprom\b",
]
TIMEPOINT_PATTERN = re.compile(
    r"\b(\d+)\s*(day|days|week|weeks|month|months|year|years)\b|follow-up|post-discharge|after discharge|at discharge",
    re.IGNORECASE,
)


def request_xml(endpoint: str, params: Dict[str, str], retries: int = 3) -> ET.Element:
    url = f"{EUTILS_BASE}/{endpoint}?{urlencode(params)}"
    for attempt in range(1, retries + 1):
        try:
            with urlopen(url, timeout=60) as resp:
                data = resp.read()
            return ET.fromstring(data)
        except Exception:
            if attempt == retries:
                raise
            time.sleep(1.5 * attempt)
    raise RuntimeError("unreachable")


def text_of(elem: Optional[ET.Element]) -> str:
    if elem is None:
        return ""
    return unescape("".join(elem.itertext())).strip()


def get_year(article: ET.Element) -> str:
    for path in [
        ".//PubDate/Year",
        ".//ArticleDate/Year",
        ".//DateCompleted/Year",
        ".//DateCreated/Year",
    ]:
        found = article.find(path)
        if found is not None and found.text:
            return found.text.strip()
    medline_date = article.find(".//PubDate/MedlineDate")
    if medline_date is not None and medline_date.text:
        m = re.search(r"(19|20)\d{2}", medline_date.text)
        if m:
            return m.group(0)
    return ""


def parse_article(pubmed_article: ET.Element, query_id: str, date_retrieved: str) -> Dict[str, str]:
    medline = pubmed_article.find("MedlineCitation")
    article = medline.find("Article") if medline is not None else None

    pmid = text_of(medline.find("PMID") if medline is not None else None)

    doi = ""
    for aid in pubmed_article.findall(".//ArticleId"):
        if aid.attrib.get("IdType", "").lower() == "doi" and aid.text:
            doi = aid.text.strip().lower()
            break

    title = text_of(article.find("ArticleTitle") if article is not None else None)

    abstract_parts = []
    if article is not None:
        for ab in article.findall("Abstract/AbstractText"):
            label = ab.attrib.get("Label")
            part = text_of(ab)
            if part:
                abstract_parts.append(f"{label}: {part}" if label else part)
    abstract = "\n".join(abstract_parts)

    journal = text_of(article.find("Journal/Title") if article is not None else None)
    year = get_year(pubmed_article)

    authors = []
    if article is not None:
        for au in article.findall("AuthorList/Author"):
            coll = text_of(au.find("CollectiveName"))
            if coll:
                authors.append(coll)
                continue
            last = text_of(au.find("LastName"))
            initials = text_of(au.find("Initials"))
            name = (last + (f" {initials}" if initials else "")).strip()
            if name:
                authors.append(name)

    publication_types = [text_of(pt) for pt in pubmed_article.findall(".//PublicationTypeList/PublicationType") if text_of(pt)]
    mesh_terms = [text_of(d) for d in pubmed_article.findall(".//MeshHeadingList/MeshHeading/DescriptorName") if text_of(d)]

    text_blob = f"{title}\n{abstract}".lower()
    flag_instrument_token = any(re.search(pat, text_blob, flags=re.IGNORECASE) for pat in INSTRUMENT_PATTERNS)
    flag_hrqol_language = any(re.search(pat, text_blob, flags=re.IGNORECASE) for pat in HRQOL_PATTERNS)
    flag_timepoint_language = bool(TIMEPOINT_PATTERN.search(text_blob))

    return {
        "pmid": pmid,
        "doi": doi,
        "title": title,
        "abstract": abstract,
        "journal": journal,
        "year": year,
        "authors": " | ".join(authors),
        "publication_types": " | ".join(publication_types),
        "mesh_terms": " | ".join(mesh_terms),
        "source_database": "pubmed",
        "query_id": query_id,
        "date_retrieved": date_retrieved,
        "flag_instrument_token": str(flag_instrument_token).lower(),
        "flag_hrqol_language": str(flag_hrqol_language).lower(),
        "flag_timepoint_language": str(flag_timepoint_language).lower(),
    }


def run_query(query: str, query_id: str, out_dir: Path) -> List[Dict[str, str]]:
    date_retrieved = datetime.now(timezone.utc).date().isoformat()

    root = request_xml(
        "esearch.fcgi",
        {
            "db": DB,
            "term": query,
            "retmax": "0",
            "usehistory": "y",
            "retmode": "xml",
        },
    )

    count = int(text_of(root.find("Count")) or "0")
    webenv = text_of(root.find("WebEnv"))
    query_key = text_of(root.find("QueryKey"))

    rows: List[Dict[str, str]] = []
    nbib_chunks: List[str] = []

    for start in range(0, count, BATCH_SIZE):
        fetch_root = request_xml(
            "efetch.fcgi",
            {
                "db": DB,
                "query_key": query_key,
                "WebEnv": webenv,
                "retstart": str(start),
                "retmax": str(BATCH_SIZE),
                "retmode": "xml",
            },
        )
        for article in fetch_root.findall("PubmedArticle"):
            rows.append(parse_article(article, query_id=query_id, date_retrieved=date_retrieved))

        nbib_url = f"{EUTILS_BASE}/efetch.fcgi?{urlencode({'db': DB, 'query_key': query_key, 'WebEnv': webenv, 'retstart': str(start), 'retmax': str(BATCH_SIZE), 'rettype': 'medline', 'retmode': 'text'})}"
        with urlopen(nbib_url, timeout=60) as resp:
            nbib_chunks.append(resp.read().decode("utf-8", errors="replace"))

    raw_path = out_dir / f"pubmed_{query_id}_raw.jsonl"
    nbib_path = out_dir / f"pubmed_{query_id}.nbib"
    csv_path = out_dir / f"pubmed_{query_id}.csv"

    with raw_path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    with nbib_path.open("w", encoding="utf-8") as f:
        for chunk in nbib_chunks:
            f.write(chunk)

    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Query {query_id}: {count} hits, exported {len(rows)} rows")
    return rows


def normalize_title(title: str) -> str:
    title = re.sub(r"\s+", " ", title.lower()).strip()
    return re.sub(r"[^a-z0-9 ]", "", title)


def first_author(authors_field: str) -> str:
    if not authors_field:
        return ""
    return authors_field.split("|")[0].strip().lower()


def dedup_key(row: Dict[str, str]) -> Tuple[str, str]:
    doi = row.get("doi", "").strip().lower()
    if doi:
        return ("doi", doi)
    pmid = row.get("pmid", "").strip()
    if pmid:
        return ("pmid", pmid)
    return (
        "title_year_author",
        f"{normalize_title(row.get('title',''))}|{row.get('year','').strip()}|{first_author(row.get('authors',''))}",
    )


def merge_rows(rows_a: List[Dict[str, str]], rows_b: List[Dict[str, str]], out_dir: Path) -> None:
    merged: Dict[Tuple[str, str], Dict[str, str]] = {}

    def ingest(row: Dict[str, str], source_query: str) -> None:
        key = dedup_key(row)
        existing = merged.get(key)
        if not existing:
            merged[key] = dict(row)
            merged[key]["query_id"] = source_query
            return

        query_ids = set(existing.get("query_id", "").split("|"))
        query_ids.add(source_query)

        if has_abstract(row) and not has_abstract(existing):
            keep = dict(row)
            keep["query_id"] = source_query
            merged[key] = keep
            existing = merged[key]
        elif has_abstract(row) == has_abstract(existing) and source_query == "B" and existing.get("query_id") == "A":
            keep = dict(row)
            keep["query_id"] = source_query
            merged[key] = keep
            existing = merged[key]

        existing["query_id"] = "B|A" if query_ids == {"A", "B"} else ("B" if "B" in query_ids else "A")

    for r in rows_a:
        ingest(r, "A")
    for r in rows_b:
        ingest(r, "B")

    merged_rows = list(merged.values())

    merged_path = out_dir / "pubmed_merged.csv"
    with merged_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(merged_rows)

    print(f"Merged rows: {len(merged_rows)}")


def main() -> None:
    out_dir = Path("data/raw/pubmed")
    out_dir.mkdir(exist_ok=True)

    rows_a = run_query(QUERY_A, "A", out_dir)
    rows_b = run_query(QUERY_B, "B", out_dir)
    merge_rows(rows_a, rows_b, out_dir)


if __name__ == "__main__":
    main()
