import { PageHeader } from "@/components/page-header";
import { listSearchQueries } from "@/lib/server/repository";

export default async function SearchQueriesPage() {
  const queries = await listSearchQueries();
  const groups = Array.from(
    queries.reduce((map, query) => {
      const key = query.source;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(query);
      return map;
    }, new Map<string, typeof queries>()),
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Search archive"
        title="Database and grey-literature queries"
        description="Exact query strings are preserved here so the identification stage can be audited, rerun, or adapted without reopening the old folder structure."
      />

      <div className="space-y-6">
        {groups.map(([source, items]) => (
          <section key={source} className="rounded-[1.9rem] border border-[var(--line)] bg-white/78 p-6">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">{source}</p>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">{source} search set</h2>
            </div>
            <div className="space-y-5">
              {items.map((query) => (
                <article key={query.id} className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-[var(--ink)]">{query.label}</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--muted-ink)]">
                      Family {query.queryFamily}
                    </span>
                  </div>
                  {query.notes ? <p className="mt-3 text-sm text-[var(--muted-ink)]">{query.notes}</p> : null}
                  <pre className="mt-4 overflow-x-auto rounded-[1.25rem] border border-[var(--line)] bg-[#1f1616] p-4 text-sm leading-7 text-[#f5ebda]">
                    <code>{query.queryText}</code>
                  </pre>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
