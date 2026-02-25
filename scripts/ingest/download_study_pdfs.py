#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import quote, urljoin

import requests
try:
    from bs4 import BeautifulSoup
except ImportError:  # optional fallback: DOI landing-page HTML parsing will be skipped
    BeautifulSoup = None  # type: ignore[assignment]


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "data" / "calibration-set" / "set-from-caresearchhub" / "qol_timepoint_matrix_timepoints.csv"
DEFAULT_OUTDIR = ROOT / "data" / "pdfs" / "calibration-set" / "caresearchhub"
DEFAULT_MANIFEST = DEFAULT_OUTDIR / "download_manifest.csv"

USER_AGENT = "QoL-cardiac-arrest-pdf-downloader/1.0 (+https://github.com/)"
REQUEST_TIMEOUT = 45
MIN_PDF_BYTES = 1024


@dataclass
class Citation:
    row_num: int
    source_id: str
    doi: str
    pmid: str
    title: str


@dataclass
class ResolutionCandidate:
    url: str
    method: str
    note: str = ""


def normalize_ws(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize_doi(value: str) -> str:
    value = normalize_ws(value)
    if not value:
        return ""
    value = re.sub(r"^(?:https?://)?(?:dx\.)?doi\.org/", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^doi:\s*", "", value, flags=re.IGNORECASE)
    return value.strip().rstrip(".")


def extract_pmid(source_id: str, doi: str) -> str:
    source_id = normalize_ws(source_id)
    if source_id.isdigit():
        return source_id
    if doi and source_id and normalize_doi(source_id).lower() == normalize_doi(doi).lower():
        return ""
    return source_id if source_id.isdigit() else ""


def safe_slug(text: str, max_len: int = 120) -> str:
    text = normalize_ws(text).lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return (text or "untitled")[:max_len]


def file_stem_for(c: Citation) -> str:
    if c.doi:
        return f"doi_{safe_slug(c.doi, 180)}"
    if c.pmid:
        return f"pmid_{c.pmid}"
    return f"row_{c.row_num}_{safe_slug(c.title)}"


def iter_citations(csv_path: Path) -> Iterable[Citation]:
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=2):  # header is row 1
            source_id = normalize_ws(row.get("id", ""))
            doi = normalize_doi(row.get("doi", ""))
            pmid = extract_pmid(source_id, doi)
            title = normalize_ws(row.get("title", ""))
            yield Citation(row_num=idx, source_id=source_id, doi=doi, pmid=pmid, title=title)


def dedupe_citations(citations: Iterable[Citation]) -> List[Citation]:
    seen: set[Tuple[str, str]] = set()
    out: List[Citation] = []
    for c in citations:
        key = ("doi", c.doi.lower()) if c.doi else ("pmid", c.pmid) if c.pmid else ("title", c.title.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


def build_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def get_json(session: requests.Session, url: str, params: Optional[Dict[str, str]] = None) -> Optional[dict]:
    try:
        resp = session.get(url, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def get_pubmed_article_ids(session: requests.Session, pmid: str) -> Dict[str, str]:
    data = get_json(
        session,
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
        params={"db": "pubmed", "id": pmid, "retmode": "json"},
    )
    if not data:
        return {}
    result = data.get("result", {}).get(pmid, {})
    articleids = result.get("articleids", []) or []
    found: Dict[str, str] = {}
    for item in articleids:
        idtype = str(item.get("idtype", "")).lower()
        value = str(item.get("value", "")).strip()
        if idtype and value:
            found[idtype] = value
    return found


def pmcid_to_pdf_url(pmcid: str) -> str:
    pmcid = pmcid.upper()
    if not pmcid.startswith("PMC"):
        pmcid = f"PMC{pmcid}"
    return f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/pdf/"


def resolve_from_unpaywall(session: requests.Session, doi: str, email: str) -> List[ResolutionCandidate]:
    url = f"https://api.unpaywall.org/v2/{quote(doi, safe='')}"
    data = get_json(session, url, params={"email": email})
    if not data:
        return []
    candidates: List[ResolutionCandidate] = []
    best = data.get("best_oa_location") or {}
    best_pdf = normalize_ws(best.get("url_for_pdf", ""))
    if best_pdf:
        candidates.append(ResolutionCandidate(best_pdf, "unpaywall.best_oa_location.url_for_pdf"))
    for loc in data.get("oa_locations", []) or []:
        pdf_url = normalize_ws((loc or {}).get("url_for_pdf", ""))
        landing = normalize_ws((loc or {}).get("url", ""))
        if pdf_url:
            candidates.append(ResolutionCandidate(pdf_url, "unpaywall.oa_locations.url_for_pdf"))
        elif landing:
            candidates.append(ResolutionCandidate(landing, "unpaywall.oa_locations.url"))
    return unique_candidates(candidates)


def resolve_from_crossref(session: requests.Session, doi: str) -> List[ResolutionCandidate]:
    data = get_json(session, f"https://api.crossref.org/works/{quote(doi, safe='')}")
    if not data:
        return []
    msg = data.get("message", {}) or {}
    candidates: List[ResolutionCandidate] = []
    for link in msg.get("link", []) or []:
        link_url = normalize_ws((link or {}).get("URL", ""))
        content_type = normalize_ws((link or {}).get("content-type", "")).lower()
        if not link_url:
            continue
        if "pdf" in content_type or link_url.lower().endswith(".pdf"):
            candidates.append(ResolutionCandidate(link_url, "crossref.link", note=content_type))
        else:
            candidates.append(ResolutionCandidate(link_url, "crossref.link.landing", note=content_type))
    return unique_candidates(candidates)


def resolve_from_europe_pmc(session: requests.Session, pmid: str = "", doi: str = "") -> List[ResolutionCandidate]:
    queries: List[str] = []
    if pmid:
        queries.append(f"EXT_ID:{pmid} AND SRC:MED")
    if doi:
        queries.append(f'DOI:"{doi}"')

    all_candidates: List[ResolutionCandidate] = []
    for query in queries:
        data = get_json(
            session,
            "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            params={"query": query, "format": "json", "pageSize": "1"},
        )
        if not data:
            continue
        results = (data.get("resultList") or {}).get("result", []) or []
        if not results:
            continue
        result = results[0] or {}
        pmcid = normalize_ws(result.get("pmcid", ""))
        if pmcid:
            all_candidates.append(ResolutionCandidate(pmcid_to_pdf_url(pmcid), "europepmc.pmcid"))

        for fulltext in result.get("fullTextUrlList", {}).get("fullTextUrl", []) or []:
            ft_url = normalize_ws((fulltext or {}).get("url", ""))
            document_style = normalize_ws((fulltext or {}).get("documentStyle", "")).lower()
            availability = normalize_ws((fulltext or {}).get("availability", "")).lower()
            if ft_url:
                method = "europepmc.fullTextUrl"
                note = ",".join([x for x in [document_style, availability] if x])
                all_candidates.append(ResolutionCandidate(ft_url, method, note=note))
    return unique_candidates(all_candidates)


def resolve_from_doi_landing(session: requests.Session, doi: str) -> List[ResolutionCandidate]:
    candidates: List[ResolutionCandidate] = []
    if BeautifulSoup is None:
        return []
    try:
        resp = session.get(f"https://doi.org/{quote(doi, safe='/')}", timeout=REQUEST_TIMEOUT, allow_redirects=True)
    except Exception:
        return []

    final_url = str(resp.url)
    content_type = (resp.headers.get("content-type") or "").lower()

    if is_pdf_response(resp):
        candidates.append(ResolutionCandidate(final_url, "doi.redirect.direct_pdf", note=content_type))
        return unique_candidates(candidates)

    if "html" not in content_type and not resp.text:
        return []

    soup = BeautifulSoup(resp.text, "lxml")

    for attr in ["citation_pdf_url", "wkhealth_pdf_url"]:
        meta = soup.find("meta", attrs={"name": attr})
        if meta and meta.get("content"):
            candidates.append(
                ResolutionCandidate(urljoin(final_url, str(meta["content"]).strip()), f"doi.landing.meta.{attr}")
            )

    for a in soup.find_all("a", href=True):
        href = urljoin(final_url, a["href"].strip())
        text = normalize_ws(a.get_text(" ", strip=True)).lower()
        href_lower = href.lower()
        if ".pdf" in href_lower or "download pdf" in text or text == "pdf":
            candidates.append(ResolutionCandidate(href, "doi.landing.anchor", note=text))

    return unique_candidates(candidates)


def unique_candidates(candidates: Sequence[ResolutionCandidate]) -> List[ResolutionCandidate]:
    seen: set[str] = set()
    out: List[ResolutionCandidate] = []
    for c in candidates:
        key = c.url.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


def is_pdf_response(resp: requests.Response) -> bool:
    ctype = (resp.headers.get("content-type") or "").lower()
    if "application/pdf" in ctype:
        return True
    head = resp.content[:8] if resp.content is not None else b""
    return head.startswith(b"%PDF")


def looks_like_pdf_bytes(data: bytes, content_type: str) -> bool:
    if "application/pdf" in (content_type or "").lower():
        return True
    return data.startswith(b"%PDF")


def download_pdf(session: requests.Session, candidate: ResolutionCandidate, dest: Path, overwrite: bool) -> Dict[str, str]:
    if dest.exists() and not overwrite:
        return {
            "status": "skipped_exists",
            "reason": "file_exists",
            "pdf_path": str(dest),
            "source_url": candidate.url,
            "resolution_method": candidate.method,
        }

    try:
        resp = session.get(candidate.url, timeout=REQUEST_TIMEOUT, allow_redirects=True, stream=True)
    except Exception as e:
        return {"status": "error", "reason": f"request_failed:{type(e).__name__}"}

    content_type = (resp.headers.get("content-type") or "").lower()
    status_code = str(resp.status_code)
    if resp.status_code >= 400:
        return {
            "status": "error",
            "reason": "http_error",
            "http_status": status_code,
            "content_type": content_type,
            "source_url": str(resp.url),
            "resolution_method": candidate.method,
        }

    chunks: List[bytes] = []
    total = 0
    try:
        for chunk in resp.iter_content(chunk_size=64 * 1024):
            if not chunk:
                continue
            chunks.append(chunk)
            total += len(chunk)
            if total > 100 * 1024 * 1024:
                return {
                    "status": "error",
                    "reason": "file_too_large",
                    "http_status": status_code,
                    "content_type": content_type,
                    "source_url": str(resp.url),
                    "resolution_method": candidate.method,
                }
    finally:
        resp.close()

    data = b"".join(chunks)
    if len(data) < MIN_PDF_BYTES:
        return {
            "status": "error",
            "reason": "response_too_small",
            "http_status": status_code,
            "content_type": content_type,
            "source_url": str(resp.url),
            "resolution_method": candidate.method,
        }

    if not looks_like_pdf_bytes(data, content_type):
        return {
            "status": "error",
            "reason": "not_pdf",
            "http_status": status_code,
            "content_type": content_type,
            "source_url": str(resp.url),
            "resolution_method": candidate.method,
        }

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    sha256 = hashlib.sha256(data).hexdigest()
    return {
        "status": "downloaded",
        "reason": "",
        "pdf_path": str(dest),
        "source_url": str(resp.url),
        "resolution_method": candidate.method,
        "http_status": status_code,
        "content_type": content_type,
        "bytes": str(len(data)),
        "sha256": sha256,
    }


def resolve_candidates(session: requests.Session, citation: Citation, unpaywall_email: str) -> Tuple[List[ResolutionCandidate], Dict[str, str]]:
    meta: Dict[str, str] = {}
    candidates: List[ResolutionCandidate] = []

    pmid = citation.pmid
    doi = citation.doi

    if pmid:
        ids = get_pubmed_article_ids(session, pmid)
        if not doi and ids.get("doi"):
            doi = normalize_doi(ids.get("doi", ""))
            meta["resolved_doi_from_pmid"] = doi
        pmcid = normalize_ws(ids.get("pmc", "")) or normalize_ws(ids.get("pmcid", ""))
        if pmcid:
            candidates.append(ResolutionCandidate(pmcid_to_pdf_url(pmcid), "pubmed.esummary.pmcid"))
            meta["pmcid"] = pmcid

    candidates.extend(resolve_from_europe_pmc(session, pmid=pmid, doi=doi))

    if doi and unpaywall_email:
        candidates.extend(resolve_from_unpaywall(session, doi, unpaywall_email))

    if doi:
        candidates.extend(resolve_from_crossref(session, doi))
        candidates.extend(resolve_from_doi_landing(session, doi))

    return unique_candidates(candidates), meta


MANIFEST_FIELDS = [
    "row_num",
    "id",
    "doi",
    "pmid",
    "title",
    "status",
    "reason",
    "pdf_path",
    "source_url",
    "resolution_method",
    "http_status",
    "content_type",
    "bytes",
    "sha256",
    "candidate_count",
    "notes",
]


def write_manifest(path: Path, rows: Sequence[Dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=MANIFEST_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in MANIFEST_FIELDS})


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Download PDFs for studies listed in a CSV with DOI/PMID fields (best-effort, OA-first)."
    )
    p.add_argument("--input-csv", type=Path, default=DEFAULT_INPUT)
    p.add_argument("--output-dir", type=Path, default=DEFAULT_OUTDIR)
    p.add_argument("--manifest-csv", type=Path, default=DEFAULT_MANIFEST)
    p.add_argument("--unpaywall-email", default="", help="Email for Unpaywall API (improves OA resolution for DOI rows).")
    p.add_argument("--overwrite", action="store_true")
    p.add_argument("--sleep-seconds", type=float, default=0.3, help="Pause between records.")
    p.add_argument("--limit", type=int, default=0, help="Optional max number of unique records to process.")
    p.add_argument("--print-candidates", action="store_true", help="Print candidate URLs before download attempts.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if not args.input_csv.exists():
        raise SystemExit(f"Input CSV not found: {args.input_csv}")

    citations = dedupe_citations(iter_citations(args.input_csv))
    if args.limit and args.limit > 0:
        citations = citations[: args.limit]

    session = build_session()
    manifest_rows: List[Dict[str, str]] = []

    total = len(citations)
    for i, citation in enumerate(citations, start=1):
        notes: List[str] = []
        print(f"[{i}/{total}] row={citation.row_num} doi={citation.doi or '-'} pmid={citation.pmid or '-'}")

        try:
            candidates, meta = resolve_candidates(session, citation, args.unpaywall_email)
            if meta:
                notes.append(json.dumps(meta, sort_keys=True))
        except Exception as e:
            manifest_rows.append(
                {
                    "row_num": str(citation.row_num),
                    "id": citation.source_id,
                    "doi": citation.doi,
                    "pmid": citation.pmid,
                    "title": citation.title,
                    "status": "error",
                    "reason": f"resolution_exception:{type(e).__name__}",
                    "candidate_count": "0",
                    "notes": "; ".join(notes),
                }
            )
            continue

        if args.print_candidates:
            for cand in candidates:
                print(f"  - {cand.method}: {cand.url}")

        result: Dict[str, str] = {
            "status": "unresolved",
            "reason": "no_pdf_candidate_found",
        }
        dest = args.output_dir / f"{file_stem_for(citation)}.pdf"
        for cand in candidates:
            result = download_pdf(session, cand, dest, overwrite=args.overwrite)
            if result.get("status") in {"downloaded", "skipped_exists"}:
                break

        manifest_rows.append(
            {
                "row_num": str(citation.row_num),
                "id": citation.source_id,
                "doi": citation.doi,
                "pmid": citation.pmid,
                "title": citation.title,
                "candidate_count": str(len(candidates)),
                "notes": "; ".join(notes),
                **result,
            }
        )
        if args.sleep_seconds > 0:
            time.sleep(args.sleep_seconds)

    write_manifest(args.manifest_csv, manifest_rows)
    downloaded = sum(1 for r in manifest_rows if r.get("status") == "downloaded")
    skipped = sum(1 for r in manifest_rows if r.get("status") == "skipped_exists")
    unresolved = sum(1 for r in manifest_rows if r.get("status") not in {"downloaded", "skipped_exists"})
    print(f"Completed: {total} studies | downloaded={downloaded} | skipped_exists={skipped} | unresolved={unresolved}")
    print(f"Manifest: {args.manifest_csv}")
    print(f"PDF dir:   {args.output_dir}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
