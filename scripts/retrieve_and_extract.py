from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError

EMBEDDING_MODEL = "text-embedding-3-small"
EXTRACTION_MODEL = "gpt-5"
PROMPT_VERSION = "qol_extract_v1"
MAX_RETRIES = 5
RETRY_BASE_SECONDS = 1.5
DEFAULT_TOP_K_PER_QUERY = 4
DEFAULT_MAX_CHUNKS_SENT = 20

RETRIEVAL_QUERIES = [
    "health related quality of life instrument questionnaire PROM EQ-5D SF-36 SF12 SF-12 RAND HUI QLQ",
    "quality of life outcome measure assessed used survey questionnaire instrument",
    "follow-up timepoints months days weeks after cardiac arrest",
    "post discharge post arrest follow-up schedule assessment at 3 months 6 months 12 months",
    "outcome assessment interview telephone questionnaire timing",
    "methods endpoints patient reported outcomes HRQoL QoL",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class InstrumentItem(StrictModel):
    instrument_name_verbatim: str = Field(min_length=1)
    instrument_standardised: str | None = None
    evidence_quote: str = Field(min_length=1, max_length=500)
    evidence_page: int = Field(ge=1)


class TimepointItem(StrictModel):
    timepoint_original_text: str = Field(min_length=1)
    timepoint_value_months: float | None = None
    time_anchor: Literal[
        "post_arrest",
        "post_discharge",
        "post_enrolment",
        "post_randomisation",
        "unclear",
    ]
    evidence_quote: str = Field(min_length=1, max_length=500)
    evidence_page: int = Field(ge=1)


class ExtractionPayload(StrictModel):
    paper_id: str
    doi: str | None = None
    pmid: str | None = None
    population: Literal["OHCA", "IHCA", "mixed", "unclear"]
    construct_label: Literal["explicit_HRQoL_PROM", "QoL_general", "health_status_related", "unclear"]
    respondent: Literal["patient_reported", "proxy_reported", "mixed", "unclear"]
    mode: Literal["self_complete", "interview", "telephone", "registry", "unclear"]
    instruments: list[InstrumentItem] = Field(default_factory=list)
    timepoints: list[TimepointItem] = Field(default_factory=list)
    notes: str | None = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def jsonl_read(path: Path):
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def jsonl_write(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=True) + "\n")


def jsonl_append(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=True) + "\n")


def retry_sleep(attempt: int) -> None:
    delay = RETRY_BASE_SECONDS * (2 ** (attempt - 1)) + random.uniform(0, 0.25)
    time.sleep(delay)


def call_with_retries(fn):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn()
        except Exception:
            if attempt >= MAX_RETRIES:
                raise
            retry_sleep(attempt)


