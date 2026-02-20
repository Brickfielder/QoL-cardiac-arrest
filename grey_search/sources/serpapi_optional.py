from __future__ import annotations

from typing import Dict, Any, List

import requests

BASE = "https://serpapi.com/search.json"


def search_serpapi(query: str, engine: str, api_key: str, max_pages: int = 10) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    start = 0

    for _ in range(max_pages):
        params = {
            "engine": engine,
            "q": query,
            "api_key": api_key,
        }
        if engine == "google":
            params["start"] = start
        elif engine == "google_scholar":
            params["start"] = start

        response = requests.get(BASE, params=params, timeout=30)
        response.raise_for_status()
        payload = response.json()

        organic = payload.get("organic_results", [])
        if not organic:
            break

        for item in organic:
            results.append({
                "title": item.get("title"),
                "snippet": item.get("snippet"),
                "url": item.get("link"),
                "engine": engine,
            })

        start += 10

    return results
