# PubMed retrieval automation for HRQoL PROMs in adult OHCA/IHCA survivors

This repository includes a reproducible script to retrieve PubMed records for two scoping-review queries:

- **Query A**: high-recall
- **Query B**: high-precision (instrument names)

## Run

```bash
python3 pubmed_retrieval.py
```

The script uses NCBI E-utilities (`esearch` + `efetch`) and writes the following generated files into `data/`:

- `pubmed_A_raw.jsonl`
- `pubmed_B_raw.jsonl`
- `pubmed_A.nbib`
- `pubmed_B.nbib`
- `pubmed_A.csv`
- `pubmed_B.csv`
- `pubmed_merged.csv`

## Output schema

CSV outputs use normalized columns:

- `pmid`, `doi`, `title`, `abstract`, `journal`, `year`, `authors`,
- `publication_types`, `mesh_terms`,
- `source_database` (= `pubmed`), `query_id` (`A`, `B`, or `B|A` in merged), `date_retrieved`
- `flag_instrument_token`, `flag_hrqol_language`, `flag_timepoint_language`

Deduplication for `pubmed_merged.csv` is applied in this order:

1. DOI
2. PMID
3. Normalized `title + year + first_author`

When duplicates occur across A and B, row content prefers:

1. The row containing an abstract.
2. If both rows either have or do not have abstracts, **B** is preferred.

Both query tags are preserved via `query_id=B|A`.

## Notes

Generated retrieval outputs are tracked in `data/` so the latest pipeline output is versioned in the repository.

## GitHub Actions

A workflow is provided at `.github/workflows/pubmed-retrieval.yml` to run the retrieval on request:

- Manual trigger: **Actions → PubMed retrieval → Run workflow**

Each run commits and pushes updated `data/pubmed_*` outputs when changes are detected, and also uploads them as a workflow artifact (retained for 14 days).

## Suggested repo structure for multi-database ingestion

If CINAHL and Web of Science exports are added, the repository can be split into clear ingest/transform/deduplicate stages:

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

Recommended workflow:

1. Keep each source export untouched in `data/raw/<source>/` (NBIB for PubMed, RIS for CINAHL/WoS).
2. Convert each raw format to a shared schema in `data/normalized/` (same columns currently used by PubMed CSV outputs).
3. Add `source_database` values (`pubmed`, `cinahl`, `wos`) and preserve source-specific identifiers (e.g. accession numbers) in dedicated columns.
4. Run a single cross-source deduplication step that prioritizes: DOI → PMID/source ID → normalized title + year + first author.
5. Write final combined datasets to `data/merged/` and keep source-level normalized files for traceability.

This layout keeps provenance clear, makes RIS conversion independent from deduplication, and allows easy future additions of other databases.
