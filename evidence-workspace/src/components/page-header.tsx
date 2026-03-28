import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, className, actions }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="max-w-3xl space-y-3">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
          {title}
        </h1>
        {description ? <p className="max-w-2xl text-sm leading-7 text-[var(--muted-ink)] sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
