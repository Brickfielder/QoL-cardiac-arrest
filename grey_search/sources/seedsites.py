from __future__ import annotations

import re
from typing import List, Dict, Any, Set
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

PDF_RE = re.compile(r"\.pdf(\?|$)", re.IGNORECASE)


def harvest_seed_sites(seed_sites: List[Dict[str, Any]], max_pages: int = 80) -> List[Dict[str, Any]]:
    """
    Simple breadth-first crawl from base_url, staying within allow_domains.
    Captures PDFs + pages that look like "guidance/report/audit/toolkit".
    Keep max_pages low to avoid runaway crawling.
    """
    hits: List[Dict[str, Any]] = []

    for site in seed_sites:
        base = site["base_url"]
        allow = set(site.get("allow_domains", []))
        queue = [base]
        seen: Set[str] = set()

        pages = 0
        while queue and pages < max_pages:
            url = queue.pop(0)
            if url in seen:
                continue
            seen.add(url)

            try:
                response = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
                if response.status_code >= 400:
                    continue
                ctype = response.headers.get("Content-Type", "")
                pages += 1

                if "application/pdf" in ctype or PDF_RE.search(url):
                    hits.append({
                        "title": None,
                        "url": url,
                        "type": "pdf",
                        "host": urlparse(url).netloc,
                    })
                    continue

                soup = BeautifulSoup(response.text, "lxml")
                title = soup.title.text.strip() if soup.title else None

                if looks_like_grey_page(url, title):
                    hits.append({
                        "title": title,
                        "url": url,
                        "type": "page",
                        "host": urlparse(url).netloc,
                    })

                for a_tag in soup.select("a[href]"):
                    href = a_tag.get("href")
                    if not href:
                        continue
                    nxt = urljoin(url, href)
                    host = urlparse(nxt).netloc

                    if allow and not any(host.endswith(domain) for domain in allow):
                        continue

                    if nxt not in seen and (nxt.startswith("http://") or nxt.startswith("https://")):
                        queue.append(nxt)

            except Exception:
                continue

    return hits


def looks_like_grey_page(url: str, title: str | None) -> bool:
    text = (url + " " + (title or "")).lower()
    return any(k in text for k in [
        "guideline", "guidance", "toolkit", "report", "audit", "pathway",
        "follow-up", "survivor", "quality of life", "rehabilitation",
    ])
