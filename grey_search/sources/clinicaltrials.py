from __future__ import annotations

from typing import Dict, Any, Optional, List

import requests

BASE = "https://clinicaltrials.gov/api/v2/studies"


def search_clinicaltrials(query: str, page_token: Optional[str] = None) -> Dict[str, Any]:
    params = {
        "query.term": query,
        "pageSize": 100,
    }
    if page_token:
        params["pageToken"] = page_token

    response = requests.get(BASE, params=params, timeout=30)
    response.raise_for_status()
    payload = response.json()

    records: List[Dict[str, Any]] = []
    for study in payload.get("studies", []):
        protocol = study.get("protocolSection", {})
        ident = protocol.get("identificationModule", {})
        status = protocol.get("statusModule", {})
        descr = protocol.get("descriptionModule", {})
        outcomes = protocol.get("outcomesModule", {})
        cond = protocol.get("conditionsModule", {})
        nct_id = ident.get("nctId")

        records.append({
            "title": ident.get("briefTitle"),
            "abstract": descr.get("briefSummary"),
            "nct_id": nct_id,
            "status": status.get("overallStatus"),
            "start_date": status.get("startDateStruct", {}).get("date"),
            "completion_date": status.get("completionDateStruct", {}).get("date"),
            "conditions": cond.get("conditions"),
            "primary_outcomes": outcomes.get("primaryOutcomes"),
            "secondary_outcomes": outcomes.get("secondaryOutcomes"),
            "url": f"https://clinicaltrials.gov/study/{nct_id}" if nct_id else None,
        })

    return {"records": records, "next_cursor": payload.get("nextPageToken")}
