import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : null;
        const studyId = payload?.studyId;

        if (!studyId || typeof studyId !== "string") {
          throw new Error("Missing study id.");
        }

        if (!pathname.startsWith(`studies/${studyId}/`)) {
          throw new Error("Pathname does not match requested study.");
        }

        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 600 * 1024 * 1024,
          validUntil: Date.now() + 1000 * 60 * 30,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload initialization failed." },
      { status: 400 },
    );
  }
}
