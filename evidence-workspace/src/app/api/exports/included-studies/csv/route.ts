import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getIncludedStudyExportRows, toCsv } from "@/lib/server/export";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const csv = toCsv(await getIncludedStudyExportRows());

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="included-studies.csv"',
    },
  });
}
