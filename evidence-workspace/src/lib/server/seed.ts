import { statSync } from "node:fs";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  bucketAssignments,
  documents,
  imports,
  pdfAssets,
  searchQueries,
  studies,
} from "@/db/schema";
import { buildRepositorySeed } from "@/lib/repo-artifacts";
import { checksumForFile, uploadLocalPdfToBlob } from "@/lib/server/blob";
import { saveUploadedPdfAsset } from "@/lib/server/pdf-assets";
import { slugFromTitle } from "@/lib/utils";

export async function syncRepositorySeed(importedBy?: string) {
  const snapshot = buildRepositorySeed();
  const db = getDb();

  for (const document of snapshot.documents) {
    await db
      .insert(documents)
      .values({
        slug: document.slug,
        title: document.title,
        markdown: document.markdown,
        documentType: document.documentType,
        updatedBy: importedBy,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: documents.slug,
        set: {
          title: document.title,
          markdown: document.markdown,
          documentType: document.documentType,
          updatedBy: importedBy,
          updatedAt: new Date(),
        },
      });
  }

  await db.delete(searchQueries);
  if (snapshot.searchQueries.length) {
    await db.insert(searchQueries).values(snapshot.searchQueries);
  }

  for (const study of snapshot.studies) {
    const [upserted] = await db
      .insert(studies)
      .values({
        recordKey: study.recordKey,
        title: study.title,
        titleNormalized: study.titleNormalized,
        studySlug: study.studySlug,
        year: study.year,
        doi: study.doi,
        journal: study.journal,
        authors: study.authors,
        selectionOrigin: study.selectionOrigin,
        studyFamilySignal: study.studyFamilySignal,
        countrySetting: study.countrySetting,
        population: study.population,
        design: study.design,
        sample: study.sample,
        measures: study.measures,
        followUp: study.followUp,
        comparatorKeyNote: study.comparatorKeyNote,
        abstract: study.abstract,
        sourceArtifact: study.sourceArtifact,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: studies.recordKey,
        set: {
          title: study.title,
          titleNormalized: study.titleNormalized,
          studySlug: study.studySlug,
          year: study.year,
          doi: study.doi,
          journal: study.journal,
          authors: study.authors,
          selectionOrigin: study.selectionOrigin,
          studyFamilySignal: study.studyFamilySignal,
          countrySetting: study.countrySetting,
          population: study.population,
          design: study.design,
          sample: study.sample,
          measures: study.measures,
          followUp: study.followUp,
          comparatorKeyNote: study.comparatorKeyNote,
          abstract: study.abstract,
          sourceArtifact: study.sourceArtifact,
          updatedAt: new Date(),
        },
      })
      .returning({ id: studies.id, title: studies.title });

    await db
      .insert(bucketAssignments)
      .values({
        studyId: upserted.id,
        currentBucket: study.bucket,
        rationale: `Seeded from ${study.sourceArtifact}`,
        changedBy: importedBy,
        changedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: bucketAssignments.studyId,
        set: {
          currentBucket: study.bucket,
          rationale: `Seeded from ${study.sourceArtifact}`,
          changedBy: importedBy,
          changedAt: new Date(),
        },
      });

    if (study.localPdfPath && process.env.BLOB_READ_WRITE_TOKEN) {
      const checksum = checksumForFile(study.localPdfPath);
      const existing = await db
        .select()
        .from(pdfAssets)
        .where(and(eq(pdfAssets.studyId, upserted.id), eq(pdfAssets.checksum, checksum)))
        .limit(1);

      if (!existing.length) {
        const pathname = `studies/${upserted.id}/${slugFromTitle(upserted.title)}.pdf`;
        const uploaded = await uploadLocalPdfToBlob(pathname, study.localPdfPath);

        await saveUploadedPdfAsset({
          studyId: upserted.id,
          blobPath: uploaded.pathname,
          blobUrl: uploaded.url,
          downloadUrl: uploaded.downloadUrl,
          checksum,
          sizeBytes: statSync(study.localPdfPath).size,
          originalFilename:
            study.localPdfPath.split(/[\\/]/).pop() ?? `${slugFromTitle(upserted.title)}.pdf`,
          uploadedBy: importedBy,
        });
      }
    }
  }

  await db.insert(imports).values({
    sourceName: "repo-artifacts",
    sourceHash: snapshot.sourceHash,
    importedBy,
    rowCount: snapshot.studies.length,
    notes: JSON.stringify(snapshot.counts),
  });

  return snapshot;
}
