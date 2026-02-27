from __future__ import annotations

import json
import os
import random
import time
from pathlib import Path
from typing import Any, Iterable, Iterator

import yaml
from dotenv import load_dotenv
from openai import OpenAI

MAX_RETRIES = 5
RETRY_BASE_SECONDS = 1.5
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "pipeline_config.yaml"


def jsonl_write(path: Path, rows: Iterable[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=True) + "\n")


def jsonl_append(path: Path, rows: Iterable[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=True) + "\n")


def jsonl_read(path: Path) -> Iterator[dict]:
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


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


def build_openai_client() -> OpenAI:
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not found. Put it in project-root .env and load via python-dotenv.")
    return OpenAI(api_key=api_key)


def load_pipeline_config(config_path: str | Path | None = None) -> dict[str, Any]:
    path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
