import { DocumentEditor } from "@/components/document-editor";
import { MarkdownDocument } from "@/components/markdown-document";
import { PageHeader } from "@/components/page-header";
import { requirePageSession } from "@/lib/server/page-session";
import { getDocumentBySlug } from "@/lib/server/repository";

export default async function MethodologyPage() {
  const session = await requirePageSession();
  const methodology = await getDocumentBySlug("methodology");
  const background = await getDocumentBySlug("project-background");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Methodology"
        title="Why the review exists and how the evidence was assembled"
        description="This page combines the theoretical rationale, search-to-screening narrative, and the current process reconstruction in one place so the project logic stays portable."
      />

      {background ? (
        <section className="rounded-[1.9rem] border border-[var(--line)] bg-white/78 p-6">
          <MarkdownDocument markdown={background.markdown} />
        </section>
      ) : null}

      <section className="rounded-[1.9rem] border border-[var(--line)] bg-white/78 p-6">
        {methodology ? (
          <MarkdownDocument markdown={methodology.markdown} />
        ) : (
          <p className="text-sm text-[var(--muted-ink)]">No methodology document has been imported yet.</p>
        )}
      </section>

      {methodology && session.user.role === "admin" ? (
        <section className="rounded-[1.9rem] border border-[var(--line)] bg-white/78 p-6">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Admin editor</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Edit methodology</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-ink)]">
              Changes here update the live methodology document shown in the workspace. The editor now includes a live formatted preview so section structure and spacing are easier to control while writing.
            </p>
          </div>
          <DocumentEditor slug={methodology.slug} initialMarkdown={methodology.markdown} />
        </section>
      ) : null}
    </div>
  );
}
