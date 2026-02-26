from __future__ import annotations

import argparse
import hashlib
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator

import pdfplumber
from openai import OpenAI

from shared import build_openai_client, call_with_retries, jsonl_read, jsonl_write, load_pipeline_config

EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_SIZE_CHARS = 2000
CHUNK_OVERLAP_CHARS = 200
EMBEDDING_BATCH_SIZE = 32

@dataclass(frozen=True)
class ChunkRecord:
    chunk_id: str
    paper_id: str
    source_path: str
    page: int
    chunk_index_on_page: int
    char_start: int
    char_end: int
    text: str
    content_hash: str


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def stable_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def find_pdfs(pdf_dir: Path) -> list[Path]:
    return sorted([p for p in pdf_dir.rglob("*.pdf") if p.is_file()])


def extract_pages(pdf_path: Path) -> list[dict]:
    pages: list[dict] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            pages.append(
                {
                    "paper_id": pdf_path.stem,
                    "source_path": str(pdf_path.as_posix()),
                    "page": idx,
                    "text": text,
                }
            )
    return pages


def chunk_text(text: str, chunk_size: int, overlap: int) -> list[tuple[int, int, str]]:
    cleaned = text.strip()
    if not cleaned:
        return []
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    chunks: list[tuple[int, int, str]] = []
    cursor = 0
    n = len(cleaned)
    while cursor < n:
        end = min(cursor + chunk_size, n)
        chunk = cleaned[cursor:end].strip()
        if chunk:
            # Map back to the cleaned string offsets (sufficient for audit metadata).
            chunk_start = cursor
            chunk_end = end
            chunks.append((chunk_start, chunk_end, chunk))
        if end >= n:
            break
        cursor = max(0, end - overlap)
    return chunks


def build_chunks(pages: list[dict], chunk_size: int, overlap: int) -> list[ChunkRecord]:
    rows: list[ChunkRecord] = []
    for page in pages:
        page_chunks = chunk_text(page["text"], chunk_size=chunk_size, overlap=overlap)
        for chunk_idx, (char_start, char_end, chunk_text_value) in enumerate(page_chunks):
            seed = f'{page["paper_id"]}|{page["page"]}|{chunk_idx}|{char_start}|{char_end}|{chunk_text_value}'
            chunk_id = stable_hash(seed)[:24]
            content_hash = stable_hash(f"{EMBEDDING_MODEL}|{chunk_text_value}")
            rows.append(
                ChunkRecord(
                    chunk_id=chunk_id,
                    paper_id=page["paper_id"],
                    source_path=page["source_path"],
                    page=page["page"],
                    chunk_index_on_page=chunk_idx,
                    char_start=char_start,
                    char_end=char_end,
                    text=chunk_text_value,
                    content_hash=content_hash,
                )
            )
    return rows


def embed_texts(client: OpenAI, texts: list[str]) -> list[list[float]]:
    def _call():
        return client.embeddings.create(model=EMBEDDING_MODEL, input=texts)

    resp = call_with_retries(_call)
    return [item.embedding for item in resp.data]


