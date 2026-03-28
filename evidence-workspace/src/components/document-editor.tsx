"use client";

import { useState } from "react";

import { updateDocumentMarkdownAction } from "@/lib/server/actions";
import { MarkdownDocument } from "@/components/markdown-document";

type DocumentEditorProps = {
  slug: string;
  initialMarkdown: string;
};

export function DocumentEditor({ slug, initialMarkdown }: DocumentEditorProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown);

  return (
    <form action={updateDocumentMarkdownAction} className="space-y-6 pb-28">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.6rem] border border-[var(--line)] bg-[var(--panel)] p-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Editor</p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">Markdown source</h3>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-ink)]">
              {markdown.split("\n").length} lines
            </p>
          </div>

          <textarea
            name="markdown"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            spellCheck={false}
            rows={28}
            className="min-h-[760px] w-full rounded-[1.2rem] border border-[var(--line-strong)] bg-[#fffdfa] px-5 py-5 font-mono text-[13px] leading-7 text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          />

          <div className="mt-4 rounded-[1.2rem] border border-[var(--line)] bg-white/80 px-4 py-3 text-sm leading-7 text-[var(--muted-ink)]">
            Use Markdown headings, lists, code ticks, and blockquotes. The preview on the right reflects spacing and section hierarchy live before saving.
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-[var(--line)] bg-white/82 p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Preview</p>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">Formatted document</h3>
          </div>
          <div className="min-h-[760px] rounded-[1.2rem] border border-[var(--line)] bg-[#fffdfa] p-6">
            <MarkdownDocument markdown={markdown} />
          </div>
        </section>
      </div>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <div className="rounded-full border border-[var(--line)] bg-white/92 p-2 shadow-[0_16px_40px_-22px_rgba(39,24,22,0.45)] backdrop-blur">
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            Save methodology
          </button>
        </div>
      </div>
    </form>
  );
}
