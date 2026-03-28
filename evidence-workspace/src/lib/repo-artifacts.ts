import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join, basename } from "node:path";

import { parse } from "csv-parse/sync";

import type { BucketName } from "@/db/schema";
import { getArtifactsRoot } from "@/lib/env";
import { normalizeTitle, safeInt, slugFromTitle } from "@/lib/utils";

type CsvRow = Record<string, string>;

export type RepoDocumentSeed = {
  slug: string;
  title: string;
  markdown: string;
  documentType: "methodology" | "project_background" | "process_note";
};

export type SearchQuerySeed = {
  source: string;
  queryFamily: string;
  label: string;
  queryText: string;
  notes?: string;
  sortOrder: number;
};

export type StudySeed = {
  recordKey: string;
  title: string;
  titleNormalized: string;
  studySlug: string;
  year: number | null;
  doi: string | null;
  journal: string | null;
  authors: string | null;
  selectionOrigin: string | null;
  studyFamilySignal: string | null;
  countrySetting: string | null;
  population: string | null;
  design: string | null;
  sample: string | null;
  measures: string | null;
  followUp: string | null;
  comparatorKeyNote: string | null;
  abstract: string | null;
  bucket: BucketName;
  sourceArtifact: string;
  localPdfPath: string | null;
};

export type RepoSeedSnapshot = {
  documents: RepoDocumentSeed[];
  searchQueries: SearchQuerySeed[];
  studies: StudySeed[];
  counts: Record<string, number>;
  sourceHash: string;
};

const CANONICAL_BUCKET_FILES: Array<{ file: string; bucket: BucketName }> = [
  { file: "canonical_final_included_197.csv", bucket: "included" },
  { file: "non_original_56.csv", bucket: "non_original" },
  { file: "protocol_or_ongoing_33.csv", bucket: "protocol_or_ongoing" },
  { file: "wrong_population_or_scope_27.csv", bucket: "wrong_population_or_scope" },
  { file: "qualitative_only_15.csv", bucket: "qualitative_only" },
  { file: "no_global_qol_12.csv", bucket: "no_global_qol" },
  { file: "not_retrieved_14.csv", bucket: "not_retrieved" },
  { file: "duplicate_report_rows_4.csv", bucket: "duplicate_report_row" },
  { file: "duplicate_bibliographic_rows_or_variants_3.csv", bucket: "duplicate_bibliographic_variant" },
];

const INCLUDED_TITLE_OVERRIDES: Record<string, string> = {
  [normalizeTitle("Health Status of Survivors of Out-of-Hospital Cardiac Arrest Six Months Later.")]:
    "Health-Status of Survivors of Out of Hospital Cardiac-Arrest",
  [normalizeTitle("Health Status and Psychological Distress Among In-Hospital Cardiac Arrest Survivors in Relation to Sex")]:
    "Health status and psychological distress among in-hospital cardiac arrest survivors in relation to gender.",
  [normalizeTitle("Reply to: Poor prognosis of female out-of-hospital cardiac arrest survivors: A risk assessment")]:
    "Poor prognosis of female out-of-hospital cardiac arrest survivors: A risk assessment.",
  [normalizeTitle("Abstract 10394: Long-Term Functional and Quality-of-Life Outcomes of Cardiac Arrest Survivors Stratified by Shock Provider: A 10 Year Retrospective Study")]:
    ".",
};

function readText(path: string) {
  return readFileSync(path, "utf8");
}

function readCsv(path: string) {
  const raw = readFileSync(path, "utf8");
  return parse(raw, { columns: true, bom: true, skip_empty_lines: true }) as CsvRow[];
}

function artifactPath(...parts: string[]) {
  return resolve(process.cwd(), getArtifactsRoot(), ...parts);
}

