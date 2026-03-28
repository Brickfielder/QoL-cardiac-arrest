import Link from "next/link";
import { notFound } from "next/navigation";

import type { BucketName } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { BUCKET_ORDER } from "@/lib/constants";
import { listStudies } from "@/lib/server/repository";
import { formatBucketLabel } from "@/lib/utils";

export default async function CategoryDetailPage(props: {
  params: Promise<{ category: string }>;
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const category = params.category as BucketName;

  if (!BUCKET_ORDER.includes(category)) {
    notFound();
  }

  const query = searchParams?.q?.trim() ?? "";
  const rows = await listStudies({ bucket: category, query: query || undefined });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Category detail"
        title={formatBucketLabel(category)}
        description="Search within the current category, open individual study records, or download the active category export."
        actions={
          <>
            <Link
              href={`/api/exports/categories/${category}/csv`}
              className="rounded-full border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Download CSV
            </Link>
            <Link
              href={`/api/exports/categories/${category}/xlsx`}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Download XLSX
            </Link>
          </>
        }
      />

      <form className="rounded-[1.5rem] border border-[var(--line)] bg-white/78 p-5">
        <label htmlFor="q" className="text-sm font-medium text-[var(--ink)]">Search this category</label>
        <div className="mt-3 flex gap-3">
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="Title, DOI, population, country..."
            className="min-w-0 flex-1 rounded-full border border-[var(--line-strong)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            Apply
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-white/78">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--panel)] text-[var(--muted-ink)]">
              <tr>
                <th className="px-5 py-4 font-medium">Title</th>
                <th className="px-5 py-4 font-medium">Year</th>
                <th className="px-5 py-4 font-medium">Population</th>
                <th className="px-5 py-4 font-medium">Measure(s)</th>
                <th className="px-5 py-4 font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--line)]">
                  <td className="px-5 py-4">
                    <Link href={`/studies/${row.id}`} className="font-medium text-[var(--ink)] hover:text-[var(--accent)]">
                      {row.title}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted-ink)]">{row.doi ?? row.recordKey}</p>
                  </td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.year ?? ""}</td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.population ?? ""}</td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.measures ?? ""}</td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.hasPdf ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? (
          <p className="px-5 py-6 text-sm text-[var(--muted-ink)]">No rows matched the current filter.</p>
        ) : null}
      </div>
    </div>
  );
}
