# QoL cardiac arrest evidence pipeline

This repository contains an end-to-end evidence retrieval workflow for health-related quality of life (HRQoL) studies in adult cardiac arrest survivors. It combines:

- **Database ingestion** (PubMed + imported RIS from CINAHL/Web of Science),
- **Normalization and deduplication**, and
- **Grey literature search** (OpenAlex, ClinicalTrials.gov, and configured seed sites).

## Repository structure

```text
.
├── data/
│   ├── raw/
│   │   ├── pubmed/            # PubMed retrieval outputs (.nbib/.csv/.jsonl)
│   │   ├── cinahl/            # CINAHL RIS exports
│   │   └── wos/               # Web of Science RIS exports
│   ├── normalized/            # Per-source normalized CSV files
│   ├── merged/                # Final merged outputs (e.g., studies_merged.csv)
│   └── processed/             # Grey-search processed outputs (RIS)
├── grey_search/
│   ├── config.yaml            # Grey-search configuration (queries, ranking, stop rules)
│   ├── run.py                 # Grey-search pipeline entrypoint
│   ├── sources/               # Source collectors (OpenAlex, ClinicalTrials, seed sites, SerpAPI optional)
│   └── utils/                 # Ranking, dedupe, text, logging utilities
├── logs/                      # Runtime logs (e.g., search_log.jsonl)
├── scripts/
│   ├── ingest/pubmed_retrieval.py
│   ├── transform/ris_to_csv.py
│   └── dedupe/merge_and_dedupe.py
├── .github/workflows/
│   ├── pubmed-retrieval.yml
│   ├── transform-ris-to-csv.yml
│   ├── merge-and-dedupe-csv.yml
│   └── grey-search.yml
├── requirements.txt
└── search_strategies.md
```

## Core scripts

1. **PubMed retrieval**  
   `python scripts/ingest/pubmed_retrieval.py`
   - Runs two predefined PubMed queries.
   - Writes query-level `.nbib`, parsed `.csv`, raw `.jsonl`, and a merged PubMed CSV under `data/raw/pubmed/`.

2. **RIS → normalized CSV transform**  
   `python scripts/transform/ris_to_csv.py`
   - Parses RIS exports in `data/raw/cinahl/` and `data/raw/wos/`.
   - Normalizes fields and writes CSV files under `data/normalized/`.
   - Also normalizes PubMed CSV records to `data/normalized/pubmed.csv`.

3. **Merge + deduplicate**  
   `python scripts/dedupe/merge_and_dedupe.py`
   - Merges normalized CSV files.
   - Deduplicates with priority: DOI → PMID/accession number → normalized title/year/first author.
   - Writes `data/merged/studies_merged.csv`.

4. **Grey search pipeline**  
   `python -m grey_search.run`
   - Reads `grey_search/config.yaml`.
   - Collects from OpenAlex, ClinicalTrials.gov, and configured seed sites.
   - Scores relevance, filters, deduplicates, and exports RIS to `data/processed/grey_candidates_deduped.ris`.
   - Writes run logs to `logs/search_log.jsonl`.

## GitHub Actions (manual)

Each workflow in `.github/workflows/` is configured for `workflow_dispatch`:

- **PubMed retrieval** → runs `scripts/ingest/pubmed_retrieval.py`.
- **Transform RIS to CSV** → runs `scripts/transform/ris_to_csv.py`.
- **Merge and dedupe CSV** → runs `scripts/dedupe/merge_and_dedupe.py`.
- **Grey search pipeline** → runs `python -m grey_search.run`.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Search strategy archive

`search_strategies.md` stores formatted database search strings used by the project.
