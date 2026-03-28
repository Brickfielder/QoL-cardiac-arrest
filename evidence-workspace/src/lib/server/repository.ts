import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  auditLog,
  bucketAssignments,
  documents,
  imports,
  pdfAssets,
  searchQueries,
  studies,
  studyNotes,
  type BucketName,
  users,
} from "@/db/schema";

export async function getDashboardSnapshot() {
  const db = getDb();
  const bucketCounts = await db
    .select({
      bucket: bucketAssignments.currentBucket,
      total: count(bucketAssignments.id),
    })
    .from(bucketAssignments)
    .groupBy(bucketAssignments.currentBucket)
    .orderBy(bucketAssignments.currentBucket);

  const [docCount] = await db.select({ total: count(documents.id) }).from(documents);
  const [studyCount] = await db.select({ total: count(studies.id) }).from(studies);
  const [pdfCount] = await db
    .select({ total: count(pdfAssets.id) })
    .from(pdfAssets)
    .where(eq(pdfAssets.active, true));
  const recentImports = await db.select().from(imports).orderBy(desc(imports.importedAt)).limit(5);

  return {
    bucketCounts,
    docCount: docCount?.total ?? 0,
    studyCount: studyCount?.total ?? 0,
    pdfCount: pdfCount?.total ?? 0,
    recentImports,
  };
}

export async function getDocumentBySlug(slug: string) {
  const db = getDb();
  const [document] = await db.select().from(documents).where(eq(documents.slug, slug)).limit(1);
  return document ?? null;
}

export async function listSearchQueries() {
  const db = getDb();
  return db.select().from(searchQueries).orderBy(asc(searchQueries.sortOrder), asc(searchQueries.label));
}

export async function listBucketSummaries() {
  const db = getDb();
  return db
    .select({
      bucket: bucketAssignments.currentBucket,
      total: count(bucketAssignments.id),
    })
    .from(bucketAssignments)
    .groupBy(bucketAssignments.currentBucket)
    .orderBy(bucketAssignments.currentBucket);
}

export async function listStudies(options?: { bucket?: BucketName; query?: string }) {
  const db = getDb();
  const filters = [];

  if (options?.bucket) {
    filters.push(eq(bucketAssignments.currentBucket, options.bucket));
  }

  if (options?.query) {
    const term = `%${options.query}%`;
    filters.push(
      or(
        ilike(studies.title, term),
        ilike(studies.doi, term),
        ilike(studies.countrySetting, term),
        ilike(studies.population, term),
      ),
    );
  }

  return db
    .select({
      id: studies.id,
      recordKey: studies.recordKey,
      title: studies.title,
      year: studies.year,
      doi: studies.doi,
      bucket: bucketAssignments.currentBucket,
      population: studies.population,
      measures: studies.measures,
      countrySetting: studies.countrySetting,
      hasPdf: sql<boolean>`case when ${pdfAssets.id} is null then false else true end`,
    })
    .from(studies)
    .leftJoin(bucketAssignments, eq(bucketAssignments.studyId, studies.id))
    .leftJoin(pdfAssets, and(eq(pdfAssets.studyId, studies.id), eq(pdfAssets.active, true)))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(studies.year), asc(studies.title));
}

export async function getStudyDetail(studyId: string) {
  const db = getDb();
  const [study] = await db
    .select({
      id: studies.id,
      recordKey: studies.recordKey,
      title: studies.title,
      year: studies.year,
      doi: studies.doi,
      journal: studies.journal,
      authors: studies.authors,
      selectionOrigin: studies.selectionOrigin,
      studyFamilySignal: studies.studyFamilySignal,
      countrySetting: studies.countrySetting,
      population: studies.population,
      design: studies.design,
      sample: studies.sample,
      measures: studies.measures,
      followUp: studies.followUp,
      comparatorKeyNote: studies.comparatorKeyNote,
      abstract: studies.abstract,
      bucket: bucketAssignments.currentBucket,
      bucketRationale: bucketAssignments.rationale,
      pdfId: pdfAssets.id,
      pdfFilename: pdfAssets.originalFilename,
      pdfPath: pdfAssets.blobPath,
    })
    .from(studies)
    .leftJoin(bucketAssignments, eq(bucketAssignments.studyId, studies.id))
    .leftJoin(pdfAssets, and(eq(pdfAssets.studyId, studies.id), eq(pdfAssets.active, true)))
    .where(eq(studies.id, studyId))
    .limit(1);

  if (!study) {
    return null;
  }

  const notes = await db
    .select({
      id: studyNotes.id,
      body: studyNotes.body,
      createdAt: studyNotes.createdAt,
      userEmail: users.email,
    })
    .from(studyNotes)
    .leftJoin(users, eq(users.id, studyNotes.createdBy))
    .where(eq(studyNotes.studyId, studyId))
    .orderBy(desc(studyNotes.createdAt));

  const history = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityId, studyId), eq(auditLog.entityType, "study")))
    .orderBy(desc(auditLog.createdAt))
    .limit(20);

  return { study, notes, history };
}

export async function listIncludedStudies() {
  const db = getDb();
  return db
    .select({
      id: studies.id,
      title: studies.title,
      year: studies.year,
      countrySetting: studies.countrySetting,
      population: studies.population,
      design: studies.design,
      sample: studies.sample,
      measures: studies.measures,
      followUp: studies.followUp,
      comparatorKeyNote: studies.comparatorKeyNote,
      doi: studies.doi,
      hasPdf: sql<boolean>`case when ${pdfAssets.id} is null then false else true end`,
    })
    .from(studies)
    .leftJoin(bucketAssignments, eq(bucketAssignments.studyId, studies.id))
    .leftJoin(pdfAssets, and(eq(pdfAssets.studyId, studies.id), eq(pdfAssets.active, true)))
    .where(eq(bucketAssignments.currentBucket, "included"))
    .orderBy(asc(studies.year), asc(studies.title));
}

export async function listStudiesMissingPdf() {
  const db = getDb();
  return db
    .select({
      id: studies.id,
      title: studies.title,
      year: studies.year,
      bucket: bucketAssignments.currentBucket,
    })
    .from(studies)
    .leftJoin(bucketAssignments, eq(bucketAssignments.studyId, studies.id))
    .leftJoin(pdfAssets, and(eq(pdfAssets.studyId, studies.id), eq(pdfAssets.active, true)))
    .where(and(eq(bucketAssignments.currentBucket, "not_retrieved"), sql`${pdfAssets.id} is null`))
    .orderBy(asc(studies.year), asc(studies.title));
}

export async function getActivePdfAsset(studyId: string) {
  const db = getDb();
  const [asset] = await db
    .select()
    .from(pdfAssets)
    .where(and(eq(pdfAssets.studyId, studyId), eq(pdfAssets.active, true)))
    .limit(1);

  return asset ?? null;
}

export async function listImports() {
  const db = getDb();
  return db.select().from(imports).orderBy(desc(imports.importedAt));
}

export async function listUsers() {
  const db = getDb();
  return db.select().from(users).orderBy(asc(users.email));
}