def l2_norm(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract PDF text, chunk pages, and build cached embeddings index.")
    parser.add_argument("--config", default="pipeline_config.yaml", help="Pipeline config YAML path.")
    parser.add_argument("--pdf-dir", default=None, help="Folder containing PDFs.")
    parser.add_argument("--out-dir", default=None, help="Base output directory.")
    parser.add_argument("--chunk-size", type=int, default=CHUNK_SIZE_CHARS)
    parser.add_argument("--chunk-overlap", type=int, default=CHUNK_OVERLAP_CHARS)
    parser.add_argument("--batch-size", type=int, default=EMBEDDING_BATCH_SIZE)
    parser.add_argument("--limit", type=int, default=None, help="Optional max number of PDFs (for testing).")
    args = parser.parse_args()

    cfg = load_pipeline_config(args.config)
    cfg_paths = cfg.get("paths", {})
    pdf_dir = Path(args.pdf_dir or cfg_paths.get("pdf_dir", "data/pdfs/calibration-set/caresearchhub"))
    out_dir = Path(args.out_dir or cfg_paths.get("out_dir", "outputs"))
    index_dir = out_dir / "index"
    pages_path = index_dir / "pages.jsonl"
    chunks_path = index_dir / "chunks.jsonl"
    embeddings_path = index_dir / f"embeddings_{EMBEDDING_MODEL}.jsonl"
    manifest_path = index_dir / "build_manifest.json"

    if not pdf_dir.exists():
        raise FileNotFoundError(f"PDF directory not found: {pdf_dir}")

    pdfs = find_pdfs(pdf_dir)
    if args.limit:
        pdfs = pdfs[: args.limit]
    if not pdfs:
        raise RuntimeError(f"No PDFs found in {pdf_dir}")

    client = build_openai_client()

    all_pages: list[dict] = []
    all_chunks: list[ChunkRecord] = []
    for pdf_path in pdfs:
        pages = extract_pages(pdf_path)
        all_pages.extend(pages)
        all_chunks.extend(build_chunks(pages, chunk_size=args.chunk_size, overlap=args.chunk_overlap))

    jsonl_write(pages_path, all_pages)
    jsonl_write(
        chunks_path,
        (
            {
                "chunk_id": c.chunk_id,
                "paper_id": c.paper_id,
                "source_path": c.source_path,
                "page": c.page,
                "chunk_index_on_page": c.chunk_index_on_page,
                "char_start": c.char_start,
                "char_end": c.char_end,
                "text": c.text,
                "content_hash": c.content_hash,
            }
            for c in all_chunks
        ),
    )

    existing_embeddings: dict[str, dict] = {}
    for row in jsonl_read(embeddings_path):
        chunk_id = row.get("chunk_id")
        if chunk_id:
            existing_embeddings[chunk_id] = row

    embeddings_records: dict[str, dict] = {}
    to_embed: list[ChunkRecord] = []
    reused_count = 0

    for chunk in all_chunks:
        cached = existing_embeddings.get(chunk.chunk_id)
        if cached and cached.get("content_hash") == chunk.content_hash and cached.get("model") == EMBEDDING_MODEL:
            embeddings_records[chunk.chunk_id] = cached
            reused_count += 1
        else:
            to_embed.append(chunk)

    for batch_start in range(0, len(to_embed), args.batch_size):
        batch = to_embed[batch_start : batch_start + args.batch_size]
        vectors = embed_texts(client, [c.text for c in batch])
        for chunk, vector in zip(batch, vectors):
            embeddings_records[chunk.chunk_id] = {
                "chunk_id": chunk.chunk_id,
                "paper_id": chunk.paper_id,
                "page": chunk.page,
                "model": EMBEDDING_MODEL,
                "content_hash": chunk.content_hash,
                "vector": vector,
                "vector_norm": l2_norm(vector),
                "updated_at": utc_now_iso(),
            }

    jsonl_write(
        embeddings_path,
        (
            embeddings_records[c.chunk_id]
            for c in all_chunks
            if c.chunk_id in embeddings_records
        ),
    )

    papers_with_text = len({p["paper_id"] for p in all_pages if p["text"].strip()})
    manifest = {
        "timestamp_utc": utc_now_iso(),
        "pdf_dir": str(pdf_dir.as_posix()),
        "pdf_count": len(pdfs),
        "page_count": len(all_pages),
        "chunk_count": len(all_chunks),
        "papers_with_any_text": papers_with_text,
        "embedding_model": EMBEDDING_MODEL,
        "chunk_size": args.chunk_size,
        "chunk_overlap": args.chunk_overlap,
        "reused_embeddings": reused_count,
        "new_embeddings": len(to_embed),
        "outputs": {
            "pages_jsonl": str(pages_path.as_posix()),
            "chunks_jsonl": str(chunks_path.as_posix()),
            "embeddings_jsonl": str(embeddings_path.as_posix()),
        },
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
