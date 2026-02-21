from __future__ import annotations

import os
import json
import time
import shutil
import pathlib
from dataclasses import dataclass
from typing import Dict, List, Any, Iterable

import pandas as pd
import yaml
from tqdm import tqdm

from grey_search.sources.openalex import search_openalex
from grey_search.sources.clinicaltrials import search_clinicaltrials
from grey_search.sources.seedsites import harvest_seed_sites
from grey_search.utils.rank import score_record, looks_relevant
from grey_search.utils.dedupe import dedupe_records
from grey_search.utils.log import log_event, now_iso


@dataclass
class StopConfig:
    n_max: int
    warmup_n: int
    zero_streak_stop: int


def load_config(path: str = "grey_search/config.yaml") -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_jsonl(path: pathlib.Path, records: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def _ris_line(tag: str, value: str) -> str:
    return f"{tag}  - {value}\n"


def save_ris(path: pathlib.Path, records: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for r in records:
            title = (r.get("title") or "Untitled").strip()
            abstract = r.get("abstract") or r.get("snippet") or ""
            if isinstance(abstract, dict):
                abstract = json.dumps(abstract, ensure_ascii=False)

            year = r.get("year")
            date = str(year) if year else ""

            url = r.get("url") or r.get("primary_location") or r.get("id")
            doi = r.get("doi")

            f.write(_ris_line("TY", "GEN"))
            f.write(_ris_line("TI", title))
            if abstract:
                f.write(_ris_line("AB", str(abstract).strip()))
            if date:
                f.write(_ris_line("PY", date))
            if doi:
                f.write(_ris_line("DO", str(doi).strip()))
            if url:
                f.write(_ris_line("UR", str(url).strip()))
            f.write(_ris_line("DB", str(r.get("source") or "grey_search")))
            f.write(_ris_line("ER", ""))
            f.write("\n")


def save_normalized_csv(path: pathlib.Path, records: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(list(records))
    df.to_csv(path, index=False)


def migrate_legacy_outputs(raw_dir: pathlib.Path, processed_dir: pathlib.Path, normalized_path: pathlib.Path) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)

    for legacy in pathlib.Path("data/raw").glob("*.jsonl"):
        shutil.move(str(legacy), str(raw_dir / legacy.name))

    legacy_ris = pathlib.Path("data/processed/grey_candidates_deduped.ris")
    if legacy_ris.exists() and legacy_ris.resolve() != (processed_dir / legacy_ris.name).resolve():
        shutil.move(str(legacy_ris), str(processed_dir / legacy_ris.name))

    legacy_csv = pathlib.Path("data/processed/grey_candidates.csv")
    if legacy_csv.exists() and legacy_csv.resolve() != normalized_path.resolve():
        shutil.move(str(legacy_csv), str(normalized_path))


def main() -> None:
    cfg = load_config()
    raw_dir = pathlib.Path(cfg["project"].get("raw_dir", "data/raw/grey-literature"))
    processed_dir = pathlib.Path(cfg["project"].get("processed_dir", "data/processed/grey-literature"))
    normalized_path = pathlib.Path(cfg["project"].get("normalized_path", "data/normalized/grey-literature.csv"))
    log_dir = pathlib.Path(cfg["project"]["log_dir"])
    log_dir.mkdir(parents=True, exist_ok=True)

    migrate_legacy_outputs(raw_dir=raw_dir, processed_dir=processed_dir, normalized_path=normalized_path)

    stop_cfg = StopConfig(
        n_max=int(cfg["stopping_rules"]["n_max_per_query"]),
        warmup_n=int(cfg["stopping_rules"]["warmup_n"]),
        zero_streak_stop=int(cfg["stopping_rules"]["zero_hit_streak_stop"]),
    )

    queries = cfg["queries"]
    all_records: List[Dict[str, Any]] = []

    for q in queries:
        qid = q["id"]
        qtext = q["text"]

        log_event(log_dir / "search_log.jsonl", {
            "ts": now_iso(),
            "source": "openalex",
            "query_id": qid,
            "query": qtext,
            "event": "start"
        })
        oa_records = run_with_stopping(
            source_name="openalex",
            fetch_fn=lambda cursor: search_openalex(qtext, per_page=200, cursor=cursor),
            stop_cfg=stop_cfg,
            cfg=cfg,
            query_id=qid,
            log_path=log_dir / "search_log.jsonl"
        )
        save_jsonl(raw_dir / f"openalex_{qid}.jsonl", oa_records)
        all_records.extend(oa_records)

        log_event(log_dir / "search_log.jsonl", {
            "ts": now_iso(),
            "source": "clinicaltrials",
            "query_id": qid,
            "query": qtext,
            "event": "start"
        })
        ct_records = run_with_stopping(
            source_name="clinicaltrials",
            fetch_fn=lambda cursor: search_clinicaltrials(qtext, page_token=cursor),
            stop_cfg=stop_cfg,
            cfg=cfg,
            query_id=qid,
            log_path=log_dir / "search_log.jsonl"
        )
        save_jsonl(raw_dir / f"clinicaltrials_{qid}.jsonl", ct_records)
        all_records.extend(ct_records)

    log_event(log_dir / "search_log.jsonl", {
        "ts": now_iso(),
        "source": "seed_sites",
        "event": "start",
        "seed_sites": [s["base_url"] for s in cfg.get("seed_sites", [])]
    })
    seed_records = harvest_seed_sites(cfg.get("seed_sites", []), max_pages=80)
    save_jsonl(raw_dir / "seed_sites.jsonl", seed_records)
    all_records.extend(seed_records)

    if cfg.get("serpapi", {}).get("enabled", False):
        from grey_search.sources.serpapi_optional import search_serpapi
        api_key_env = cfg["serpapi"]["api_key_env"]
        api_key = os.getenv(api_key_env, "")
        if not api_key:
            raise RuntimeError(f"SERP API enabled but env var {api_key_env} is empty.")

        for q in queries:
            qid = q["id"]
            qtext = q["text"]
            for engine in cfg["serpapi"]["engines"]:
                serp_records = search_serpapi(
                    qtext,
                    engine=engine,
                    api_key=api_key,
                    max_pages=int(cfg["stopping_rules"]["max_pages_google_like"]),
                )
                save_jsonl(raw_dir / f"serpapi_{engine}_{qid}.jsonl", serp_records)
                all_records.extend(serp_records)

    for r in all_records:
        r["relevance_score"] = score_record(r, cfg)
        r["looks_relevant"] = looks_relevant(r, cfg)

    filtered = [r for r in all_records if r["relevance_score"] >= cfg["ranking"]["min_score_to_keep"]]
    deduped = dedupe_records(filtered, cfg)

    ris_path = processed_dir / "grey_candidates_deduped.ris"
    save_ris(ris_path, deduped)
    save_normalized_csv(normalized_path, deduped)

    log_event(log_dir / "search_log.jsonl", {
        "ts": now_iso(),
        "event": "complete",
        "raw_n": len(all_records),
        "filtered_n": len(filtered),
        "deduped_n": len(deduped),
        "output_ris": str(ris_path),
        "output_normalized_csv": str(normalized_path),
    })

    print(f"Done. Raw={len(all_records)} Filtered={len(filtered)} Deduped={len(deduped)}")
    print(f"Raw output dir: {raw_dir}")
    print(f"RIS output: {ris_path}")
    print(f"Normalized CSV: {normalized_path}")


def run_with_stopping(source_name: str, fetch_fn, stop_cfg: StopConfig, cfg: Dict[str, Any],
                      query_id: str, log_path: pathlib.Path) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    cursor = None
    irrelevant_streak = 0

    pbar = tqdm(total=stop_cfg.n_max, desc=f"{source_name}:{query_id}", leave=False)
    while len(out) < stop_cfg.n_max:
        payload = fetch_fn(cursor)
        batch = payload.get("records", [])
        cursor = payload.get("next_cursor")

        if not batch:
            log_event(log_path, {"ts": now_iso(), "source": source_name, "query_id": query_id, "event": "no_more_results"})
            break

        for r in batch:
            r["source"] = source_name
            r["query_id"] = query_id
            out.append(r)

            if len(out) > stop_cfg.warmup_n:
                if not looks_relevant(r, cfg):
                    irrelevant_streak += 1
                else:
                    irrelevant_streak = 0

                if irrelevant_streak >= stop_cfg.zero_streak_stop:
                    log_event(log_path, {
                        "ts": now_iso(), "source": source_name, "query_id": query_id,
                        "event": "early_stop_irrelevant_streak",
                        "irrelevant_streak": irrelevant_streak,
                        "n_collected": len(out)
                    })
                    pbar.close()
                    return out[: stop_cfg.n_max]

            if len(out) >= stop_cfg.n_max:
                break
            pbar.update(1)

        if not cursor:
            break

        time.sleep(0.2)

    pbar.close()
    return out[: stop_cfg.n_max]


if __name__ == "__main__":
    main()
