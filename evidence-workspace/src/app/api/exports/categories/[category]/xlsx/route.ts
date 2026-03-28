import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { BucketName } from "@/db/schema";
import { BUCKET_ORDER } from "@/lib/constants";
import { getBucketExportRows, toXlsxBuffer } from "@/lib/server/export";

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

  const buffer = toXlsxBuffer(await getBucketExportRows(category), category);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${category}.xlsx"`,
    },
  });
}