function groupQueries(markdown: string) {
  const sections = [
    { source: "Web of Science", family: "A", label: "Query A", heading: "## Web of Science" },
    { source: "CINAHL", family: "A", label: "Query A (HRQoL)", heading: "### Query A (HRQoL)" },
    { source: "CINAHL", family: "B", label: "Query B (HRQoL + instrument filter)", heading: "### Query B (HRQoL + instrument filter)" },
    { source: "PubMed", family: "A", label: "QUERY_A", heading: "### QUERY_A" },
    { source: "PubMed", family: "B", label: "QUERY_B", heading: "### QUERY_B" },
    { source: "Grey literature", family: "A", label: "A_high_recall", heading: "#### A_high_recall" },
    { source: "Grey literature", family: "B", label: "B_instruments", heading: "#### B_instruments" },
  ];

  return sections.map((section, index) => {
    const start = markdown.indexOf(section.heading);
    const codeStart = markdown.indexOf("```text", start);
    const codeEnd = markdown.indexOf("```", codeStart + 7);
    const queryText = markdown.slice(codeStart + 7, codeEnd).trim();

    return {
      source: section.source,
      queryFamily: section.family,
      label: section.label,
      queryText,
      notes:
        section.source === "Grey literature"
          ? "Seed sites and stopping rules are preserved in grey_search/config.yaml."
          : undefined,
      sortOrder: index + 1,
    } satisfies SearchQuerySeed;
  });
}

function buildDocuments() {
  const methodologyPath = artifactPath("docs", "methods", "review_methodology_reconstruction.md");
  const searchPath = artifactPath("docs", "methods", "search_strategies.md");
  const prismaPath = artifactPath("outputs", "current", "asreview_second_screen", "prisma_flow_draft.md");

  const methodology = readText(methodologyPath);
  const search = readText(searchPath);
  const prisma = readText(prismaPath);

  const projectBackground = `# Why This Project Exists

Cardiac arrest survivorship has improved, but survival alone is not the outcome of interest. This workspace focuses on health-related quality of life, broader global quality-of-life outcomes, and related patient-reported evidence among cardiac arrest survivors.

## Scope

- Adult cardiac arrest survivors
- Original survivor data prioritized over non-original synthesis
- Transparent documentation of search strategy, screening, ASReview prioritization, and final inclusion status

## Current Research Logic

This database distinguishes included studies, excluded full-text buckets, unresolved retrieval issues, and duplicate-report or duplicate-bibliographic records so the evidence trail stays auditable for collaborative review.
`;

  return [
    {
      slug: "methodology",
      title: "Methodology and Process Reconstruction",
      markdown: methodology,
      documentType: "methodology",
    },
    {
      slug: "project-background",
      title: "Theoretical Background",
      markdown: projectBackground,
      documentType: "project_background",
    },
    {
      slug: "search-archive-note",
      title: "Search Archive Note",
      markdown: `${search}\n\n---\n\n${prisma}`,
      documentType: "process_note",
    },
  ] satisfies RepoDocumentSeed[];
}

function buildSummaryLookup() {
  const summaryRows = readCsv(artifactPath("outputs", "current", "articles_full_run", "study_summary_8col.csv"));
  const correctionRows = readCsv(
    artifactPath("outputs", "current", "articles_full_run", "study_summary_8col_title_corrections.csv"),
  );

  const dedupedSummary = new Map<string, CsvRow>();
  for (const row of summaryRows) {
    const key = normalizeTitle(row["Study"]);
    if (!dedupedSummary.has(key)) {
      dedupedSummary.set(key, row);
    }
  }

  const correctionByTitle = new Map<string, CsvRow[]>();
  for (const row of correctionRows) {
    const key = normalizeTitle(row["new_study"] || row["old_study"]);
    const existing = correctionByTitle.get(key) ?? [];
    existing.push(row);
    correctionByTitle.set(key, existing);
  }

  return { dedupedSummary, correctionByTitle };
}

function buildPdfLookup() {
  const pdfDir = artifactPath("data", "pdfs", "user_downloads", "articles");
  const names = readdirSync(pdfDir).filter((entry) => entry.toLowerCase().endsWith(".pdf"));
  const byPaperId = new Map<string, string>();

  for (const name of names) {
    const stem = basename(name, ".pdf");
    const withoutYear = stem.replace(/^\d{4}_/, "");
    const fullPath = join(pdfDir, name);
    byPaperId.set(stem, fullPath);
    byPaperId.set(withoutYear, fullPath);
  }

  return byPaperId;
}

