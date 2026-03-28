import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { auditLog, pdfAssets } from "@/db/schema";

export async function saveUploadedPdfAsset(params: {
  studyId: string;
  blobPath: string;
  blobUrl: string;
  downloadUrl?: string;
  originalFilename: string;
  sizeBytes?: number | null;
  checksum?: string | null;
  uploadedBy?: string;
}) {
  const db = getDb();

  await db
    .update(pdfAssets)
    .set({ active: false })
    .where(and(eq(pdfAssets.studyId, params.studyId), eq(pdfAssets.active, true)));

  await db.insert(pdfAssets).values({
    studyId: params.studyId,
    blobPath: params.blobPath,
    blobUrl: params.blobUrl,
    downloadUrl: params.downloadUrl,
    originalFilename: params.originalFilename,
    sizeBytes: params.sizeBytes ?? null,
    checksum: params.checksum ?? null,
    uploadedBy: params.uploadedBy,
    active: true,
  });

  await db.insert(auditLog).values({
    entityType: "study",
    entityId: params.studyId,
    action: "study.pdf.uploaded",
    actorId: params.uploadedBy,
    afterJson: params,
  });
}
