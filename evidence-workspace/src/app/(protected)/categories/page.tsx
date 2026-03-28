import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { listBucketSummaries } from "@/lib/server/repository";
import { formatBucketLabel } from "@/lib/utils";

export default async function CategoriesPage() {
  const categories = await listBucketSummaries();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Category browser"
        title="Canonical inclusion and exclusion categories"
        description="These categories are the working decision surface for the database. Each category can be searched, exported, and revised at the individual-study level."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((item) => (
          <Link
            key={item.bucket}
            href={`/categories/${item.bucket}`}
            className="rounded-[1.7rem] border border-[var(--line)] bg-white/78 p-6 transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Category</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
              {formatBucketLabel(item.bucket)}
            </h2>
            <p className="mt-4 text-sm text-[var(--muted-ink)]">Open records, inspect metadata, and export the current view.</p>
            <p className="mt-6 font-[family-name:var(--font-display)] text-5xl text-[var(--ink)]">{item.total}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
