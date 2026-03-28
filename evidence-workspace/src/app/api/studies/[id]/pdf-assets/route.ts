import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getActivePdfAsset } from "@/lib/server/repository";
import { getPrivateBlob } from "@/lib/server/blob";
import { saveUploadedPdfAsset } from "@/lib/server/pdf-assets";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const params = await context.params;
  const asset = await getActivePdfAsset(params.id);

  if (!asset) {
    return new NextResponse("PDF not found.", { status: 404 });
  }

  const blob = await getPrivateBlob(asset.blobPath);

  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return new NextResponse("Blob not found.", { status: 404 });
  }

  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType || "application/pdf",
      "Content-Disposition": `inline; filename="${asset.originalFilename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const body = await request.json();

  await saveUploadedPdfAsset({
    studyId: params.id,
    blobPath: String(body.blobPath),
    blobUrl: String(body.blobUrl),
    downloadUrl: body.downloadUrl ? String(body.downloadUrl) : undefined,
    originalFilename: String(body.originalFilename),
    sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : null,
    checksum: body.checksum ? String(body.checksum) : null,
    uploadedBy: session.user.id,
  });

  revalidatePath(`/studies/${params.id}`);
  revalidatePath(`/pdfs/${params.id}`);
  revalidatePath("/uploads");
  revalidatePath("/included-studies");

  return NextResponse.json({ ok: true });
}