def build_client() -> OpenAI:
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not found. Put it in project-root .env and load via python-dotenv.")
    return OpenAI(api_key=api_key)


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def vector_norm(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def cosine_sim(a: list[float], b: list[float], norm_a: float | None = None, norm_b: float | None = None) -> float:
    na = norm_a if norm_a is not None else vector_norm(a)
    nb = norm_b if norm_b is not None else vector_norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return dot(a, b) / (na * nb)


def extract_response_text(resp) -> str:
    text = getattr(resp, "output_text", None)
    if isinstance(text, str) and text.strip():
        return text

    # Fallback for SDK variants.
    try:
        return resp.model_dump_json()
    except Exception:
        return str(resp)


def parse_json_object(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def make_openai_strict_json_schema(schema: dict) -> dict:
    """Normalize Pydantic JSON Schema for Responses API strict mode expectations."""
    def _walk(node):
        if isinstance(node, dict):
            # OpenAI strict schema validation can reject non-structural keywords like defaults.
            for noisy_key in ("default", "title", "examples"):
                node.pop(noisy_key, None)
            if node.get("type") == "object" or "properties" in node:
                props = node.get("properties", {})
                if isinstance(props, dict):
                    node["required"] = list(props.keys())
                    node["additionalProperties"] = False
                    for child in props.values():
                        _walk(child)
            if "items" in node:
                _walk(node["items"])
            for key in ("anyOf", "oneOf", "allOf"):
                if isinstance(node.get(key), list):
                    for child in node[key]:
                        _walk(child)
            if "$defs" in node and isinstance(node["$defs"], dict):
                for child in node["$defs"].values():
                    _walk(child)
        elif isinstance(node, list):
            for item in node:
                _walk(item)
        return node

    return _walk(schema)


def embed_queries(client: OpenAI, queries: list[str]) -> list[list[float]]:
    def _call():
        return client.embeddings.create(model=EMBEDDING_MODEL, input=queries)

    resp = call_with_retries(_call)
    return [item.embedding for item in resp.data]


def load_index(index_dir: Path) -> dict[str, list[dict]]:
    chunks_path = index_dir / "chunks.jsonl"
    embeddings_path = index_dir / f"embeddings_{EMBEDDING_MODEL}.jsonl"
    if not chunks_path.exists():
        raise FileNotFoundError(f"Missing chunks file: {chunks_path}. Run scripts/build_index.py first.")
    if not embeddings_path.exists():
        raise FileNotFoundError(f"Missing embeddings file: {embeddings_path}. Run scripts/build_index.py first.")

    chunks_by_id = {row["chunk_id"]: row for row in jsonl_read(chunks_path)}
    embeddings_by_id = {row["chunk_id"]: row for row in jsonl_read(embeddings_path)}

    papers: dict[str, list[dict]] = defaultdict(list)
    for chunk_id, chunk in chunks_by_id.items():
        emb = embeddings_by_id.get(chunk_id)
        if not emb:
            continue
        record = {
            **chunk,
            "vector": emb["vector"],
            "vector_norm": emb.get("vector_norm"),
        }
        papers[chunk["paper_id"]].append(record)

    for paper_id in papers:
        papers[paper_id].sort(key=lambda r: (r["page"], r["chunk_index_on_page"], r["char_start"]))
    return papers


def load_existing_paper_ids(extractions_path: Path) -> set[str]:
    paper_ids: set[str] = set()
    if not extractions_path.exists():
        return paper_ids
    for row in jsonl_read(extractions_path):
        paper_id = row.get("paper_id")
        if isinstance(paper_id, str) and paper_id.strip():
            paper_ids.add(paper_id)
    return paper_ids


def retrieve_chunks_for_paper(
    paper_chunks: list[dict],
    query_vectors: list[list[float]],
    *,
    top_k_per_query: int,
    max_chunks_sent: int,
) -> list[dict]:
    selected: dict[str, dict] = {}

    for qv in query_vectors:
        scored = []
        q_norm = vector_norm(qv)
        for chunk in paper_chunks:
            score = cosine_sim(qv, chunk["vector"], norm_a=q_norm, norm_b=chunk.get("vector_norm"))
            scored.append((score, chunk))
        scored.sort(key=lambda x: x[0], reverse=True)
        for score, chunk in scored[:top_k_per_query]:
            chosen = dict(chunk)
            chosen["retrieval_score"] = score
            prior = selected.get(chunk["chunk_id"])
            if prior is None or score > prior.get("retrieval_score", -1):
                selected[chunk["chunk_id"]] = chosen

    top_scored = sorted(
        selected.values(),
        key=lambda r: r.get("retrieval_score", 0.0),
        reverse=True,
    )[:max_chunks_sent]
    ordered = sorted(
        top_scored,
        key=lambda r: (r["page"], r["chunk_index_on_page"], r["char_start"]),
    )
    return ordered


def build_extraction_prompt(paper_id: str, chunks: list[dict]) -> list[dict]:
    context_blocks = []
    for idx, chunk in enumerate(chunks, start=1):
        context_blocks.append(
            f"[Chunk {idx}] paper_id={paper_id} page={chunk['page']} chunk_id={chunk['chunk_id']}\n{chunk['text']}"
        )
    joined_context = "\n\n".join(context_blocks)

    system = (
        "You extract HRQoL/QoL instruments and follow-up timepoints from study PDF text chunks. "
        "Return only JSON matching the provided schema. "
        "Do not infer beyond explicit evidence. "
        "If evidence quote/page is missing, omit that instrument or timepoint item entirely. "
        "Evidence quotes must be short verbatim excerpts (<=25 words) from the provided chunks and page numbers must match the chunk page. "
        "If time anchor is not explicit, use 'unclear'."
    )
    user = (
        f"Extract data for paper_id={paper_id} from ONLY the retrieved chunks below.\n\n"
        "Required fields:\n"
        "- population (OHCA/IHCA/mixed/unclear)\n"
        "- instruments[] with verbatim name, standardized label if clear, evidence quote+page\n"
        "- timepoints[] with original text, numeric months if possible, time_anchor, evidence quote+page\n"
        "- construct_label, respondent, mode\n"
        "- optional doi/pmid if explicitly shown in chunks\n\n"
        "Chunks:\n"
        f"{joined_context}"
    )
    return [
        {"role": "system", "content": [{"type": "input_text", "text": system}]},
        {"role": "user", "content": [{"type": "input_text", "text": user}]},
    ]


def call_extraction(client: OpenAI, paper_id: str, chunks: list[dict]) -> ExtractionPayload:
    schema = make_openai_strict_json_schema(ExtractionPayload.model_json_schema())
    prompt = build_extraction_prompt(paper_id, chunks)

    def _call():
        return client.responses.create(
            model=EXTRACTION_MODEL,
            input=prompt,
            text={
                "format": {
                    "type": "json_schema",
                    "name": "qol_extraction_payload",
                    "schema": schema,
                    "strict": True,
                }
            },
            store=False,
        )

    resp = call_with_retries(_call)
    payload_text = extract_response_text(resp)
    payload_json = parse_json_object(payload_text)
    payload = ExtractionPayload.model_validate(payload_json)

    # Guardrail: drop items missing evidence or violating quote length rule.
    payload.instruments = [
        item for item in payload.instruments if item.evidence_quote.strip() and item.evidence_page >= 1 and len(item.evidence_quote.split()) <= 25
    ]
    payload.timepoints = [
        item for item in payload.timepoints if item.evidence_quote.strip() and item.evidence_page >= 1 and len(item.evidence_quote.split()) <= 25
    ]
    if payload.paper_id != paper_id:
        payload.paper_id = paper_id
    return payload


def qa_flags(payload: ExtractionPayload, retrieved_chunks: list[dict], total_chunks_available: int) -> dict:
    low_text_coverage = total_chunks_available < 3 or len(retrieved_chunks) < 2
    missing_evidence = any(
        not item.evidence_quote.strip() or not item.evidence_page
        for item in [*payload.instruments, *payload.timepoints]
    )
    return {
        "missing_evidence": missing_evidence,
        "anchor_unclear_present": any(tp.time_anchor == "unclear" for tp in payload.timepoints),
        "no_instruments_found": len(payload.instruments) == 0,
        "no_timepoints_found": len(payload.timepoints) == 0,
        "low_text_coverage": low_text_coverage,
        "extraction_error": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Retrieve chunks from local embeddings index and run structured extraction.")
    parser.add_argument("--out-dir", default="outputs", help="Base output directory.")
    parser.add_argument("--paper-id", default=None, help="Optional single paper_id to process.")
    parser.add_argument("--top-k-per-query", type=int, default=DEFAULT_TOP_K_PER_QUERY)
    parser.add_argument("--max-chunks-sent", type=int, default=DEFAULT_MAX_CHUNKS_SENT)
    parser.add_argument("--limit", type=int, default=None, help="Optional max number of papers.")
    parser.add_argument("--resume", action="store_true", help="Skip papers already present in outputs/extractions.jsonl and append new results.")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    index_dir = out_dir / "index"
    extractions_path = out_dir / "extractions.jsonl"

    papers = load_index(index_dir)
    paper_ids = sorted(papers)
    if args.paper_id:
        paper_ids = [pid for pid in paper_ids if pid == args.paper_id]
    if args.limit is not None:
        paper_ids = paper_ids[: args.limit]

    skipped_existing = 0
    if args.resume:
        existing_paper_ids = load_existing_paper_ids(extractions_path)
        before = len(paper_ids)
        paper_ids = [pid for pid in paper_ids if pid not in existing_paper_ids]
        skipped_existing = before - len(paper_ids)
        if skipped_existing:
            print(f"Resume mode: skipping {skipped_existing} already-processed paper(s) in {extractions_path.as_posix()}")

    if not paper_ids:
        if args.resume:
            print("No papers left to process (resume mode).")
            return
        raise RuntimeError("No papers selected for extraction.")

    client = build_client()
    query_vectors = embed_queries(client, RETRIEVAL_QUERIES)

    all_rows: list[dict] = []
    for paper_id in paper_ids:
        paper_chunks = papers[paper_id]
        retrieved = retrieve_chunks_for_paper(
            paper_chunks,
            query_vectors,
            top_k_per_query=args.top_k_per_query,
            max_chunks_sent=args.max_chunks_sent,
        )

        payload: ExtractionPayload
        qa: dict
        error_message = None
        try:
            payload = call_extraction(client, paper_id, retrieved)
            qa = qa_flags(payload, retrieved, total_chunks_available=len(paper_chunks))
        except (ValidationError, json.JSONDecodeError, Exception) as exc:
            # Keep pipeline auditable and resumable.
            error_message = f"{type(exc).__name__}: {exc}"
            payload = ExtractionPayload(
                paper_id=paper_id,
                population="unclear",
                construct_label="unclear",
                respondent="unclear",
                mode="unclear",
                instruments=[],
                timepoints=[],
                notes="Extraction failed; see run_metadata.error",
            )
            qa = {
                "missing_evidence": False,
                "anchor_unclear_present": False,
                "no_instruments_found": True,
                "no_timepoints_found": True,
                "low_text_coverage": len(paper_chunks) < 3 or len(retrieved) < 2,
                "extraction_error": True,
            }

        row = payload.model_dump()
        row["retrieved_chunks"] = [
            {
                "chunk_id": c["chunk_id"],
                "page": c["page"],
                "chunk_index_on_page": c["chunk_index_on_page"],
                "char_start": c["char_start"],
                "char_end": c["char_end"],
                "retrieval_score": round(float(c.get("retrieval_score", 0.0)), 6),
            }
            for c in retrieved
        ]
        row["run_metadata"] = {
            "timestamp_utc": utc_now_iso(),
            "paper_id": paper_id,
            "embedding_model": EMBEDDING_MODEL,
            "extraction_model": EXTRACTION_MODEL,
            "prompt_version": PROMPT_VERSION,
            "retrieval_queries": RETRIEVAL_QUERIES,
            "num_chunks_available": len(paper_chunks),
            "num_chunks_retrieved": len(retrieved),
            "top_k_per_query": args.top_k_per_query,
            "max_chunks_sent": args.max_chunks_sent,
            "qa_flags": qa,
            "error": error_message,
        }
        all_rows.append(row)
        print(f"{paper_id}: instruments={len(row['instruments'])} timepoints={len(row['timepoints'])} retrieved={len(retrieved)}")

    if args.resume:
        jsonl_append(extractions_path, all_rows)
        print(
            f"Appended {len(all_rows)} paper-level extraction record(s) to {extractions_path.as_posix()} "
            f"(skipped_existing={skipped_existing})"
        )
    else:
        jsonl_write(extractions_path, all_rows)
        print(f"Wrote {len(all_rows)} paper-level extraction records to {extractions_path.as_posix()}")


if __name__ == "__main__":
    main()
