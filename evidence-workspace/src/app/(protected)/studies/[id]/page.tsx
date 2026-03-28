import Link from "next/link";
import { notFound } from "next/navigation";

import { PdfUploadWidget } from "@/components/pdf-upload-widget";
import { PageHeader } from "@/components/page-header";
import { BUCKET_ORDER } from "@/lib/constants";
import { addStudyNoteAction, updateStudyBucketAction, updateStudyMetadataAction } from "@/lib/server/actions";
import { getStudyDetail } from "@/lib/server/repository";
import { formatBucketLabel } from "@/lib/utils";

export default async function StudyDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const detail = await getStudyDetail(params.id);

  if (!detail) {
    notFound();
  }

  const { study, notes, history } = detail;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Study detail"
        title={study.title}
        description="Edit the metadata, move the study between canonical categories, add notes, and manage the attached PDF asset."
        actions={
          study.pdfId ? (
            <Link
              href={`/pdfs/${study.id}`}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Open PDF
            </Link>
          ) : undefined
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-ink)]">DOI</p>
                <p className="mt-2 text-sm text-[var(--ink)]">{study.doi ?? "Not recorded"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-ink)]">Current category</p>
                <p className="mt-2 text-sm text-[var(--ink)]">{study.bucket ? formatBucketLabel(study.bucket) : "Unassigned"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-ink)]">Selection origin</p>
                <p className="mt-2 text-sm text-[var(--ink)]">{study.selectionOrigin ?? "Not recorded"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-ink)]">Study family signal</p>
                <p className="mt-2 text-sm text-[var(--ink)]">{study.studyFamilySignal ?? "Not recorded"}</p>
              </div>
            </div>
          </div>

          <form action={updateStudyMetadataAction} className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
            <input type="hidden" name="studyId" value={study.id} />
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Editable study summary</p>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Metadata</h2>
            </div>
            <div className="grid gap-4">
              {[
                { name: "countrySetting", label: "Country / setting", value: study.countrySetting },
                { name: "population", label: "Population", value: study.population },
                { name: "design", label: "Design", value: study.design },
                { name: "sample", label: "Sample", value: study.sample },
                { name: "measures", label: "Measure(s)", value: study.measures },
                { name: "followUp", label: "Follow-up", value: study.followUp },
                { name: "comparatorKeyNote", label: "Comparator / key note", value: study.comparatorKeyNote },
              ].map(({ name, label, value }) => (
                <div key={name} className="space-y-2">
                  <label htmlFor={name} className="text-sm font-medium text-[var(--ink)]">
                    {label}
                  </label>
                  <textarea
                    id={name}
                    name={name}
                    defaultValue={value ?? ""}
                    rows={name === "sample" || name === "comparatorKeyNote" ? 4 : 2}
                    className="w-full rounded-[1.2rem] border border-[var(--line-strong)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Save metadata
            </button>
          </form>

          <form action={addStudyNoteAction} className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
            <input type="hidden" name="studyId" value={study.id} />
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Notes</p>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Add a study note</h2>
            </div>
            <textarea
              name="body"
              rows={5}
              className="w-full rounded-[1.2rem] border border-[var(--line-strong)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              placeholder="Record rationale, uncertainties, or reviewer observations."
            />
            <button
              type="submit"
              className="mt-6 rounded-full border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Save note
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <form action={updateStudyBucketAction} className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
            <input type="hidden" name="studyId" value={study.id} />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Category assignment</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Current placement</h2>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <label htmlFor="bucket" className="text-sm font-medium text-[var(--ink)]">
                  Category
                </label>
                <select
                  id="bucket"
                  name="bucket"
                  defaultValue={study.bucket ?? "included"}
                  className="w-full rounded-full border border-[var(--line-strong)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                >
                  {BUCKET_ORDER.map((bucket) => (
                    <option key={bucket} value={bucket}>
                      {formatBucketLabel(bucket)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="rationale" className="text-sm font-medium text-[var(--ink)]">
                  Rationale
                </label>
                <textarea
                  id="rationale"
                  name="rationale"
                  defaultValue={study.bucketRationale ?? ""}
                  rows={4}
                  className="w-full rounded-[1.2rem] border border-[var(--line-strong)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Update category
            </button>
          </form>

          <PdfUploadWidget studyId={study.id} studyTitle={study.title} />

          <div className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Active PDF</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Asset status</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-ink)]">
              {study.pdfFilename ? `Current file: ${study.pdfFilename}` : "No PDF is currently attached to this record."}
            </p>
            {study.pdfFilename ? (
              <Link href={`/pdfs/${study.id}`} className="mt-5 inline-flex text-sm font-medium text-[var(--accent)]">
                View the authenticated PDF route
              </Link>
            ) : null}
          </div>

          <div className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Notes</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Reviewer log</h2>
            <div className="mt-5 space-y-4">
              {notes.length ? (
                notes.map((note) => (
                  <article key={note.id} className="rounded-[1.3rem] border border-[var(--line)] bg-[var(--panel)] p-4">
                    <p className="text-sm leading-7 text-[var(--ink)]">{note.body}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted-ink)]">
                      {note.userEmail ?? "Unknown user"} · {note.createdAt.toUTCString()}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-[var(--muted-ink)]">No notes recorded yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-[var(--line)] bg-white/78 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Audit history</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Recent actions</h2>
            <div className="mt-5 space-y-4">
              {history.length ? (
                history.map((entry) => (
                  <article key={entry.id} className="rounded-[1.3rem] border border-[var(--line)] bg-[var(--panel)] p-4">
                    <p className="text-sm font-medium text-[var(--ink)]">{entry.action}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted-ink)]">{entry.createdAt.toUTCString()}</p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-[var(--muted-ink)]">No audit entries recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
