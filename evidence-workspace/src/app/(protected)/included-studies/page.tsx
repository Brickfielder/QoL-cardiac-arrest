import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { listIncludedStudies } from "@/lib/server/repository";

export default async function IncludedStudiesPage() {
  const rows = await listIncludedStudies();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Included set"
        title="Included studies table"
        description="This table mirrors the current eight-column supplementary summary structure, while keeping only the canonical included reports represented in the current PDF corpus."
        actions={
          <>
            <Link
              href="/api/exports/included-studies/csv"
              className="rounded-full border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Download CSV
            </Link>
            <Link
              href="/api/exports/included-studies/xlsx"
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Download XLSX
            </Link>
          </>
        }
      />

      <div className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-white/78">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] text-left text-sm">
            <thead className="bg-[var(--panel)] text-[var(--muted-ink)]">
              <tr>
                <th className="px-5 py-4 font-medium">Study</th>
                <th className="px-5 py-4 font-medium">Country / setting</th>
                <th className="px-5 py-4 font-medium">Population</th>
                <th className="px-5 py-4 font-medium">Design</th>
                <th className="px-5 py-4 font-medium">Sample</th>
                <th className="px-5 py-4 font-medium">Measure(s)</th>
                <th className="px-5 py-4 font-medium">Follow-up</th>
                <th className="px-5 py-4 font-medium">Comparator / key note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--line)] align-top">
                  <td className="px-5 py-4">
                    <Link href={`/studies/${row.id}`} className="font-medium text-[var(--ink)] hover:text-[var(--accent)]">
                      {row.title}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted-ink)]">{row.doi ?? ""}</p>
                  </td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.countrySetting ?? ""}</td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.population ?? ""}</td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.design ?? ""}</td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.sample ?? ""}</td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.measures ?? ""}</td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.followUp ?? ""}</td>
                  <td className="px-5 py-4 text-[var(--muted-ink)]">{row.comparatorKeyNote ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
