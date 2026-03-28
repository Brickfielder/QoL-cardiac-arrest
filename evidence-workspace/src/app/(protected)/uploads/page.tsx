import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { listStudiesMissingPdf } from "@/lib/server/repository";
import { formatBucketLabel } from "@/lib/utils";

export default async function UploadsPage() {
  const missing = await listStudiesMissingPdf();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Uploads"
        title="PDF upload coverage"
        description="Editors and admins can attach or replace PDFs from the study detail page. This view highlights the remaining PDF gaps within the not retrieved category."
      />

      <section>
        <div className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Missing active PDF</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Not retrieved studies</h2>
          <div className="mt-5 space-y-3">
            {missing.length ? (
              missing.map((row) => (
                <Link
                  key={row.id}
                  href={`/studies/${row.id}`}
                  className="block rounded-[1.3rem] border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent)]"
                >
                  <p className="font-medium text-[var(--ink)]">{row.title}</p>
                  <p className="mt-2 text-sm text-[var(--muted-ink)]">
                    {row.bucket ? formatBucketLabel(row.bucket) : "Unassigned"} {row.year ? `· ${row.year}` : ""}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-[var(--muted-ink)]">No studies remain in the not retrieved category without an active PDF.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
