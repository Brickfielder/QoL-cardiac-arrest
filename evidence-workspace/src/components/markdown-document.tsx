import type { ComponentPropsWithoutRef } from "react";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-6 font-[family-name:var(--font-display)] text-4xl leading-tight text-[var(--ink)]">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-12 mb-4 border-t border-[var(--line)] pt-8 font-[family-name:var(--font-display)] text-2xl leading-tight text-[var(--ink)] first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-3 font-[family-name:var(--font-display)] text-xl leading-tight text-[var(--ink)]">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="my-4 text-[15px] leading-8 text-[var(--muted-ink)]">{children}</p>,
  ul: ({ children }) => <ul className="my-5 space-y-2 pl-6 text-[15px] leading-8 text-[var(--muted-ink)]">{children}</ul>,
  ol: ({ children }) => <ol className="my-5 space-y-2 pl-6 text-[15px] leading-8 text-[var(--muted-ink)]">{children}</ol>,
  li: ({ children }) => <li className="pl-1 marker:text-[var(--accent)]">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-6 rounded-r-[1.1rem] border-l-4 border-[var(--accent)] bg-[var(--panel)] px-5 py-4 text-[15px] leading-8 text-[var(--ink)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-10 border-0 border-t border-dashed border-[var(--line-strong)]" />,
  a: ({ children, href }) => (
    <a
      href={href}
      className="font-medium text-[var(--accent)] underline decoration-[var(--line-strong)] underline-offset-4 transition hover:text-[var(--accent-strong)]"
    >
      {children}
    </a>
  ),
  img: ({ alt, src }) => {
    const imageSrc = typeof src === "string" ? src : undefined;
    if (!imageSrc) {
      return null;
    }

    return (
      // ReactMarkdown renders document-authored figures; a native img keeps markdown assets simple.
      <a
        href={imageSrc}
        target="_blank"
        rel="noreferrer"
        className="my-8 block rounded-[1.6rem] border border-[var(--line)] bg-white p-3 shadow-[0_24px_70px_-40px_rgba(39,24,22,0.45)] transition hover:border-[var(--accent)]"
        title="Open full-size figure"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt ?? ""}
          src={imageSrc}
          className="mx-auto block max-h-[82vh] h-auto w-auto max-w-full object-contain"
        />
        <span className="mt-3 block text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted-ink)]">
          Open full-size figure
        </span>
      </a>
    );
  },
  table: ({ children }) => (
    <div className="my-8 overflow-x-auto rounded-[1.2rem] border border-[var(--line)] bg-white/92">
      <table className="min-w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[var(--panel)] text-[var(--ink)]">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-[var(--line)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-t border-[var(--line)] px-4 py-3 align-top text-[var(--muted-ink)]">{children}</td>,
  pre: ({ children }) => (
    <pre className="my-6 overflow-x-auto rounded-[1.2rem] border border-[var(--line)] bg-[var(--panel)] px-5 py-4 text-sm leading-7 text-[var(--ink)]">
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }: ComponentPropsWithoutRef<"code">) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    return (
      <code
        className="rounded-md bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[0.92em] text-[var(--accent-strong)]"
        {...props}
      >
        {children}
      </code>
    );
  },
};

export function MarkdownDocument({ markdown }: { markdown: string }) {
  return (
    <article className="max-w-none text-[var(--muted-ink)]">
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
