import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "editor"]);
export const bucketEnum = pgEnum("bucket_name", [
  "included",
  "non_original",
  "protocol_or_ongoing",
  "wrong_population_or_scope",
  "qualitative_only",
  "no_global_qol",
  "not_retrieved",
  "duplicate_report_row",
  "duplicate_bibliographic_variant",
]);
export const documentTypeEnum = pgEnum("document_type", [
  "methodology",
  "project_background",
  "process_note",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("editor"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailUnique: uniqueIndex("users_email_unique").on(table.email),
}));

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  markdown: text("markdown").notNull(),
  documentType: documentTypeEnum("document_type").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugUnique: uniqueIndex("documents_slug_unique").on(table.slug),
}));

export const searchQueries = pgTable("search_queries", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(),
  queryFamily: text("query_family").notNull(),
  label: text("label").notNull(),
  queryText: text("query_text").notNull(),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studies = pgTable("studies", {
  id: uuid("id").defaultRandom().primaryKey(),
  recordKey: text("record_key").notNull(),
  title: text("title").notNull(),
  titleNormalized: text("title_normalized").notNull(),
  studySlug: text("study_slug").notNull(),
  year: integer("year"),
  doi: text("doi"),
  journal: text("journal"),
  authors: text("authors"),
  selectionOrigin: text("selection_origin"),
  studyFamilySignal: text("study_family_signal"),
  countrySetting: text("country_setting"),
  population: text("population"),
  design: text("design"),
  sample: text("sample"),
  measures: text("measures"),
  followUp: text("follow_up"),
  comparatorKeyNote: text("comparator_key_note"),
  abstract: text("abstract"),
  sourceArtifact: text("source_artifact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  recordKeyUnique: uniqueIndex("studies_record_key_unique").on(table.recordKey),
  slugUnique: uniqueIndex("studies_slug_unique").on(table.studySlug),
}));

export const bucketAssignments = pgTable("bucket_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  studyId: uuid("study_id").notNull().references(() => studies.id, { onDelete: "cascade" }),
  currentBucket: bucketEnum("current_bucket").notNull(),
  rationale: text("rationale"),
  changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  studyUnique: uniqueIndex("bucket_assignments_study_unique").on(table.studyId),
}));

export const pdfAssets = pgTable("pdf_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  studyId: uuid("study_id").notNull().references(() => studies.id, { onDelete: "cascade" }),
  blobPath: text("blob_path").notNull(),
  blobUrl: text("blob_url").notNull(),
  downloadUrl: text("download_url"),
  checksum: text("checksum"),
  sizeBytes: integer("size_bytes"),
  originalFilename: text("original_filename").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
}, (table) => ({
  blobUnique: uniqueIndex("pdf_assets_blob_path_unique").on(table.blobPath),
}));

export const studyNotes = pgTable("study_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  studyId: uuid("study_id").notNull().references(() => studies.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  beforeJson: jsonb("before_json"),
  afterJson: jsonb("after_json"),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const imports = pgTable("imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceName: text("source_name").notNull(),
  sourceHash: text("source_hash"),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  importedBy: uuid("imported_by").references(() => users.id, { onDelete: "set null" }),
  rowCount: integer("row_count").notNull().default(0),
  notes: text("notes"),
});

export type BucketName = (typeof bucketEnum.enumValues)[number];
export type UserRole = (typeof userRoleEnum.enumValues)[number];
