import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { get, put } from "@vercel/blob";

import { requireEnv } from "@/lib/env";

export function checksumForFile(path: string) {
  const buffer = readFileSync(path);
  return createHash("sha256").update(buffer).digest("hex");
}

export async function uploadLocalPdfToBlob(pathname: string, filePath: string) {
  const token = requireEnv("BLOB_READ_WRITE_TOKEN");
  const body = readFileSync(filePath);

  return put(pathname, body, {
    access: "private",
    contentType: "application/pdf",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
    cacheControlMaxAge: 60,
  });
}

export async function getPrivateBlob(pathname: string) {
  const token = requireEnv("BLOB_READ_WRITE_TOKEN");
  return get(pathname, {
    access: "private",
    token,
    useCache: false,
  });
}
