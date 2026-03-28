import type { BucketName } from "@/db/schema";

export const BUCKET_ORDER: BucketName[] = [
  "included",
  "non_original",
  "protocol_or_ongoing",
  "wrong_population_or_scope",
  "qualitative_only",
  "no_global_qol",
  "not_retrieved",
  "duplicate_report_row",
  "duplicate_bibliographic_variant",
];

export const PROTECTED_PATHS = [
  "/dashboard",
  "/methodology",
  "/search-queries",
  "/categories",
  "/buckets",
  "/included-studies",
  "/studies",
  "/pdfs",
  "/exports",
  "/uploads",
  "/admin",
] as const;

export const APP_TITLE = "Cardiac Arrest HRQoL Workspace";
