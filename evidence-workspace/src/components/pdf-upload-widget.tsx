"use client";

import { useMemo, useState, startTransition } from "react";
import { upload } from "@vercel/blob/client";

type PdfUploadWidgetProps = {
  studyId: string;
  studyTitle: string;
};

function slugifyFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function PdfUploadWidget({ studyId, studyTitle }: PdfUploadWidgetProps) {
  const [status, setStatus] = useState<string>("Upload a PDF to attach or replace the active file.");
  const [progress, setProgress] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const suggestedName = useMemo(() => slugifyFilename(studyTitle), [studyTitle]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setStatus("Only PDF files are supported.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setStatus("Uploading PDF to private storage...");

    try {
      const pathname = `studies/${studyId}/${Date.now()}-${suggestedName || "study"}.pdf`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({ studyId }),
        multipart: true,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });

      setStatus("Recording upload in the workspace...");

      const checksum = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const checksumHex = Array.from(new Uint8Array(checksum))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      const response = await fetch(`/api/studies/${studyId}/pdf-assets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blobPath: blob.pathname,
          blobUrl: blob.url,
          downloadUrl: blob.downloadUrl,
          originalFilename: file.name,
          sizeBytes: file.size,
          checksum: checksumHex,
        }),
      });

      if (!response.ok) {
        throw new Error("Upload saved to storage, but the database update failed.");
      }

      setStatus("PDF attached successfully.");
      startTransition(() => {
        window.location.reload();
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-dashed border-[var(--line-strong)] bg-[var(--panel)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--ink)]">PDF asset</p>
          <p className="text-sm leading-6 text-[var(--muted-ink)]">{status}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_42px_-28px_rgba(122,38,39,0.85)] transition hover:bg-[var(--accent-strong)]">
          {busy ? "Uploading..." : "Upload or replace PDF"}
          <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} disabled={busy} />
        </label>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
