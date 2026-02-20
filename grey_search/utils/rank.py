from __future__ import annotations

from typing import Dict, Any

from grey_search.utils.text import openalex_abstract_to_text


def _text_blob(record: Dict[str, Any]) -> str:
    title = record.get("title") or ""
    abstract = record.get("abstract") or record.get("snippet") or ""
    if isinstance(abstract, dict):
        abstract = openalex_abstract_to_text(abstract)
    return f"{title} {abstract}".lower()


def score_record(record: Dict[str, Any], cfg: Dict[str, Any]) -> int:
    blob = _text_blob(record)
    include_terms = cfg["ranking"]["include_terms"]
    exclude_terms = cfg["ranking"]["exclude_terms"]

    score = 0
    for term in include_terms:
        if term.lower() in blob:
            score += 1
    for term in exclude_terms:
        if term.lower() in blob:
            score -= 2
    return score


def looks_relevant(record: Dict[str, Any], cfg: Dict[str, Any]) -> bool:
    return score_record(record, cfg) >= cfg["ranking"]["min_score_to_keep"]
