import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getIncludedStudyExportRows, toXlsxBuffer } from "@/lib/server/export";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const buffer = toXlsxBuffer(await getIncludedStudyExportRows(), "included-studies");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="included-studies.xlsx"',
    },
  });
}
