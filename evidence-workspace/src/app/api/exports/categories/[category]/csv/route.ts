import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { BucketName } from "@/db/schema";
import { BUCKET_ORDER } from "@/lib/constants";
import { getBucketExportRows, toCsv } from "@/lib/server/export";

export async function GET(
  _request: Request,
  context: { params: Promise<{ category: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const params = await context.params;
  const category = params.category as BucketName;
  if (!BUCKET_ORDER.includes(category)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const csv = toCsv(await getBucketExportRows(category));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${category}.csv"`,
    },
  });
}
