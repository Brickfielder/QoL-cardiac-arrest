from __future__ import annotations

import argparse
import csv
from itertools import product
from pathlib import Path

from shared import jsonl_read, load_pipeline_config




def to_pairs(record: dict) -> list[dict]:
    instruments = record.get("instruments") or []
    timepoints = record.get("timepoints") or []
    inst_list = instruments if instruments else [None]
    tp_list = timepoints if timepoints else [None]

    rows: list[dict] = []
    for inst_idx, tp_idx in product(range(len(inst_list)), range(len(tp_list))):
        inst = inst_list[inst_idx]
        tp = tp_list[tp_idx]
        rows.append(
            {
                "paper_id": record.get("paper_id"),
                "doi": record.get("doi"),
                "pmid": record.get("pmid"),
                "population": record.get("population"),
                "construct_label": record.get("construct_label"),
                "respondent": record.get("respondent"),
                "mode": record.get("mode"),
                "instrument_count": len(instruments),
                "timepoint_count": len(timepoints),
                "pairing_strategy": "cartesian",
                "instrument_index": inst_idx if inst is not None else "",
                "instrument_name_verbatim": (inst or {}).get("instrument_name_verbatim"),
                "instrument_standardised": (inst or {}).get("instrument_standardised"),
                "instrument_evidence_quote": (inst or {}).get("evidence_quote"),
                "instrument_evidence_page": (inst or {}).get("evidence_page"),
                "timepoint_index": tp_idx if tp is not None else "",
                "timepoint_original_text": (tp or {}).get("timepoint_original_text"),
                "timepoint_value_months": (tp or {}).get("timepoint_value_months"),
                "time_anchor": (tp or {}).get("time_anchor"),
                "timepoint_evidence_quote": (tp or {}).get("evidence_quote"),
                "timepoint_evidence_page": (tp or {}).get("evidence_page"),
                "qa_missing_evidence": ((record.get("run_metadata") or {}).get("qa_flags") or {}).get("missing_evidence"),
                "qa_anchor_unclear_present": ((record.get("run_metadata") or {}).get("qa_flags") or {}).get("anchor_unclear_present"),
                "qa_no_instruments_found": ((record.get("run_metadata") or {}).get("qa_flags") or {}).get("no_instruments_found"),
                "qa_no_timepoints_found": ((record.get("run_metadata") or {}).get("qa_flags") or {}).get("no_timepoints_found"),
                "qa_low_text_coverage": ((record.get("run_metadata") or {}).get("qa_flags") or {}).get("low_text_coverage"),
                "qa_extraction_error": ((record.get("run_metadata") or {}).get("qa_flags") or {}).get("extraction_error"),
                "num_chunks_retrieved": (record.get("run_metadata") or {}).get("num_chunks_retrieved"),
                "prompt_version": (record.get("run_metadata") or {}).get("prompt_version"),
                "extraction_model": (record.get("run_metadata") or {}).get("extraction_model"),
            }
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Export extraction JSONL to a review-friendly CSV.")
    parser.add_argument("--config", default="pipeline_config.yaml", help="Pipeline config YAML path.")
    parser.add_argument("--input", default=None, help="Paper-level extraction JSONL path.")
    parser.add_argument("--output", default=None, help="Output CSV path.")
    args = parser.parse_args()

    cfg = load_pipeline_config(args.config)
    cfg_paths = cfg.get("paths", {})
    out_dir = Path(cfg_paths.get("out_dir", "outputs"))
    input_path = Path(args.input) if args.input else out_dir / "extractions.jsonl"
    output_path = Path(args.output) if args.output else out_dir / "extractions.csv"
    if not input_path.exists():
        raise FileNotFoundError(f"Input JSONL not found: {input_path}")

    rows: list[dict] = []
    for record in jsonl_read(input_path):
        rows.extend(to_pairs(record))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "paper_id",
        "doi",
        "pmid",
        "population",
        "construct_label",
        "respondent",
        "mode",
        "instrument_count",
        "timepoint_count",
        "pairing_strategy",
        "instrument_index",
        "instrument_name_verbatim",
        "instrument_standardised",
        "instrument_evidence_quote",
        "instrument_evidence_page",
        "timepoint_index",
        "timepoint_original_text",
        "timepoint_value_months",
        "time_anchor",
        "timepoint_evidence_quote",
        "timepoint_evidence_page",
        "qa_missing_evidence",
        "qa_anchor_unclear_present",
        "qa_no_instruments_found",
        "qa_no_timepoints_found",
        "qa_low_text_coverage",
        "qa_extraction_error",
        "num_chunks_retrieved",
        "prompt_version",
        "extraction_model",
    ]
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output_path.as_posix()}")


if __name__ == "__main__":
    main()
