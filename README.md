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

When duplicates occur across A and B, row content prefers **B** while preserving both tags via `query_id=B|A`.

## Notes

Generated retrieval outputs are intentionally gitignored to keep commits and PRs lightweight.

## GitHub Actions

A workflow is provided at `.github/workflows/pubmed-retrieval.yml` to run the retrieval automatically:

- Manual trigger: **Actions → PubMed retrieval → Run workflow**
- Scheduled trigger: every Monday at 06:00 UTC

Each run uploads generated `data/pubmed_*` files as a workflow artifact (retained for 14 days).
