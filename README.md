# PubMed retrieval automation for HRQoL PROMs in adult OHCA/IHCA survivors

This repository is organized into clear ingest/transform/deduplicate stages for PubMed, CINAHL, and Web of Science exports.

## Repository structure

```text
data/
  raw/
    pubmed/
    cinahl/
    wos/
  normalized/
    pubmed.csv
    cinahl.csv
    wos.csv
  merged/
    studies_merged.csv
scripts/
  ingest/
    pubmed_retrieval.py
  transform/
    ris_to_csv.py
  dedupe/
    merge_and_dedupe.py
```

## Data placement

All source exports are stored in `data/raw/<source>/`:

- `data/raw/pubmed/`: NBIB + retrieval outputs.
- `data/raw/cinahl/`: CINAHL RIS exports.
- `data/raw/wos/`: Web of Science RIS exports (including split exports when WoS download limits apply).

## Actions

Two manual GitHub Actions are provided for post-ingest processing:

1. **Transform RIS to CSV** (`.github/workflows/transform-ris-to-csv.yml`)
   - Runs `python scripts/transform/ris_to_csv.py`.
   - Converts all RIS files in `data/raw/cinahl/` and `data/raw/wos/` into normalized CSV files in `data/normalized/`.
   - Also consolidates PubMed source CSVs into `data/normalized/pubmed.csv`.

2. **Merge and dedupe CSV** (`.github/workflows/merge-and-dedupe-csv.yml`)
   - Runs `python scripts/dedupe/merge_and_dedupe.py`.
   - Merges all CSV files in `data/normalized/`.
   - Deduplicates in this priority order: DOI → PMID/accession number → normalized title + year + first author.
   - Writes `data/merged/studies_merged.csv`.

## Existing PubMed retrieval action

The existing **PubMed retrieval** workflow is retained and now runs `scripts/ingest/pubmed_retrieval.py`, writing outputs to `data/raw/pubmed/`.

## Search strategy archive

Formatted database queries are stored in `search_strategies.md`.
