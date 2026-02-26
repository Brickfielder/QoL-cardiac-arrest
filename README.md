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

5. **Study PDF download (best-effort, OA-first)**  
   `python scripts/ingest/download_study_pdfs.py --unpaywall-email you@example.org`
   - Reads `data/calibration-set/set-from-caresearchhub/qol_timepoint_matrix_timepoints.csv` by default.
   - Uses PMID/DOI to resolve PDF URLs via PubMed/PMC, Europe PMC, Unpaywall (optional but recommended), Crossref, and DOI landing pages.
   - Downloads accessible PDFs to `data/pdfs/calibration-set/caresearchhub/`.
   - Writes a manifest CSV (`download_manifest.csv`) with status, URL, and failure reasons for unresolved/paywalled items.

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

## PDF download notes

- The PDF downloader is **best-effort** and primarily targets open-access or directly reachable publisher PDFs.
- Some records in the calibration set are conference abstracts, protocols, or paywalled articles and may remain unresolved.
- Use `--print-candidates` to inspect attempted URLs and `--overwrite` to re-download.

## Local PDF extraction pipeline (OpenAI + retrieval)

This repository now includes a local pipeline to extract HRQoL/QoL instruments and follow-up timepoints from PDFs in an **auditable** way:

- local PDF text extraction with page numbers
- local chunking + embeddings index (cached on disk)
- per-paper retrieval using multiple targeted queries
- structured extraction with the OpenAI **Responses API** (strict JSON Schema)
- JSONL + CSV outputs for review

### Folder structure suggestion (for this pipeline)

```text
.
├── data/
│   └── pdfs/
│       └── calibration-set/caresearchhub/   # current local PDFs (default input)
├── outputs/
│   ├── index/
│   │   ├── pages.jsonl                      # page-level text with 1-indexed page numbers
│   │   ├── chunks.jsonl                     # chunk metadata + text
│   │   ├── embeddings_text-embedding-3-small.jsonl
│   │   └── build_manifest.json
│   ├── extractions.jsonl                    # one record per paper (arrays preserved)
│   └── extractions.csv                      # review CSV (instrument-timepoint pairing rows)
└── scripts/
    ├── build_index.py
    ├── retrieve_and_extract.py
    └── export_csv.py
```

### New dependencies

Added to `requirements.txt`:

- `openai`
- `python-dotenv`
- `pdfplumber`
- `pydantic`

### Environment setup (VS Code terminal)

1. Create and activate a virtual environment.
2. Install dependencies.
3. Set your API key in `.env` (project root).

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`.env` (project root):

```env
OPENAI_API_KEY=your_key_here
```

The scripts use `python-dotenv` (`load_dotenv`) and read `OPENAI_API_KEY` from environment variables. Keys are not hardcoded.

The extraction scripts also read defaults from `pipeline_config.yaml` (PDF input/output paths and model names). You can override those defaults with CLI flags such as `--config`, `--pdf-dir`, and `--out-dir`.

### Pipeline steps and commands

The implementation maps the requested steps as:

- `scripts/build_index.py` = steps 1-3 (PDF text extraction, page-preserving chunking, embeddings index)
- `scripts/retrieve_and_extract.py` = steps 4-6 (retrieval, structured extraction, QA flags)
- `scripts/export_csv.py` = step 7 (CSV export)

#### 1) Build page/chunk/embedding index

Default PDF input is `data/pdfs/calibration-set/caresearchhub`. Override with `--pdf-dir` if needed.

```powershell
python scripts/build_index.py
```

Optional examples:

```powershell
python scripts/build_index.py --pdf-dir data/pdfs/calibration-set/caresearchhub --limit 5
python scripts/build_index.py --chunk-size 2000 --chunk-overlap 200
```

Notes:

- Uses `pdfplumber` for text-based PDFs.
- If a page has no text, it is retained in `outputs/index/pages.jsonl` with empty text (for later OCR extension).
- Embeddings are cached and reused if chunk content is unchanged.

#### 2) Retrieve relevant chunks and extract structured data

```powershell
python scripts/retrieve_and_extract.py
```

Optional examples:

```powershell
python scripts/retrieve_and_extract.py --paper-id doi_10_1016_j_resuscitation_2023_109830
python scripts/retrieve_and_extract.py --top-k-per-query 4 --max-chunks-sent 20
python scripts/retrieve_and_extract.py --resume
```

Defaults:

- extraction model: `gpt-5`
- embeddings model: `text-embedding-3-small`
- `store=False` for API calls
- conservative retry/backoff for embeddings and extraction calls
- `--resume` skips `paper_id`s already present in `outputs/extractions.jsonl` and appends only new records

#### 3) Export review CSV

```powershell
python scripts/export_csv.py
```

Outputs:

- `outputs/extractions.jsonl` (paper-level records; arrays preserved)
- `outputs/extractions.csv` (review CSV)

### What is extracted (data dictionary coverage)

The extraction JSONL includes:

1. `paper_id` (filename stem)
2. `population` (`OHCA` / `IHCA` / `mixed` / `unclear`)
3. `instruments[].instrument_name_verbatim`
4. `instruments[].instrument_standardised`
5. `timepoints[].timepoint_original_text`
6. `timepoints[].timepoint_value_months`
7. `timepoints[].time_anchor`
8. `instruments[]` and `timepoints[]` each include `evidence_quote` + `evidence_page`
9. `construct_label`
10. `respondent`
11. `mode`

Also included:

- optional `doi` / `pmid` (if explicitly present in retrieved chunks)
- `retrieved_chunks` metadata (page/chunk references used for extraction)
- `run_metadata` (models, prompt version, timestamp, retrieval settings, QA flags)

### Auditing rules (quote + page)

- Every extracted **instrument** and **timepoint** must include:
  - `evidence_quote` (short verbatim quote; <=25 words)
  - `evidence_page` (1-indexed page number)
- If evidence is not available, the item should be omitted (not guessed).
- `time_anchor` is set to `unclear` if not explicit.

### QA flags per paper

Stored under `run_metadata.qa_flags`:

- `missing_evidence`
- `anchor_unclear_present`
- `no_instruments_found`
- `no_timepoints_found`
- `low_text_coverage`

If extraction fails for a paper, a placeholder record is still written with `extraction_error` in QA flags and an error string in `run_metadata.error`.

### CSV export format (reviewability)

`outputs/extractions.csv` uses **one row per instrument-timepoint pairing** (Cartesian pairing within each paper) so reviewers can scan instruments and timepoints together in a flat table.

Important:

- If a paper has multiple instruments and multiple timepoints, rows are duplicated across pairings by design.
- `instrument_count` and `timepoint_count` are included to make this explicit.
- The authoritative, non-flattened record remains `outputs/extractions.jsonl`.