function resolveSummaryRow(title: string, summaryLookup: ReturnType<typeof buildSummaryLookup>) {
  const overrideTitle = INCLUDED_TITLE_OVERRIDES[normalizeTitle(title)];
  const summaryKey = normalizeTitle(overrideTitle ?? title);

  return {
    summaryRow: summaryLookup.dedupedSummary.get(summaryKey) ?? null,
    correctionRows: summaryLookup.correctionByTitle.get(summaryKey) ?? [],
  };
}

function maybePdfPath(
  title: string,
  summaryLookup: ReturnType<typeof buildSummaryLookup>,
  pdfLookup: Map<string, string>,
) {
  const { correctionRows } = resolveSummaryRow(title, summaryLookup);

  for (const correctionRow of correctionRows) {
    const paperId = correctionRow?.paper_id;
    const paperIdWithoutYear = paperId?.replace(/^\d{4}_/, "");

    if (paperId && pdfLookup.has(paperId)) {
      return pdfLookup.get(paperId) ?? null;
    }

    if (paperIdWithoutYear && pdfLookup.has(paperIdWithoutYear)) {
      return pdfLookup.get(paperIdWithoutYear) ?? null;
    }
  }

  const fallbackPaperId = correctionRows[0]?.paper_id;
  return fallbackPaperId ? pdfLookup.get(fallbackPaperId) ?? null : null;
}

function asStudySeed(
  row: CsvRow,
  bucket: BucketName,
  sourceArtifact: string,
  summaryLookup: ReturnType<typeof buildSummaryLookup>,
  pdfLookup: Map<string, string>,
) {
  const title = row.title;
  const { summaryRow } = resolveSummaryRow(title, summaryLookup);
  const slugSuffix = createHash("sha1").update(row.record_key).digest("hex").slice(0, 8);

  return {
    recordKey: row.record_key,
    title,
    titleNormalized: normalizeTitle(title),
    studySlug: `${row.year || "undated"}-${slugFromTitle(title).slice(0, 56)}-${slugSuffix}`,
    year: safeInt(row.year),
    doi: row.doi || null,
    journal: row.journal || null,
    authors: row.authors || null,
    selectionOrigin: row.selection_origin || null,
    studyFamilySignal: row.study_family_signal || null,
    countrySetting: summaryRow?.["Country / setting"] ?? null,
    population: summaryRow?.Population ?? null,
    design: summaryRow?.Design ?? null,
    sample: summaryRow?.Sample ?? null,
    measures: summaryRow?.["Measure(s)"] ?? null,
    followUp: summaryRow?.["Follow-up"] ?? null,
    comparatorKeyNote: summaryRow?.["Comparator / key note"] ?? null,
    abstract: row.abstract || null,
    bucket,
    sourceArtifact,
    localPdfPath: bucket === "included" ? maybePdfPath(title, summaryLookup, pdfLookup) : null,
  } satisfies StudySeed;
}

export function buildRepositorySeed(): RepoSeedSnapshot {
  const documents = buildDocuments();
  const searchMarkdown = readText(artifactPath("docs", "methods", "search_strategies.md"));
  const searchQueries = groupQueries(searchMarkdown);
  const summaryLookup = buildSummaryLookup();
  const pdfLookup = buildPdfLookup();

  const studies: StudySeed[] = [];
  const counts: Record<string, number> = {};

  for (const bucketFile of CANONICAL_BUCKET_FILES) {
    const path =
      bucketFile.bucket === "included"
        ? artifactPath(
            "outputs",
            "current",
            "canonical_pdf_stage_reconciliation_2026-03-27",
            bucketFile.file,
          )
        : artifactPath("outputs", "current", "canonical_requested_buckets_2026-03-27", bucketFile.file);

    if (!existsSync(path)) {
      continue;
    }

    const rows = readCsv(path);
    counts[bucketFile.bucket] = rows.length;

    for (const row of rows) {
      studies.push(asStudySeed(row, bucketFile.bucket, path, summaryLookup, pdfLookup));
    }
  }

  const sourceHash = createHash("sha256")
    .update(JSON.stringify({
      counts,
      titles: studies.map((study) => `${study.recordKey}:${study.bucket}:${study.title}`),
    }))
    .digest("hex");

  return {
    documents,
    searchQueries,
    studies,
    counts,
    sourceHash,
  };
}
