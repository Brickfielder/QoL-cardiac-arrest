import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { BucketName } from "@/db/schema";
import { BUCKET_ORDER } from "@/lib/constants";
import { getBucketExportRows, toCsv } from "@/lib/server/export";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bucket: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const params = await context.params;
  const bucket = params.bucket as BucketName;
  if (!BUCKET_ORDER.includes(bucket)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const csv = toCsv(await getBucketExportRows(bucket));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${bucket}.csv"`,
    },
  });
}
