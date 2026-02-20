from __future__ import annotations

from typing import Dict, Any, List, Tuple

from rapidfuzz import fuzz


def _norm(s: str) -> str:
    return " ".join((s or "").lower().split())


def dedupe_records(records: List[Dict[str, Any]], cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    seen: Dict[Tuple[str, str], int] = {}
    out: List[Dict[str, Any]] = []

    thresh = int(cfg["dedupe"]["title_fuzzy_threshold"])

    for record in records:
        doi = (record.get("doi") or "").lower().strip()
        pmid = str(record.get("pmid") or "").strip()
        nct = str(record.get("nct_id") or "").strip()
        title = _norm(record.get("title") or "")

        key = None
        if doi and cfg["dedupe"]["use_doi"]:
            key = ("doi", doi)
        elif pmid and cfg["dedupe"]["use_pmid"]:
            key = ("pmid", pmid)
        elif nct:
            key = ("nct", nct)

        if key:
            if key in seen:
                continue
            seen[key] = 1
            out.append(record)
            continue

        dup = False
        for existing in out:
            existing_title = _norm(existing.get("title") or "")
            if title and existing_title and fuzz.token_set_ratio(title, existing_title) >= thresh:
                dup = True
                break
        if not dup:
            out.append(record)

    return out
