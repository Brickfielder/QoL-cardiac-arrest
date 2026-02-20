from __future__ import annotations

from typing import Dict, Any, Optional, List

import requests

BASE = "https://api.openalex.org/works"


def search_openalex(query: str, per_page: int = 200, cursor: Optional[str] = None) -> Dict[str, Any]:
    params = {
        "search": query,
        "per-page": min(per_page, 200),
        "cursor": cursor or "*",
        "mailto": "your_email@example.com",
    }
    response = requests.get(BASE, params=params, timeout=30)
    response.raise_for_status()
    payload = response.json()

    records: List[Dict[str, Any]] = []
    for item in payload.get("results", []):
        records.append({
            "title": item.get("title"),
            "abstract": item.get("abstract_inverted_index"),
            "doi": (item.get("doi") or "").replace("https://doi.org/", "") if item.get("doi") else None,
            "id": item.get("id"),
            "year": item.get("publication_year"),
            "type": item.get("type"),
            "primary_location": (item.get("primary_location") or {}).get("landing_page_url"),
            "host_venue": (item.get("host_venue") or {}).get("display_name"),
            "authorships": item.get("authorships"),
            "open_access": item.get("open_access"),
        })

    return {"records": records, "next_cursor": payload.get("meta", {}).get("next_cursor")}
