import { PageHeader } from "@/components/page-header";
import { runRepositoryImportAction } from "@/lib/server/admin-actions";
import { requirePageSession } from "@/lib/server/page-session";
import { listImports, listUsers } from "@/lib/server/repository";

export default async function AdminImportsPage() {
  await requirePageSession("admin");
  const [imports, users] = await Promise.all([listImports(), listUsers()]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Imports and user management"
        description="Admins can rerun the repository import, inspect sync history, and confirm which accounts currently have access."
      />

      <section className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Repository seed</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Run import</h2>
          </div>
          <form
            action={async () => {
              "use server";
              await runRepositoryImportAction();
            }}
          >
            <button
              type="submit"
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Sync repo artifacts
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Import history</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Recorded runs</h2>
          <div className="mt-5 space-y-3">
            {imports.length ? (
              imports.map((item) => (
                <article key={item.id} className="rounded-[1.3rem] border border-[var(--line)] bg-[var(--panel)] p-4">
                  <p className="font-medium text-[var(--ink)]">{item.sourceName}</p>
                  <p className="mt-2 text-sm text-[var(--muted-ink)]">{item.importedAt.toUTCString()}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted-ink)]">{item.rowCount} rows</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-[var(--muted-ink)]">No imports have been run yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Users</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Active access list</h2>
          <div className="mt-5 space-y-3">
            {users.map((user) => (
              <article key={user.id} className="rounded-[1.3rem] border border-[var(--line)] bg-[var(--panel)] p-4">
                <p className="font-medium text-[var(--ink)]">{user.email}</p>
                <p className="mt-2 text-sm text-[var(--muted-ink)]">{user.role}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted-ink)]">
                  {user.active ? "Active" : "Inactive"}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
