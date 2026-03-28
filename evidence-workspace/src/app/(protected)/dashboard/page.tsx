import Link from "next/link";

import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { getDashboardSnapshot } from "@/lib/server/repository";
import { formatBucketLabel } from "@/lib/utils";

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Workspace overview"
        title="Research operations at a glance"
        description="The workspace keeps the canonical study categories, methodology archive, query library, and PDF corpus aligned so both collaborators can curate from the same source of truth."
        actions={
          <>
            <Link
              href="/included-studies"
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Review included studies
            </Link>
            <Link
              href="/uploads"
              className="rounded-full border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Inspect uploads
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Tracked studies" value={snapshot.studyCount} detail="Canonical rows currently loaded into Neon." />
        <MetricCard label="Active PDFs" value={snapshot.pdfCount} detail="Active private blob assets linked to study records." />
        <MetricCard label="Documents" value={snapshot.docCount} detail="Methodology and process documents available in-app." />
      </section>

      <section className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Canonical categories</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Current distribution</h2>
          </div>
          <Link href="/categories" className="text-sm font-medium text-[var(--accent)]">
            Open all categories
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot.bucketCounts.map((item) => (
            <Link
              key={item.bucket}
              href={`/categories/${item.bucket}`}
              className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--panel)] px-4 py-4 transition hover:border-[var(--accent)]"
            >
              <p className="text-sm text-[var(--muted-ink)]">{formatBucketLabel(item.bucket)}</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">{item.total}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
