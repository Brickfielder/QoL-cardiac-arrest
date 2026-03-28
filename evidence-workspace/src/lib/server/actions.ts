"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { auditLog, bucketAssignments, documents, studies, studyNotes, type BucketName } from "@/db/schema";
import { saveUploadedPdfAsset } from "@/lib/server/pdf-assets";

async function requireEditorSession() {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return session;
}

async function requireAdminSession() {
  const session = await requireEditorSession();

  if (session.user.role !== "admin") {
    throw new Error("Admin access required.");
  }

  return session;
}

async function insertAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
}) {
  const db = getDb();
  await db.insert(auditLog).values({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    actorId: params.actorId,
    beforeJson: params.beforeJson,
    afterJson: params.afterJson,
  });
}

export async function updateStudyMetadataAction(formData: FormData) {
  const session = await requireEditorSession();
  const studyId = String(formData.get("studyId"));
  const payload = {
    countrySetting: String(formData.get("countrySetting") ?? ""),
    population: String(formData.get("population") ?? ""),
    design: String(formData.get("design") ?? ""),
    sample: String(formData.get("sample") ?? ""),
    measures: String(formData.get("measures") ?? ""),
    followUp: String(formData.get("followUp") ?? ""),
    comparatorKeyNote: String(formData.get("comparatorKeyNote") ?? ""),
  };

  const db = getDb();
  const [before] = await db.select().from(studies).where(eq(studies.id, studyId)).limit(1);

  await db.update(studies).set({ ...payload, updatedAt: new Date() }).where(eq(studies.id, studyId));
  await insertAudit({
    entityType: "study",
    entityId: studyId,
    action: "study.metadata.updated",
    actorId: session.user.id,
    beforeJson: before,
    afterJson: payload,
  });

  revalidatePath(`/studies/${studyId}`);
  revalidatePath("/included-studies");
}

export async function updateStudyBucketAction(formData: FormData) {
  const session = await requireEditorSession();
  const studyId = String(formData.get("studyId"));
  const bucket = String(formData.get("bucket")) as BucketName;
  const rationale = String(formData.get("rationale") ?? "");

  const db = getDb();
  const [before] = await db
    .select()
    .from(bucketAssignments)
    .where(eq(bucketAssignments.studyId, studyId))
    .limit(1);

  await db
    .insert(bucketAssignments)
    .values({
      studyId,
      currentBucket: bucket,
      rationale,
      changedBy: session.user.id,
      changedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: bucketAssignments.studyId,
      set: {
        currentBucket: bucket,
        rationale,
        changedBy: session.user.id,
        changedAt: new Date(),
      },
    });

  await insertAudit({
    entityType: "study",
    entityId: studyId,
    action: "study.bucket.updated",
    actorId: session.user.id,
    beforeJson: before,
    afterJson: { bucket, rationale },
  });

  revalidatePath(`/studies/${studyId}`);
  revalidatePath("/categories");
  revalidatePath("/buckets");
  revalidatePath("/included-studies");
}

export async function addStudyNoteAction(formData: FormData) {
  const session = await requireEditorSession();
  const studyId = String(formData.get("studyId"));
  const body = String(formData.get("body") ?? "").trim();

  if (!body) {
    return;
  }

  const db = getDb();
  await db.insert(studyNotes).values({
    studyId,
    body,
    createdBy: session.user.id,
  });

  await insertAudit({
    entityType: "study",
    entityId: studyId,
    action: "study.note.created",
    actorId: session.user.id,
    afterJson: { body },
  });

  revalidatePath(`/studies/${studyId}`);
}

export async function updateDocumentMarkdownAction(formData: FormData) {
  const session = await requireAdminSession();
  const slug = String(formData.get("slug") ?? "").trim();
  const markdown = String(formData.get("markdown") ?? "");

  if (!slug) {
    throw new Error("Document slug is required.");
  }

  const db = getDb();
  const [before] = await db.select().from(documents).where(eq(documents.slug, slug)).limit(1);

  if (!before) {
    throw new Error("Document not found.");
  }

  await db
    .update(documents)
    .set({
      markdown,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(documents.slug, slug));

  await insertAudit({
    entityType: "document",
    entityId: before.id,
    action: "document.markdown.updated",
    actorId: session.user.id,
    beforeJson: { markdown: before.markdown, slug: before.slug },
    afterJson: { markdown, slug },
  });

  revalidatePath("/methodology");
}

export async function persistUploadedPdfAction(input: {
  studyId: string;
  blobPath: string;
  blobUrl: string;
  downloadUrl?: string;
  originalFilename: string;
  sizeBytes?: number;
  checksum?: string;
}) {
  const session = await requireEditorSession();
  await saveUploadedPdfAsset({
    ...input,
    uploadedBy: session.user.id,
  });

  revalidatePath(`/studies/${input.studyId}`);
  revalidatePath("/uploads");
  revalidatePath(`/pdfs/${input.studyId}`);
  revalidatePath("/included-studies");
}
