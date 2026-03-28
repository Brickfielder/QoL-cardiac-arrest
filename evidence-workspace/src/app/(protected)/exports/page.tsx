import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { BUCKET_ORDER } from "@/lib/constants";
import { formatBucketLabel } from "@/lib/utils";

export default function ExportsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Exports"
        title="Download the active working views"
        description="Each export is generated from the live database state, so category changes and metadata edits are reflected immediately."
      />

      <section className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Included table</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Included studies</h2>
          </div>
          <div className="flex gap-3">
            <Link href="/api/exports/included-studies/csv" className="rounded-full border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)]">
              CSV
            </Link>
            <Link href="/api/exports/included-studies/xlsx" className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
              XLSX
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {BUCKET_ORDER.map((bucket) => (
          <article key={bucket} className="rounded-[1.7rem] border border-[var(--line)] bg-white/78 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Category export</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
              {formatBucketLabel(bucket)}
            </h2>
            <div className="mt-5 flex gap-3">
              <Link href={`/api/exports/categories/${bucket}/csv`} className="rounded-full border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)]">
                CSV
              </Link>
              <Link href={`/api/exports/categories/${bucket}/xlsx`} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
                XLSX
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
